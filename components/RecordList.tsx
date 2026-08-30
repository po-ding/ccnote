
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
  Navigation
} from 'lucide-react';
import { formatToManwon } from '../utils';

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
    const info = locations[name];
    const targetAddress = (info && info.address && info.address.trim()) ? info.address.trim() : name;
    await Clipboard.write({ string: targetAddress });
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `📋 ${targetAddress}` } }));
  };

  const [showConfirm, setShowConfirm] = useState<{id: number, status: RecordType} | null>(null);

  const handleQuickUpdateClick = (id: number, status: RecordType) => {
    onQuickUpdate(id, status);
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

    return (
      <div key={record.id} className={`bg-white rounded-2xl p-4 shadow-sm border ${isActive ? 'border-blue-500 ring-2 ring-blue-100 scale-[1.02]' : isCancelled ? 'border-red-200 bg-red-50/10' : isOverhead ? 'border-orange-200 bg-orange-50/10' : 'border-slate-100'} flex flex-col gap-3 transition-all relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300`}>
        {isActive && (
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-100 overflow-hidden">
            <div className="h-full bg-blue-500 animate-[loading_2s_infinite] w-1/3"></div>
          </div>
        )}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            {isWaiting ? (
              <button 
                onClick={() => onQuickUpdate(record.id, '화물운송')} 
                className="w-10 h-10 bg-blue-600 hover:bg-blue-700 active:scale-90 text-white rounded-xl shadow-md transition-all flex items-center justify-center shrink-0 group"
                title="운행 시작"
                aria-label="운행 시작"
              >
                <Play size={20} fill="white" className="ml-0.5 group-hover:scale-110 transition-transform" />
              </button>
            ) : (
              <span className={`p-2.5 rounded-xl ${
                isActive 
                  ? 'bg-blue-600 text-white' 
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
                {isActive ? <Activity size={20} className="animate-pulse" /> : isCancelled ? <Ban size={20} /> : record.type === '공차거리' ? <Wind size={20} /> : record.type === '주유기록' ? <Fuel size={20} /> : record.type === '운행회차' ? <CornerUpLeft size={20} /> : <Truck size={20} />}
              </span>
            )}
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
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

                {/* 3. 상차층수 / 동 / 도크 */}
                {record.floorInfo && (
                  <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md shrink-0">
                    {record.floorInfo}
                  </span>
                )}

                {/* 4. 상차호 / 몇호차 */}
                {record.vehicleNo && (
                  <span className="text-[11px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md shrink-0">
                    [{record.vehicleNo.replace(/[\[\]]/g, '')}]
                  </span>
                )}

                {/* 5. 밀크런/주문 번호 */}
                {record.orderNumber && (
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md shrink-0">
                    #{record.orderNumber}
                  </span>
                )}
              </div>

              {/* 6. 특이사항 (AI 분석 특이사항만 표기) */}
              {record.aiParsedNote && (
                <div className="text-[11px] text-slate-600 mt-1 font-medium truncate">
                  💡 <span className="font-bold text-slate-700">특이사항:</span> {record.aiParsedNote}
                </div>
              )}

              {!isWaiting && (
                <div className={`font-bold leading-tight mt-1 text-xs ${
                  isCancelled 
                    ? 'text-red-500 font-black' 
                    : record.type === '운행회차' 
                      ? 'text-orange-600 font-black' 
                      : isOverhead 
                        ? 'text-orange-600' 
                        : 'text-slate-800'
                }`}>
                  {displayType}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => onEdit(record)} className="p-2 text-slate-300 hover:text-blue-500 transition-colors" title="수정"><Edit2 size={16} /></button>
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
                <button 
                  onClick={() => handleEditCenter(record, 'from')} 
                  className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 rounded-lg flex items-center justify-center active:scale-95 transition-all shrink-0 shadow-2xs"
                  title="상차 센터 수정"
                >
                  <Edit2 size={13} />
                </button>
              </div>

              {/* 상차 메모란 */}
              <div className="ml-4 pl-2.5 border-l-2 border-blue-200 flex items-center justify-between gap-2 bg-blue-50/40 p-2 rounded-xl">
                <div className="flex items-start gap-1.5 flex-1 min-w-0">
                  <Info size={13} className="text-blue-400 mt-0.5 shrink-0" />
                  <span className="text-xs font-semibold text-slate-700 break-all leading-snug">
                    {record.from && locations[record.from]?.memo ? (
                      locations[record.from].memo
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
                <button 
                  onClick={() => handleEditCenter(record, 'to')} 
                  className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-300 rounded-lg flex items-center justify-center active:scale-95 transition-all shrink-0 shadow-2xs"
                  title="하차 센터 수정"
                >
                  <Edit2 size={13} />
                </button>
              </div>

              {/* 하차 메모란 */}
              <div className="ml-4 pl-2.5 border-l-2 border-emerald-200 flex items-center justify-between gap-2 bg-emerald-50/40 p-2 rounded-xl">
                <div className="flex items-start gap-1.5 flex-1 min-w-0">
                  <Info size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-xs font-semibold text-slate-700 break-all leading-snug">
                    {record.to && locations[record.to]?.memo ? (
                      locations[record.to].memo
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

      <style>{`@keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
    </div>
  );
};

export default RecordList;
