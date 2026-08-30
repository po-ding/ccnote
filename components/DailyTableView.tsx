
import React, { useMemo } from 'react';
import { TransportRecord, SalaryRecord } from '../types';
import { calculateDuration, getTodayString } from '../utils';

interface Props {
  records: TransportRecord[];
  salaryRecords: SalaryRecord[];
  selectedYear: number;
  selectedMonth: number;
  onViewDetail: (date: string) => void;
}

const DailyTableView: React.FC<Props> = ({ 
  records, 
  salaryRecords,
  selectedYear, 
  selectedMonth, 
  onViewDetail 
}) => {
  
  const dailyData = useMemo(() => {
    const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const todayStr = getTodayString();
    const data = [];

    const safeRecords = Array.isArray(records) ? records : [];
    const safeSalaries = Array.isArray(salaryRecords) ? salaryRecords : [];

    for (let day = daysInMonth; day >= 1; day--) {
      const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`;
      if (dateStr > todayStr) continue;

      const dayRecords = safeRecords.filter(r => r?.date === dateStr);
      const daySalaries = safeSalaries.filter(s => s?.date === dateStr);
      
      let sales = 0;
      let income = 0;
      let expense = 0;
      let fuel = 0;
      let liters = 0;
      let distance = 0;
      let movements = 0;
      let cancelCount = 0;
      
      let firstStart = "";
      let lastEnd = "";

      dayRecords.forEach(r => {
        if (!r) return;
        if (r.type === '수입') sales += (r.income || 0);
        else if (r.type === '지출') expense += (r.cost || 0);
        else if (r.type === '주유기록') {
          fuel += (r.actualCost !== undefined ? r.actualCost : (r.cost - (r.subsidy || 0)));
          liters += (r.liters || 0);
        }
        else if (['화물운송', '공차거리', '운행종료', '운송종료', '운행취소', '운행회차', '대기'].includes(r.type)) {
          // 운행취소는 매출/수입에 합산하지 않음 (0원)
          if (r.type !== '운행취소') {
            sales += (r.income || 0);
          }
          expense += (r.cost || 0);
          distance += (r.distance || 0);
          
          if (r.type === '운행취소') {
            cancelCount++;
          } else {
            const isCompleted = !!(r.endTime || (r.distance && r.distance > 0) || r.type === '대기' || r.type === '운행회차');
            if (isCompleted && r.type !== '공차거리') movements++;
          }

          if (r.time && r.type !== '운행취소') {
            if (!firstStart || r.time < firstStart) firstStart = r.time;
          }
          if (r.endTime && r.type !== '운행취소') {
            if (!lastEnd || r.endTime > lastEnd) lastEnd = r.endTime;
          }
        }
      });

      daySalaries.forEach(s => {
        income += (s.amount || 0);
      });

      const duration = (firstStart && lastEnd) ? calculateDuration(firstStart, lastEnd) : "-";
      
      // Format duration to show only hours
      let durationStr = "-";
      if (duration !== "-") {
        const parts = duration.split(' ');
        const hours = parts[0].replace('시간', '');
        durationStr = `${hours}시간`;
      }

      data.push({
        date: dateStr,
        day: `${day}일`,
        sales: Math.round(sales / 10000),
        fuel: Math.round(fuel / 10000),
        liters: Math.round(liters),
        distance: Math.round(distance),
        movements,
        cancelCount,
        duration: durationStr
      });
    }
    return data;
  }, [records, salaryRecords, selectedYear, selectedMonth]);

  return (
    <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm animate-in fade-in duration-300">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="py-3 px-1 font-bold text-slate-700 border-r border-slate-200">일</th>
            <th className="py-3 px-1 font-bold text-slate-700 border-r border-slate-200">예정</th>
            <th className="py-3 px-1 font-bold text-slate-700 border-r border-slate-200">주유</th>
            <th className="py-3 px-1 font-bold text-slate-700 border-r border-slate-200">거리</th>
            <th className="py-3 px-1 font-bold text-slate-700 border-r border-slate-200">이동</th>
            <th className="py-3 px-1 font-bold text-slate-700">소요</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {dailyData.length > 0 ? (
            dailyData.map((row) => (
              <tr 
                key={row.date} 
                onClick={() => onViewDetail(row.date)}
                className="text-center active:bg-slate-50 transition-colors cursor-pointer hover:bg-slate-50"
              >
                <td className="py-4 font-bold text-slate-600 border-r border-slate-100">{row.day}</td>
                <td className="py-4 text-blue-600 font-bold border-r border-slate-100">{row.sales === 0 ? '0' : row.sales.toLocaleString()}</td>
                <td className="py-4 text-red-500 border-r border-slate-100">
                  {row.fuel === 0 ? '0' : row.fuel.toLocaleString()}
                  {row.liters > 0 && <div className="text-[9px] opacity-60">({row.liters.toLocaleString()}L)</div>}
                </td>
                <td className="py-4 text-slate-600 border-r border-slate-100">{row.distance.toLocaleString()}</td>
                <td className="py-4 text-slate-600 border-r border-slate-100">
                  <div className="flex items-center justify-center gap-0.5">
                    <span>{row.movements}</span>
                    {row.cancelCount > 0 && (
                      <span className="text-red-500 text-[10px] font-bold">(-{row.cancelCount})</span>
                    )}
                  </div>
                </td>
                <td className="py-4 text-slate-500 text-[10px] font-bold leading-tight">
                  {row.duration}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="py-10 text-center text-slate-300 italic">데이터가 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DailyTableView;
