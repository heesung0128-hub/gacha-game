/**
 * =========================================================================
 * FIREBASE CONFIGURATION BLOCK
 * =========================================================================
 * 다중 기기 실시간 동기화를 사용하려면 아래 객체에 본인의 Firebase 설정 값을 입력하세요.
 * 설정 값을 비워두면 자동으로 '로컬 테스트 모드 (Mock Mode)'로 작동합니다.
 * 웹 화면의 우측 상단 'Firebase 설정' 버튼을 통해서도 실시간으로 등록 및 저장이 가능합니다.
 */
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// =========================================================================
// INITIAL GACHA INVENTORY SETTINGS
// =========================================================================
// 초기 뽑기 아이템 정보 및 수량을 설정합니다.
// (Firebase 최초 구동 시 자동으로 DB에 등록되며, 초기화 버튼 클릭 시에도 적용됩니다)
const initialGachaInventory = {
  totalCount: 100, // 각 prizes의 currentCount 합과 일치해야 합니다.
  prizes: [
    { rank: "1등", prizeName: "10,000 포인트", currentCount: 5, totalCount: 5 },
    { rank: "2등", prizeName: "5,000 포인트", currentCount: 15, totalCount: 15 },
    { rank: "3등", prizeName: "1,000 포인트", currentCount: 30, totalCount: 30 },
    { rank: "4등", prizeName: "100 포인트", currentCount: 50, totalCount: 50 }
  ]
};

// =========================================================================
// STATE MANAGEMENT & RUNTIME LOGIC
// =========================================================================
let app = null;
let db = null;
let syncRef = null;

// Application State
let state = {
  totalCount: initialGachaInventory.totalCount,
  prizes: JSON.parse(JSON.stringify(initialGachaInventory.prizes)),
  isDrawing: false,
  mode: 'local' // 'local' or 'firebase'
};

// DOM Elements
const syncStatusEl = document.getElementById('syncStatus');
const btnConfigToggle = document.getElementById('btnConfigToggle');
const capsulesContainer = document.getElementById('capsulesContainer');
const totalRemainingVal = document.getElementById('totalRemainingVal');
const btnDraw = document.getElementById('btnDraw');
const inventoryGrid = document.getElementById('inventoryGrid');
const btnResetDB = document.getElementById('btnResetDB');
const leverWrapper = document.getElementById('leverWrapper');
const deliveredCapsule = document.getElementById('deliveredCapsule');
const dispenserChute = document.querySelector('.dispenser-chute');

// Modal Elements
const resultModal = document.getElementById('resultModal');
const modalPrizeRank = document.getElementById('modalPrizeRank');
const modalPrizeName = document.getElementById('modalPrizeName');
const btnModalClose = document.getElementById('btnModalClose');
const confettiContainer = document.getElementById('confettiContainer');

// Config Modal Elements
const configModal = document.getElementById('configModal');
const btnCloseConfigModal = document.getElementById('btnCloseConfigModal');
const configForm = document.getElementById('configForm');
const btnClearConfig = document.getElementById('btnClearConfig');

// =========================================================================
// INITIALIZATION
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initGlobeCapsules();
  setupEventListeners();
  checkAndInitializeFirebase();
});

// Setup capsules in the Gashapon glass globe
function initGlobeCapsules() {
  capsulesContainer.innerHTML = '';
  const colors = ['c-pink', 'c-blue', 'c-green', 'c-purple', 'c-gold', 'c-orange', 'c-cyan'];
  const totalBalls = 15;
  
  for (let i = 0; i < totalBalls; i++) {
    const capsule = document.createElement('div');
    capsule.className = `capsule ${colors[i % colors.length]}`;
    
    // Position inside the circular globe boundaries (dome center: 145, 145)
    // Spawn primarily in the lower portion to look natural
    const angle = Math.random() * Math.PI + Math.PI * 0.05; // ~10deg to 170deg (lower semi-circle)
    const distance = 35 + Math.random() * 85; // distance from center
    
    const x = 145 + Math.cos(angle) * distance - 16; // 16px is half the capsule width (32px)
    const y = 145 + Math.sin(angle) * distance - 16;
    
    capsule.style.left = `${x}px`;
    capsule.style.top = `${y}px`;
    capsule.style.transform = `rotate(${Math.random() * 360}deg)`;
    capsulesContainer.appendChild(capsule);
  }
}

