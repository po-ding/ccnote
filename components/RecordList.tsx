
import React, { useState, useMemo, useEffect } from 'react';
import { Clipboard } from '@capacitor/clipboard';
import { TransportRecord, LocationInfo, RecordType } from '../types';
import { 
  Truck, 
  Fuel, 
  Edit2, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2,
  Play,
  Square,
  RotateCcw,
  XCircle,
  Activity,
  Clock,
  Info,
  Wind,
  CornerUpLeft,
  Ban,
  Copy,
  Navigation,
  X
} from 'lucide-react';
import { formatToManwon, normalizeCenterName, findBestLocationMatch } from '../utils';

interface Props {
  records: TransportRecord[];
  locations: Record<string, LocationInfo>;
  setLocations?: React.Dispatch<React.SetStateAction<Record<string, LocationInfo>>>;
  setRecords?: React.Dispatch<React.SetStateAction<TransportRecord[]>>;
  viewDate: string;
  isTracking: boolean;
  currentGpsDistance: number;
  currentCargoDistance: number;
  onEdit: (record: TransportRecord) => void;
  onQuickUpdate: (id: number, status: RecordType) => void;
}

const RecordList: React.FC<Props> = ({ records, locations, setLocations, setRecords, viewDate, isTracking, currentGpsDistance, currentCargoDistance, onEdit, onQuickUpdate }) => {
  const [isWaitExpanded, setIsWaitExpanded] = useState(true);
  const [isDoneExpanded, setIsDoneExpanded] = useState(false);
  const [isEmptyExpanded, setIsEmptyExpanded] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    placeholder: string;
    value: string;
    onSave: (val: string) => void;
  }>({
    isOpen: false,
    title: '',
    placeholder: '',
    value: '',
    onSave: () => {},
  });

  const [selectedEstimateRoute, setSelectedEstimateRoute] = useState<{
    from: string;
    to: string;
    stats: { min: number; max: number; expected: number; count: number } | null;
  } | null>(null);

  // 동일 구간 과거 운행시간 사전 집계 (O(1) 캐시 맵)
  const routeTimeStatsMap = useMemo(() => {
    if (!Array.isArray(records)) return {};

    const map: Record<string, { min: number; max: number; expected: number; count: number }> = {};
    const routeDurations: Record<string, number[]> = {};

    records.forEach(r => {
      // 1. 현재 운행 중이거나 취소된 건은 제외
      if (r.isStarted || r.type === '운행취소' || r.type === '공차거리' || r.type === '주유기록') return;
      if (!r.from || !r.to || !r.from.trim() || !r.to.trim()) return;
      if (!r.time || !r.endTime) return;

      const [sh, sm] = r.time.split(':').map(Number);
      const [eh, em] = r.endTime.split(':').map(Number);
      if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return;

      let diffMinutes = (eh * 60 + em) - (sh * 60 + sm);
      if (diffMinutes < 0) diffMinutes += 1440; // 자정 넘김 대응

      // 2. 비정상 이상치(5분 미만, 12시간 초과) 제외
      if (diffMinutes < 5 || diffMinutes > 720) return;

      const normFrom = normalizeCenterName(r.from);
      const normTo = normalizeCenterName(r.to);
      if (!normFrom || !normTo) return;

      const key = `${normFrom}➜${normTo}`;
      if (!routeDurations[key]) {
        routeDurations[key] = [];
      }
      routeDurations[key].push(diffMinutes);
    });

    Object.keys(routeDurations).forEach(key => {
      const list = routeDurations[key];
      if (list.length === 0) return;
      const min = Math.min(...list);
      const max = Math.max(...list);
      const expected = Math.round((min + max) / 2);
      map[key] = {
        min,
        max,
        expected,
        count: list.length
      };
    });

    return map;
  }, [records]);

  const handleEditCenter = (record: TransportRecord, target: 'from' | 'to') => {
    const isFrom = target === 'from';
    const currentName = isFrom ? (record.from || '') : (record.to || '');
    setModalState({
      isOpen: true,
      title: `${isFrom ? '상차' : '하차'} 센터 수정`,
      placeholder: '센터명을 입력하세요 (예: 서울센터)',
      value: currentName,
      onSave: (newCenterName) => {
        const trimmed = newCenterName.trim();
        if (!trimmed) return;
        if (setRecords) {
          setRecords(prev => prev.map(r => r.id === record.id ? { ...r, [target]: trimmed } : r));
        }
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `${isFrom ? '상차' : '하차'} 센터가 수정되었습니다.` } }));
      }
    });
  };

  const handleEditMemo = (record: TransportRecord, target: 'from' | 'to') => {
    const isFrom = target === 'from';
    const centerName = isFrom ? record.from : record.to;
    if (!centerName) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `먼저 ${isFrom ? '상차' : '하차'} 센터를 입력해주세요.`, type: 'error' } }));
      return;
    }
    const currentMemo = locations[centerName]?.memo || '';
    setModalState({
      isOpen: true,
      title: `'${centerName}' ${isFrom ? '상차' : '하차'} 메모 수정`,
      placeholder: '메모를 입력하세요',
      value: currentMemo,
      onSave: (newMemo) => {
        if (setLocations) {
          setLocations(prev => ({
            ...prev,
            [centerName]: {
              address: prev[centerName]?.address || '',
              memo: newMemo.trim()
            }
          }));
        }
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `${isFrom ? '상차' : '하차'} 메모가 수정되었습니다.` } }));
      }
    });
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const processedRecords = useMemo(() => {
    if (!Array.isArray(records)) return [];
    return records
      .filter(r => r && (r.date === viewDate || r.isStarted))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time || "").localeCompare(b.time || "");
      });
  }, [records, viewDate]);

  const formatDist = (dist: number) => {
    if (dist < 10) return dist.toFixed(2);
    if (dist < 100) return dist.toFixed(1);
    return Math.round(dist).toString();
  };

  const runningRecords = processedRecords.filter(r => r && r.isStarted);
  
  const waitingRecords = processedRecords.filter(r => 
    r && !r.isStarted && 
    r.date === viewDate && 
    !r.endTime && 
    ['대기', '화물운송'].includes(r.type)
  );

  const completedRecords = processedRecords.filter(r => 
    r && !r.isStarted && 
    r.date === viewDate && 
    ['화물운송', '수입', '지출', '운행종료', '운행취소', '운행회차', '소모품'].includes(r.type) &&
    (r.endTime || (r.income || 0) > 0 || (r.cost || 0) > 0 || (r.distance || 0) > 0 || r.type === '운행취소')
  );

  const completedNormalTripsCount = completedRecords.filter(r => r.type !== '운행취소').length;
  const cancelledTripsCount = completedRecords.filter(r => r.type === '운행취소').length;

  const emptyRecords = processedRecords.filter(r => 
    r && !r.isStarted && 
    r.date === viewDate && 
    r.type === '공차거리'
  );

  const copyAddress = async (name: string) => {
    const match = findBestLocationMatch(locations, name);
    const targetAddress = (match && match.address && match.address.trim()) ? match.address.trim() : name;
    await Clipboard.write({ string: targetAddress });
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `📋 ${targetAddress}` } }));
  };

  const [showConfirm, setShowConfirm] = useState<{id: number, status: RecordType} | null>(null);

  const handleQuickUpdateClick = (id: number, status: RecordType) => {
    onQuickUpdate(id, status);
  };

  const getVisitCount = (centerName?: string) => {
    if (!centerName || !Array.isArray(records)) return 0;
    const norm = normalizeCenterName(centerName);
    if (!norm) return 0;
    return records.filter(r => r && (normalizeCenterName(r.from || '') === norm || normalizeCenterName(r.to || '') === norm)).length;
  };

  const renderCard = (record: TransportRecord, isActive: boolean = false, isWaiting: boolean = false) => {
    if (!record) return null;
    const isActuallyCompleted = !isActive && !isWaiting && (
      record.endTime || 
      (record.income || 0) > 0 || 
      (record.cost || 0) > 0 || 
      (record.distance || 0) > 0 ||
      record.type === '운행취소'
    );
    const hasLocationData = !!(record.from || record.to);
    let displayType: string = record.type || "기타";
    
    if (isActive) {
      displayType = record.type === '공차거리' ? (record.from || '공차 측정 중') : '운행 중';
    }
    
    const isOverhead = record.type === '공차거리' || record.type === '주유기록';
    const isCancelled = record.type === '운행취소';

    let durationStr = "";
    if (isActive && record.time && record.type !== '공차거리') {
      let startDate: Date;
      if (record.date) {
        const [y, m, d] = record.date.split('-').map(Number);
        const [sh, sm] = record.time.split(':').map(Number);
        startDate = new Date(y, m - 1, d, sh, sm, 0, 0);
      } else {
        const [sh, sm] = record.time.split(':').map(Number);
        startDate = new Date(currentTime);
        startDate.setHours(sh, sm, 0, 0);
      }
      if (startDate.getTime() > currentTime.getTime()) {
        startDate.setDate(startDate.getDate() - 1);
      }
      const diff = Math.max(0, currentTime.getTime() - startDate.getTime());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      durationStr = `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    const startVisitCount = getVisitCount(record.from);
    const endVisitCount = getVisitCount(record.to);
    const normFrom = record.from ? normalizeCenterName(record.from) : '';
    const normTo = record.to ? normalizeCenterName(record.to) : '';
    const routeKey = (normFrom && normTo) ? `${normFrom}➜${normTo}` : '';
    const routeStats = routeKey ? routeTimeStatsMap[routeKey] : null;

    const fromMatch = record.from ? findBestLocationMatch(locations, record.from) : null;
    const toMatch = record.to ? findBestLocationMatch(locations, record.to) : null;

    return (
      <div key={record.id} className={`bg-white rounded-2xl p-4 shadow-sm border ${isActive ? 'border-blue-500 ring-2 ring-blue-100 scale-[1.02]' : isCancelled ? 'border-red-200 bg-red-50/10' : isOverhead ? 'border-orange-200 bg-orange-50/10' : 'border-slate-100'} flex flex-col gap-3 transition-all relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300`}>
        {isActive && (
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-100 overflow-hidden">
            <div className="h-full bg-blue-500 animate-[loading_2s_infinite] w-1/3"></div>
          </div>
        )}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {isWaiting ? (
              <button 
                onClick={() => onQuickUpdate(record.id, '화물운송')} 
                className="p-2 bg-blue-600 hover:bg-blue-700 active:scale-90 text-white rounded-xl shadow-md transition-all flex items-center justify-center shrink-0 group"
                title="운행 시작"
                aria-label="운행 시작"
              >
                <Play size={18} fill="white" className="ml-0.5 group-hover:scale-110 transition-transform" />
              </button>
            ) : (
              <span className={`p-2 rounded-xl shrink-0 ${
                isActive 
                  ? 'bg-blue-600 text-white animate-pulse' 
                  : isCancelled
                    ? 'bg-red-50 text-red-500 border border-red-200'
                    : record.type === '공차거리' 
                      ? 'bg-orange-100 text-orange-600' 
                      : record.type === '주유기록' 
                        ? 'bg-orange-50 text-orange-600' 
                        : record.type === '운행회차'
                          ? 'bg-orange-50 text-orange-600 border border-orange-200'
                          : isActuallyCompleted 
                            ? 'bg-emerald-50 text-emerald-600' 
                            : 'bg-slate-100 text-slate-500'
              }`}>
                {isActive ? <Activity size={18} /> : isCancelled ? <Ban size={18} /> : record.type === '공차거리' ? <Wind size={18} /> : record.type === '주유기록' ? <Fuel size={18} /> : record.type === '운행회차' ? <CornerUpLeft size={18} /> : <Truck size={18} />}
              </span>
            )}

            <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
              {/* 1. 진행시간 */}
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                <Clock size={11} className="text-slate-400" />
                <span>{isActive && durationStr ? durationStr : (record.isStarted || record.endTime ? record.time : '00:00')}</span>
              </span>

              {/* 2. 배정시간 */}
              {record.scheduledTime && (
                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md shrink-0">
                  배정 {record.scheduledTime}
                </span>
              )}

              {/* 3. 동일 구간 과거 운행시간 기반 예상시간 */}
              {record.type !== '공차거리' && record.type !== '주유기록' && (
                <button
                  type="button"
                  onClick={() => setSelectedEstimateRoute({
                    from: record.from || '',
                    to: record.to || '',
                    stats: routeStats
                  })}
                  className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 px-2 py-0.5 rounded-md shrink-0 active:scale-95 transition-all flex items-center gap-0.5"
                  title="동일 구간 과거 운행시간 통계 보기"
                >
                  <span>예상 {routeStats && routeStats.count > 0 ? `${routeStats.expected}분` : '-분'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-1 shrink-0">
            <button onClick={() => onEdit(record)} className="p-1.5 text-slate-300 hover:text-blue-500 transition-colors" title="수정"><Edit2 size={16} /></button>
          </div>
        </div>
        
        {record.type !== '공차거리' && record.type !== '주유기록' && (
          <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-3.5 space-y-3">
            {/* 상차 센터 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
                  <span className="text-[11px] font-bold text-blue-600 shrink-0">상차</span>
                  <button 
                    onClick={() => record.from && copyAddress(record.from)} 
                    className="font-black text-xl text-slate-800 tracking-tight truncate hover:text-blue-600 transition-colors text-left"
                    title="주소 복사"
                  >
                    {record.from || '상차지 미지정'}
                  </button>
                  {record.from && (
                    <button 
                      onClick={() => copyAddress(record.from!)} 
                      className="p-1 text-slate-300 hover:text-blue-500 transition-colors shrink-0"
                      title="주소 복사"
                    >
                      <Copy size={13} />
                    </button>
                  )}
                </div>
                {startVisitCount > 0 && (
                  <span className="text-xs font-bold text-slate-700 tracking-tight shrink-0">
                    ({startVisitCount}회)
                  </span>
                )}
              </div>

              {/* 상차지 층수 / 도크 / 특이사항 */}
              {(record.floorInfo || record.vehicleNo || record.aiParsedNote) && (
                <div className="ml-4 flex flex-wrap items-center gap-1.5 mt-1">
                  {record.floorInfo && (
                    <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                      {record.floorInfo}
                    </span>
                  )}
                  {record.vehicleNo && (
                    <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                      [{record.vehicleNo.replace(/[\[\]]/g, '')}]
                    </span>
                  )}
                  {record.aiParsedNote && (
                    <div className="flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-amber-50/80 px-1.5 py-0.5 rounded border border-amber-200/60 max-w-full">
                      <span className="text-xs">💡</span>
                      <span className="truncate">{record.aiParsedNote}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 상차 메모란 */}
              <div className="ml-4 pl-2.5 border-l-2 border-blue-200 flex items-center justify-between gap-2 bg-blue-50/40 p-2 rounded-xl">
                <div className="flex items-start gap-1.5 flex-1 min-w-0">
                  <Info size={13} className="text-blue-400 mt-0.5 shrink-0" />
                  <span className="text-xs font-semibold text-slate-700 break-all leading-snug">
                    {fromMatch && fromMatch.memo ? (
                      fromMatch.memo
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">상차 메모 없음</span>
                    )}
                  </span>
                </div>
                <button 
                  onClick={() => handleEditMemo(record, 'from')} 
                  className="p-1 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-md flex items-center justify-center active:scale-95 transition-all shrink-0"
                  title="상차 메모 수정"
                >
                  <Edit2 size={11} />
                </button>
              </div>
            </div>

            <div className="h-px bg-slate-200/60 my-1"></div>

            {/* 하차 센터 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="text-[11px] font-bold text-emerald-600 shrink-0">하차</span>
                  <button 
                    onClick={() => record.to && copyAddress(record.to)} 
                    className="font-black text-xl text-slate-800 tracking-tight truncate hover:text-emerald-600 transition-colors text-left"
                    title="주소 복사"
                  >
                    {record.to || '하차지 미지정'}
                  </button>
                  {record.to && (
                    <button 
                      onClick={() => copyAddress(record.to!)} 
                      className="p-1 text-slate-300 hover:text-emerald-500 transition-colors shrink-0"
                      title="주소 복사"
                    >
                      <Copy size={13} />
                    </button>
                  )}
                </div>
                {endVisitCount > 0 && (
                  <span className="text-xs font-bold text-slate-700 tracking-tight shrink-0">
                    ({endVisitCount}회)
                  </span>
                )}
              </div>

              {/* 하차 메모란 */}
              <div className="ml-4 pl-2.5 border-l-2 border-emerald-200 flex items-center justify-between gap-2 bg-emerald-50/40 p-2 rounded-xl">
                <div className="flex items-start gap-1.5 flex-1 min-w-0">
                  <Info size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-xs font-semibold text-slate-700 break-all leading-snug">
                    {toMatch && toMatch.memo ? (
                      toMatch.memo
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">하차 메모 없음</span>
                    )}
                  </span>
                </div>
                <button 
                  onClick={() => handleEditMemo(record, 'to')} 
                  className="p-1 bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded-md flex items-center justify-center active:scale-95 transition-all shrink-0"
                  title="하차 메모 수정"
                >
                  <Edit2 size={11} />
                </button>
              </div>
            </div>
          </div>
        )}

        {record.type === '대기' && record.orderNumber && (
          <button 
            onClick={async () => {
              await Clipboard.write({ string: record.orderNumber! });
              window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '밀크런 코드가 복사되었습니다.' } }));
            }}
            className="w-full flex items-center justify-between bg-orange-50 p-2.5 rounded-lg border border-orange-200 mt-1 hover:bg-orange-100 active:scale-[0.98] transition-all group"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-orange-600 font-bold">밀크런 코드</span>
              <span className="text-sm text-orange-900 font-black tracking-wider">{record.orderNumber}</span>
            </div>
            <Copy size={14} className="text-orange-400 group-hover:text-orange-600 transition-colors" />
          </button>
        )}
        
        <div className="flex justify-between items-center px-1">
          <div className="flex gap-4">
             {(record.distance || 0) > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-300">거리</span>
                <span className={`text-sm font-bold ${isOverhead ? 'text-orange-600' : 'text-slate-600'}`}>
                  {record.distance.toFixed(2)}km
                  {isActive && <Navigation size={10} className="inline ml-1 text-blue-500 animate-bounce" />}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2 items-center">
            {record.type === '운행취소' ? (
              <div className="text-xs font-black text-red-500 bg-red-50 px-2 py-1 rounded-lg border border-red-200">
                취소 (0원)
              </div>
            ) : (record.income || 0) > 0 ? (
              <div className="text-lg font-black text-blue-600">+{formatToManwon(record.income)}만</div>
            ) : (isActuallyCompleted && ['화물운송', '운송종료', '운행종료', '운행회차', '대기'].includes(record.type)) ? (
              <div className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                운송료 미입력 (0만)
              </div>
            ) : null}
            {(record.cost || 0) > 0 && <div className="text-lg font-black text-red-600">-{record.type === '주유기록' ? (record.actualCost !== undefined ? record.actualCost : (record.cost - (record.subsidy || 0))).toLocaleString() + '원' : formatToManwon(record.cost) + '만'}</div>}
          </div>
        </div>

        {isActive && record.type !== '공차거리' && (
          <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-100">
            <button 
              onClick={() => handleQuickUpdateClick(record.id, '운행종료')} 
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-900 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-all"
            >
              <Square size={18} fill="white" /> 운행 종료
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => onQuickUpdate(record.id, '운행회차')} 
                className="flex items-center justify-center gap-2 py-3 bg-orange-100 text-orange-700 rounded-xl font-bold text-xs active:scale-95 transition-all"
              >
                <CornerUpLeft size={16} /> 운행 회차
              </button>
              <button 
                onClick={() => onQuickUpdate(record.id, '운행취소')} 
                className="flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-xl font-bold text-xs active:scale-95 transition-all border border-red-100"
              >
                <Ban size={16} /> 운행 취소
              </button>
            </div>
          </div>
        )}


      </div>
    );
  };

  const isCargoTracking = isTracking && runningRecords.length > 0;
  const isEmptyTracking = isTracking && runningRecords.length === 0;

  return (
    <div className="space-y-6 pb-4">
      {runningRecords.length > 0 && (
        <div className="space-y-3 animate-in slide-in-from-top-4 duration-500">
           <div className="px-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-2 shadow-sm">
             <Activity size={14} className="animate-pulse"/> 운행 중인 화물 ({runningRecords.length})
           </div>
           <div className="space-y-3">
             {runningRecords.map(r => renderCard(r, true, false))}
           </div>
        </div>
      )}

      <div className="space-y-3">
        <button onClick={() => setIsWaitExpanded(!isWaitExpanded)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-500 bg-slate-100/50 rounded-xl">
          <div className="flex items-center gap-2"><Truck size={14} /> 운행 대기 ({waitingRecords.length})</div>
          {isWaitExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        {isWaitExpanded && <div className="space-y-3">{waitingRecords.map(r => renderCard(r, false, true))}</div>}
      </div>

      <div className="space-y-3">
        <button onClick={() => setIsDoneExpanded(!isDoneExpanded)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-400 bg-slate-100/30 rounded-xl">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            <span>운행 완료 기록 ({completedNormalTripsCount}</span>
            {cancelledTripsCount > 0 && (
              <span className="text-red-500 font-bold text-[11px]">(-{cancelledTripsCount})</span>
            )}
            <span>)</span>
          </div>
          {isDoneExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        {isDoneExpanded && <div className="space-y-3">{completedRecords.map(r => renderCard(r, false, false))}</div>}
      </div>

      <div className="space-y-3">
        <button onClick={() => setIsEmptyExpanded(!isEmptyExpanded)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-orange-500 bg-orange-50/50 rounded-xl border border-orange-200 shadow-sm">
          <div className="flex items-center gap-2">
            <Wind size={14} /> 공차 ({emptyRecords.length})
            {emptyRecords.reduce((acc, r) => acc + (r.distance || 0), 0) > 0 && (
              <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-md ml-1 text-[10px]">
                총 {emptyRecords.reduce((acc, r) => acc + (r.distance || 0), 0).toFixed(1)}km
              </span>
            )}
          </div>
          {isEmptyExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        {isEmptyExpanded && <div className="space-y-3">{emptyRecords.map(r => renderCard(r, false, false))}</div>}
      </div>

      {modalState.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-xl border border-slate-100">
            <h3 className="font-black text-lg text-slate-800">{modalState.title}</h3>
            <textarea
              value={modalState.value}
              onChange={(e) => setModalState(prev => ({ ...prev, value: e.target.value }))}
              placeholder={modalState.placeholder}
              className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[90px] text-sm text-slate-800"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs"
              >
                취소
              </button>
              <button
                onClick={() => {
                  modalState.onSave(modalState.value);
                  setModalState(prev => ({ ...prev, isOpen: false }));
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 동일 구간 과거 운행시간 상세 모달 */}
      {selectedEstimateRoute && (
        <div 
          className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedEstimateRoute(null)}
        >
          <div 
            className="bg-white rounded-3xl p-5 w-full max-w-xs space-y-4 shadow-2xl border border-slate-100 relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm text-white">
                  <Clock size={16} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-800 text-sm">동일구간 과거 운행시간</h3>
                  <p className="text-[11px] text-slate-500 font-bold truncate max-w-[170px]">
                    {selectedEstimateRoute.from || '상차지'} ➜ {selectedEstimateRoute.to || '하차지'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedEstimateRoute(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full active:scale-90 transition-transform"
              >
                <X size={18} />
              </button>
            </div>

            {selectedEstimateRoute.stats && selectedEstimateRoute.stats.count > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100">
                  {/* 최소시간 */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-500">최소시간</span>
                    <span className="text-base font-black text-slate-700 tracking-tight">
                      {selectedEstimateRoute.stats.min}분
                    </span>
                  </div>

                  {/* 예상시간 */}
                  <div className="flex flex-col items-center border-x border-indigo-200 px-1">
                    <span className="text-[10px] font-bold text-indigo-600">예상시간</span>
                    <span className="text-xl font-black text-indigo-700 tracking-tight">
                      {selectedEstimateRoute.stats.expected}분
                    </span>
                  </div>

                  {/* 최대시간 */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-500">최대시간</span>
                    <span className="text-base font-black text-slate-700 tracking-tight">
                      {selectedEstimateRoute.stats.max}분
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] text-slate-600 font-medium space-y-1">
                  <div className="flex justify-between items-center font-bold text-indigo-900">
                    <span>분석 데이터:</span>
                    <span>과거 기록 {selectedEstimateRoute.stats.count}건 기준</span>
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight">
                    * 최소시간과 최대시간의 중간값((최소+최대)/2)으로 산출된 예상 소요시간입니다.
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center space-y-2">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <Info size={20} />
                </div>
                <p className="text-xs font-bold text-slate-600">
                  동일 구간의 과거 운행 기록이 없습니다.
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed px-2">
                  해당 구간의 운행을 완료하면 자동으로 소요시간이 분석되어 다음 운행에 반영됩니다.
                </p>
              </div>
            )}

            <button
              onClick={() => setSelectedEstimateRoute(null)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-md"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
    </div>
  );
};

export default RecordList;
