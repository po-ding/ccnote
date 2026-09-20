
import React, { useState, useMemo, useEffect } from 'react';
import { 
  TransportRecord, 
  LocationInfo, 
  FixedExpense, 
  SalaryRecord 
} from '../types';
import { 
  MapPin, 
  Trash2, 
  Edit2,
  Download, 
  Upload, 
  FileText,
  ChevronDown, 
  ChevronUp,
  Database,
  DollarSign,
  Key,
  CheckCircle,
  AlertCircle,
  Save,
  X,
  FileSpreadsheet,
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw
} from 'lucide-react';
import Papa from 'papaparse';
import { getTodayString, formatToManwon } from '../utils';
import { saveToFirebase, loadFromFirebase } from '../firebase';

// --- 외부 컴포넌트 선언 (리렌더링 시 포커스 잃음 방지) ---

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
      <StatCard label="예정 매출" value={formatToManwon(stats.sales)} unit="만원" color="text-blue-600" />
      <StatCard label="총수입(급여)" value={formatToManwon(stats.income)} unit="만원" color="text-emerald-600" />
      <StatCard label="총지출" value={formatToManwon(stats.expense)} unit="만원" color="text-red-500" />
      <StatCard label="정산" value={formatToManwon(stats.net)} unit="만원" highlight color={stats.net >= 0 ? "text-blue-600" : "text-red-500"} />
      <StatCard label="평균 연비" value={stats.avgEfficiency} unit="km/L" />
    </div>
  </div>
);

