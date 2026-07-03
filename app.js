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
// SAFE STORAGE WRAPPER FOR FILE:// PROTOCOL
// =========================================================================
// 브라우저에서 로컬 파일(file://)로 열었을 때 localStorage 접근 시 발생하는 SecurityError 방지
const safeStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("localStorage is not accessible in this context:", e);
      return null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn("localStorage is not accessible in this context:", e);
      return false;
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn("localStorage is not accessible in this context:", e);
      return false;
    }
  }
};

// =========================================================================
// STATE MANAGEMENT & RUNTIME LOGIC
// =========================================================================
let app = null;
let db = null;
let syncRef = null;

// Helper to get currently active inventory setup (from localStorage if custom, else default)
function getActiveInventory() {
  const storedCustom = safeStorage.getItem('custom_gacha_inventory');
  if (storedCustom) {
    try {
      return JSON.parse(storedCustom);
    } catch (e) {
      console.error("Failed to parse custom inventory config", e);
    }
  }
  return initialGachaInventory;
}

const activeInventory = getActiveInventory();

// Application State
let state = {
  totalCount: activeInventory.totalCount,
  prizes: JSON.parse(JSON.stringify(activeInventory.prizes)),
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

// Status Banner Elements
const statusBannerBox = document.getElementById('statusBannerBox');
const statusBannerText = document.getElementById('statusBannerText');

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

// Settings Modal Elements (Admin Menu)
const inventorySettingsModal = document.getElementById('inventorySettingsModal');
const btnEditInventory = document.getElementById('btnEditInventory');
const btnCloseSettingsModal = document.getElementById('btnCloseSettingsModal');
const inventorySettingsForm = document.getElementById('inventorySettingsForm');
const btnResetToDefaultSettings = document.getElementById('btnResetToDefaultSettings');
const btnAddSettingRow = document.getElementById('btnAddSettingRow');

// =========================================================================
// INITIALIZATION
// =========================================================================
// DOM 로드 완료 상태를 안정적으로 감지하여 초기화 진행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

function initApp() {
  initGlobeCapsules();
  setupEventListeners();
  checkAndInitializeFirebase();
  adjustViewportScale();
}

function adjustViewportScale() {
  const container = document.getElementById('appContainer');
  if (!container) return;
  
  if (window.innerWidth > 968) {
    const targetWidth = 1280;
    const targetHeight = 720;
    
    const statusBar = document.querySelector('.status-bar');
    const statusBarHeight = statusBar ? (statusBar.offsetHeight || 60) : 60;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight - statusBarHeight;
    
    const scaleX = viewportWidth / targetWidth;
    const scaleY = viewportHeight / targetHeight;
    const scale = Math.min(scaleX, scaleY);
    
    container.style.transform = `scale(${scale})`;
    container.style.width = `${targetWidth}px`;
    container.style.height = `${targetHeight}px`;
  } else {
    container.style.transform = '';
    container.style.width = '';
    container.style.height = '';
  }
}

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
  // Check URL query parameters for Firebase config auto-registration
  const urlParams = new URLSearchParams(window.location.search);
  const urlApiKey = urlParams.get('apiKey');
  const urlDatabaseURL = urlParams.get('databaseURL');
  const urlProjectId = urlParams.get('projectId');
  
  if (urlApiKey && urlDatabaseURL && urlProjectId) {
    const configFromUrl = {
      apiKey: urlApiKey.trim(),
      authDomain: urlParams.get('authDomain')?.trim() || `${urlProjectId.trim()}.firebaseapp.com`,
      databaseURL: urlDatabaseURL.trim(),
      projectId: urlProjectId.trim(),
      storageBucket: urlParams.get('storageBucket')?.trim() || `${urlProjectId.trim()}.appspot.com`,
      messagingSenderId: urlParams.get('messagingSenderId')?.trim() || '',
      appId: urlParams.get('appId')?.trim() || ''
    };
    
    safeStorage.setItem('firebase_config', JSON.stringify(configFromUrl));
    
    // Clean up URL parameters to keep it clean and secure
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
    
    alert("공유 링크를 통해 Firebase 설정이 자동으로 등록되었습니다!");
    window.location.reload();
    return;
  }

  let activeConfig = null;
  
  // 1. Check localStorage first
  const storedConfig = safeStorage.getItem('firebase_config');
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
          // If DB is empty, initialize it with current active config
          import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js").then(({ set }) => {
            set(syncRef, getActiveInventory());
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
    
    // Map rank to specific style classes (supporting fallback style for high ranks)
    let badgeClass = 'rank-default';
    let fillClass = 'rank-default';
    if (prize.rank === '1등') { badgeClass = 'rank-1st'; fillClass = 'rank-1st'; }
    else if (prize.rank === '2등') { badgeClass = 'rank-2nd'; fillClass = 'rank-2nd'; }
    else if (prize.rank === '3등') { badgeClass = 'rank-3nd'; fillClass = 'rank-3nd'; }
    else if (prize.rank === '4등') { badgeClass = 'rank-4th'; fillClass = 'rank-4th'; }
    
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
  
  // Update main PRESS button state
  btnDraw.disabled = (state.totalCount <= 0 || state.isDrawing);
  
  // Update operational status banner below the machine
  const statusDot = statusBannerBox.querySelector('.status-banner-dot');
  if (state.totalCount <= 0) {
    statusDot.className = 'status-banner-dot out-of-stock';
    statusBannerText.textContent = '준비된 상품 소진';
  } else if (state.isDrawing) {
    statusDot.className = 'status-banner-dot drawing';
    statusBannerText.textContent = '뽑기 진행 중...';
  } else {
    statusDot.className = 'status-banner-dot';
    statusBannerText.textContent = '뽑기 준비 완료';
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
  
  // Fullscreen toggle controls
  const btnFullscreenToggle = document.getElementById('btnFullscreenToggle');
  const fullscreenIcon = document.getElementById('fullscreenIcon');
  const fullscreenText = document.getElementById('fullscreenText');
  
  if (btnFullscreenToggle) {
    btnFullscreenToggle.addEventListener('click', () => {
      const docEl = document.documentElement;
      const requestFS = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
      const exitFS = document.exitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen || document.msExitFullscreen;
      
      const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
      
      if (!isFullscreen) {
        if (requestFS) {
          requestFS.call(docEl).catch((err) => {
            console.warn(`Error attempting to enable fullscreen: ${err.message}`);
          });
        }
      } else {
        if (exitFS) {
          exitFS.call(document);
        }
      }
    });
    
    const onFullscreenChange = () => {
      const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
      if (isFullscreen) {
        fullscreenIcon.className = 'fa-solid fa-compress';
        fullscreenText.textContent = '창 모드로 보기';
      } else {
        fullscreenIcon.className = 'fa-solid fa-expand';
        fullscreenText.textContent = '전체화면';
      }
      setTimeout(adjustViewportScale, 100);
    };
    
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);
    document.addEventListener('MSFullscreenChange', onFullscreenChange);
  }
  
  configForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const projectId = document.getElementById('projectId').value.trim();
    const config = {
      apiKey: document.getElementById('apiKey').value.trim(),
      authDomain: document.getElementById('authDomain').value.trim() || `${projectId}.firebaseapp.com`,
      databaseURL: document.getElementById('databaseURL').value.trim(),
      projectId: projectId,
      storageBucket: document.getElementById('storageBucket').value.trim() || `${projectId}.appspot.com`,
      messagingSenderId: document.getElementById('messagingSenderId').value.trim(),
      appId: document.getElementById('appId').value.trim()
    };
    
    safeStorage.setItem('firebase_config', JSON.stringify(config));
    alert('Firebase.설정이 저장되었습니다. 페이지를 새로고침하여 연결합니다.');
    window.location.reload();
  });
  
  btnClearConfig.addEventListener('click', () => {
    if (confirm('Firebase 설정을 초기화하고 로컬 모드로 전환하시겠습니까?')) {
      safeStorage.removeItem('firebase_config');
      alert('설정이 지워졌습니다. 페이지를 새로고침합니다.');
      window.location.reload();
    }
  });
  
  const btnCopyShareLink = document.getElementById('btnCopyShareLink');
  btnCopyShareLink.addEventListener('click', () => {
    const apiKey = document.getElementById('apiKey').value.trim();
    const authDomain = document.getElementById('authDomain').value.trim();
    const databaseURL = document.getElementById('databaseURL').value.trim();
    const projectId = document.getElementById('projectId').value.trim();
    const storageBucket = document.getElementById('storageBucket').value.trim();
    const messagingSenderId = document.getElementById('messagingSenderId').value.trim();
    const appId = document.getElementById('appId').value.trim();
    
    if (!apiKey || !databaseURL || !projectId) {
      alert("공유 링크를 만들려면 최소한 API Key, Database URL, Project ID는 입력하셔야 합니다.");
      return;
    }
    
    const params = new URLSearchParams();
    params.set('apiKey', apiKey);
    params.set('authDomain', authDomain);
    params.set('databaseURL', databaseURL);
    params.set('projectId', projectId);
    if (storageBucket) params.set('storageBucket', storageBucket);
    if (messagingSenderId) params.set('messagingSenderId', messagingSenderId);
    if (appId) params.set('appId', appId);
    
    const shareUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?${params.toString()}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert("Firebase 연동 공유 링크가 클립보드에 복사되었습니다!\n이 링크를 태블릿이나 다른 기기에서 열면 즉시 자동으로 Firebase가 등록됩니다.");
    }).catch(err => {
      console.error("Clipboard copy failed:", err);
      prompt("아래 링크를 복사해서 공유하세요:", shareUrl);
    });
  });
  
  // Inventory settings modal controls
  btnEditInventory.addEventListener('click', openSettingsModal);
  btnCloseSettingsModal.addEventListener('click', () => inventorySettingsModal.classList.remove('active'));
  inventorySettingsForm.addEventListener('submit', handleSaveSettings);
  btnResetToDefaultSettings.addEventListener('click', resetSettingsToDefault);
  btnAddSettingRow.addEventListener('click', () => {
    addSettingRowMarkup('', '');
  });
  
  // Reset database / Local storage values
  btnResetDB.addEventListener('click', handleReset);
  
  // Dynamic scale fitting on resize
  window.addEventListener('resize', adjustViewportScale);
}

