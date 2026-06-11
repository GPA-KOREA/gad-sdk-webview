# GAD Offerwall WebView SDK (`Gad.Ofw`)

GAD 오퍼월 **웹뷰 SDK**. 매체가 자체 웹페이지로 오퍼월 목록 UI 를 구성할 수 있게 하는 네이티브 브리지 래퍼다.

> ⚠️ 이 SDK 는 **네이티브 앱의 WebView 안에서만** 동작한다. GAD **네이티브 SDK**(Android `client/gad`, iOS `client/gad-ios`)가 선행 연동돼 있어야 한다. 브리지가 없는 일반 브라우저에서는 `loadAds` 등이 명확히 reject 된다 (WebView 전용).

## 동작 모델

이 JS SDK 는 로직을 거의 갖지 않는 **네이티브 브리지 래퍼**다.

```
[네이티브 앱]
  Gad.init(ctx, mediaKey, userId)         // 네이티브 SDK 초기화 (호스트 앱)
  Gad.showWebOfferwall(ctx, pageUrl)      // WebView 컨테이너 띄움 + GadOfwBridge 주입
        └ WebView(pageUrl)
             └ [퍼블리셔 HTML] <script src="gad-ofw-sdk.umd.js">
                   Gad.Ofw.loadAds()              → 네이티브가 /campaign/list 조회
                   퍼블리셔가 자기 HTML 로 목록 렌더
                   Gad.Ofw.registerNativeAd(ad,el) → 클릭 바인딩
                   Gad.Ofw.showOfferwall(ad)      → 네이티브 상세/랜딩/적립 (기존 로직 재사용)
```

광고 조회·랜딩·설치감지·적립·고객센터는 **모두 네이티브 SDK** 가 처리한다. 웹은 (1) 광고 데이터 요청 (2) 커스텀 HTML 목록 렌더 (3) 노출/클릭 전달만 한다.

> 📖 매체(퍼블리셔) 연동 절차는 **[GUIDE.md](GUIDE.md)** 참고 (네이티브 의존성 버전 포함).

## 설치

```html
<!-- CDN (UMD, 전역 Gad) -->
<script src="https://cdn.gpakorea.com/gad/ofw-sdk/0.1.0/gad-ofw-sdk.umd.js"></script>
```

## 빠른 시작

```js
// 1. 초기화 (mediaKey/userId 는 네이티브 Gad.init 이 이미 보유 → 인자 없음)
Gad.Ofw.init();

// 2. 광고 목록 → 직접 렌더 (인자 없으면 전체, 숫자 주면 그 개수)
const ads = await Gad.Ofw.loadAds();
ads.forEach((ad) => {
  const el = renderMyCard(ad);          // 퍼블리셔 커스텀 UI
  Gad.Ofw.registerNativeAd(ad, el);     // 클릭 → 네이티브 상세
  Gad.Ofw.impression(ad.id);            // 노출 트래킹
});

// 3. 부가 진입
Gad.Ofw.showOfferwall();   // 네이티브 풀 오퍼월
Gad.Ofw.showHelp();        // 고객센터
Gad.Ofw.setUid('USER_ID'); // 사용자 식별자 바인딩
```

## API

| 메서드 | 설명 | 반환 |
|---|---|---|
| `init()` | 초기화 (unload 시 캐시 정리 리스너 등록) | void |
| `loadAds(size?)` | 광고 목록. 생략/0 = 전체, 양수 = 그 개수 | `Promise<GadAd[]>` |
| `registerNativeAd(ad, el)` | 클릭 → `showOfferwall(ad)` 바인딩 | void |
| `impression(adId)` | 노출 트래킹 | void |
| `showOfferwall(ad?)` | ad 있으면 상세, 없으면 풀 오퍼월 | void |
| `showHelp()` | 고객센터 | void |
| `setUid(uid)` | 사용자 식별자 바인딩 | void |
| `clearCache()` | 네이티브 캐시 정리 (unload 시 자동) | void |
| `getSdkVersion()` | 네이티브 SDK 버전 | `Promise<string>` |
| `getVersion()` | 웹 SDK 버전 | string |
| `availableReward()` | 적립 가능 잔액 — **미지원(보류)** | `Promise<number>` (reject) |

### `GadAd`

GAD API(advertisement list) 필드명을 그대로 따릅니다.

```ts
interface GadAd {
  id: string;        // 광고 ID (노출 트래킹 impression 용)
  key: string;       // 광고키 (참여/적립)
  type: number;      // 0 참여 / 1 설치 / 2 실행 / 3 미션 / 4 액션 / 5 CPS
  title: string;     // 광고명
  point: number;     // 적립 포인트 (내부 수익 save_point 는 절대 미포함)
  unit?: string;     // 적립 단위 (목록 공통, 예: "캐시")
  icon?: string;     // 광고 아이콘 URL
}
```

## 네이티브 브리지 계약 (네이티브 SDK 구현용)

- **Android**: `webView.addJavascriptInterface(bridge, "GadOfwBridge")`
  - 비동기: `loadAds(handle, size)` / `availableReward(handle)` / `getSdkVersion(handle)` + `runAsyncResult(handle): String`
  - fire-and-forget: `setUid(uid)` / `showNativeAd(adId)` / `showOfferwall()` / `showHelp()` / `impression(adId)` / `clearCache()`
  - 비동기 완료 시 네이티브 → 웹: `evaluateJavascript("window.__gadOfwAndroidResult('<handle>', <true|false>)")` 호출 후 JS 가 `runAsyncResult(handle)` 로 결과(JSON 문자열) 회수.
- **iOS**: `WKScriptMessageHandler` name `"GadOfwBridge"`
  - `postMessage({command, id?, ...})` 수신. 비동기 완료 시 `evaluateJavaScript("window.__gadOfwIOSResult('<handle>', '<data>', '<error>')")` 호출.

## 개발

```bash
npm install
npm test          # vitest — 브리지 프로토콜 유닛 테스트
npm run typecheck # tsc --noEmit
npm run build     # dist/ (ES + UMD + .d.ts)
npm run serve     # 빌드 후 sample/index.html 로컬 서버 (네이티브 WebView 안에서 로드)
```

문의: jayce@gpakorea.com
