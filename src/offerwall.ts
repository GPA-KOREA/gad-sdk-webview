import { asyncCall, fireCall, hasBridge } from './bridge';
import type { GadAd } from './types';

const SDK_VERSION = '0.1.1';

/**
 * GAD 오퍼월 웹뷰 SDK.
 *
 * **동작 모델**: 이 JS SDK 는 로직을 거의 갖지 않는 "네이티브 브리지 래퍼"다.
 * 실제 광고 조회·랜딩·설치감지·적립·고객센터는 모두 GAD 네이티브 SDK 가 처리하고,
 * 웹은 (1) 광고 데이터 요청 (2) 퍼블리셔가 자기 HTML 로 목록 직접 렌더 (3) 노출/클릭을 네이티브에 전달만 한다.
 *
 * 네이티브 WebView 밖(일반 브라우저)에서는 브리지가 없으므로 loadAds 등이 reject 된다 (WebView 전용).
 */
export class Offerwall {
  /** SDK 초기화. 페이지 unload 시 네이티브 캐시 정리 리스너를 등록한다.
   *  mediaKey/userId 는 호스트 앱의 네이티브 `Gad.init(mediaKey, userId)` 이 이미 보유하므로 인자가 없다. */
  init(): void {
    const clear = (): void => this.clearCache();
    window.addEventListener('unload', clear, false);
    window.addEventListener('beforeunload', clear, false);
    if (!hasBridge()) {
      console.warn('[Gad.Ofw] 네이티브 브리지가 없습니다. 이 SDK 는 GAD 네이티브 WebView 안에서만 동작합니다.');
    }
  }

  /** 웹 SDK 버전 (동기). */
  getVersion(): string {
    return SDK_VERSION;
  }

  /** 네이티브 SDK 버전 (비동기 브리지). 브리지 없으면 웹 SDK 버전 반환. */
  getSdkVersion(): Promise<string> {
    if (!hasBridge()) return Promise.resolve(SDK_VERSION);
    return asyncCall({
      android: (b, h) => b.getSdkVersion(h),
      ios: { command: 'getSdkVersion' },
    });
  }

  /** 매체 사용자 식별자 바인딩 (웹에서 로그인 후 호출). */
  setUid(uid?: string): void {
    fireCall({
      android: (b) => b.setUid(uid ?? ''),
      ios: { command: 'setUid', payload: { uid: uid ?? '' } },
    });
  }

  /** 적립 가능 잔액 — 현재 미지원(보류). 호출 시 reject. */
  availableReward(): Promise<number> {
    console.warn('[Gad.Ofw] availableReward 는 아직 지원하지 않습니다.');
    return Promise.reject(new Error('availableReward is not supported yet'));
  }

  /** 브리지(네이티브 WebView)가 없을 때의 reject. 이 SDK 는 WebView 전용이다. */
  private noBridge(): Promise<never> {
    return Promise.reject(
      new Error('Gad.Ofw 는 GAD 네이티브 WebView 안에서만 동작합니다 (브리지 없음).'),
    );
  }

  /** 광고 목록 조회. `size` 를 생략(또는 0)하면 매체에 설정된 **전체 캠페인**, 양수면 그 개수만큼 반환한다.
   *  퍼블리셔가 이 결과로 커스텀 HTML 목록을 렌더한다. */
  async loadAds(size = 0): Promise<GadAd[]> {
    if (!hasBridge()) return this.noBridge();
    const raw = await asyncCall({
      android: (b, h) => b.loadAds(h, size),
      ios: { command: 'loadAds', payload: { size } },
    });
    return parseAds(raw);
  }

  /** 광고 DOM 요소에 클릭 → showOfferwall(ad) 바인딩 (로컬 DOM 처리만). */
  registerNativeAd(ad: GadAd, adView: HTMLElement): void {
    adView.classList.add('gad-ofw-native-ad-view');
    adView.addEventListener('click', () => this.showOfferwall(ad), false);
  }

  /** 광고 상세/참여 진입. ad 지정 시 해당 광고, 미지정 시 네이티브 풀 오퍼월. */
  showOfferwall(ad?: GadAd): void {
    if (ad != null) {
      fireCall({
        android: (b) => b.showNativeAd(ad.key),
        ios: { command: 'showOfferwallDetail', payload: { key: ad.key } },
        fallback: () => console.warn(`[Gad.Ofw] showOfferwall(${ad.title}) — 네이티브 브리지가 필요합니다.`),
      });
      return;
    }
    fireCall({
      android: (b) => b.showOfferwall(),
      ios: { command: 'showOfferwall' },
      fallback: () => console.warn('[Gad.Ofw] showOfferwall — 네이티브 브리지가 필요합니다.'),
    });
  }

  /** 고객센터/문의 화면. */
  showHelp(): void {
    fireCall({
      android: (b) => b.showHelp(),
      ios: { command: 'showHelp' },
      fallback: () => console.warn('[Gad.Ofw] showHelp — 네이티브 브리지가 필요합니다.'),
    });
  }

  /** 광고 노출 트래킹. loadAds 로 받은 광고 객체를 그대로 전달. (목록에서 광고가 화면에 보일 때 호출) */
  impression(ad: GadAd): void {
    fireCall({
      android: (b) => b.impression(ad.key),
      ios: { command: 'impression', payload: { key: ad.key } },
    });
  }

  /** 네이티브 캐시 정리 (페이지 unload 시 자동 호출). */
  clearCache(): void {
    fireCall({
      android: (b) => b.clearCache(),
      ios: { command: 'clearCache' },
    });
  }
}

/** 네이티브가 반환한 JSON 문자열 → GadAd[]. 배열 또는 {ads:[...]} 모두 허용. */
function parseAds(raw: string): GadAd[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw.replace(/\t/g, '')) as unknown;
  if (Array.isArray(parsed)) return parsed as GadAd[];
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { ads?: unknown }).ads)) {
    return (parsed as { ads: GadAd[] }).ads;
  }
  return [];
}