// =========================================================================
// DRAW CORE LOGIC
// =========================================================================
async function handleDraw() {
  if (state.isDrawing || state.totalCount <= 0) return;
  
  // 1. Instantly lock draw button locally to prevent spamming
  state.isDrawing = true;
  btnDraw.disabled = true;
  updateUI(); // force update status text to 'Drawing' immediately
  
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
  
  // Phase 1: Bouncing balls inside machine (lasts 1.1 seconds)
  setTimeout(() => {
    // Open chute door and release the capsule
    dispenserChute.classList.add('open');
    deliveredCapsule.classList.add('roll-out');
    
    // Phase 2: Capsule rolling out down the chute (lasts 0.4 seconds)
    setTimeout(() => {
      showResultModal(wonPrize);
    }, 400);
    
  }, 1100);
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
  else modalPrizeRank.classList.add('rank-default');
  
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
  const activeSetup = getActiveInventory();
  if (confirm("정말로 모든 뽑기 재고 수량을 설정된 초기값으로 재설정하시겠습니까?")) {
    if (state.mode === 'firebase') {
      try {
        const { set } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js");
        await set(syncRef, activeSetup);
        alert("데이터베이스 수량이 성공적으로 초기화되었습니다.");
      } catch (err) {
        console.error("Firebase reset error:", err);
        alert("데이터베이스 초기화 도중 오류가 발생했습니다.");
      }
    } else {
      // Local Mode Reset
      state.totalCount = activeSetup.totalCount;
      state.prizes = JSON.parse(JSON.stringify(activeSetup.prizes));
      updateUI();
      alert("로컬 수량이 초기화되었습니다.");
    }
  }
}

