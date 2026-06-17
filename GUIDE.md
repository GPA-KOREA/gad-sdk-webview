# GAD 오퍼월 웹뷰 SDK 연동 가이드

매체(퍼블리셔)가 **자체 디자인의 오퍼월 목록 UI**를 웹페이지로 만들고, GAD 네이티브 SDK 가 참여/적립을 처리하는 연동 방식입니다.

> 기본 오퍼월 화면만 필요하면 네이티브 SDK 의 `showAdList()` 만으로 충분합니다.
> 웹뷰 SDK 는 **목록 UI 를 직접 구성하려는 매체**를 위한 옵션입니다.

## 구조

```
[매체 앱]
  ① GAD 네이티브 SDK 연동 (필수)
  ② Gad.init(mediaKey, userId)
  ③ Gad.showWebOfferwall(오퍼월 페이지 URL)
        └ [매체가 호스팅하는 웹페이지] — 커스텀 목록 UI
              └ ④ <script src="gad-ofw-sdk.umd.js">
                    Gad.Ofw.loadAds() → 목록 데이터 → 직접 렌더
                    클릭 → 네이티브 상세/참여/적립 (네이티브 SDK 가 처리)
```

광고 참여·적립·고객센터·포스트백은 모두 **네이티브 SDK** 가 처리합니다. 웹페이지는 목록 표시만 담당합니다.

---

## 1. 네이티브 SDK 연동 (필수 선행)

### Android

```gradle
// settings.gradle 또는 build.gradle
repositories {
    maven { url 'https://jitpack.io' }
}

// app/build.gradle
dependencies {
    implementation 'com.github.koreagpa-dev:gad:0.7.3'
}
```

### iOS (SPM)

Xcode → File ▸ Add Package Dependencies…

```
https://github.com/GPA-KOREA/gad-ios-sdk    (0.1.10+)
```

---

## 2. 앱에서 웹 오퍼월 진입

- `mediaKey`: GAD 오퍼월에서 발급받은 매체 키
- `userId`: 매체의 고유 사용자 식별자 (최대 36자)
- 오퍼월 페이지 URL 은 **반드시 https** (http 는 OS 보안 정책에 차단됨)
- `mediaKey`/`userId` 는 `Gad.init`(초기화) 이 보유합니다. 웹페이지로 다시 넘길 필요 없습니다 (그래서 JS `Gad.Ofw.init()` 은 인자가 없습니다).

진입 방식은 두 가지입니다. 목적에 맞는 쪽을 고르세요.

| 방식 | 화면 | 용도 |
|---|---|---|
| **A. 풀 오퍼월 컨테이너** | SDK 가 전체 화면 WebView 를 띄움 | 오퍼월 페이지 자체를 하나의 화면으로 노출 |
| **B. 매체 WebView 에 부착** | 매체가 가진 WebView 를 그대로 사용 | **매체 자체 화면 일부 지면**에 캠페인 몇 개를 끼워 넣기 |

> 두 방식 모두 브릿지 주입은 SDK 가 처리하므로, 매체가 별도 브릿지 코드를 작성할 필요는 없습니다.

### 방식 A — 풀 오퍼월 컨테이너 (`showWebOfferwall`)

SDK 가 풀스크린 WebView 를 띄우고 브릿지를 자동 주입합니다.

```kotlin
// Android
Gad.init(this, "YOUR_MEDIA_KEY", "USER_ID")
Gad.showWebOfferwall(this, "https://your-domain.com/offerwall.html")
```

```swift
// iOS
Gad.initialize(mediaKey: "YOUR_MEDIA_KEY", userId: "USER_ID")
Gad.showWebOfferwall(from: self, url: "https://your-domain.com/offerwall.html")
```

### 방식 B — 매체 자체 WebView 에 부착 (`attachOfwBridge`)

매체가 직접 관리하는 WebView 에 브릿지만 부착합니다. 풀스크린 전환 없이 **자체 화면 일부 지면**에 캠페인을 노출할 때 사용합니다. (`Gad.init` 으로 초기화돼 있어야 하며, WebView 의 JavaScript 가 활성화돼 있어야 합니다.)

