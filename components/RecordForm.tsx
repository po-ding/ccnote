
import React, { useState, useEffect } from 'react';
import { TransportRecord, RecordType, LocationInfo } from '../types';
import { getWorkDate, getCurrentTimeString, findPriceForRoute } from '../utils';
import { Truck, Fuel, DollarSign, TrendingUp, Sparkles, Loader2, Camera, AlertCircle, Navigation, Trash2 } from 'lucide-react';
import { analyzeReceipt } from '../ocr';

interface Props {
  initialData?: TransportRecord | null;
  locations: Record<string, LocationInfo>;
  records: TransportRecord[];
  onSubmit: (record: TransportRecord) => void;
  onDelete?: (id: number) => void;
  viewDate: string;
}

const RecordForm: React.FC<Props> = ({ initialData, locations, records, onSubmit, onDelete, viewDate }) => {
  const [type, setType] = useState<RecordType>(initialData?.type || '화물운송');
  const [date, setDate] = useState(initialData?.date || viewDate);
  const [time, setTime] = useState(initialData?.time || getCurrentTimeString());
  const [endTime, setEndTime] = useState(initialData?.endTime || '');
  const [from, setFrom] = useState(initialData?.from || '');
  const [to, setTo] = useState(initialData?.to || '');
  const [distance, setDistance] = useState(initialData?.distance?.toString() || '');
  const [income, setIncome] = useState(initialData?.income ? (initialData.income / 10000).toString() : '');
  const [cost, setCost] = useState(initialData?.cost ? (initialData.cost).toString() : '');
  const [memo, setMemo] = useState(initialData?.memo || '');

  // Dispatch details
  const [vehicleNo, setVehicleNo] = useState(initialData?.vehicleNo || '');
  const [floorInfo, setFloorInfo] = useState(initialData?.floorInfo || '');
  const [scheduledTime, setScheduledTime] = useState(initialData?.scheduledTime || '');

  const findLocationMemo = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    
    // Exact match
    if (locations[trimmed]) return locations[trimmed].memo;
    
    // Fuzzy match
    const getNum = (s: string) => s.match(/\d+/)?.[0] || "";
    const trimmedNum = getNum(trimmed);
    
    const storedNames = Object.keys(locations);
    for (const storedName of storedNames) {
      const info = locations[storedName];
      const storedNum = getNum(storedName);
      const isNumMatch = (storedNum !== "" || trimmedNum !== "") ? (storedNum === trimmedNum) : true;
      const isStringMatch = storedName.includes(trimmed) || trimmed.includes(storedName);
      if (isNumMatch && isStringMatch) return info.memo;
    }
    return null;
  };

  const handleFromChange = (val: string) => {
    setFrom(val);
    const locMemo = findLocationMemo(val);
    if (locMemo && !memo.includes(locMemo)) {
      setMemo(prev => prev ? `${prev} | ${locMemo}` : locMemo);
    }
    
    // 금액 자동 입력 시도
    if (to && !income) {
      const price = findPriceForRoute(records, val, to);
      if (price) setIncome((price / 10000).toString());
    }
  };

  const handleToChange = (val: string) => {
    setTo(val);
    const locMemo = findLocationMemo(val);
    if (locMemo && !memo.includes(locMemo)) {
      setMemo(prev => prev ? `${prev} | ${locMemo}` : locMemo);
    }

    // 금액 자동 입력 시도
    if (from && !income) {
      const price = findPriceForRoute(records, from, val);
      if (price) setIncome((price / 10000).toString());
    }
  };
  
  const [liters, setLiters] = useState(initialData?.liters?.toString() || '');
  const [unitPrice, setUnitPrice] = useState(initialData?.unitPrice?.toString() || '');
  const [brand, setBrand] = useState(initialData?.brand || '기타');

  const [subsidy, setSubsidy] = useState(initialData?.subsidy?.toString() || '');
  const [actualCost, setActualCost] = useState(initialData?.actualCost?.toString() || '');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isStarted, setIsStarted] = useState(initialData?.isStarted ?? false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const total = parseFloat(cost.replace(/,/g, '')) || 0;
    const sub = parseFloat(subsidy.replace(/,/g, '')) || 0;
    if (total > 0) {
      setActualCost((total - sub).toString());
    }
  }, [cost, subsidy]);

  const handleImageOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsAnalyzing(true);
    setError(null);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        const result = await analyzeReceipt(file.type, base64Data);
        
        if (result.date) setDate(result.date);
        if (result.time) setTime(result.time);
        if (result.liters) setLiters(result.liters.toString());
        if (result.unitPrice) setUnitPrice(result.unitPrice.toString());
        if (result.totalAmount) setCost(result.totalAmount.toString());
        if (result.subsidy) setSubsidy(result.subsidy.toString());
        if (result.actualPayment) setActualCost(result.actualPayment.toString());
      } catch (err: any) {
        setError(err.message || "분석 중 오류 발생");
      } finally {
        setIsAnalyzing(false);
      }
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const record: TransportRecord = {
      id: initialData?.id || Date.now(),
      date, time, type,
      from: from || undefined, to: to || undefined,
      distance: parseFloat(distance) || 0,
      start_gps: initialData?.start_gps || "", end_gps: initialData?.end_gps || "",
      cost: parseFloat(cost) || 0,
      income: Math.round((parseFloat(income) || 0) * 10000),
      liters: parseFloat(liters) || 0,
      unitPrice: parseInt(unitPrice) || 0,
      brand: type === '주유기록' ? brand : (initialData?.brand || "기타"),
      ureaLiters: initialData?.ureaLiters || 0,
      ureaUnitPrice: initialData?.ureaUnitPrice || 0,
      ureaStation: initialData?.ureaStation || "",
      supplyItem: initialData?.supplyItem || "",
      mileage: initialData?.mileage || 0,
      waitingTime: initialData?.waitingTime || 0,
      endTime: endTime || undefined,
      isStarted: isStarted,
      memo,
      subsidy: parseFloat(subsidy) || 0,
      actualCost: parseFloat(actualCost) || 0,
      vehicleNo: vehicleNo || undefined,
      floorInfo: floorInfo || undefined,
      scheduledTime: scheduledTime || undefined
    };
    onSubmit(record);
  };

  const isTransportType = ['화물운송', '대기', '공차거리', '운행취소', '운행회차', '운행종료'].includes(type);

  return (
    <form onSubmit={handleSubmit} className="safe-area-bottom space-y-6">
      <div className="grid grid-cols-4 gap-2">
        {(['화물운송', '주유기록', '지출', '수입'] as RecordType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`py-3 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${type === t || (t === '화물운송' && isTransportType) ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}
          >
            {t === '화물운송' && <Truck size={18} />}
            {t === '주유기록' && <Fuel size={18} />}
            {t === '지출' && <DollarSign size={18} />}
            {t === '수입' && <TrendingUp size={18} />}
            {t}
          </button>
        ))}
      </div>

      {type === '주유기록' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-amber-500" />
            <span className="text-[11px] font-black text-amber-800 uppercase tracking-wider">AI 영수증 자동 인식</span>
          </div>
          
          <label className={`w-full py-8 bg-white border-2 border-dashed ${isAnalyzing ? 'border-amber-400' : 'border-amber-300'} rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer shadow-sm active:bg-amber-50 transition-all`}>
            {isAnalyzing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={28} className="text-amber-500 animate-spin" />
                <span className="text-[13px] font-black text-amber-800 animate-pulse">분석 중...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Camera size={28} className="text-amber-600" />
                <span className="text-[11px] font-bold text-amber-800">영수증 촬영/선택</span>
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageOCR} disabled={isAnalyzing} />
          </label>
          {error && <div className="flex items-center gap-2 p-2 bg-red-50 text-red-600 rounded-lg text-[9px] font-bold border border-red-100"><AlertCircle size={12} />{error}</div>}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400">업무일자</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-3 border rounded-xl text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400">시작시간</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full p-3 border rounded-xl text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400">종료시간</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-3 border rounded-xl text-sm" />
          </div>
        </div>

        {isTransportType && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">상차지</label>
                <input type="text" placeholder="상차지" value={from} onChange={e => handleFromChange(e.target.value)} className="w-full p-3 border rounded-xl text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">하차지</label>
                <input type="text" placeholder="하차지" value={to} onChange={e => handleToChange(e.target.value)} className="w-full p-3 border rounded-xl text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">거리(km)</label>
                <div className="relative">
                  <Navigation size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input type="number" step="0.01" placeholder="0.00" value={distance} onChange={e => setDistance(e.target.value)} className="w-full p-3 pl-8 border rounded-xl text-sm font-bold" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">호차</label>
                <input type="text" placeholder="예: 1호" value={vehicleNo} onChange={e => setVehicleNo(e.target.value)} className="w-full p-3 border rounded-xl text-sm font-bold text-blue-600" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">지정 시각</label>
                <input type="text" placeholder="예: 08:20" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} className="w-full p-3 border rounded-xl text-sm font-bold text-slate-800" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">층/동/도크</label>
                <input type="text" placeholder="예: 3F, DOCK 5" value={floorInfo} onChange={e => setFloorInfo(e.target.value)} className="w-full p-3 border rounded-xl text-sm font-bold text-slate-800" />
              </div>
            </div>
          </>
        )}

        {type === '주유기록' ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400">주유량(L)</label>
              <input type="number" step="0.01" value={liters} onChange={e => setLiters(e.target.value)} className="w-full p-3 border rounded-xl text-sm font-bold" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400">총금액(원)</label>
              <input type="number" value={cost} onChange={e => setCost(e.target.value)} className="w-full p-3 border rounded-xl text-sm font-bold text-slate-800" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400">보조금(원)</label>
              <input type="number" value={subsidy} onChange={e => setSubsidy(e.target.value)} className="w-full p-3 border rounded-xl text-sm font-bold text-blue-600" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400">실결제(원)</label>
              <input type="number" value={actualCost} readOnly className="w-full p-3 border rounded-xl text-sm font-bold text-red-600 bg-slate-50" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400">수입(만원)</label>
              <input type="number" step="0.1" value={income} onChange={e => setIncome(e.target.value)} className="w-full p-3 border rounded-xl text-sm font-bold text-blue-600" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400">지출(만원)</label>
              <input type="number" step="0.1" value={cost} onChange={e => setCost(e.target.value)} className="w-full p-3 border rounded-xl text-sm font-bold text-red-600" />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400">메모</label>
          <textarea placeholder="특이사항" value={memo} onChange={e => setMemo(e.target.value)} className="w-full p-3 border rounded-xl h-20 text-sm outline-none" />
        </div>

        {isTransportType && initialData && (
          <div className="grid grid-cols-2 gap-2">
            <button 
              type="button" 
              onClick={() => { setType('운행회차'); setMemo(prev => prev.includes('(회차)') ? prev : `${prev} (회차)`.trim()); }}
              className={`py-3 rounded-xl font-bold text-xs border transition-all ${type === '운행회차' ? 'bg-orange-500 text-white border-orange-600 shadow-md' : 'bg-orange-50 text-orange-600 border-orange-200'}`}
            >
              운행 회차로 변경
            </button>
            <button 
              type="button" 
              onClick={() => { setType('운행취소'); setMemo(prev => prev.includes('(취소)') ? prev : `${prev} (취소)`.trim()); }}
              className={`py-3 rounded-xl font-bold text-xs border transition-all ${type === '운행취소' ? 'bg-red-500 text-white border-red-600 shadow-md' : 'bg-red-50 text-red-600 border-red-200'}`}
            >
              운행 취소로 변경
            </button>
          </div>
        )}

        {isTransportType && isStarted && (
          <button 
            type="button" 
            onClick={() => {
              setIsStarted(false);
              if (!endTime) setEndTime(getCurrentTimeString());
              setDate(new Date().toISOString().split('T')[0]);
            }}
            className="w-full py-4 bg-blue-50 text-blue-600 rounded-xl font-black border-2 border-blue-200 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Truck size={18} /> 운송 완료 처리 (종료시간 입력)
          </button>
        )}
      </div>
      <button type="submit" className="w-full bg-slate-800 text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all">
        {initialData ? '수정 내용 저장' : '새 기록 저장'}
      </button>
      {initialData && onDelete && (
        <button 
          type="button" 
          onClick={() => {
            onDelete(initialData.id);
          }}
          className="w-full bg-red-50 text-red-600 font-bold py-4 rounded-xl border border-red-100 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <Trash2 size={18} /> 이 기록 삭제하기
        </button>
      )}
    </form>
  );
};

export default RecordForm;