// =========================================================================
// ADMIN INVENTORY EDITING LOGIC (DYNAMIC ROWS)
// =========================================================================
function renderSettingsRows(prizesList) {
  const container = document.getElementById('settingsGridContainer');
  container.innerHTML = '';
  prizesList.forEach((prize, idx) => {
    addSettingRowMarkup(prize.prizeName, prize.totalCount);
  });
}

function addSettingRowMarkup(name = '', qty = '') {
  const container = document.getElementById('settingsGridContainer');
  const index = container.children.length;
  
  // Assign styling badge classes sequentially
  let badgeClass = 'rank-default';
  if (index === 0) badgeClass = 'rank-1st';
  else if (index === 1) badgeClass = 'rank-2nd';
  else if (index === 2) badgeClass = 'rank-3nd';
  else if (index === 3) badgeClass = 'rank-4th';
  
  const rowMarkup = `
    <div class="settings-row">
      <span class="row-label ${badgeClass}">${index + 1}등</span>
      <div class="form-group-inline">
        <input type="text" class="edit-prize-name" placeholder="상품명" value="${name}" required>
        <input type="number" class="edit-prize-qty" min="0" max="1000" placeholder="수량" value="${qty}" required>
        <button type="button" class="btn-delete-row" title="삭제">&times;</button>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', rowMarkup);
  
  // Attach deletion event listener
  const newRow = container.lastElementChild;
  const deleteBtn = newRow.querySelector('.btn-delete-row');
  deleteBtn.addEventListener('click', () => {
    if (container.children.length <= 1) {
      alert("적어도 하나의 상품은 등록되어야 합니다.");
      return;
    }
    newRow.remove();
    reindexSettingRows();
  });
}

function reindexSettingRows() {
  const container = document.getElementById('settingsGridContainer');
  const rows = container.querySelectorAll('.settings-row');
  
  rows.forEach((row, idx) => {
    const label = row.querySelector('.row-label');
    label.textContent = `${idx + 1}등`;
    
    // Refresh styling badge classes
    label.className = 'row-label';
    if (idx === 0) label.classList.add('rank-1st');
    else if (idx === 1) label.classList.add('rank-2nd');
    else if (idx === 2) label.classList.add('rank-3nd');
    else if (idx === 3) label.classList.add('rank-4th');
    else label.classList.add('rank-default');
  });
}

function openSettingsModal() {
  renderSettingsRows(state.prizes);
  inventorySettingsModal.classList.add('active');
}

async function handleSaveSettings(e) {
  e.preventDefault();
  
  const container = document.getElementById('settingsGridContainer');
  const rows = container.querySelectorAll('.settings-row');
  
  const newPrizes = [];
  let newTotal = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = row.querySelector('.edit-prize-name').value.trim();
    const qty = parseInt(row.querySelector('.edit-prize-qty').value) || 0;
    
    if (qty < 0 || qty > 1000) {
      alert("각 상품의 수량은 0개에서 1000개 사이로 입력해 주세요.");
      return;
    }
    
    newPrizes.push({
      rank: `${i + 1}등`,
      prizeName: name,
      currentCount: qty,
      totalCount: qty
    });
    newTotal += qty;
  }
  
  const newInventory = {
    totalCount: newTotal,
    prizes: newPrizes
  };
  
  if (state.mode === 'firebase') {
    try {
      const { set } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js");
      await set(syncRef, newInventory);
      alert("상품 정보 및 재고 설정이 데이터베이스에 저장 및 동기화되었습니다.");
    } catch (err) {
      console.error("Firebase settings save error:", err);
      alert("데이터베이스 저장 도중 오류가 발생했습니다.");
    }
  } else {
    // Local mode: save to local storage to make it persistent
    safeStorage.setItem('custom_gacha_inventory', JSON.stringify(newInventory));
    state.totalCount = newTotal;
    state.prizes = JSON.parse(JSON.stringify(newPrizes));
    updateUI();
    alert("로컬 상품 설정이 저장 및 초기화되었습니다.");
  }
  
  inventorySettingsModal.classList.remove('active');
}

function resetSettingsToDefault() {
  if (confirm("모든 입력을 초기 기본 설정값(100개 세팅)으로 채우시겠습니까?\n(저장 및 초기화 버튼을 눌러야 적용됩니다)")) {
    renderSettingsRows(initialGachaInventory.prizes);
  }
}

// =========================================================================
// VANILLA CONFETTI EFFECT
// =========================================================================
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

function stopConfetti() {
  confettiContainer.innerHTML = '';
}