```kotlin
// Android — 매체가 가진 WebView 에 부착 (0.7.3+)
Gad.attachOfwBridge(activity, myWebView)
```

```swift
// iOS — 매체가 가진 WKWebView 에 부착 (0.1.10+)
Gad.attachOfwBridge(to: myWebView, host: self)
```

부착 후, 그 WebView 가 로드한 페이지에서 아래 3절처럼 `Gad.Ofw` 로 캠페인을 받아 원하는 자리에 렌더하면 됩니다. 일부 지면용으로 개수를 제한하려면 `loadAds(3)` 처럼 개수를 넘기세요.

---

## 3. 오퍼월 웹페이지 작성

매체가 직접 호스팅합니다. JS SDK 를 로드하고 목록을 렌더하세요.

```html
<script src="https://cdn.gpakorea.com/gad/ofw-sdk/0.1.1/gad-ofw-sdk.umd.js"></script>
<script>
  Gad.Ofw.init();

  // 광고 목록 (인자 없으면 전체, 숫자 주면 그 개수만큼)
  Gad.Ofw.loadAds().then(function (ads) {
    ads.forEach(function (ad) {
      const card = renderMyCard(ad);        // 매체 커스텀 UI
      Gad.Ofw.registerNativeAd(ad, card);   // 클릭 → 네이티브 상세/참여
      Gad.Ofw.impression(ad);               // 노출 트래킹
    });
  });

  // 부가 진입
  // Gad.Ofw.showOfferwall();  → 네이티브 풀 오퍼월
  // Gad.Ofw.showHelp();       → 고객센터(문의/내역)
</script>
```

완성된 예제는 [`sample/index.html`](sample/index.html) 참고 (네이티브 디자인 톤의 카드 + 더보기 + 문의하기).

### 광고 데이터 (`GadAd`)

GAD API 문서의 필드명을 그대로 따릅니다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `key` | string | 광고키 — 광고 식별자 (상세 진입/노출 트래킹) |
| `type` | number | 0 참여 / 1 설치 / 2 실행 / 3 미션 / 4 액션 / 5 CPS |
| `title` | string | 광고명 |
| `point` | number | 적립 포인트 |
| `unit` | string | 적립 단위 (예: "캐시") — 표기는 `point + ' ' + unit` 권장 |
| `icon` | string | 광고 아이콘 URL |

### JS API 요약

| 메서드 | 설명 |
|---|---|
| `Gad.Ofw.init()` | 초기화 (인자 없음 — mediaKey/userId 는 네이티브가 보유) |
| `Gad.Ofw.loadAds(size?)` | 광고 목록. 생략/0 = 전체 |
| `Gad.Ofw.registerNativeAd(ad, el)` | 요소 클릭 → 네이티브 상세 진입 바인딩 |
| `Gad.Ofw.impression(ad)` | 노출 트래킹 |
| `Gad.Ofw.showOfferwall(ad?)` | ad 있으면 상세, 없으면 네이티브 풀 오퍼월 |
| `Gad.Ofw.showHelp()` | 고객센터 |
| `Gad.Ofw.setUid(uid)` | 사용자 식별자 갱신 (웹 로그인 후) |

---

## 4. 동작 확인 체크리스트

1. 앱에서 웹 오퍼월 진입 → 목록이 매체에 설정된 캠페인으로 렌더되는가
2. 카드 탭 → 네이티브 상세 페이지가 뜨는가
3. 상세에서 참여 → 적립 → 포스트백 수신 확인
4. 고객센터 진입/문의 동작

## 주의사항

- 이 SDK 는 **GAD 네이티브 WebView 안에서만** 동작합니다. 일반 브라우저에서 페이지를 직접 열면 `loadAds` 가 거부됩니다.
- 적립 포인트는 목록의 `point`(매체 노출용)만 제공됩니다.
- 페이지는 https 로 호스팅하세요. (개발 중 http 테스트는 OS 별 로컬 네트워킹 예외 필요)

문의: jayce@gpakorea.com
