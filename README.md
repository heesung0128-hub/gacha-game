# 100% 간식 당첨! 잔반없는날 랜덤 뽑기 (Gashapon Real-time Draw)

이 프로젝트는 실시간 다중 기기 재고 동기화 기능이 포함된 프리미엄 웹 가챠(랜덤 뽑기) 프로그램입니다. 사용자가 뽑기를 진행할 때마다 각 등수별 실시간 남은 수량을 기반으로 당첨 등수가 계산되며, Firebase Realtime Database를 통해 여러 사용자가 동시에 접속해도 중복 당첨이나 재고 부족 오류 없이 실시간으로 수량이 동기화됩니다.

## 🚀 주요 기능

1. **실시간 다중 기기 동기화 (Firebase RTDB)**
   - Firebase Realtime Database와의 연동을 지원하여 어떤 기기에서 뽑기를 진행하든 즉시 모든 기기의 현황판에 반영됩니다.
   - **동시성 제어 (Transaction)**: 두 사용자가 정확히 동시에 클릭하더라도 서버 측 트랜잭션(`runTransaction`)을 통해 안전하게 순차 차감되어 중복 당첨이나 마이너스 수량 발생을 완벽하게 차단합니다.
   
2. **비율 기반 랜덤 당첨 알고리즘**
   - 단순 고정 확률이 아니라 **"현재 남아있는 실제 재고의 비율"**을 실시간으로 계산하여 당첨을 결정합니다. 특정 등수의 재고가 완전히 소진(0개)되면 더 이상 당첨되지 않습니다.

3. **로컬 테스트 모드 (Mock Mode) 내장**
   - Firebase 설정 정보가 없더라도 메모리 상의 로컬 데이터를 사용하여 모든 애니메이션과 대시보드 차감 흐름을 그대로 테스트할 수 있습니다.

4. **프리미엄 UI/UX & CSS 애니메이션**
   - **반응형 2단 레이아웃**: 데스크톱 기준 좌측 뽑기 영역, 우측 현황판 영역으로 배치되며 모바일 환경에서는 최적의 가독성을 위해 상하로 재배치됩니다.
   - **가샤폰 물리 시뮬레이션**: 레버를 돌릴 때 유리 돔 안의 컬러 캡슐들이 사방으로 튕기며 회전하는 역동적인 CSS Keyframe 애니메이션이 적용되어 있습니다.
   - **캡슐 배출 및 결과 연출**: 2초간의 회전 후 기계 배출구로 당첨 캡슐이 굴러 나오며, 뒤이어 축하 꽃가루(Confetti) 효과와 함께 결과 안내 팝업창이 등장합니다.

---

## 🛠️ 기술 스택

- **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript (ES6+ Module)
- **Database**: Firebase Realtime Database SDK (v10 modular CDN)
- **Design & Icons**: FontAwesome 6, Google Fonts (Outfit, Noto Sans KR)

---

## 💻 실행 방법

### 1. 로컬에서 즉시 실행 (테스트 모드)
이 프로젝트는 별도의 서버 구축이나 빌드 프로세스가 필요하지 않은 순수 정적 웹페이지입니다.
1. 이 저장소의 파일(`index.html`, `style.css`, `app.js`)을 다운로드합니다.
2. `index.html`을 웹 브라우저에서 바로 더블클릭하여 실행하거나, VS Code의 `Live Server` 등을 이용해 실행합니다.
3. 기본값인 **로컬 테스트 모드**로 작동하며 우측 하단의 `초기 수량으로 재설정 (관리자)` 버튼을 이용해 언제든 재고를 100개로 리셋할 수 있습니다.

### 2. Firebase 실시간 동기화 설정 방법
다중 기기 실시간 공유를 원하실 경우 다음 순서로 Firebase를 연결하세요:

#### 방법 A: 코드에서 직접 수정
`app.js` 파일 상단에 있는 `firebaseConfig` 객체에 본인의 Firebase 프로젝트 설정 값을 입력합니다:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

#### 방법 B: 웹 브라우저 화면에서 설정 (권장)
1. 브라우저에서 페이지를 엽니다.
2. 좌측 상단의 **`Firebase 설정`** 버튼을 누릅니다.
3. 열린 모달 창에 Firebase 콘솔에서 복사한 SDK 구성 값을 입력한 뒤 **`저장 및 연결`**을 클릭합니다.
4. 설정값은 브라우저의 `localStorage`에 안전하게 저장되며, 자동으로 페이지가 새로고침되면서 Firebase 동기화 모드로 전환됩니다.
5. 연결을 끊고 로컬 테스트 모드로 돌아가려면 모달 내의 **`설정 지우기`** 버튼을 누르면 됩니다.

---

## ⚙️ 초기 상품 데이터 설정 변경
상품 종류, 초기 수량, 등수 이름을 변경하고 싶다면 `app.js` 파일 내의 `initialGachaInventory` 객체를 수정하세요:

```javascript
const initialGachaInventory = {
  totalCount: 100, // 반드시 아래 prizes의 totalCount 합과 일치하도록 맞춰주세요.
  prizes: [
    { rank: "1등", prizeName: "10,000 포인트", currentCount: 5, totalCount: 5 },
    { rank: "2등", prizeName: "5,000 포인트", currentCount: 15, totalCount: 15 },
    { rank: "3등", prizeName: "1,000 포인트", currentCount: 30, totalCount: 30 },
    { rank: "4등", prizeName: "100 포인트", currentCount: 50, totalCount: 50 }
  ]
};
```
Firebase 연동 상태라면 최초 연결 시 이 기본 데이터가 자동으로 Firebase RTDB에 적재됩니다.
