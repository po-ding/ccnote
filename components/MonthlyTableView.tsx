
import React, { useMemo } from 'react';
import { TransportRecord, SalaryRecord } from '../types';
import { getTodayString } from '../utils';

interface Props {
  records: TransportRecord[];
  salaryRecords: SalaryRecord[];
  selectedYear: number;
}

const MonthlyTableView: React.FC<Props> = ({ 
  records, 
  salaryRecords,
  selectedYear 
}) => {
  
  const monthlyData = useMemo(() => {
    const data = [];
    const todayStr = getTodayString();
    const [tYear, tMonth] = todayStr.split('-').map(Number);

    const years = [selectedYear, selectedYear - 1];

    for (const year of years) {
      for (let m = 12; m >= 1; m--) {
        if (year > tYear || (year === tYear && m > tMonth)) continue;

        const monthStr = `${year}-${String(m).padStart(2, '0')}`;
        const monthRecords = records.filter(r => r.date.startsWith(monthStr));
        const monthSalaries = (salaryRecords || []).filter(s => s.date.startsWith(monthStr));

        let mTransportIncome = 0; // 운송 수입 (예정 금액)
        let mSalaryDeposit = 0;   // 급여 입금 (실제 입금)
        let mFuelCost = 0;
        let mFuelLiters = 0;
        let mDist = 0;
        let mMovements = 0;
        let mCancelCount = 0;
        let mTotalMinutes = 0;

        monthRecords.forEach(r => {
          if (r.type === '수입') {
            mTransportIncome += (r.income || 0);
          } else if (r.type === '주유기록') {
            // 주유금액은 실결제금액 우선, 없으면 cost 사용
            mFuelCost += (r.actualCost !== undefined ? r.actualCost : (r.cost - (r.subsidy || 0)));
            mFuelLiters += (r.liters || 0);
          } else if (['화물운송', '운행종료', '공차거리', '운행취소', '운행회차', '대기'].includes(r.type)) {
            // 운행취소는 운송 수입에 합산하지 않음 (0원)
            if (r.type !== '운행취소') {
              mTransportIncome += (r.income || 0);
            }
            mDist += (r.distance || 0);
            
            if (r.type === '운행취소') {
              mCancelCount++;
            } else {
              // 완료된 건만 집계 (공차거리 제외, 운행취소 제외)
              if (['화물운송', '운행종료', '운행회차', '대기'].includes(r.type) && 
                  (r.endTime || r.distance > 0 || r.type === '대기' || r.type === '운행회차')) {
                mMovements++;
              }
            }

            if (r.time && r.endTime && r.type !== '운행취소') {
              const [sh, sm] = r.time.split(':').map(Number);
              const [eh, em] = r.endTime.split(':').map(Number);
              let diff = (eh * 60 + em) - (sh * 60 + sm);
              if (diff < 0) diff += 1440;
              mTotalMinutes += diff;
            }
          }
        });

        monthSalaries.forEach(s => {
          mSalaryDeposit += (s.amount || 0);
        });

        // 데이터가 없는 달은 건너뛰기 (작년 데이터 포함)
        const hasData = mTransportIncome > 0 || mSalaryDeposit > 0 || mFuelCost > 0 || mFuelLiters > 0 || mDist > 0 || mMovements > 0 || mCancelCount > 0;
        if (!hasData) continue;

        const h = Math.floor(mTotalMinutes / 60);
        const durationStr = mTotalMinutes > 0 ? `${h}시간` : "-";

        // 급여 표시 로직: 급여 입금이 있으면 입금액(검정), 없으면 운송수입(파랑/예정)
        const displaySalary = mSalaryDeposit > 0 ? mSalaryDeposit : mTransportIncome;
        const isEstimated = mSalaryDeposit === 0 && mTransportIncome > 0;

        data.push({
          label: `${String(year).substring(2)}년\n${String(m).padStart(2, '0')}월`,
          salary: Math.round(displaySalary / 10000),
          isEstimated,
          fuelLiters: Math.round(mFuelLiters),
          fuelCost: Math.round(mFuelCost / 10000),
          distance: Math.round(mDist),
          movements: mMovements,
          cancelCount: mCancelCount,
          duration: durationStr
        });
      }
    }
    return data;
  }, [records, salaryRecords, selectedYear]);

  return (
    <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm animate-in fade-in duration-300">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="py-3 px-1 font-bold text-slate-700 border-r border-slate-200">월</th>
            <th className="py-3 px-1 font-bold text-slate-700 border-r border-slate-200">급여</th>
            <th className="py-3 px-1 font-bold text-slate-700 border-r border-slate-200">주유리터</th>
            <th className="py-3 px-1 font-bold text-slate-700 border-r border-slate-200">주유금액</th>
            <th className="py-3 px-1 font-bold text-slate-700 border-r border-slate-200">거리</th>
            <th className="py-3 px-1 font-bold text-slate-700 border-r border-slate-200">이동</th>
            <th className="py-3 px-1 font-bold text-slate-700">소요</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {monthlyData.length > 0 ? (
            monthlyData.map((row, idx) => (
              <tr key={idx} className="text-center active:bg-slate-50 transition-colors">
                <td className="py-5 font-bold text-slate-600 border-r border-slate-100 whitespace-pre-line leading-tight">{row.label}</td>
                <td className={`py-5 font-bold border-r border-slate-100 ${row.isEstimated ? 'text-blue-500' : 'text-emerald-600'}`}>
                  {row.salary === 0 ? '0' : row.salary.toLocaleString()}
                </td>
                <td className="py-5 text-slate-600 border-r border-slate-100">{row.fuelLiters.toLocaleString()}</td>
                <td className="py-5 text-red-500 border-r border-slate-100">{row.fuelCost === 0 ? '0' : row.fuelCost.toLocaleString()}</td>
                <td className="py-5 text-slate-600 border-r border-slate-100">{row.distance.toLocaleString()}</td>
                <td className="py-5 text-slate-600 border-r border-slate-100">
                  <div className="flex items-center justify-center gap-0.5">
                    <span>{row.movements}</span>
                    {row.cancelCount > 0 && (
                      <span className="text-red-500 text-[10px] font-bold">(-{row.cancelCount})</span>
                    )}
                  </div>
                </td>
                <td className="py-5 text-slate-500 text-[10px] font-bold leading-tight whitespace-pre-line">
                  {row.duration}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="py-10 text-center text-slate-300 italic">데이터가 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default MonthlyTableView;