// Check if Firebase configuration is provided (either hardcoded or in localStorage)
async function checkAndInitializeFirebase() {
  let activeConfig = null;
  
  // 1. Check localStorage first
  const storedConfig = localStorage.getItem('firebase_config');
  if (storedConfig) {
    try {
      activeConfig = JSON.parse(storedConfig);
    } catch (e) {
      console.error("Failed to parse stored config", e);
    }
  }
  
  // 2. Check hardcoded config block if local storage is empty
  if (!activeConfig && firebaseConfig.apiKey) {
    activeConfig = firebaseConfig;
  }
  
  if (activeConfig && activeConfig.apiKey && activeConfig.databaseURL) {
    try {
      // Import Firebase modules dynamically
      const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
      const { getDatabase, ref, onValue } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js");
      
      app = initializeApp(activeConfig);
      db = getDatabase(app);
      syncRef = ref(db, 'gacha');
      
      // Listen to real-time database changes
      onValue(syncRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          // If DB is empty, initialize it with default config
          import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js").then(({ set }) => {
            set(syncRef, initialGachaInventory);
          });
        } else {
          state.totalCount = data.totalCount;
          state.prizes = data.prizes;
          state.mode = 'firebase';
          updateSyncStatus(true);
          updateUI();
        }
      }, (error) => {
        console.error("Firebase database read error:", error);
        fallbackToLocalMode("데이터베이스 권한 오류");
      });
      
      // Pre-fill form inputs in config modal
      prefillConfigForm(activeConfig);
      
    } catch (err) {
      console.error("Firebase Initialization Failed:", err);
      fallbackToLocalMode("연결 실패");
    }
  } else {
    fallbackToLocalMode("설정 없음");
    updateUI();
  }
}

function fallbackToLocalMode(reason) {
  state.mode = 'local';
  console.log(`Working in Local Mock Mode: ${reason}`);
  updateSyncStatus(false);
}

// Prefill Firebase configurations form
function prefillConfigForm(config) {
  document.getElementById('apiKey').value = config.apiKey || '';
  document.getElementById('authDomain').value = config.authDomain || '';
  document.getElementById('databaseURL').value = config.databaseURL || '';
  document.getElementById('projectId').value = config.projectId || '';
  document.getElementById('storageBucket').value = config.storageBucket || '';
  document.getElementById('messagingSenderId').value = config.messagingSenderId || '';
  document.getElementById('appId').value = config.appId || '';
}

// Update status indicator top-left
function updateSyncStatus(isSynced) {
  const dot = syncStatusEl.querySelector('.status-dot');
  const text = syncStatusEl.querySelector('.status-text');
  
  if (isSynced) {
    dot.className = 'status-dot online';
    text.textContent = 'Firebase 실시간 동기화 활성';
  } else {
    dot.className = 'status-dot warning';
    text.textContent = '로컬 테스트 모드 (실시간 동기화 비활성)';
  }
}

// =========================================================================
// UI UPDATES (STATE BINDING)
// =========================================================================
function updateUI() {
  // Update total count
  totalRemainingVal.textContent = state.totalCount;
  
  // Update dashboard grid
  inventoryGrid.innerHTML = '';
  
  state.prizes.forEach((prize, idx) => {
    const isOutOfStock = prize.currentCount === 0;
    const isLow = prize.currentCount > 0 && prize.currentCount <= 3;
    const progressPercent = prize.totalCount > 0 ? (prize.currentCount / prize.totalCount) * 100 : 0;
    
    // Map rank to specific style classes
    let badgeClass = 'rank-4th';
    let fillClass = 'rank-4th';
    if (prize.rank === '1등') { badgeClass = 'rank-1st'; fillClass = 'rank-1st'; }
    else if (prize.rank === '2등') { badgeClass = 'rank-2nd'; fillClass = 'rank-2nd'; }
    else if (prize.rank === '3등') { badgeClass = 'rank-3nd'; fillClass = 'rank-3nd'; }
    
    const cardMarkup = `
      <div class="inventory-card ${isOutOfStock ? 'out-of-stock' : ''}">
        <div class="inventory-card-top">
          <div class="rank-info">
            <span class="rank-badge ${badgeClass}">${prize.rank}</span>
            <span class="prize-title-text">${prize.prizeName}</span>
          </div>
          <div class="quantity-info">
            <span class="qty-val ${isLow ? 'warning-low' : ''}">${prize.currentCount}</span>
            <span class="qty-total">/ ${prize.totalCount}개</span>
          </div>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill ${fillClass}" style="width: ${progressPercent}%"></div>
        </div>
      </div>
    `;
    inventoryGrid.insertAdjacentHTML('beforeend', cardMarkup);
  });
  
  // Update main draw button state
  if (state.totalCount <= 0) {
    btnDraw.disabled = true;
    btnDraw.querySelector('.btn-text').textContent = '준비된 상품이 모두 소진되었습니다';
  } else if (!state.isDrawing) {
    btnDraw.disabled = false;
    btnDraw.querySelector('.btn-text').textContent = '뽑기 시작하기';
  }
}

