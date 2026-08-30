
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
  const d = R * c;
  // GPS 직선거리의 한계(코너 자르기 등)를 보정하기 위해 3% 가산
  return d * 1.03; 
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
  const ft = f.trim();
  const tt = t.trim();
  // 최신 기록부터 검색
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    if (r.from?.trim() === ft && r.to?.trim() === tt && r.income > 0) {
      return r.income;
    }
  }
  return null;
};
