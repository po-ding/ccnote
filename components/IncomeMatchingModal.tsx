
import React, { useState, useMemo } from 'react';
import { TransportRecord } from '../types';
import { 
  X, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  ArrowRight,
  Search,
  Save,
  FileSpreadsheet
} from 'lucide-react';
import Papa from 'papaparse';
import { formatToManwon } from '../utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  records: TransportRecord[];
  setRecords: React.Dispatch<React.SetStateAction<TransportRecord[]>>;
}

interface MatchResult {
  recordId: number;
  proposedIncome: number;
  isMatched: boolean;
}

const IncomeMatchingModal: React.FC<Props> = ({ isOpen, onClose, records, setRecords }) => {
  const [csvData, setCsvData] = useState<Record<string, number>>({});
  const [manualIncomes, setManualIncomes] = useState<Record<number, string>>({});
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  // 0원인 기록들 필터링 및 정렬 (상차지 -> 하차지 순), 중복 제거
  const targetGroups = useMemo(() => {
    const groups: Record<string, { from: string, to: string, recordIds: number[], count: number, latestDate: string }> = {};
    
    records
      .filter(r => ['화물운송', '운행종료', '운송종료'].includes(r.type) && (r.income || 0) === 0 && r.from && r.to)
      .forEach(r => {
        const key = `${r.from?.trim()}||${r.to?.trim()}`;
        if (!groups[key]) {
          groups[key] = { from: r.from!.trim(), to: r.to!.trim(), recordIds: [], count: 0, latestDate: r.date };
        }
        groups[key].recordIds.push(r.id);
        groups[key].count++;
        if (r.date > groups[key].latestDate) {
          groups[key].latestDate = r.date;
        }
      });

    return Object.values(groups).sort((a, b) => {
      const fromCompare = a.from.localeCompare(b.from);
      if (fromCompare !== 0) return fromCompare;
      return a.to.localeCompare(b.to);
    });
  }, [records]);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const priceMap: Record<string, number> = {};
        results.data.forEach((row: any) => {
          const from = (row['상차지'] || row['출발지'] || row['Origin'] || '').trim();
          const to = (row['하차지'] || row['도착지'] || row['Destination'] || '').trim();
          const incomeRaw = row['금액'] || row['수입'] || row['Income'] || row['Amount'] || '0';
          
          if (from && to) {
            const income = Math.round(parseFloat(incomeRaw.toString().replace(/[^0-9.]/g, '')) * (incomeRaw.toString().includes('만') ? 10000 : 1));
            if (income > 0) {
              priceMap[`${from}||${to}`] = income;
            }
          }
        });
        setCsvData(priceMap);
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { message: `CSV 분석 완료: ${Object.keys(priceMap).length}개의 단가 정보를 읽었습니다.` } 
        }));
      }
    });
    e.target.value = '';
  };

  const matchResults = useMemo(() => {
    const results: Record<string, MatchResult> = {};
    targetGroups.forEach(g => {
      const key = `${g.from}||${g.to}`;
      if (csvData[key]) {
        results[key] = {
          recordId: 0,
          proposedIncome: csvData[key],
          isMatched: true
        };
      }
    });
    return results;
  }, [targetGroups, csvData]);

  const handleApplyAllMatches = () => {
    const matchedKeys = Object.keys(matchResults);
    if (matchedKeys.length === 0) return;

    const idsToUpdate = new Set<number>();
    const updates: Record<number, number> = {};

    targetGroups.forEach(g => {
      const key = `${g.from}||${g.to}`;
      if (matchResults[key]) {
        g.recordIds.forEach(id => {
          idsToUpdate.add(id);
          updates[id] = matchResults[key].proposedIncome;
        });
      }
    });

    setRecords(prev => prev.map(r => {
      if (idsToUpdate.has(r.id)) {
        return { ...r, income: updates[r.id] };
      }
      return r;
    }));

    setCsvData({}); // 적용 후 초기화
    window.dispatchEvent(new CustomEvent('show-toast', { 
      detail: { message: `일괄 적용되었습니다.` } 
    }));
  };

  const handleSaveAllManual = () => {
    const idsToUpdate = new Set<number>();
    const updates: Record<number, number> = {};

    Object.entries(manualIncomes).forEach(([groupKey, val]) => {
      const income = Math.round(parseFloat(val as string) * 10000);
      const group = targetGroups.find(g => `${g.from}||${g.to}` === groupKey);
      if (group) {
        group.recordIds.forEach(id => {
          idsToUpdate.add(id);
          updates[id] = income;
        });
      }
    });

    if (idsToUpdate.size === 0) return;

    setRecords(prev => prev.map(r => {
      if (idsToUpdate.has(r.id)) return { ...r, income: updates[r.id] };
      return r;
    }));

    setManualIncomes({});
    window.dispatchEvent(new CustomEvent('show-toast', { 
      detail: { message: `수기 입력이 저장되었습니다.` } 
    }));
  };

  const handleManualSave = (groupKey: string) => {
    const val = manualIncomes[groupKey];
    if (!val) return;

    const income = Math.round(parseFloat(val) * 10000);
    const group = targetGroups.find(g => `${g.from}||${g.to}` === groupKey);
    if (!group) return;

    const idsToUpdate = new Set(group.recordIds);

    setRecords(prev => prev.map(r => {
      if (idsToUpdate.has(r.id)) return { ...r, income };
      return r;
    }));

    setManualIncomes(prev => {
      const next = { ...prev };
      delete next[groupKey];
      return next;
    });

    window.dispatchEvent(new CustomEvent('show-toast', { 
      detail: { message: `수기 입력이 저장되었습니다.` } 
    }));
  };

  const handleClose = () => {
    if (Object.keys(manualIncomes).length > 0) {
      if (!window.confirm('저장되지 않은 수기 입력 내용이 있습니다. 정말 닫으시겠습니까?')) {
        return;
      }
    }
    onClose();
  };

  const filteredTargets = targetGroups.filter(g => 
    g.from.includes(searchTerm) || g.to.includes(searchTerm)
  );

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
      <div className="flex-1 bg-slate-50 mt-12 rounded-t-[32px] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <DollarSign className="text-blue-600" /> 금액 미입력 관리
            </h2>
            <p className="text-xs text-slate-400 font-bold mt-1">
              총 <span className="text-blue-600">{targetGroups.length}개</span>의 미입력 구간이 있습니다.
            </p>
          </div>
          <button onClick={handleClose} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 bg-white border-b border-slate-100 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input 
                type="text" 
                placeholder="상/하차지 검색..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="relative">
              <button className="h-full px-4 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 flex items-center gap-2 font-bold text-sm active:scale-95 transition-all">
                <FileSpreadsheet size={18} /> CSV 업로드
              </button>
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleCsvUpload}
                className="absolute inset-0 opacity-0 cursor-pointer" 
              />
            </div>
          </div>

          <div className="flex gap-2">
            {Object.keys(matchResults).length > 0 && (
              <button 
                onClick={handleApplyAllMatches}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-sm shadow-lg shadow-blue-200 flex items-center justify-center gap-2 animate-bounce-subtle"
              >
                <CheckCircle2 size={18} /> {Object.keys(matchResults).length}건 매칭 적용
              </button>
            )}
            {Object.keys(manualIncomes).length > 0 && (
              <button 
                onClick={handleSaveAllManual}
                className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-black text-sm shadow-lg flex items-center justify-center gap-2"
              >
                <Save size={18} /> {Object.keys(manualIncomes).length}건 수기 저장
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredTargets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <CheckCircle2 size={48} className="mb-4 opacity-20" />
              <p className="font-bold">미입력 내역이 없습니다.</p>
            </div>
          ) : (
            filteredTargets.map(g => {
              const groupKey = `${g.from}||${g.to}`;
              const match = matchResults[groupKey];
              return (
                  <div key={groupKey} className={`bg-white p-4 rounded-2xl border transition-all ${match ? 'border-blue-200 bg-blue-50/10' : 'border-slate-100'}`}>
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-slate-400">최근: {g.latestDate} 외 {g.count - 1}건</span>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="font-black text-slate-800 text-base break-keep">{g.from}</span>
                          <ArrowRight size={14} className="text-slate-300 shrink-0" />
                          <span className="font-black text-slate-800 text-base break-keep">{g.to}</span>
                        </div>
                      </div>
                      {match ? (
                        <div className="px-2 py-1 bg-blue-100 text-blue-600 rounded-lg text-[10px] font-black flex items-center gap-1 shrink-0">
                          <CheckCircle2 size={12} /> 매칭됨
                        </div>
                      ) : (
                        <div className="px-2 py-1 bg-slate-100 text-slate-400 rounded-lg text-[10px] font-black flex items-center gap-1 shrink-0">
                          <AlertCircle size={12} /> 미매칭
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 pt-3 border-t border-slate-50">
                      <div className="flex-1 w-full min-w-0">
                        {match ? (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-bold">제안 금액</span>
                            <span className="text-lg font-black text-blue-600">{formatToManwon(match.proposedIncome)}만</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 w-full">
                            <input 
                              type="number" 
                              placeholder="금액(만)" 
                              value={manualIncomes[groupKey] || ''}
                              onChange={e => setManualIncomes(prev => ({ ...prev, [groupKey]: e.target.value }))}
                              className="flex-1 min-w-0 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                            />
                            <button 
                              onClick={() => handleManualSave(groupKey)}
                              disabled={!manualIncomes[groupKey]}
                              className="p-2 bg-slate-800 text-white rounded-lg disabled:opacity-30 transition-opacity shrink-0"
                            >
                              <Save size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
              );
            })
          )}
        </div>
      </div>
      <style>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default IncomeMatchingModal;
