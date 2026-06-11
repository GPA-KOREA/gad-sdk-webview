/** 광고 객체 — loadAds 결과. GAD API(advertisement list) 필드명을 그대로 따른다.
 *  퍼블리셔는 이 데이터로 자기 HTML 목록을 직접 렌더한다. */
export interface GadAd {
  /** 광고 ID. 노출 트래킹(impression)에 사용. */
  id: string;
  /** 광고키. 참여/적립 시 네이티브가 사용. */
  key: string;
  /** 광고 타입 (0 참여 / 1 설치 / 2 실행 / 3 미션 / 4 액션 / 5 CPS). */
  type: number;
  /** 광고명. */
  title: string;
  /** 적립 포인트. */
  point: number;
  /** 적립 단위 (목록 공통, 예: "캐시"). 내부 수익(save_point)은 절대 포함되지 않음. */
  unit?: string;
  /** 광고 아이콘 URL. */
  icon?: string;
}
