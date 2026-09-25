
export const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// 익일 07시까지 전날 기록으로 처리하는 로직
export const getWorkDate = () => {
  const now = new Date();
  const hours = now.getHours();
  // 07시 이전이면 날짜를 하루 뺌
  if (hours < 7) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const getCurrentTimeString = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const formatToManwon = (val: number) => {
  if (isNaN(val)) return '0';
  return Math.round(val / 10000).toLocaleString('ko-KR');
};

export const safeInt = (value: any) => {
  if (!value) return 0;
  const num = parseInt(String(value).replace(/,/g, ''), 10);
  return isNaN(num) ? 0 : num;
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // 지구 반지름 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // 정밀 지구 표면 직선/측지선 거리 (km)
};

// 속도 지수이동평균(EMA) 스무딩
export const smoothSpeed = (prevSmoothed: number | null, rawSpeedKmh: number, alpha: number = 0.35): number => {
  if (rawSpeedKmh < 1.0) return 0;
  if (prevSmoothed === null || prevSmoothed <= 0) return rawSpeedKmh;
  return prevSmoothed * (1 - alpha) + rawSpeedKmh * alpha;
};

export const formatSpeedDisplay = (speedKmh: number | null): string => {
  if (speedKmh === null || isNaN(speedKmh) || speedKmh < 0) return '-- km/h';
  if (speedKmh < 1.0) return '0 km/h';
  return `${Math.round(speedKmh)} km/h`;
};

export const calculateDuration = (start: string, end: string): string => {
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  let diff = (eH * 60 + eM) - (sH * 60 + sM);
  if (diff < 0) diff += 1440; 
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
};

export const findPriceForRoute = (records: any[], f: string, t: string) => {
  if (!f || !t || !f.trim() || !t.trim()) return null;
  const ft = normalizeCenterName(f);
  const tt = normalizeCenterName(t);
  // 최신 기록부터 검색
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    if (normalizeCenterName(r.from || '') === ft && normalizeCenterName(r.to || '') === tt && r.income > 0) {
      return r.income;
    }
  }
  return null;
};

/**
 * 화물 센터명 정규화 함수
 * 규칙:
 * 1. 고양1, 고양1센터, 고양1물류센터, 고양1(54) -> 모두 '고양1'
 *    (기본명 뒤에 붙은 '센터', '물류센터', '(숫자)' 등은 무시)
 * 2. 인천2(SH) vs 인천2 -> (SH)는 서브센터이므로 철저히 다른 곳으로 구분 (인천2(SH) 유지)
 * 3. SF고양1 vs 고양1 -> 접두사(SF)가 다르므로 다른 곳으로 구분
 */
export const normalizeCenterName = (rawName: string): string => {
  if (!rawName) return '';
  let str = rawName.trim();
  if (!str) return '';

  // 1. (SH), [SH], (서브) 등 서브센터 표기 감지 및 보존
  const isSH = /\(SH\)|\[SH\]|\bSH\b/i.test(str);

  // 2. 괄호 안의 단순 숫자 (예: 고양1(54), 동탄1(2), [12]) 제거
  str = str.replace(/\([\d\s]+\)|\[[\d\s]+\]/g, '').trim();

  // 3. 센터/물류센터/HUB/허브/캠프/FC 등 뒤쪽 접미어 공통 처리
  // 단, 고양1물류센터 -> 고양1, 고양1센터 -> 고양1
  // '시흥2HUB' 같은 경우도 '시흥2' 또는 '시흥2HUB'로 유지될 수 있도록 검토하되
  // 고양1, 고양1센터, 고양1물류센터 처럼 '물류센터', '센터' 제거
  str = str.replace(/(물류센터|물류\s*센터|센터|물류)\b/g, '').trim();

  // 4. 불필요한 공백 정리
  str = str.replace(/\s+/g, ' ').trim();

  // 5. SH 서브센터 표기 복원 (인천2(SH) 형태)
  if (isSH) {
    // 이미 (SH)가 깔끔하게 붙어있지 않다면 끝에 (SH) 부착
    str = str.replace(/\(SH\)|\[SH\]/gi, '').trim();
    return `${str}(SH)`;
  }

  return str;
};

/**
 * 운송지역(locations)에서 센터명과 가장 잘 일치하는 정보(주소/메모)를 찾는 함수
 * 1순위: 완전 일치 (name === rawName)
 * 2순위: 정규화 일치 (normalizeCenterName(name) === normalizeCenterName(rawName))
 *        중복이 있을 경우: 주소+메모가 모두 있는 알찬 항목 우선
 */
export const findBestLocationMatch = (
  locations: Record<string, { address?: string; memo?: string }> | undefined,
  rawName: string
): { name: string; address: string; memo: string } => {
  const empty = { name: rawName ? rawName.trim() : '', address: '', memo: '' };
  if (!locations || !rawName || !rawName.trim()) return empty;

  const trimmed = rawName.trim();

  // 1순위: 정확한 일치
  if (locations[trimmed]) {
    return {
      name: trimmed,
      address: locations[trimmed].address || '',
      memo: locations[trimmed].memo || ''
    };
  }

  const targetNorm = normalizeCenterName(trimmed);
  if (!targetNorm) return empty;

  // 2순위: 정규화 이름 일치 검색
  const candidates: Array<{ name: string; address: string; memo: string; score: number }> = [];

  for (const [storedName, info] of Object.entries(locations)) {
    const storedNorm = normalizeCenterName(storedName);
    if (storedNorm === targetNorm) {
      let score = 0;
      if (info.address && info.address.trim()) score += 2;
      if (info.memo && info.memo.trim()) score += 1;
      candidates.push({
        name: storedName,
        address: info.address || '',
        memo: info.memo || '',
        score
      });
    }
  }

  if (candidates.length > 0) {
    // 점수(주소/메모 채워짐)가 가장 높은 것 우선
    candidates.sort((a, b) => b.score - a.score);
    return {
      name: candidates[0].name,
      address: candidates[0].address,
      memo: candidates[0].memo
    };
  }

  return empty;
};