// =========================================================================
// EVENT LISTENERS & ROUTING
// =========================================================================
function setupEventListeners() {
  btnDraw.addEventListener('click', handleDraw);
  btnModalClose.addEventListener('click', closeModal);
  
  // Firebase configuration modal controls
  btnConfigToggle.addEventListener('click', () => configModal.classList.add('active'));
  btnCloseConfigModal.addEventListener('click', () => configModal.classList.remove('active'));
  
  configForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const config = {
      apiKey: document.getElementById('apiKey').value.trim(),
      authDomain: document.getElementById('authDomain').value.trim(),
      databaseURL: document.getElementById('databaseURL').value.trim(),
      projectId: document.getElementById('projectId').value.trim(),
      storageBucket: document.getElementById('storageBucket').value.trim(),
      messagingSenderId: document.getElementById('messagingSenderId').value.trim(),
      appId: document.getElementById('appId').value.trim()
    };
    
    localStorage.setItem('firebase_config', JSON.stringify(config));
    alert('Firebase 설정이 저장되었습니다. 페이지를 새로고침하여 연결합니다.');
    window.location.reload();
  });
  
  btnClearConfig.addEventListener('click', () => {
    if (confirm('Firebase 설정을 초기화하고 로컬 모드로 전환하시겠습니까?')) {
      localStorage.removeItem('firebase_config');
      alert('설정이 지워졌습니다. 페이지를 새로고침합니다.');
      window.location.reload();
    }
  });
  
  // Reset database / Local storage values
  btnResetDB.addEventListener('click', handleReset);
}

// =========================================================================
// DRAW CORE LOGIC
// =========================================================================
async function handleDraw() {
  if (state.isDrawing || state.totalCount <= 0) return;
  
  // 1. Instantly lock draw button locally to prevent spamming
  state.isDrawing = true;
  btnDraw.disabled = true;
  
  if (state.mode === 'firebase') {
    try {
      const { ref, runTransaction } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js");
      
      let selectedPrizeIndex = -1;
      const gachaDbRef = ref(db, 'gacha');
      
      const transactionResult = await runTransaction(gachaDbRef, (currentData) => {
        if (!currentData) return currentData;
        
        if (currentData.totalCount <= 0) {
          return; // Abort
        }
        
        // Calculate remaining item rates and choose prize
        const prizes = currentData.prizes;
        let total = 0;
        for (let i = 0; i < prizes.length; i++) {
          total += prizes[i].currentCount;
        }
        
        if (total <= 0) return; // Abort
        
        // Random Selection Algorithm
        const randVal = Math.floor(Math.random() * total) + 1;
        let runningSum = 0;
        let chosenIdx = -1;
        
        for (let i = 0; i < prizes.length; i++) {
          runningSum += prizes[i].currentCount;
          if (runningSum >= randVal) {
            chosenIdx = i;
            break;
          }
        }
        
        if (chosenIdx !== -1) {
          prizes[chosenIdx].currentCount -= 1;
          currentData.totalCount -= 1;
          selectedPrizeIndex = chosenIdx; // Save choice to scope
        }
        
        return currentData;
      });
      
      if (transactionResult.committed) {
        // Success! Get the winning prize name from the snapshot (before the decrement or computed index)
        const wonPrize = transactionResult.snapshot.val().prizes[selectedPrizeIndex];
        playGachaAnimation(wonPrize);
      } else {
        // Aborted because totalCount reached 0 in the transaction check
        showCancellationAlert();
      }
      
    } catch (err) {
      console.error("Transaction Error: ", err);
      alert("데이터를 전송하는 중 오류가 발생했습니다. 다시 시도해 주세요.");
      state.isDrawing = false;
      updateUI();
    }
  } else {
    // LOCAL MODE DRAW
    // 1. Probability selection based on remaining items
    let total = 0;
    state.prizes.forEach(p => total += p.currentCount);
    
    if (total <= 0) {
      showCancellationAlert();
      return;
    }
    
    const randVal = Math.floor(Math.random() * total) + 1;
    let runningSum = 0;
    let chosenIdx = -1;
    
    for (let i = 0; i < state.prizes.length; i++) {
      runningSum += state.prizes[i].currentCount;
      if (runningSum >= randVal) {
        chosenIdx = i;
        break;
      }
    }
    
    if (chosenIdx !== -1) {
      // Decrement counts locally
      state.prizes[chosenIdx].currentCount -= 1;
      state.totalCount -= 1;
      
      const wonPrize = state.prizes[chosenIdx];
      // Proceed with animation
      playGachaAnimation(wonPrize);
    } else {
      showCancellationAlert();
    }
  }
}

