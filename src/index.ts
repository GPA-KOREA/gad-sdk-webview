import { Offerwall } from './offerwall';

/** 전역 싱글톤. UMD 빌드 시 `window.Gad.Ofw` 로 노출 (애디슨 `Adison.Ofw` 대응). */
export const Ofw = new Offerwall();

export { Offerwall };
export type { GadAd } from './types';
