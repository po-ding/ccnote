
import React, { useMemo } from 'react';
import { TransportRecord } from '../types';
import { getTodayString } from '../utils';

interface Props {
  records: TransportRecord[];
  selectedYear: number;
  selectedMonth: number;
}

const WeeklyTableView: React.FC<Props> = ({ 
  records, 
  selectedYear, 
  selectedMonth 
}) => {
  
  const weeklyData = useMemo(() => {
    const data = [];
    const firstDayOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
    const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0);
    const todayStr = getTodayString();

    let current = new Date(firstDayOfMonth);
    const dayOfWeek = current.getDay();
    current.setDate(current.getDate() - dayOfWeek); // Start on Sunday

    const endOfCalendar = new Date(lastDayOfMonth);
    const lastDayOfWeek = endOfCalendar.getDay();
    endOfCalendar.setDate(endOfCalendar.getDate() + (6 - lastDayOfWeek)); // End on Saturday

    let weekNum = 1;

    while (current <= endOfCalendar) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const displayStart = weekStart.getDate();
      const actualEnd = weekEnd.getDate();
      const startMonth = weekStart.getMonth() + 1;
      const endMonth = weekEnd.getMonth() + 1;
      
      const weekStartStr = `${weekStart.getFullYear()}-${String(startMonth).padStart(2, '0')}-${String(displayStart).padStart(2, '0')}`;
      if (weekStartStr > todayStr) break;

      const weekRecords = records.filter(r => {
        const rDate = new Date(r.date);
        return rDate >= weekStart && rDate <= weekEnd;
      });

      let income = 0;
      let expense = 0;
      let fuel = 0;
      let distance = 0;
      let movements = 0;
      let cancelCount = 0;
      let totalMinutes = 0;

      weekRecords.forEach(r => {
        if (r.type === '수입') income += (r.income || 0);
        else if (r.type === '지출') expense += (r.cost || 0);
        else if (r.type === '주유기록') fuel += (r.cost || 0);
        else if (['화물운송', '운행종료', '공차거리', '운행취소', '운행회차', '대기'].includes(r.type)) {
          // 운행취소는 예정 수입에 합산하지 않음 (0원)
          if (r.type !== '운행취소') {
            income += (r.income || 0);
          }
          expense += (r.cost || 0);
          distance += (r.distance || 0);
          
          if (r.type === '운행취소') {
            cancelCount++;
          } else {
            // 완료된 건만 집계 (공차거리 제외, 운행취소 제외)
            if (['화물운송', '운행종료', '운행회차', '대기'].includes(r.type) && 
                (r.endTime || r.distance > 0 || r.type === '대기' || r.type === '운행회차')) {
              movements++;
            }
          }

          if (r.time && r.endTime && r.type !== '운행취소') {
            const [sh, sm] = r.time.split(':').map(Number);
            const [eh, em] = r.endTime.split(':').map(Number);
            let diff = (eh * 60 + em) - (sh * 60 + sm);
            if (diff < 0) diff += 1440;
            totalMinutes += diff;
          }
        }
      });

      const h = Math.floor(totalMinutes / 60);
      const durationStr = `${h}시간`;

      data.push({
        weekName: `${weekNum}주차\n(${startMonth}/${displayStart}~${endMonth}/${actualEnd})`,
        income: Math.round(income / 10000),
        fuel: Math.round(fuel / 10000),
        distance: Math.round(distance),
        movements,
        cancelCount,
        duration: durationStr
      });

      current.setDate(current.getDate() + 7);
      weekNum++;
      if (weekNum > 6) break;
    }

    return data;
  }, [records, selectedYear, selectedMonth]);

  return (
    <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm animate-in fade-in duration-300">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="py-3 px-1 font-bold text-slate-700 border-r border-slate-200">주차</th>
            <th className="py-3 px-1 font-bold text-slate-700 border-r border-slate-200">예정</th>
            <th className="py-3 px-1 font-bold text-slate-700 border-r border-slate-200">주유</th>
            <th className="py-3 px-1 font-bold text-slate-700 border-r border-slate-200">거리</th>
            <th className="py-3 px-1 font-bold text-slate-700 border-r border-slate-200">이동</th>
            <th className="py-3 px-1 font-bold text-slate-700">소요</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {weeklyData.length > 0 ? (
            weeklyData.map((row, idx) => (
              <tr key={idx} className="text-center active:bg-slate-50 transition-colors">
                <td className="py-6 font-bold text-slate-600 border-r border-slate-100 whitespace-pre-line leading-tight">{row.weekName}</td>
                <td className="py-6 text-blue-600 border-r border-slate-100 font-bold">{row.income === 0 ? '0' : row.income.toLocaleString()}</td>
                <td className="py-6 text-red-500 border-r border-slate-100 font-bold">{row.fuel === 0 ? '0' : row.fuel.toLocaleString()}</td>
                <td className="py-6 text-slate-600 border-r border-slate-100">{row.distance.toLocaleString()}</td>
                <td className="py-6 text-slate-600 border-r border-slate-100">
                  <div className="flex items-center justify-center gap-0.5">
                    <span>{row.movements}</span>
                    {row.cancelCount > 0 && (
                      <span className="text-red-500 text-[10px] font-bold">(-{row.cancelCount})</span>
                    )}
                  </div>
                </td>
                <td className="py-6 text-slate-500 text-[10px] font-bold leading-tight">
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

export default WeeklyTableView;
