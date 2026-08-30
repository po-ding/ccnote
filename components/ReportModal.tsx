
import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Activity, FileText, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, 
  DollarSign, CreditCard, ShoppingBag, Truck, Wind, ChevronDown, ChevronUp, Edit2, Trash2
} from 'lucide-react';
import { TransportRecord, SalaryRecord, FixedExpense } from '../types';
import { formatToManwon } from '../utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  records: TransportRecord[];
  salaryRecords: SalaryRecord[];
  fixedExpenses: FixedExpense[];
  initialYear?: number;
  initialMonth?: number;
}

const ReportModal: React.FC<Props> = ({ 
  isOpen, onClose, records, salaryRecords, fixedExpenses, initialYear, initialMonth 
}) => {
  const [selYear, setSelYear] = useState(initialYear || new Date().getFullYear());
  const [selMonth, setSelMonth] = useState(initialMonth || new Date().getMonth() + 1);
  
  // 리스트 토글 상태
  const [showFuelList, setShowFuelList] = useState(false);
  const [showDriveList, setShowDriveList] = useState(false);

  useEffect(() => {
    setSelYear(initialYear || new Date().getFullYear());
    setSelMonth(initialMonth || new Date().getMonth() + 1);
  }, [initialYear, initialMonth]);

  const currentMonthStr = `${selYear}-${String(selMonth).padStart(2, '0')}`;
  const prevMonthStr = (() => {
    const d = new Date(selYear, selMonth - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const getStats = (monthPrefix: string) => {
    const rMonth = records.filter(r => r && r.date?.startsWith(monthPrefix));
    const sMonth = salaryRecords.filter(s => s && s.date?.startsWith(monthPrefix));
    
    // 고정 지출 필터링: 해당 월에 등록되었거나, '매월 반복' 설정된 모든 항목
    const fMonth = fixedExpenses.filter(f => f && (f.isRepeat || f.date?.startsWith(monthPrefix)));

    const transportSales = rMonth.filter(r => ['화물운송', '수입', '운송종료', '운행종료', '운행회차', '대기'].includes(r.type)).reduce((acc, r) => acc + (r.income || 0), 0);
    const salaryIncome = sMonth.reduce((acc, s) => acc + (s.amount || 0), 0);
    
    const generalCosts = rMonth.filter(r => r.type === '지출').reduce((acc, r) => acc + (r.cost || 0), 0);
    const fuelCosts = rMonth.filter(r => r.type === '주유기록').reduce((acc, r) => acc + (r.actualCost !== undefined ? r.actualCost : (r.cost - (r.subsidy || 0))), 0);
    const fuelCount = rMonth.filter(r => r.type === '주유기록').length;
    const fixedCosts = fMonth.reduce((acc, f) => acc + (f.cost || 0), 0);

    const totalSales = transportSales;
    const totalIncome = salaryIncome;
    const totalCosts = generalCosts + fuelCosts + fixedCosts;
    const netIncome = salaryIncome - totalCosts; // 정산 금액: 급여 - 총지출

    const workDays = new Set(rMonth.filter(r => (r.distance > 0 || r.type === '화물운송') && r.type !== '공차거리').map(r => r.date)).size;
    const cancelTrips = rMonth.filter(r => r.type === '운행취소').length;
    const trips = rMonth.filter(r => 
      ['화물운송', '운송종료', '운행종료', '운행회차', '대기'].includes(r.type) && 
      (r.distance > 0 || r.endTime || r.type === '대기' || r.type === '운행회차')
    ).length;
    
    const distance = rMonth.filter(r => r.type !== '공차거리').reduce((acc, r) => acc + (r.distance || 0), 0);
    const emptyDistance = rMonth.filter(r => r.type === '공차거리').reduce((acc, r) => acc + (r.distance || 0), 0);
    const missingIncomeCount = rMonth.filter(r => ['화물운송', '운송종료', '운행종료', '운행회차', '대기'].includes(r.type) && (!r.income || r.income === 0)).length;

    return { totalSales, totalIncome, totalCosts, netIncome, workDays, trips, cancelTrips, distance, emptyDistance, missingIncomeCount, rMonth, sMonth, fMonth, fuelCosts, fuelCount, salaryIncome };
  };

  const curr = useMemo(() => getStats(currentMonthStr), [records, salaryRecords, fixedExpenses, currentMonthStr]);
  const prev = useMemo(() => getStats(prevMonthStr), [records, salaryRecords, fixedExpenses, prevMonthStr]);

  if (!isOpen) return null;

  const DiffBadge = ({ curr, prev, unit, isReverse = false }: any) => {
    const diff = (curr || 0) - (prev || 0);
    const isUp = diff > 0;
    const color = isReverse ? (isUp ? 'text-red-500' : 'text-blue-500') : (isUp ? 'text-blue-500' : 'text-red-500');
    return (
      <div className={`text-[9px] font-black ${color} flex items-center gap-0.5`}>
        {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {Math.abs(diff).toFixed(0)}{unit}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[120] bg-white flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden">
      <header className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10 pt-[env(safe-area-inset-top)]">
        <h3 className="font-black text-slate-900 text-lg flex items-center gap-2"><FileText className="text-blue-600"/> {selMonth}월 운행 리포트</h3>
        <button onClick={onClose} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
      </header>

      <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-6 pb-20">
        {/* 달 이동 */}
        <div className="bg-white px-6 py-3 rounded-2xl border flex items-center justify-between">
          <button onClick={() => setSelMonth(m => m === 1 ? 12 : m - 1)} className="p-1"><ChevronLeft/></button>
          <div className="font-black text-slate-800">{selYear}년 {selMonth}월</div>
          <button onClick={() => setSelMonth(m => m === 12 ? 1 : m + 1)} className="p-1"><ChevronRight/></button>
        </div>

        {/* 0. 총합 요약 */}
        <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl grid grid-cols-4 gap-2">
          <div className="space-y-1">
            <div className="text-[10px] opacity-60 font-bold">예정 매출</div>
            <div className="text-lg font-black text-blue-400 flex items-baseline gap-1">
              {formatToManwon(curr.totalSales)}만
              {curr.missingIncomeCount > 0 && <span className="text-red-400 text-xs font-bold">(-{curr.missingIncomeCount})</span>}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] opacity-60 font-bold">총수입</div>
            <div className="text-lg font-black text-emerald-400">{formatToManwon(curr.totalIncome)}만</div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] opacity-60 font-bold">총지출</div>
            <div className="text-lg font-black text-red-400">{formatToManwon(curr.totalCosts)}만</div>
          </div>
          <div className="space-y-1 border-l border-white/10 pl-3">
            <div className="text-[10px] opacity-60 font-bold">순수익</div>
            <div className="text-xl font-black text-blue-400">{formatToManwon(curr.netIncome)}만</div>
          </div>
        </div>

        {/* 1. 운행 지표 */}
        <div className="bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm space-y-5">
          <h4 className="text-[11px] font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest"><Activity size={14} className="text-blue-600"/> 1. 운행 지표 (전월 대비)</h4>
          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
            <div>
              <div className="text-[10px] text-slate-400 font-bold">운행 일수</div>
              <div className="text-lg font-black text-slate-800">{curr.workDays}일</div>
              <DiffBadge curr={curr.workDays} prev={prev.workDays} unit="일" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold">운행 건수</div>
              <div className="text-lg font-black text-slate-800 flex items-baseline gap-1">
                <span>{curr.trips}건</span>
                {curr.cancelTrips > 0 && (
                  <span className="text-xs font-bold text-red-500">(-{curr.cancelTrips}건)</span>
                )}
              </div>
              <DiffBadge curr={curr.trips} prev={prev.trips} unit="건" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold">운행 거리</div>
              <div className="text-lg font-black text-slate-800">{Math.round(curr.distance)}km</div>
              <DiffBadge curr={curr.distance} prev={prev.distance} unit="km" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold">공차 거리</div>
              <div className="text-lg font-black text-orange-600">{Math.round(curr.emptyDistance)}km</div>
              <DiffBadge curr={curr.emptyDistance} prev={prev.emptyDistance} unit="km" isReverse />
            </div>
          </div>
        </div>

        {/* 2. 급여 입금 */}
        <div className="bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-[11px] font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest"><DollarSign size={14} className="text-emerald-500"/> 2. 급여 입금 내역</h4>
            <div className="text-sm font-black text-emerald-600">{formatToManwon(curr.salaryIncome)}만원</div>
          </div>
          <DiffBadge curr={curr.salaryIncome} prev={prev.salaryIncome} unit="원" />
          <div className="space-y-2 pt-2">
            {curr.sMonth.map((s, i) => (
              <div key={i} className="flex justify-between text-[11px] py-1 border-b border-slate-50 last:border-0">
                <span className="text-slate-500">{s.date.substring(8)}일 {s.memo || '입금'}</span>
                <span className="font-bold">{(s.amount / 10000).toLocaleString()}만원</span>
              </div>
            ))}
            {curr.sMonth.length === 0 && <div className="text-[10px] text-slate-300 text-center">기록 없음</div>}
          </div>
        </div>

        {/* 3. 고정 지출 */}
        <div className="bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-[11px] font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest"><CreditCard size={14} className="text-red-500"/> 3. 고정 지출 합계</h4>
            <div className="text-sm font-black text-red-600">{formatToManwon(curr.fMonth.reduce((a,c) => a+(c.cost||0),0))}만원</div>
          </div>
          <div className="space-y-2">
            {curr.fMonth.map((f, i) => (
              <div key={i} className="flex justify-between text-[11px] py-2 border-b border-slate-50 last:border-0">
                <div className="flex flex-col"><span className="text-slate-400 text-[9px]">{f.isRepeat ? '매월 반복' : (f.date?.substring(8)+'일')}</span><span className="font-bold text-slate-700">{f.name}</span></div>
                <span className="font-black text-red-500">{(f.cost / 10000).toLocaleString()}만원</span>
              </div>
            ))}
            {curr.fMonth.length === 0 && <div className="text-[10px] text-slate-300 text-center">기록 없음</div>}
          </div>
        </div>

        {/* 4. 일반 지출 */}
        <div className="bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-[11px] font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest"><ShoppingBag size={14} className="text-orange-500"/> 4. 일반 지출 합계</h4>
            <div className="text-sm font-black text-red-600">{formatToManwon(curr.rMonth.filter(r => r.type === '지출').reduce((a,c) => a+(c.cost||0),0))}만원</div>
          </div>
          <div className="space-y-2">
            {curr.rMonth.filter(r => r.type === '지출').map((r, i) => (
              <div key={i} className="flex justify-between text-[11px] py-2 border-b border-slate-50 last:border-0">
                <div className="flex flex-col"><span className="text-slate-400 text-[9px]">{r.date.substring(8)}일 {r.time}</span><span className="font-bold text-slate-700">{r.memo || '일반지출'}</span></div>
                <span className="font-black text-red-500">{(r.cost / 10000).toLocaleString()}만원</span>
              </div>
            ))}
            {curr.rMonth.filter(r => r.type === '지출').length === 0 && <div className="text-[10px] text-slate-300 text-center">기록 없음</div>}
          </div>
        </div>

        {/* 5. 주유 기록 */}
        <div className="bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-[11px] font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest"><Wind size={14} className="text-orange-600"/> 5. 주유 기록 ({curr.fuelCount}건)</h4>
            <div className="text-sm font-black text-orange-600">{curr.fuelCosts.toLocaleString()}원</div>
          </div>
          <div className="flex justify-between items-center">
             <DiffBadge curr={curr.fuelCosts} prev={prev.fuelCosts} unit="원" isReverse />
             <button onClick={() => setShowFuelList(!showFuelList)} className="text-[10px] font-black text-blue-600 flex items-center gap-1">{showFuelList ? <ChevronUp size={12}/> : <ChevronDown size={12}/>} 상세 내역 {showFuelList ? '닫기' : '보기'}</button>
          </div>
          {showFuelList && (
            <div className="space-y-2 pt-2 animate-in slide-in-from-top-2">
              {curr.rMonth.filter(r => r.type === '주유기록').map((r, i) => {
                const cost = r.actualCost !== undefined ? r.actualCost : (r.cost - (r.subsidy || 0));
                const unitPrice = r.liters && r.liters > 0 ? Math.round(cost / r.liters) : 0;
                return (
                  <div key={i} className="flex justify-between text-[10px] py-2 border-b border-slate-50 last:border-0">
                    <span className="text-slate-500 w-20">{r.date.substring(8)}일 {r.time}</span>
                    <div className="flex-1 flex justify-end gap-3">
                      <span className="font-medium text-slate-600">{r.liters}L</span>
                      <span className="font-medium text-slate-400">@{unitPrice.toLocaleString()}</span>
                      <span className="font-bold text-slate-900">{cost.toLocaleString()}원</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 6. 운행 기록 */}
        <div className="bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-[11px] font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest"><Truck size={14} className="text-blue-600"/> 6. 운행 기록 합계</h4>
            <div className="text-sm font-black text-blue-600 flex gap-2 items-baseline">
              <span>{curr.trips}건{curr.cancelTrips > 0 && <span className="text-xs font-bold text-red-500 ml-0.5">(-{curr.cancelTrips}건)</span>}</span>
              <span>{formatToManwon(curr.rMonth.filter(r => ['화물운송', '운송종료', '운행종료', '운행회차', '대기'].includes(r.type)).reduce((a,b)=>a+(b.income||0),0))}만원</span>
              <span>{Math.round(curr.rMonth.filter(r => ['화물운송', '운송종료', '운행종료', '운행회차', '운행취소', '대기'].includes(r.type)).reduce((a,b)=>a+(b.distance||0),0))}km</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center pt-2 border-t border-slate-50">
             <span className="text-[10px] font-bold text-slate-500">총 공차 거리 합계</span>
             <span className="text-sm font-black text-orange-600">{Math.round(curr.emptyDistance)}km</span>
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={() => setShowDriveList(!showDriveList)} className="text-[10px] font-black text-blue-600 flex items-center gap-1">{showDriveList ? <ChevronUp size={12}/> : <ChevronDown size={12}/>} 상세 내역 {showDriveList ? '닫기' : '보기'}</button>
          </div>
          {showDriveList && (
            <div className="space-y-3 pt-2 animate-in slide-in-from-top-2">
              {(() => {
                const driveRecords = curr.rMonth.filter(r => 
                  ['화물운송', '운송종료', '운행종료', '운행회차', '운행취소', '대기'].includes(r.type) && 
                  r.from?.trim() && r.to?.trim()
                );
                
                // 일별 거리 합계 계산
                const dailyDistances: Record<string, number> = {};
                curr.rMonth.forEach(r => {
                  if (r.distance > 0) {
                    dailyDistances[r.date] = (dailyDistances[r.date] || 0) + r.distance;
                  }
                });

                return driveRecords.map((r, i, arr) => {
                  const isFirstOfDay = i === 0 || r.date !== arr[i-1].date;
                  return (
                    <React.Fragment key={i}>
                      {isFirstOfDay && i > 0 && <div className="border-t-2 border-slate-100 my-3"></div>}
                      {isFirstOfDay && (
                        <div className="flex justify-between items-center bg-slate-50 px-3 py-1.5 rounded-lg mb-2">
                          <span className="text-[10px] font-black text-slate-600">{r.date}</span>
                          <span className="text-[10px] font-black text-blue-600">일일 주행: {Math.round(dailyDistances[r.date] || 0)}km</span>
                        </div>
                      )}
                      <div className="flex flex-col text-[10px] py-2 border-b border-slate-50 last:border-0 gap-1 relative group pl-2">
                        <button onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('edit-record', { detail: r })); }} className="absolute -top-1 -right-1 p-1.5 bg-white border shadow-sm rounded-full text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <Edit2 size={12} />
                        </button>
                        <div className="flex justify-between font-bold text-slate-400 pr-2">
                          <span>{r.time}~{r.endTime || '--:--'} {['운행회차', '운행취소'].includes(r.type) ? `[${r.type}]` : ''}</span>
                          <span className={
                            r.type === '운행취소' 
                              ? "text-red-500 font-bold" 
                              : (!r.income || r.income === 0) 
                                ? "text-amber-500 font-bold" 
                                : "text-blue-600"
                          }>
                            {r.type === '운행취소' 
                              ? "0만 [취소]" 
                              : (!r.income || r.income === 0) 
                                ? "0만 [미입력]" 
                                : `${formatToManwon(r.income)}만`}
                          </span>
                        </div>
                        <div className="font-black text-slate-800 flex justify-between pr-2">
                          <span>{r.from || '(출발지 미입력)'} ➜ {r.to || '(도착지 미입력)'}</span>
                          <span className="text-slate-500 text-[9px]">{r.distance >= 0 ? `${Math.round(r.distance)}km` : ''}</span>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
