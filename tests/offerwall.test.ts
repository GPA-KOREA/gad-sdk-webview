import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Offerwall } from '../src/offerwall';

function resetBridges(): void {
  delete window.GadOfwBridge;
  delete window.webkit;
}

beforeEach(() => resetBridges());

describe('Gad.Ofw — Android 브리지', () => {
  it('loadAds: GadOfwBridge.loadAds 호출 + runAsyncResult 로 결과 회수', async () => {
    const store: Record<string, string> = {};
    window.GadOfwBridge = {
      loadAds(handle: string) {
        store[handle] = JSON.stringify([
          { key: 'k1', type: 0, title: 'A', point: 100, unit: '캐시' },
          { key: 'k2', type: 3, title: 'B', point: 200, unit: '캐시' },
        ]);
        window.__gadOfwAndroidResult!(handle, true);
      },
      runAsyncResult: (handle: string) => store[handle],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const ads = await new Offerwall().loadAds(20);
    expect(ads).toHaveLength(2);
    expect(ads[0]).toMatchObject({ key: 'k1', title: 'A', point: 100, unit: '캐시' });
  });

  it('loadAds: 네이티브 실패 시 reject', async () => {
    const store: Record<string, string> = {};
    window.GadOfwBridge = {
      loadAds(handle: string) {
        store[handle] = 'boom';
        window.__gadOfwAndroidResult!(handle, false);
      },
      runAsyncResult: (handle: string) => store[handle],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await expect(new Offerwall().loadAds()).rejects.toThrow(/boom/);
  });

  it('showOfferwall(ad): showNativeAd(id) 호출', () => {
    const showNativeAd = vi.fn();
    window.GadOfwBridge = { showNativeAd } as any;
    new Offerwall().showOfferwall({ key: 'k7', type: 0, title: 'X', point: 0 });
    expect(showNativeAd).toHaveBeenCalledWith('k7');
  });

  it('showOfferwall(): 인자 없으면 showOfferwall() 호출', () => {
    const showOfferwall = vi.fn();
    window.GadOfwBridge = { showOfferwall } as any;
    new Offerwall().showOfferwall();
    expect(showOfferwall).toHaveBeenCalledOnce();
  });

  it('impression: 광고 key 로 호출', () => {
    const impression = vi.fn();
    window.GadOfwBridge = { impression } as any;
    new Offerwall().impression({ key: 'k42', type: 0, title: 'I', point: 0 });
    expect(impression).toHaveBeenCalledWith('k42');
  });

  it('registerNativeAd: class 추가 + 클릭 시 showNativeAd', () => {
    const showNativeAd = vi.fn();
    window.GadOfwBridge = { showNativeAd } as any;
    const ofw = new Offerwall();
    const el = document.createElement('div');
    ofw.registerNativeAd({ key: 'k9', type: 0, title: 'Z', point: 0 }, el);
    expect(el.classList.contains('gad-ofw-native-ad-view')).toBe(true);
    el.click();
    expect(showNativeAd).toHaveBeenCalledWith('k9');
  });
});

describe('Gad.Ofw — iOS 브리지', () => {
  it('loadAds: postMessage(command:loadAds) + __gadOfwIOSResult 로 resolve', async () => {
    let posted: Record<string, unknown> | null = null;
    window.webkit = {
      messageHandlers: {
        GadOfwBridge: {
          postMessage(msg: Record<string, unknown>) {
            posted = msg;
            window.__gadOfwIOSResult!(
              msg.id as string,
              JSON.stringify([{ key: 'k3', type: 0, title: 'C', point: 300 }]),
            );
          },
        },
      },
    };
    const ads = await new Offerwall().loadAds(20);
    expect(posted!.command).toBe('loadAds');
    expect(posted!.size).toBe(20); // 요청 size 그대로 전달 (인위적 캡 없음)
    expect(ads[0]).toMatchObject({ key: 'k3', title: 'C', point: 300 });
  });

  it('showHelp: postMessage(command:showHelp)', () => {
    let posted: Record<string, unknown> | null = null;
    window.webkit = {
      messageHandlers: { GadOfwBridge: { postMessage: (m: Record<string, unknown>) => { posted = m; } } },
    };
    new Offerwall().showHelp();
    expect(posted).toEqual({ command: 'showHelp' });
  });

  it('impression: postMessage(command:impression, key)', () => {
    let posted: Record<string, unknown> | null = null;
    window.webkit = {
      messageHandlers: { GadOfwBridge: { postMessage: (m: Record<string, unknown>) => { posted = m; } } },
    };
    new Offerwall().impression({ key: 'k55', type: 0, title: 'I', point: 0 });
    expect(posted).toEqual({ command: 'impression', key: 'k55' });
  });
});

describe('Gad.Ofw — 브리지 없음 (WebView 밖)', () => {
  it('loadAds: 브리지 없으면 reject (WebView 전용)', async () => {
    await expect(new Offerwall().loadAds()).rejects.toThrow(/WebView/);
  });

  it('availableReward: 미지원 reject', async () => {
    await expect(new Offerwall().availableReward()).rejects.toThrow(/not supported/);
  });

  it('showOfferwall: 브리지 없으면 throw 하지 않음', () => {
    expect(() => new Offerwall().showOfferwall({ key: 'k1', type: 0, title: 'a', point: 0 })).not.toThrow();
  });

  it('init: 인자 없이 호출 가능', () => {
    expect(() => new Offerwall().init()).not.toThrow();
  });
});
