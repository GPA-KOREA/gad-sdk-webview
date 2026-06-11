// 네이티브 브리지 호출 레이어.
//
// Android: window.GadOfwBridge
//   네이티브가 webView.addJavascriptInterface(obj, "GadOfwBridge") 로 주입한 @JavascriptInterface 객체.
// iOS:     window.webkit.messageHandlers.GadOfwBridge
//   WKScriptMessageHandler (name "GadOfwBridge"). postMessage(payload) 로 호출.
//
// 비동기 결과 회수 (네이티브 → 웹):
//   Android — 네이티브가 evaluateJavascript("window.__gadOfwAndroidResult('<handle>', <true|false>)") 호출
//             → JS 가 GadOfwBridge.runAsyncResult('<handle>') 로 결과 문자열을 동기 회수.
//             (큰 페이로드를 네이티브에 보관 → 동기 pull → 인자 이스케이프 이슈 회피)
//   iOS     — 네이티브가 evaluateJavaScript("window.__gadOfwIOSResult('<handle>', '<data>', '<error>')") 호출.

/** Android @JavascriptInterface 계약 (네이티브가 구현). */
export interface GadAndroidBridge {
  // 비동기 — 결과는 runAsyncResult(handle) 로 회수
  loadAds(handle: string, size: number): void;
  availableReward(handle: string): void;
  getSdkVersion(handle: string): void;
  runAsyncResult(handle: string): string;
  // fire-and-forget
  setUid(uid: string): void;
  showNativeAd(adKey: string): void;
  showOfferwall(): void;
  showHelp(): void;
  impression(adKey: string): void;
  clearCache(): void;
}

interface IOSMessageHandler {
  postMessage(message: unknown): void;
}

declare global {
  interface Window {
    GadOfwBridge?: GadAndroidBridge;
    webkit?: { messageHandlers?: Record<string, IOSMessageHandler> };
    __gadOfwAndroidResult?: (handle: string, success: boolean) => void;
    __gadOfwIOSResult?: (handle: string, data: string, error?: string) => void;
  }
}

interface Pending {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

const pending = new Map<string, Pending>();
let counter = 0;
let installed = false;

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

/** 네이티브 → 웹 결과 디스패처를 1회만 설치 — 호출마다 글로벌 콜백을 덮어쓰면 동시 호출 시 경합하므로 단일 디스패처로 고정. */
function installDispatchers(): void {
  if (installed) return;
  installed = true;

  window.__gadOfwAndroidResult = (handle, success) => {
    const p = pending.get(handle);
    if (!p) return;
    pending.delete(handle);
    let raw = '';
    try {
      raw = window.GadOfwBridge ? window.GadOfwBridge.runAsyncResult(handle) : '';
    } catch (e) {
      p.reject(toError(e));
      return;
    }
    if (success) p.resolve(raw);
    else p.reject(new Error(raw || 'native bridge error'));
  };

  window.__gadOfwIOSResult = (handle, data, error) => {
    const p = pending.get(handle);
    if (!p) return;
    pending.delete(handle);
    if (error) p.reject(new Error(error));
    else p.resolve(data);
  };
}

/** iOS WKScriptMessageHandler 접근 단일화. */
function iosHandler(): IOSMessageHandler | undefined {
  return window.webkit?.messageHandlers?.GadOfwBridge;
}

export function isAndroid(): boolean {
  return !!window.GadOfwBridge;
}

export function isIOS(): boolean {
  return !!iosHandler();
}

export function hasBridge(): boolean {
  return isAndroid() || isIOS();
}

export interface AsyncSpec {
  android: (bridge: GadAndroidBridge, handle: string) => void;
  ios: { command: string; payload?: Record<string, unknown> };
}

/** 비동기 브리지 호출 → Promise<결과 문자열>. */
export function asyncCall(spec: AsyncSpec): Promise<string> {
  installDispatchers();
  counter += 1;
  const handle = `gadOfw_${counter}`;
  return new Promise<string>((resolve, reject) => {
    pending.set(handle, { resolve, reject });
    try {
      const android = window.GadOfwBridge;
      const ios = iosHandler();
      if (android) {
        spec.android(android, handle);
      } else if (ios) {
        ios.postMessage({ ...spec.ios.payload, command: spec.ios.command, id: handle });
      } else {
        pending.delete(handle);
        reject(new Error('No native bridge found'));
      }
    } catch (e) {
      pending.delete(handle);
      reject(toError(e));
    }
  });
}

export interface FireSpec {
  android: (bridge: GadAndroidBridge) => void;
  ios: { command: string; payload?: Record<string, unknown> };
  /** 브리지가 없을 때 (개발 모드) 실행. 없으면 무시. */
  fallback?: () => void;
}

/** fire-and-forget 브리지 호출. */
export function fireCall(spec: FireSpec): void {
  const android = window.GadOfwBridge;
  const ios = iosHandler();
  if (android) {
    spec.android(android);
  } else if (ios) {
    ios.postMessage({ ...spec.ios.payload, command: spec.ios.command });
  } else if (spec.fallback) {
    spec.fallback();
  }
}