// Play Gashapon spin & chute rollout animations
function playGachaAnimation(wonPrize) {
  // Rotate lever
  leverWrapper.classList.add('lever-spinning');
  
  // Bounding capsules bounce
  const glassGlobe = document.querySelector('.glass-globe');
  glassGlobe.classList.add('globe-spinning');
  
  // Set capsule ball color for chute rollout
  deliveredCapsule.className = 'delivered-capsule'; // reset
  let colorClass = 'c-orange';
  if (wonPrize.rank === '1등') colorClass = 'c-gold';
  else if (wonPrize.rank === '2등') colorClass = 'c-cyan';
  else if (wonPrize.rank === '3등') colorClass = 'c-purple';
  else if (wonPrize.rank === '4등') colorClass = 'c-pink';
  
  deliveredCapsule.classList.add(colorClass);
  
  // Phase 1: Bouncing balls inside machine (lasts 2 seconds)
  setTimeout(() => {
    // Open chute door and release the capsule
    dispenserChute.classList.add('open');
    deliveredCapsule.classList.add('roll-out');
    
    // Phase 2: Capsule rolling out down the chute (lasts 0.8 seconds)
    setTimeout(() => {
      showResultModal(wonPrize);
    }, 800);
    
  }, 2000);
}

// Show the result popup with Confetti
function showResultModal(prize) {
  modalPrizeRank.textContent = prize.rank;
  modalPrizeName.textContent = prize.prizeName;
  
  // Assign color badge based on rank
  modalPrizeRank.className = 'prize-badge'; // reset
  if (prize.rank === '1등') modalPrizeRank.classList.add('rank-1st');
  else if (prize.rank === '2등') modalPrizeRank.classList.add('rank-2nd');
  else if (prize.rank === '3등') modalPrizeRank.classList.add('rank-3nd');
  else if (prize.rank === '4등') modalPrizeRank.classList.add('rank-4th');
  
  // Run Confetti effect
  startConfetti();
  
  // Open Modal
  resultModal.classList.add('active');
}

// Close Result popup and reset animations
function closeModal() {
  resultModal.classList.remove('active');
  stopConfetti();
  
  // Clear animation classes
  leverWrapper.classList.remove('lever-spinning');
  document.querySelector('.glass-globe').classList.remove('globe-spinning');
  dispenserChute.classList.remove('open');
  deliveredCapsule.classList.remove('roll-out');
  
  // Mark drawing process finished, refresh UI
  state.isDrawing = false;
  updateUI();
}

function showCancellationAlert() {
  alert("방금 다른 사용자가 마지막 상품을 뽑았습니다!");
  state.isDrawing = false;
  updateUI();
}

// =========================================================================
// RESET DATABASE / STATE
// =========================================================================
async function handleReset() {
  if (confirm("정말로 모든 뽑기 재고 수량을 초기 세팅 값(100개)으로 재설정하시겠습니까?")) {
    if (state.mode === 'firebase') {
      try {
        const { set } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js");
        await set(syncRef, initialGachaInventory);
        alert("데이터베이스 수량이 성공적으로 초기화되었습니다.");
      } catch (err) {
        console.error("Firebase reset error:", err);
        alert("데이터베이스 초기화 도중 오류가 발생했습니다.");
      }
    } else {
      // Local Mode Reset
      state.totalCount = initialGachaInventory.totalCount;
      state.prizes = JSON.parse(JSON.stringify(initialGachaInventory.prizes));
      updateUI();
      alert("로컬 수량이 초기화되었습니다.");
    }
  }
}

// =========================================================================
// VANILLA CONFETTI EFFECT
// =========================================================================
let confettiInterval = null;

function startConfetti() {
  confettiContainer.innerHTML = '';
  const colors = ['#ffd700', '#ff3366', '#00e5ff', '#e040fb', '#ff6e40', '#69f0ae', '#ffffff'];
  
  // Create pieces
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    
    // Randomize properties
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width = `${4 + Math.random() * 6}px`;
    piece.style.height = `${8 + Math.random() * 10}px`;
    piece.style.animationDelay = `${Math.random() * 2}s`;
    piece.style.animationDuration = `${1.5 + Math.random() * 2}s`;
    
    confettiContainer.appendChild(piece);
  }
}

// ... existing code ...
function stopConfetti() {
  confettiContainer.innerHTML = '';
}
