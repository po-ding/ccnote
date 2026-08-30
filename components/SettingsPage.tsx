
import React, { useState, useMemo } from 'react';
import { 
  TransportRecord, 
  LocationInfo, 
  FixedExpense, 
  SalaryRecord 
} from '../types';
import { 
  MapPin, 
  Trash2, 
  Download, 
  Upload, 
  Plus, 
  FileText,
  CreditCard,
  ChevronDown, 
  ChevronUp,
  Database,
  Save
} from 'lucide-react';
import { getTodayString, formatToManwon } from '../utils';

interface Props {
  records: TransportRecord[];
  setRecords: React.Dispatch<React.SetStateAction<TransportRecord[]>>;
  locations: Record<string, LocationInfo>;
  setLocations: React.Dispatch<React.SetStateAction<Record<string, LocationInfo>>>;
  fixedExpenses: FixedExpense[];
  setFixedExpenses: React.Dispatch<React.SetStateAction<FixedExpense[]>>;
  salaryRecords: SalaryRecord[];
  setSalaryRecords: React.Dispatch<React.SetStateAction<SalaryRecord[]>>;
  onOpenReport: () => void;
}

const SettingsPage: React.FC<Props> = ({ 
  records, setRecords,
  locations, setLocations, 
  fixedExpenses, setFixedExpenses,
  salaryRecords, setSalaryRecords,
  onOpenReport
}) => {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Form States for Inputs
  const [salDate, setSalDate] = useState(getTodayString());
  const [salAmount, setSalAmount] = useState('');
  const [salMemo, setSalMemo] = useState('');

  const [expDate, setExpDate] = useState(getTodayString());
  const [expName, setExpName] = useState('');
  const [expCost, setExpCost] = useState('');
  const [expRepeat, setExpRepeat] = useState(true);

  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locMemo, setLocMemo] = useState('');

  // --- Statistics Logic ---
  const calculateStats = (filteredRecords: TransportRecord[], filteredSalaries: SalaryRecord[], filteredFixed: FixedExpense[]) => {
    let income = filteredRecords.reduce((acc, r) => acc + (r.income || 0), 0);
    income += filteredSalaries.reduce((acc, s) => acc + s.amount, 0);

    let fuelCost = filteredRecords.filter(r => r.type === '주유기록').reduce((acc, r) => acc + (r.cost || 0), 0);
    let generalCost = filteredRecords.filter(r => r.type === '지출').reduce((acc, r) => acc + (r.cost || 0), 0);
    let fixedCostSum = filteredFixed.reduce((acc, f) => acc + f.cost, 0);
    
    const totalExpense = fuelCost + generalCost + fixedCostSum;
    const distance = filteredRecords.reduce((acc, r) => acc + (r.distance || 0), 0);
    const trips = filteredRecords.filter(r => ['화물운송', '운행종료'].includes(r.type)).length;
    const workDays = new Set(filteredRecords.filter(r => r.distance > 0 || r.type === '화물운송').map(r => r.date)).size;
    
    const totalLiters = filteredRecords.reduce((acc, r) => acc + (r.liters || 0), 0);
    const avgEfficiency = totalLiters > 0 ? (distance / totalLiters).toFixed(2) : "0.00";
    const costPerKm = distance > 0 ? Math.round(totalExpense / distance).toLocaleString() : "0";

    return { workDays, trips, distance, income, expense: totalExpense, net: income - totalExpense, avgEfficiency, costPerKm };
  };

  const currentMonth = new Date().toISOString().substring(0, 7);
  const currentMonthName = (new Date().getMonth() + 1) + "월";

  const monthlyStats = useMemo(() => {
    const r = records.filter(r => r.date.startsWith(currentMonth));
    const s = salaryRecords.filter(s => s.date.startsWith(currentMonth));
    const f = fixedExpenses.filter(f => f.isRepeat || f.date.startsWith(currentMonth));
    return calculateStats(r, s, f);
  }, [records, salaryRecords, fixedExpenses, currentMonth]);

  const cumulativeStats = useMemo(() => {
    return calculateStats(records, salaryRecords, fixedExpenses);
  }, [records, salaryRecords, fixedExpenses]);

  // --- Handlers ---
  const addSalary = () => {
    if (!salAmount) return;
    const newSal: SalaryRecord = { id: Date.now(), date: salDate, amount: Math.round(parseFloat(salAmount) * 10000), memo: salMemo };
    setSalaryRecords(prev => [newSal, ...prev]);
    setSalAmount(''); setSalMemo('');
  };

  const addExpense = () => {
    if (!expName || !expCost) return;
    const newExp: FixedExpense = { id: Date.now(), date: expDate, name: expName, cost: Math.round(parseFloat(expCost) * 10000), isRepeat: expRepeat, memo: '' };
    setFixedExpenses(prev => [newExp, ...prev]);
    setExpName(''); setExpCost('');
  };

  const addLocation = () => {
    if (!locName) return;
    setLocations(prev => ({ ...prev, [locName]: { address: locAddress, memo: locMemo } }));
    setLocName(''); setLocAddress(''); setLocMemo('');
  };

  const handleExport = () => {
    const data = { records, locations, fixedExpenses, salaryRecords };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CNote_Backup_${getTodayString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (confirm('모든 데이터를 파일의 데이터로 교체하시겠습니까? (기존 데이터는 삭제됩니다)')) {
          setRecords(data.records || []);
          setLocations(data.locations || {});
          setFixedExpenses(data.fixedExpenses || []);
          setSalaryRecords(data.salaryRecords || []);
          alert('데이터 복원이 완료되었습니다.');
        }
      } catch (err) { alert('유효한 백업 파일이 아닙니다.'); }
    };
    reader.readAsText(file);
  };

  // UI Components
  const StatCard = ({ label, value, unit, color = "text-slate-800", highlight = false }: any) => (
    <div className={`bg-white p-2 rounded-xl border flex flex-col items-center justify-center shadow-sm min-h-[72px] transition-all ${highlight ? 'border-blue-400 ring-2 ring-blue-50 bg-blue-50/10' : 'border-slate-100'}`}>
      <span className="text-[9px] font-bold text-slate-400 mb-1">{label}</span>
      <div className="flex items-baseline gap-0.5">
        <span className={`text-[13px] font-black ${color}`}>{value}</span>
        <span className="text-[9px] font-bold text-slate-400">{unit}</span>
      </div>
    </div>
  );

  const StatGrid = ({ title, stats }: { title: string, stats: any }) => (
    <div className="space-y-3">
      <h3 className="text-center text-[11px] font-black text-slate-600 uppercase tracking-widest">{title}</h3>
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="운행일수" value={stats.workDays} unit="일" />
        <StatCard label="운행건수" value={stats.trips} unit="건" />
        <StatCard label="총 운행거리" value={Math.round(stats.distance).toLocaleString()} unit="km" />
        <StatCard label="총수입" value={formatToManwon(stats.income)} unit="만원" color="text-emerald-600" />
        <StatCard label="총지출" value={formatToManwon(stats.expense)} unit="만원" color="text-red-500" />
        <StatCard label="정산 금액" value={formatToManwon(stats.net)} unit="만원" highlight color={stats.net >= 0 ? "text-blue-600" : "text-red-500"} />
        <StatCard label="평균 연비" value={stats.avgEfficiency} unit="km/L" />
        <StatCard label="km당 운행비용" value={stats.costPerKm} unit="원" />
      </div>
    </div>
  );

  const Section = ({ id, title, icon: Icon, children }: any) => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
      <button 
        onClick={() => setActiveSection(activeSection === id ? null : id)}
        className={`w-full p-4 flex justify-between items-center transition-all ${activeSection === id ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`}
      >
        <div className="flex items-center gap-3">
          <Icon size={18} className={activeSection === id ? 'text-blue-600' : 'text-slate-400'} />
          <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
        </div>
        {activeSection === id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {activeSection === id && <div className="p-4 border-t border-slate-100 space-y-4">{children}</div>}
    </div>
  );

  return (
    <div className="space-y-10 pb-24 pt-2">
      {/* 1. 요약 대시보드 */}
      <div className="space-y-10 px-1">
        <StatGrid title={`${currentMonthName} 실시간 요약`} stats={monthlyStats} />
        <StatGrid title="누적 데이터" stats={cumulativeStats} />
      </div>

      <div className="space-y-4">
        {/* 2. 내역 출력 버튼 */}
        <div className="px-1">
          <button 
            onClick={onOpenReport} 
            className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <FileText size={18}/> 상세 내역 출력 리포트
          </button>
        </div>

        {/* 3. 급여 & 고정 지출 관리 테이블 */}
        <Section id="salary" title="급여 & 고정 지출 관리" icon={CreditCard}>
          <div className="space-y-4">
            {/* 등록 폼 */}
            <div className="p-4 bg-slate-50 rounded-xl border space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={salDate} onChange={e => setSalDate(e.target.value)} className="p-2 border rounded-lg text-xs" />
                <input type="number" placeholder="급여 금액(만원)" value={salAmount} onChange={e => setSalAmount(e.target.value)} className="p-2 border rounded-lg text-xs" />
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="메모(보너스, 식대 등)" value={salMemo} onChange={e => setSalMemo(e.target.value)} className="flex-1 p-2 border rounded-lg text-xs" />
                <button onClick={addSalary} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold active:scale-95">급여등록</button>
              </div>
            </div>
            <div className="p-4 bg-red-50/30 rounded-xl border border-red-100 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} className="p-2 border rounded-lg text-xs" />
                <input type="text" placeholder="지출 항목명" value={expName} onChange={e => setExpName(e.target.value)} className="p-2 border rounded-lg text-xs" />
              </div>
              <div className="flex gap-2 items-center">
                <input type="number" placeholder="금액(만원)" value={expCost} onChange={e => setExpCost(e.target.value)} className="flex-1 p-2 border rounded-lg text-xs" />
                <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500 whitespace-nowrap">
                  <input type="checkbox" checked={expRepeat} onChange={e => setExpRepeat(e.target.checked)} /> 매월 반복
                </label>
                <button onClick={addExpense} className="px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-bold active:scale-95">지출등록</button>
              </div>
            </div>
            {/* 목록 테이블 */}
            <div className="max-h-48 overflow-y-auto divide-y border rounded-xl bg-white shadow-inner">
              {[...salaryRecords, ...fixedExpenses.map(f => ({ ...f, type: 'fixed' }))].sort((a:any, b:any) => b.id - a.id).map((item: any) => (
                <div key={item.id} className="p-3 flex justify-between items-center text-[10px]">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-600">{item.date} {item.isRepeat ? '[고정]' : ''}</span>
                    <span className={item.type === 'fixed' ? 'text-red-500 font-bold' : 'text-blue-600 font-bold'}>{item.name || item.memo || '무명'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-sm">{(item.cost || item.amount / 10000).toLocaleString()}만</span>
                    <button 
                      onClick={() => {
                        const isFixed = item.type === 'fixed';
                        const label = isFixed ? '고정 지출' : '급여';
                        if (confirm(`이 ${label} 항목을 삭제하시겠습니까?`)) {
                          isFixed 
                            ? setFixedExpenses(p => p.filter(x => x.id !== item.id)) 
                            : setSalaryRecords(p => p.filter(x => x.id !== item.id));
                        }
                      }} 
                      className="text-slate-300 hover:text-red-500 p-1"
                    >
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>
              ))}
              {(salaryRecords.length === 0 && fixedExpenses.length === 0) && <div className="p-4 text-center text-slate-300 text-[10px]">내역이 없습니다.</div>}
            </div>
          </div>
        </Section>

        {/* 4. 운송 지역 관리 테이블 */}
        <Section id="location" title="운송 지역 관리 테이블" icon={MapPin}>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border space-y-3">
              <input type="text" placeholder="지역 이름 (예: 안산 쿠팡)" value={locName} onChange={e => setLocName(e.target.value)} className="w-full p-2 border rounded-lg text-sm font-bold" />
              <input type="text" placeholder="정확한 주소 입력" value={locAddress} onChange={e => setLocAddress(e.target.value)} className="w-full p-2 border rounded-lg text-xs" />
              <div className="flex gap-2">
                <input type="text" placeholder="참조 메모" value={locMemo} onChange={e => setLocMemo(e.target.value)} className="flex-1 p-2 border rounded-lg text-xs" />
                <button onClick={addLocation} className="px-6 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold active:scale-95">지역 추가</button>
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y border rounded-xl bg-white shadow-inner">
              {Object.entries(locations).map(([name, info]: [string, LocationInfo]) => (
                <div key={name} className="p-3 flex justify-between items-start">
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="text-sm font-bold text-slate-800">{name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{info.address}</div>
                    {info.memo && <div className="text-[9px] text-slate-400 mt-0.5 italic">{info.memo}</div>}
                  </div>
                  <button onClick={() => {
                    if (confirm(`'${name}' 지역 정보를 삭제하시겠습니까?`)) {
                      setLocations(p => { const n={...p}; delete n[name]; return n; });
                    }
                  }} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                </div>
              ))}
              {Object.keys(locations).length === 0 && <div className="p-4 text-center text-slate-300 text-[10px]">등록된 지역이 없습니다.</div>}
            </div>
          </div>
        </Section>

        {/* 5. 데이터 관리 */}
        <Section id="data" title="데이터 관리" icon={Database}>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleExport} className="p-5 bg-blue-50 text-blue-600 rounded-2xl flex flex-col items-center gap-2 border border-blue-100 active:scale-95 transition-all shadow-sm">
              <Download size={24}/>
              <span className="text-[11px] font-black uppercase">전체 백업</span>
            </button>
            <div className="relative p-5 bg-emerald-50 text-emerald-600 rounded-2xl flex flex-col items-center gap-2 border border-emerald-100 active:scale-95 transition-all shadow-sm">
              <Upload size={24}/>
              <span className="text-[11px] font-black uppercase">백업 복원</span>
              <input type="file" accept=".json" onChange={handleImport} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
          </div>
          <p className="text-[9px] text-slate-400 text-center font-bold">기기 변경 시 백업 파일을 만들어 새 기기에서 복원하세요.</p>
        </Section>
      </div>
    </div>
  );
};

export default SettingsPage;