const Section = ({ id, title, icon: Icon, activeSection, setActiveSection, children }: any) => (
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

const SettingsPage2: React.FC<any> = ({ 
  records, setRecords,
  locations, setLocations, 
  fixedExpenses, setFixedExpenses,
  salaryRecords, setSalaryRecords,
  onOpenReport,
  onManualBackup,
  lastBackupTime
}) => {
  const [activeSection, setActiveSection] = useState<string | null>('finance');
  const [financeTab, setFinanceTab] = useState<'salary' | 'fixed' | 'general'>('salary');

  // Form States
  const [salDate, setSalDate] = useState(getTodayString());
  const [salAmount, setSalAmount] = useState('');
  const [salMemo, setSalMemo] = useState('');
  const [editingSalId, setEditingSalId] = useState<number | null>(null);

  const [expDate, setExpDate] = useState(getTodayString());
  const [expName, setExpName] = useState('');
  const [expCost, setExpCost] = useState('');
  const [expRepeat, setExpRepeat] = useState(true);
  const [editingExpId, setEditingExpId] = useState<number | null>(null);

  const [genDate, setGenDate] = useState(getTodayString());
  const [genMemo, setGenMemo] = useState('');
  const [genCost, setGenCost] = useState('');
  const [editingGenId, setEditingGenId] = useState<number | null>(null);

  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locMemo, setLocMemo] = useState('');
  const [locSearch, setLocSearch] = useState('');
  const [editingLocName, setEditingLocName] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState('');
  const [isKeySaved, setIsKeySaved] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('GEMINI_API_KEY');
    if (savedKey) {
      setApiKey(savedKey);
      setIsKeySaved(true);
    } else {
      setApiKey("AIzaSyC93qXIy2YbzZqHJoKB0sIvsUeGkw1qHNY");
    }
  }, []);

  const calculateStats = (filteredRecords: TransportRecord[] = [], filteredSalaries: SalaryRecord[] = [], filteredFixed: FixedExpense[] = []) => {
    const safeRecords = (filteredRecords || []).filter(r => r && r.date);
    const safeSalaries = (filteredSalaries || []).filter(s => s && s.date);
    const safeFixed = (filteredFixed || []).filter(f => f && (f.isRepeat || f.date));

    let sales = safeRecords.filter(r => r.type !== '운행취소').reduce((acc, r) => acc + (r.income || 0), 0);
    let income = safeSalaries.reduce((acc, s) => acc + (s.amount || 0), 0);

    let fuelCost = safeRecords.filter(r => r.type === '주유기록').reduce((acc, r) => acc + (r.actualCost !== undefined ? r.actualCost : (r.cost - (r.subsidy || 0))), 0);
    let generalCost = safeRecords.filter(r => r.type === '지출').reduce((acc, r) => acc + (r.cost || 0), 0);
    let fixedCostSum = safeFixed.reduce((acc, f) => acc + (f.cost || 0), 0);
    
    const totalExpense = fuelCost + generalCost + fixedCostSum;
    const distance = safeRecords.filter(r => r.type !== '공차거리').reduce((acc, r) => acc + (r.distance || 0), 0);
    const emptyDistance = safeRecords.filter(r => r.type === '공차거리').reduce((acc, r) => acc + (r.distance || 0), 0);
    
    const cancelTrips = safeRecords.filter(r => r.type === '운행취소').length;
    const trips = safeRecords.filter(r => 
      ['화물운송', '운송종료', '운행종료', '운행회차', '대기'].includes(r.type) && 
      (r.distance > 0 || r.endTime || r.type === '대기' || r.type === '운행회차')
    ).length;
    
    const workDays = new Set(safeRecords.filter(r => (r.distance > 0 || r.type === '화물운송') && r.type !== '공차거리').map(r => r.date)).size;
    const totalLiters = safeRecords.reduce((acc, r) => acc + (r.liters || 0), 0);
    const avgEfficiency = totalLiters > 0 ? (distance / totalLiters).toFixed(2) : "0.00";

    return { workDays, trips, distance, emptyDistance, sales, income, expense: totalExpense, net: income - totalExpense, avgEfficiency };
  };

  const currentMonth = new Date().toISOString().substring(0, 7);
  const currentMonthName = (new Date().getMonth() + 1) + "월";

  const monthlyStats = useMemo(() => {
    const r = (records || []).filter(r => r && r.date && r.date.startsWith(currentMonth));
    const s = (salaryRecords || []).filter(s => s && s.date && s.date.startsWith(currentMonth));
    const f = (fixedExpenses || []).filter(f => f && (f.isRepeat || (f.date && f.date.startsWith(currentMonth))));
    return calculateStats(r, s, f);
  }, [records, salaryRecords, fixedExpenses, currentMonth]);

  const cumulativeStats = useMemo(() => {
    return calculateStats(records, salaryRecords, fixedExpenses);
  }, [records, salaryRecords, fixedExpenses]);

  // Handlers
  const addSalary = () => {
    if (!salAmount) return;
    const amountVal = Math.round(parseFloat(salAmount) * 10000);
    if (editingSalId) {
      setSalaryRecords((prev: SalaryRecord[]) => prev.map(s => s.id === editingSalId ? { ...s, date: salDate, amount: amountVal, memo: salMemo } : s));
      setEditingSalId(null);
    } else {
      setSalaryRecords((prev: SalaryRecord[]) => [{ id: Date.now(), date: salDate, amount: amountVal, memo: salMemo }, ...prev]);
    }
    setSalAmount(''); setSalMemo(''); setSalDate(getTodayString());
  };

  const addExpense = () => {
    if (!expName || !expCost) return;
    const costVal = Math.round(parseFloat(expCost) * 10000);
    if (editingExpId) {
      setFixedExpenses((prev: FixedExpense[]) => prev.map(f => f.id === editingExpId ? { ...f, date: expDate, name: expName, cost: costVal, isRepeat: expRepeat } : f));
      setEditingExpId(null);
    } else {
      setFixedExpenses((prev: FixedExpense[]) => [{ id: Date.now(), date: expDate, name: expName, cost: costVal, isRepeat: expRepeat, memo: '' }, ...prev]);
    }
    setExpName(''); setExpCost(''); setExpDate(getTodayString());
  };

  const saveGeneralEdit = () => {
    if (!genCost) return;
    const costVal = Math.round(parseFloat(genCost) * 10000);
    if (editingGenId) {
      setRecords((prev: TransportRecord[]) => prev.map(r => r.id === editingGenId ? { ...r, date: genDate, memo: genMemo, cost: costVal } : r));
      setEditingGenId(null);
    } else {
      const now = new Date();
      setRecords((prev: TransportRecord[]) => [{
        id: Date.now(),
        date: genDate,
        time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        type: '지출',
        cost: costVal,
        memo: genMemo,
        distance: 0,
        start_gps: '',
        end_gps: '',
        income: 0,
        liters: 0,
        unitPrice: 0,
        brand: '',
        ureaLiters: 0,
        ureaUnitPrice: 0,
        ureaStation: '',
        supplyItem: '',
        mileage: 0,
        waitingTime: 0
      } as TransportRecord, ...prev]);
    }
    setGenCost(''); setGenMemo(''); setGenDate(getTodayString());
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let totalNewRecords: TransportRecord[] = [];
    let processedFiles = 0;

    Array.from(files as FileList).forEach((file: File) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const parsedRecords: TransportRecord[] = results.data.map((row: any) => {
              const date = row['날짜'] || row['Date'] || getTodayString();
              const time = row['시간'] || row['Time'] || '00:00';
              const from = (row['상차지'] || row['출발지'] || row['Origin'] || '').trim();
              const to = (row['하차지'] || row['도착지'] || row['Destination'] || '').trim();
              const incomeRaw = row['금액'] || row['수입'] || row['Income'] || row['Amount'] || '0';
              const income = Math.round(parseFloat(incomeRaw.toString().replace(/[^0-9.]/g, '')) * (incomeRaw.toString().includes('만') ? 10000 : 1));
              const distance = parseFloat(row['거리'] || row['Distance'] || '0');
              const memo = row['메모'] || row['비고'] || row['Memo'] || '';

              return {
                id: Date.now() + Math.random(),
                date,
                time,
                type: '화물운송',
                from,
                to,
                distance,
                income,
                cost: 0,
                liters: 0,
                unitPrice: 0,
                brand: '기타',
                ureaLiters: 0,
                ureaUnitPrice: 0,
                ureaStation: '',
                supplyItem: '',
                mileage: 0,
                waitingTime: 0,
                start_gps: '',
                end_gps: '',
                isStarted: false,
                memo
              };
            });
            totalNewRecords = [...totalNewRecords, ...parsedRecords];
          } catch (err) {
            console.error('CSV parse error', err);
          } finally {
            processedFiles++;
            if (processedFiles === files.length) {
              finalizeImport(totalNewRecords);
            }
          }
        }
      });
    });
    e.target.value = '';
  };

  const finalizeImport = (newParsed: TransportRecord[]) => {
    setRecords((prev: TransportRecord[]) => {
      const existingKeys = new Set(prev.map(r => `${r.date}_${r.time}_${r.from}_${r.to}`));
      const uniqueNew = newParsed.filter(r => {
        const key = `${r.date}_${r.time}_${r.from}_${r.to}`;
        if (existingKeys.has(key)) return false;
        existingKeys.add(key);
        return true;
      });

      if (uniqueNew.length > 0) {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: `${uniqueNew.length}건의 새로운 내역이 추가되었습니다. (중복 ${newParsed.length - uniqueNew.length}건 제외)` } 
        }));
        return [...prev, ...uniqueNew].sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return a.time.localeCompare(b.time);
        });
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: '새로 추가할 내역이 없습니다. (모두 중복)', type: 'error' } 
        }));
        return prev;
      }
    });
  };

  const handleBatchFillIncome = () => {
    // 1. 단가 맵 생성 (from + to -> income)
    const priceMap: Record<string, number> = {};
    records.forEach(r => {
      if (r.from && r.to && r.income > 0) {
        const key = `${r.from.trim()}_${r.to.trim()}`;
        // 더 최신 기록이 뒤에 있으므로 덮어씌워짐 (최신 단가 유지)
        priceMap[key] = r.income;
      }
    });

    // 2. 업데이트 대상 카운트
    let targetCount = 0;
    records.forEach(r => {
      if (r.income === 0 && r.from && r.to) {
        const key = `${r.from.trim()}_${r.to.trim()}`;
        if (priceMap[key]) {
          targetCount++;
        }
      }
    });

    if (targetCount === 0) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '자동으로 채울 수 있는 금액이 없습니다.', type: 'error' } }));
      return;
    }

    if (window.confirm(`금액이 없는 ${targetCount}건의 기록을 과거 단가에 맞춰 업데이트하시겠습니까?`)) {
      const result = records.map(r => {
        if (r.income === 0 && r.from && r.to) {
          const key = `${r.from.trim()}_${r.to.trim()}`;
          if (priceMap[key]) {
            return { ...r, income: priceMap[key] };
          }
        }
        return r;
      });
      setRecords(result);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `${targetCount}건의 누락된 금액이 자동으로 채워졌습니다.` } }));
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = JSON.parse(event.target?.result as string);
        const data = (raw.data || raw) as {
          records?: any[];
          fixedExpenses?: any[];
          salaryRecords?: any[];
          locations?: Record<string, any>;
        };
        setRecords(Array.isArray(data.records) ? data.records : []);
        setFixedExpenses(Array.isArray(data.fixedExpenses) ? data.fixedExpenses : []);
        (setSalaryRecords as any)(Array.isArray(data.salaryRecords) ? data.salaryRecords : []);
        setLocations(data.locations || {});
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '데이터 복원이 완료되었습니다.' } }));
      } catch (err) { window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '유효한 백업 파일이 아닙니다.', type: 'error' } })); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudUserId, setCloudUserId] = useState(() => localStorage.getItem('cloud_user_id') || 'my_driver_data');
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState(() => localStorage.getItem('last_cloud_sync_time') || '');

  const handleCloudUpload = async () => {
    if (isCloudSyncing) return;
    setIsCloudSyncing(true);
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Firebase 클라우드에 백업 중...' } }));
    
    try {
      const ok = await saveToFirebase(cloudUserId, records, fixedExpenses, salaryRecords, locations);
      if (ok) {
        const timeNow = new Date().toISOString();
        setLastCloudSyncTime(timeNow);
        localStorage.setItem('last_cloud_sync_time', timeNow);
        localStorage.setItem('cloud_user_id', cloudUserId);
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '클라우드 백업이 완료되었습니다!' } }));
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '클라우드 백업 실패 (네트워크를 확인하세요)', type: 'error' } }));
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '클라우드 백업 중 오류 발생', type: 'error' } }));
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleCloudDownload = async () => {
    if (isCloudSyncing) return;
    if (!window.confirm('클라우드에서 데이터를 불러오시겠습니까?\n현재 기기의 기록이 클라우드 백업본으로 교체됩니다.')) return;
    
    setIsCloudSyncing(true);
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Firebase 클라우드에서 불러오는 중...' } }));
    
    try {
      const cloudData = await loadFromFirebase(cloudUserId);
      if (cloudData && Array.isArray(cloudData.records)) {
        setRecords(cloudData.records);
        setFixedExpenses(Array.isArray(cloudData.fixedExpenses) ? cloudData.fixedExpenses : []);
        if (cloudData.salaryRecords && Array.isArray(cloudData.salaryRecords)) {
          (setSalaryRecords as any)(cloudData.salaryRecords);
        }
        if (cloudData.locations) {
          setLocations(cloudData.locations);
        }
        const timeNow = cloudData.updatedAt || new Date().toISOString();
        setLastCloudSyncTime(timeNow);
        localStorage.setItem('last_cloud_sync_time', timeNow);
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `클라우드에서 ${cloudData.records.length}건 복원 완료!` } }));
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '클라우드에 저장된 백업 데이터가 없습니다.', type: 'error' } }));
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '클라우드 불러오기 중 오류 발생', type: 'error' } }));
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleLocationSave = () => {
    if(!locName) return;
    if (editingLocName && editingLocName !== locName) {
      setLocations((p:any) => {
        const n={...p};
        delete n[editingLocName];
        n[locName] = { address: locAddress, memo: locMemo };
        return n;
      });
    } else {
      setLocations((p:any) => ({...p, [locName]: {address: locAddress, memo: locMemo}}));
    }
    setLocName(''); setLocAddress(''); setLocMemo(''); setEditingLocName(null);
  };

  const sortedFilteredLocations = useMemo(() => {
    return Object.entries(locations || {})
      .filter(([name, info]: [string, any]) => 
        name.toLowerCase().includes(locSearch.toLowerCase()) || 
        info.address.toLowerCase().includes(locSearch.toLowerCase())
      )
      .sort(([a], [b]) => a.localeCompare(b, 'ko'));
  }, [locations, locSearch]);

  return (
    <div className="space-y-10 pb-24 pt-4 px-2">
      <StatGrid title={`${currentMonthName} 실시간 요약`} stats={monthlyStats} />
      <StatGrid title="누적 데이터" stats={cumulativeStats} />

      <button onClick={onOpenReport} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
        <FileText size={18}/> 상세 내역 출력 리포트
      </button>

      <Section id="finance" title="금융 관리 (급여/지출)" icon={DollarSign} activeSection={activeSection} setActiveSection={setActiveSection}>
        <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
          {(['salary', 'fixed', 'general'] as const).map(tab => (
            <button key={tab} onClick={() => setFinanceTab(tab)} className={`flex-1 py-2 text-[11px] font-black rounded-lg transition-all ${financeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>{tab === 'salary' ? '급여' : tab === 'fixed' ? '고정지출' : '일반지출'}</button>
          ))}
        </div>

        {financeTab === 'salary' && (
          <div className="space-y-4">
            <div className={`p-4 rounded-xl border space-y-3 ${editingSalId ? 'bg-blue-50 border-blue-200' : 'bg-blue-50/50 border-blue-100'}`}>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={salDate} onChange={e => setSalDate(e.target.value)} className="p-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-200" />
                <input type="number" placeholder="금액(만원)" value={salAmount} onChange={e => setSalAmount(e.target.value)} className="p-2 border rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="급여 메모" value={salMemo} onChange={e => setSalMemo(e.target.value)} className="flex-1 p-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-200" />
                <button onClick={addSalary} className={`px-4 py-2 text-white rounded-lg text-xs font-bold shrink-0 ${editingSalId ? 'bg-orange-500' : 'bg-blue-600'}`}>{editingSalId ? '수정 완료' : '등록'}</button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y border rounded-xl bg-white shadow-inner">
              {salaryRecords.map(s => (
                <div key={s.id} className="p-3 flex justify-between items-center text-[11px]">
                  <div className="flex flex-col"><span className="text-slate-400">{s.date}</span><span className="font-bold text-blue-600">{s.memo || '급여 입금'}</span></div>
                  <div className="flex items-center gap-1">
                    <span className="font-black">{(s.amount / 10000).toLocaleString()}만</span>
                    <button onClick={() => { setSalDate(s.date); setSalAmount((s.amount/10000).toString()); setSalMemo(s.memo); setEditingSalId(s.id); }} className="p-2 text-slate-300 hover:text-blue-500"><Edit2 size={14}/></button>
                    <button onClick={() => {
                      if (confirm('이 급여 기록을 삭제하시겠습니까?')) {
                        setSalaryRecords((p: SalaryRecord[]) => p.filter(x => x.id !== s.id));
                        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '급여 기록이 삭제되었습니다.' } }));
                      }
                    }} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {financeTab === 'fixed' && (
          <div className="space-y-4">
            <div className={`p-4 rounded-xl border space-y-3 ${editingExpId ? 'bg-red-50 border-red-200' : 'bg-red-50/50 border-red-100'}`}>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} className="w-full p-2.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-red-200 bg-white" />
                <input type="text" placeholder="예: 보험료 (항목명)" value={expName} onChange={e => setExpName(e.target.value)} className="w-full p-2.5 border rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-red-200 bg-white" />
              </div>
              <div className="flex items-center gap-2">
                <input type="number" placeholder="금액(만원)" value={expCost} onChange={e => setExpCost(e.target.value)} className="flex-1 min-w-0 p-2.5 border rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-red-200 bg-white" />
                <div className="bg-white border rounded-lg w-12 h-[38px] flex items-center justify-center shrink-0">
                  <input type="checkbox" id="fixed-repeat" checked={expRepeat} onChange={e => setExpRepeat(e.target.checked)} className="w-5 h-5 rounded cursor-pointer accent-red-500" />
                </div>
                <button onClick={addExpense} className={`px-5 h-[38px] text-white rounded-lg text-xs font-black shadow-sm shrink-0 ${editingExpId ? 'bg-orange-500' : 'bg-red-500'}`}>{editingExpId ? '수정' : '등록'}</button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y border rounded-xl bg-white shadow-inner">
              {fixedExpenses.map(f => (
                <div key={f.id} className="p-3 flex justify-between items-center text-[11px]">
                  <div className="flex flex-col"><span className="text-slate-400">{f.date}</span><span className="font-bold text-red-500">{f.name} {f.isRepeat && '[매월]'}</span></div>
                  <div className="flex items-center gap-1">
                    <span className="font-black">{(f.cost / 10000).toLocaleString()}만</span>
                    <button onClick={() => { setExpDate(f.date); setExpName(f.name); setExpCost((f.cost/10000).toString()); setExpRepeat(f.isRepeat); setEditingExpId(f.id); }} className="p-2 text-slate-300 hover:text-blue-500"><Edit2 size={14}/></button>
                    <button onClick={() => {
                      if (confirm('이 고정 지출 항목을 삭제하시겠습니까?')) {
                        setFixedExpenses((p: FixedExpense[]) => p.filter(x => x.id !== f.id));
                        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '고정 지출이 삭제되었습니다.' } }));
                      }
                    }} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {financeTab === 'general' && (
          <div className="space-y-4">
            <div className={`p-4 rounded-xl border space-y-3 ${editingGenId ? 'bg-orange-50 border-orange-200' : 'bg-orange-50/50 border-orange-100'}`}>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={genDate} onChange={e => setGenDate(e.target.value)} className="p-2.5 border rounded-lg text-xs outline-none bg-white focus:ring-2 focus:ring-orange-200" />
                <input type="number" placeholder="금액(만원)" value={genCost} onChange={e => setGenCost(e.target.value)} className="p-2.5 border rounded-lg text-xs font-bold outline-none bg-white focus:ring-2 focus:ring-orange-200" />
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="항목명 (예: 식대, 수리비)" value={genMemo} onChange={e => setGenMemo(e.target.value)} className="flex-1 p-2.5 border rounded-lg text-xs outline-none bg-white focus:ring-2 focus:ring-orange-200" />
                <button onClick={saveGeneralEdit} className={`px-4 py-2.5 text-white rounded-lg text-xs font-black shrink-0 ${editingGenId ? 'bg-orange-500' : 'bg-orange-600'}`}>{editingGenId ? '수정 완료' : '등록'}</button>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto divide-y border rounded-xl bg-white shadow-inner">
              {(records || []).filter(r => r && r.type === '지출').sort((a,b) => b.id - a.id).map(r => (
                <div key={r.id} className="p-3 flex justify-between items-center text-[11px]">
                  <div className="flex flex-col"><span className="text-slate-400">{r.date}</span><span className="font-bold text-slate-700">{r.memo || '지출'}</span></div>
                  <div className="flex items-center gap-1">
                    <span className="font-black">{(r.cost / 10000).toLocaleString()}만</span>
                    <button onClick={() => { setGenDate(r.date); setGenMemo(r.memo || ''); setGenCost((r.cost/10000).toString()); setEditingGenId(r.id); }} className="p-2 text-slate-300 hover:text-blue-500"><Edit2 size={14}/></button>
                    <button onClick={() => {
                      if (confirm('이 지출 기록을 삭제하시겠습니까?')) {
                        setRecords((p: TransportRecord[]) => p.filter(x => x.id !== r.id));
                        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '지출 기록이 삭제되었습니다.' } }));
                      }
                    }} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section id="location" title="운송 지역 관리" icon={MapPin} activeSection={activeSection} setActiveSection={setActiveSection}>
        <div className="space-y-3">
          <div className={`p-4 rounded-xl border space-y-3 ${editingLocName ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{editingLocName ? '지역 정보 수정' : '새 지역 추가'}</span>
              {editingLocName && <button onClick={() => { setEditingLocName(null); setLocName(''); setLocAddress(''); setLocMemo(''); }} className="p-1 text-slate-400"><X size={14}/></button>}
            </div>
            <input type="text" placeholder="지역 이름 (예: 안산 쿠팡)" value={locName} onChange={e => setLocName(e.target.value)} className="w-full p-2 border rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-slate-300 bg-white" />
            <input type="text" placeholder="정확한 주소 입력" value={locAddress} onChange={e => setLocAddress(e.target.value)} className="w-full p-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-slate-300 bg-white" />
            <div className="flex gap-2">
              <input type="text" placeholder="참조 메모" value={locMemo} onChange={e => setLocMemo(e.target.value)} className="flex-1 p-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-slate-300 bg-white" />
              <button onClick={handleLocationSave} className={`px-6 py-2 text-white rounded-lg text-xs font-bold shrink-0 active:scale-95 flex items-center gap-1 ${editingLocName ? 'bg-blue-600' : 'bg-slate-800'}`}>
                {editingLocName ? <Save size={14} /> : null} {editingLocName ? '수정' : '지역 추가'}
              </button>
            </div>
          </div>
          <div className="relative">
            <input 
              type="text" 
              placeholder="지역 검색..." 
              value={locSearch} 
              onChange={e => setLocSearch(e.target.value)} 
              className="w-full p-2 pl-8 border rounded-xl text-xs bg-white mb-2 outline-none focus:ring-2 focus:ring-slate-200"
            />
            <Database size={14} className="absolute left-2.5 top-2.5 text-slate-300" />
          </div>
          <div className="max-h-48 overflow-y-auto divide-y border rounded-xl bg-white shadow-inner">
            {sortedFilteredLocations.map(([name, info]: [string, any]) => (
              <div key={name} className="p-3 flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="text-sm font-bold text-slate-800">{name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{info.address}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setEditingLocName(name); setLocName(name); setLocAddress(info.address); setLocMemo(info.memo); }} className="text-slate-300 hover:text-blue-500 p-1"><Edit2 size={14}/></button>
                  <button onClick={() => {
                    if (confirm(`'${name}' 지역 정보를 삭제하시겠습니까?`)) {
                      setLocations((p:any) => { const n={...p}; delete n[name]; return n; });
                      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '지역 정보가 삭제되었습니다.' } }));
                    }
                  }} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
            {Object.keys(locations || {}).length === 0 && <div className="p-8 text-center text-slate-300 text-xs italic">등록된 지역이 없습니다.</div>}
          </div>
        </div>
      </Section>

      <Section id="ai-settings" title="AI 서비스 설정" icon={Key} activeSection={activeSection} setActiveSection={setActiveSection}>
        <div className="space-y-4">
          <div className={`p-5 rounded-2xl border transition-all ${isKeySaved ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
            <div className="flex items-center gap-2 mb-3">
              {isKeySaved ? <CheckCircle className="text-emerald-500" size={18} /> : <AlertCircle className="text-amber-500" size={18} />}
              <h4 className="font-black text-slate-800 text-sm">Gemini AI 영수증 분석</h4>
            </div>
            <input type="password" placeholder="API 키 입력" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full p-3 border rounded-xl text-xs bg-white mb-2 outline-none focus:ring-2 focus:ring-amber-200" />
            <div className="mb-3 px-1">
              <a href="https://aistudio.google.com/api-keys?hl=ko" target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 underline font-bold">Gemini API 키 발급받기 (무료)</a>
            </div>
            <button onClick={() => { localStorage.setItem('GEMINI_API_KEY', apiKey); setIsKeySaved(true); window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'AI API 키가 저장되었습니다.' } })); }} className="w-full py-3 bg-slate-800 text-white rounded-xl font-black text-xs active:scale-95">키 저장하기</button>
          </div>
        </div>
      </Section>

      <Section id="cloud" title="클라우드 동기화 (Firebase)" icon={Cloud} activeSection={activeSection} setActiveSection={setActiveSection}>
        <div className="space-y-4">
          <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-2xl space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700">기사 식별 ID (클라우드 계정)</span>
              <span className="text-[10px] text-blue-600 bg-blue-100/70 px-2 py-0.5 rounded-full font-bold">실시간 연동</span>
            </div>
            <input 
              type="text" 
              placeholder="예: 010-1234-5678 또는 차량번호" 
              value={cloudUserId} 
              onChange={e => setCloudUserId(e.target.value)} 
              className="w-full p-2.5 bg-white border border-blue-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-300"
            />
            <p className="text-[10px] text-slate-500">
              * 기기를 변경하더라도 위 식별 ID만 똑같이 입력하면 언제든 모든 데이터를 불러올 수 있습니다.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={handleCloudUpload} 
              disabled={isCloudSyncing}
              className="p-4 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl flex flex-col items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
            >
              {isCloudSyncing ? <RefreshCw size={22} className="animate-spin" /> : <CloudUpload size={22} />}
              <span className="text-xs font-black">클라우드에 백업</span>
              <span className="text-[9px] text-blue-200">현재 기기 ➡️ 클라우드</span>
            </button>

            <button 
              onClick={handleCloudDownload} 
              disabled={isCloudSyncing}
              className="p-4 bg-white border border-blue-200 text-blue-700 rounded-2xl flex flex-col items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50 hover:bg-blue-50/50"
            >
              {isCloudSyncing ? <RefreshCw size={22} className="animate-spin text-blue-600" /> : <CloudDownload size={22} className="text-blue-600" />}
              <span className="text-xs font-black">클라우드서 불러오기</span>
              <span className="text-[9px] text-slate-400">클라우드 ➡️ 현재 기기</span>
            </button>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
            <span className="text-[10px] font-bold text-slate-500">마지막 클라우드 백업</span>
            <span className="text-[11px] font-black text-blue-600">
              {lastCloudSyncTime ? new Date(lastCloudSyncTime).toLocaleString('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
              }) : '기록 없음'}
            </span>
          </div>
        </div>
      </Section>

      <Section id="data" title="기기 로컬 데이터 관리" icon={Database} activeSection={activeSection} setActiveSection={setActiveSection}>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => onManualBackup()} className="p-5 bg-blue-50 text-blue-600 rounded-2xl flex flex-col items-center gap-2 border border-blue-100 active:scale-95 transition-all shadow-sm"><Download size={24}/><span className="text-[11px] font-black uppercase">전체 백업</span></button>
          <div className="relative p-5 bg-emerald-50 text-emerald-600 rounded-2xl flex flex-col items-center gap-2 border border-emerald-100 active:scale-95 transition-all shadow-sm">
            <Upload size={24}/><span className="text-[11px] font-black uppercase">백업 복원</span>
            <input type="file" accept=".json" onChange={handleImport} className="absolute inset-0 opacity-0 cursor-pointer" />
          </div>
        </div>
        <div className="mt-3 space-y-3">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-500">마지막 백업</span>
            <span className="text-[11px] font-black text-slate-800">
              {lastBackupTime ? new Date(lastBackupTime).toLocaleString('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
              }) : '기록 없음'}
            </span>
          </div>
          <p className="text-[9px] text-slate-400 mt-2 px-2">
            * 기기 변경이나 데이터 유실을 대비해 정기적으로 백업을 수행하세요.
          </p>
        </div>
      </Section>
    </div>
  );
};

export default SettingsPage2;
