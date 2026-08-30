
import React, { useMemo } from 'react';
import { TransportRecord, SalaryRecord, FixedExpense } from '../types';
import { formatToManwon } from '../utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, Navigation, Truck, DollarSign, Wind } from 'lucide-react';

interface Props {
  records: TransportRecord[];
  salaryRecords: SalaryRecord[];
  fixedExpenses: FixedExpense[];
}

const Statistics: React.FC<Props> = ({ records, salaryRecords, fixedExpenses }) => {
  const currentMonth = new Date().toISOString().substring(0, 7);

  const stats = useMemo(() => {
    const safeRecords = Array.isArray(records) ? records : [];
    const safeSalaries = Array.isArray(salaryRecords) ? salaryRecords : [];
    const safeFixed = Array.isArray(fixedExpenses) ? fixedExpenses : [];

    const monthRecords = safeRecords.filter(r => r && r.date && r.date.startsWith(currentMonth));
    let sales = 0;
    let income = 0;
    let expense = 0;
    let fuelCost = 0;
    let fuelLiters = 0;
    let distance = 0;
    let emptyDistance = 0;
    let trips = 0;
    let cancelTrips = 0;

    monthRecords.forEach(r => {
      // 운행취소는 매출/수입에 합산하지 않음 (0원)
      if (r.type !== '운행취소') {
        sales += (r.income || 0);
      }
      
      if (r.type === '주유기록') {
        fuelCost += (r.actualCost !== undefined ? r.actualCost : (r.cost - (r.subsidy || 0)));
        fuelLiters += (r.liters || 0);
      } else {
        expense += (r.cost || 0);
      }
      
      const isTransportType = ['화물운송', '공차거리', '운송종료', '운행종료', '운행취소', '운행회차', '대기'].includes(r.type);
      const isCompleted = !!(r.endTime || (r.distance && r.distance > 0) || r.type === '대기' || r.type === '운행회차');
      
      if (isTransportType) {
        if (r.type === '공차거리') {
          emptyDistance += (r.distance || 0);
        } else if (r.type === '운행취소') {
          cancelTrips++;
        } else {
          distance += (r.distance || 0);
          if (isCompleted) trips++;
        }
      }
    });

    safeSalaries.forEach(s => {
      if (s && s.date && s.date.startsWith(currentMonth)) {
        income += (s.amount || 0);
      }
    });

    safeFixed.forEach(fe => {
      if (fe && (fe.isRepeat || (fe.date && fe.date.startsWith(currentMonth)))) {
        expense += (fe.cost || 0);
      }
    });

    const totalExpense = expense + fuelCost;
    return { 
      sales, 
      income, 
      expense: totalExpense, 
      fuelCost, 
      fuelLiters,
      net: income - totalExpense, // 정산 금액: 급여 - 총지출
      distance, 
      emptyDistance, 
      trips,
      cancelTrips
    };
  }, [records, salaryRecords, fixedExpenses, currentMonth]);

  const chartData = useMemo(() => {
    const safeRecords = Array.isArray(records) ? records : [];
    const last10Days = Array.from({ length: 10 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last10Days.map(date => {
      const daily = safeRecords.filter(r => r && r.date === date);
      const dailyTrips = daily.filter(r => 
        r && ['화물운송', '운행종료', '운행회차', '대기'].includes(r.type) && 
        (r.endTime || (r.distance && r.distance > 0) || r.type === '대기' || r.type === '운행회차') && 
        r.type !== '공차거리' &&
        r.type !== '운행취소'
      ).length;
      
      return { 
        name: date.substring(8, 10) + '일', 
        운행건수: dailyTrips
      };
    });
  }, [records]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-600 rounded-2xl p-4 text-white shadow-lg">
          <div className="text-xs opacity-80 mb-1">이번 달 예정 매출(운송)</div>
          <div className="text-2xl font-black">{formatToManwon(stats.sales)} <span className="text-sm font-normal">만원</span></div>
        </div>
        <div className="bg-emerald-600 rounded-2xl p-4 text-white shadow-lg">
          <div className="text-xs opacity-80 mb-1">이번 달 총수입(급여)</div>
          <div className="text-2xl font-black">{formatToManwon(stats.income)} <span className="text-sm font-normal">만원</span></div>
        </div>
        <div className="bg-orange-500 rounded-2xl p-4 text-white shadow-lg">
          <div className="text-xs opacity-80 mb-1">이번 달 주유비</div>
          <div className="text-2xl font-black">{stats.fuelCost.toLocaleString()} <span className="text-sm font-normal">원</span></div>
          <div className="text-[10px] opacity-80 mt-1">총 {stats.fuelLiters.toFixed(1)}L 주유</div>
        </div>
        <div className="bg-slate-800 rounded-2xl p-4 text-white shadow-lg">
          <div className="text-xs opacity-80 mb-1">이번 달 총지출</div>
          <div className="text-2xl font-black text-red-400">{formatToManwon(stats.expense)} <span className="text-sm font-normal text-white">만원</span></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <h3 className="text-sm font-bold text-slate-800 mb-4">이번 달 정산 (급여 - 지출)</h3>
        <div className={`text-3xl font-black text-center ${stats.net >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
          {stats.net > 0 ? '+' : ''}{formatToManwon(stats.net)} <span className="text-lg text-slate-400 font-normal">만원</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Activity size={18} className="text-emerald-500" />
            최근 10일 운행 건수
          </h3>
          <div className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
            Completed
          </div>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip 
                cursor={{fill: '#f1f5f9'}}
                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
              />
              <Bar dataKey="운행건수" fill="#10b981" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.운행건수 > 0 ? '#10b981' : '#e2e8f0'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 flex flex-col justify-center shadow-sm border border-slate-100 col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
               <DollarSign size={16} className="text-blue-600" />
            </div>
            <span className="text-slate-500 font-medium">이번 달 순이익</span>
          </div>
          <span className={`text-2xl font-black ${stats.net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {formatToManwon(stats.net)} <span className="text-xs font-bold">만원</span>
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 flex flex-col justify-center shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
               <Navigation size={16} className="text-emerald-600" />
            </div>
            <span className="text-slate-500 font-medium">유상 거리</span>
          </div>
          <span className="text-xl font-black text-slate-800">
            {stats.distance.toFixed(1)} <span className="text-xs font-bold">km</span>
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 flex flex-col justify-center shadow-sm border border-slate-100 ring-2 ring-orange-50 border-orange-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
               <Wind size={16} className="text-orange-500" />
            </div>
            <span className="text-slate-500 font-medium">공차 거리</span>
          </div>
          <span className="text-xl font-black text-orange-600">
            {stats.emptyDistance.toFixed(1)} <span className="text-xs font-bold">km</span>
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 flex flex-col justify-center shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
               <Truck size={16} className="text-slate-600" />
            </div>
            <span className="text-slate-500 font-medium">운행 완료</span>
          </div>
          <span className="text-xl font-black text-slate-800 flex items-baseline gap-1">
            <span>{stats.trips} <span className="text-xs font-bold">건</span></span>
            {stats.cancelTrips > 0 && (
              <span className="text-xs font-bold text-red-500">(-{stats.cancelTrips})</span>
            )}
          </span>
        </div>
        
        <div className="bg-slate-100 rounded-2xl p-4 flex flex-col justify-center shadow-inner text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase">공차 비중</span>
          <span className="text-lg font-black text-slate-600">
            {stats.distance + stats.emptyDistance > 0 
              ? ((stats.emptyDistance / (stats.distance + stats.emptyDistance)) * 100).toFixed(1) 
              : 0}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
