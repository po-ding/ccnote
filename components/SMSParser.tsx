
import React, { useState } from 'react';
import { Clipboard } from '@capacitor/clipboard';
import { Sparkles, Clipboard as ClipboardIcon, X, ArrowRight, Save, Copy, FileText, MapPin, Info, Loader2, Trash2 } from 'lucide-react';
import { TransportRecord, LocationInfo } from '../types';
import { getWorkDate, getCurrentTimeString, findPriceForRoute, findBestLocationMatch } from '../utils';
import { GoogleGenAI, Type } from "@google/genai";

interface Props {
  locations: Record<string, LocationInfo>;
  setLocations: React.Dispatch<React.SetStateAction<Record<string, LocationInfo>>>;
  onParsed: (records: TransportRecord[]) => void;
  records: TransportRecord[];
  viewDate: string;
}

interface DraftRecord {
  id: string;
  from: { name: string; address: string; memo: string };
  to: { name: string; address: string; memo: string };
  time: string;
  orderNumber?: string;
  vehicleNo?: string;
  floorInfo?: string;
  scheduledTime?: string;
  aiParsedNote?: string;
}

const SMSParser: React.FC<Props> = ({ locations, setLocations, onParsed, records, viewDate }) => {
  const [text, setText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const locationNames = Object.keys(locations);

  React.useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('toggle-sms-parser', handleToggle);
    window.addEventListener('open-sms-parser', handleOpen);
    return () => {
      window.removeEventListener('toggle-sms-parser', handleToggle);
      window.removeEventListener('open-sms-parser', handleOpen);
    };
  }, []);

  const getFuzzyLocation = (rawName: string): { name: string; address: string; memo: string } => {
    const trimmed = rawName.trim();
    if (trimmed.length < 1) return { name: '', address: '', memo: '' };

    const match = findBestLocationMatch(locations, trimmed);
    if (match.address || match.memo) {
      return match;
    }
    return { name: trimmed, address: '', memo: '' };
  };

  const analyzeWithAI = async (smsText: string) => {
    const defaultApiKey = "AIzaSyC93qXIy2YbzZqHJoKB0sIvsUeGkw1qHNY";
    const savedApiKey = localStorage.getItem('GEMINI_API_KEY') || defaultApiKey;
    
    if (!savedApiKey || savedApiKey.length < 10) {
      throw new Error("API 키가 설정되지 않았습니다.");
    }

    const ai = new GoogleGenAI({ apiKey: savedApiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [{
          text: `다음은 화물 배차 문자입니다. 문맥과 단어를 분석하여 아래 항목들을 정확히 추출하여 JSON 배열 형식으로 반환하세요.
          여러 건의 배차가 포함되어 있을 수 있습니다.
          
          주의 및 필수 파싱 규칙:
          1. 상차지(fromName)와 하차지(toName)가 띄어쓰기 없이 붙어있는 경우(예: '인천13물류센터고양1센터', '인천물류센터고양센터')도 단어를 정확하게 상차지와 하차지 2개로 분리하세요.
             - 예: '인천13물류센터고양1센터' => fromName: '인천13물류센터', toName: '고양1센터'
          2. 호차(vehicleNo): '[1호]', '[2호]', '1호', '2호차' 등의 호차 정보를 추출하세요. (예: '1호')
          3. 배차/지정 시간(scheduledTime): '8:20', '08:20', '11:00' 등의 시각 정보를 HH:mm 형식으로 추출하세요. (예: '08:20')
          4. 층/동/도크 정보(floorInfo): '3F', '3층', '1동', 'DOCK 5', '12도크' 등 위치 관련 층/동/도크 정보를 추출하세요. (예: '3F')
          5. 문자 내용에 7자리 이상 숫자가 있다면 orderNumber로 추출하세요.
          
          9. 호차, 시간, 층/도크, 주소/장소명을 제외한 문자 내 특이사항/주의사항(예: '접안시간 준수', '초소접수', '카톡접수', 'QR접수대기', '공휴일하차불가' 등)이 있다면 aiParsedNote 로 별도 추출하세요.
          
          문자 내용:
          ${smsText}
          
          추출 항목:
          - fromName: 상차지 이름
          - toName: 하차지 이름
          - time: 상차 예정/지정 시간 (HH:mm 형식)
          - vehicleNo: 몇 호차 정보 (예: '1호', 없으면 빈 문자열)
          - floorInfo: 층/동/도크 정보 (예: '3F', '3층', 'DOCK 2', 없으면 빈 문자열)
          - scheduledTime: 지정 시간 (예: '08:20', 없으면 빈 문자열)
          - orderNumber: 주문/배차/밀크런 번호
          - aiParsedNote: 특이사항/주의사항 (예: '접안시간 준수', '초소접수' 등, 없으면 빈 문자열)`
        }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              fromName: { type: Type.STRING },
              toName: { type: Type.STRING },
              time: { type: Type.STRING },
              vehicleNo: { type: Type.STRING },
              floorInfo: { type: Type.STRING },
              scheduledTime: { type: Type.STRING },
              orderNumber: { type: Type.STRING },
              aiParsedNote: { type: Type.STRING }
            },
            required: ["fromName", "toName"]
          }
        }
      }
    });

    if (!response.text) return [];
    return JSON.parse(response.text.trim());
  };

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setIsAnalyzing(true);
    
    try {
      const aiResults = await analyzeWithAI(text);
      
      if (aiResults && aiResults.length > 0) {
        const newDrafts: DraftRecord[] = aiResults.map((res: any) => {
          const fromMatch = getFuzzyLocation(res.fromName);
          const toMatch = getFuzzyLocation(res.toName);
          return {
            id: Math.random().toString(36).substr(2, 9),
            from: { 
              name: res.fromName, 
              address: fromMatch.address, 
              memo: fromMatch.memo 
            },
            to: { 
              name: res.toName, 
              address: toMatch.address, 
              memo: toMatch.memo 
            },
            time: '00:00',
            orderNumber: res.orderNumber || undefined,
            vehicleNo: res.vehicleNo || undefined,
            floorInfo: res.floorInfo || undefined,
            scheduledTime: res.scheduledTime || (res.time !== '00:00' ? res.time : undefined) || undefined,
            aiParsedNote: res.aiParsedNote || undefined
          };
        });
        setDrafts(newDrafts);
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `${newDrafts.length}건이 AI로 분석되었습니다.` } }));
      } else {
        fallbackAnalyze();
      }
    } catch (err) {
      console.error("AI Analysis failed:", err);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'AI 분석 실패, 기본 분석을 시도합니다.', type: 'error' } }));
      fallbackAnalyze();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fallbackAnalyze = () => {
    const lines = text.split(/\r\n|\r|\n/);
    const newDrafts: DraftRecord[] = [];
    
    lines.forEach(line => {
      if (line.includes('[Web발신]') || line.includes('배차표') || line.includes('<--인식금지') || line.trim().length < 2) return;
      
      let orderNumber: string | undefined;
      const orderMatch = line.match(/\b\d{7,}\b/);
      if (orderMatch) orderNumber = orderMatch[0];

      // 호차 추출 (예: [3호], 3호, 3호차)
      let vehicleNo: string | undefined;
      const vehMatch = line.match(/\[(\d+호)\]|(\d+호차)|(\d+호)/);
      if (vehMatch) {
        vehicleNo = vehMatch[1] || vehMatch[2] || vehMatch[3];
      }

      // 배차시간 추출 (예: 03:00, 3:00, 08:20)
      let scheduledTime: string | undefined;
      const timeMatch = line.match(/(\b[0-2]?\d:[0-5]\d\b)/);
      if (timeMatch) {
        scheduledTime = timeMatch[1].padStart(5, '0');
      }

      // 층수/도크 추출 (예: 6층, 5F, 3F, DOCK 5, 2도크)
      let floorInfo: string | undefined;
      const floorMatch = line.match(/(\d+층|\d+[fF]|\b[dD][oO][cC][kK]\s*\d+|\d+도크)/);
      if (floorMatch) {
        floorInfo = floorMatch[1];
      }

      // 특이사항 추출
      let aiParsedNote: string | undefined;
      const noteMatch = line.match(/(?:특이사항|메모|주의|비고)[\s:：]+([^\n,]+)/i);
      if (noteMatch) {
        aiParsedNote = noteMatch[1].trim();
      }

      // 특수문자나 공백으로 분리
      const parts = line.split(/\s*(?:->|~|➜|\s+)\s*/).filter(p => p.trim().length > 0);
      
      if (parts.length >= 2) {
        // 시간, 톤수, 날짜, 오더번호, 층수 등 제외하고 장소만 추출
        const cleanParts = parts.filter(p => 
          !p.startsWith('[') && 
          !p.match(/^\d+호(?:차)?$/) && 
          !p.match(/^\d+[tT톤]$/) && 
          !p.includes('월') && 
          !p.includes('일') && 
          !p.match(/^\d{1,2}:\d{2}$/) &&
          !p.match(/^\d{5,}$/) &&
          !p.match(/^\d+층$/) &&
          !p.match(/^\d+[fF]$/)
        );

        // 2개씩 짝지어 처리 (한 줄에 여러 건이 붙어있는 경우 대응)
        if (cleanParts.length >= 2) {
          for (let i = 0; i < cleanParts.length - 1; i += 2) {
            newDrafts.push({
              id: Math.random().toString(36).substr(2, 9),
              from: getFuzzyLocation(cleanParts[i]),
              to: getFuzzyLocation(cleanParts[i+1]),
              time: '00:00',
              orderNumber,
              vehicleNo,
              scheduledTime,
              floorInfo,
              aiParsedNote
            });
          }
        }
      }
    });

    if (newDrafts.length > 0) {
      setDrafts(newDrafts);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `${newDrafts.length}건이 분석되었습니다 (기본 모드).` } }));
    } else {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '분석 가능한 배차 내역을 찾지 못했습니다.', type: 'error' } }));
    }
  };

  const handlePaste = async () => {
    try {
      const { value } = await Clipboard.read();
      if (value) setText(value);
    } catch (err) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '클립보드 권한이 필요합니다.', type: 'error' } }));
    }
  };

  const handleClear = () => {
    setText('');
    setDrafts([]);
  };

  const copyOrderNumber = async (num: string) => {
    await Clipboard.write({ string: num });
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '밀크런 코드가 복사되었습니다.' } }));
  };

  const saveOne = (draft: DraftRecord, allRecords: any[]) => {
    const locationUpdates: Record<string, LocationInfo> = {};
    if (draft.from.name.trim()) locationUpdates[draft.from.name.trim()] = { address: draft.from.address.trim(), memo: draft.from.memo.trim() };
    if (draft.to.name.trim()) locationUpdates[draft.to.name.trim()] = { address: draft.to.address.trim(), memo: draft.to.memo.trim() };
    if (Object.keys(locationUpdates).length > 0) setLocations(prev => ({ ...prev, ...locationUpdates }));

    const autoIncome = findPriceForRoute(allRecords, draft.from.name, draft.to.name) || 0;

    const record: TransportRecord = {
      id: Date.now() + Math.random(),
      date: viewDate, // 현재 보고 있는 날짜에 등록
      time: '00:00', // 상차시간은 운행 시작시 스타트 (대기 시 00:00 표기)
      type: '대기',
      from: draft.from.name,
      to: draft.to.name,
      distance: 0, 
      income: autoIncome, 
      cost: 0,
      liters: 0, 
      unitPrice: 0,
      memo: `${draft.from.memo || ''} ${draft.to.memo || ''}`.trim(),
      aiParsedNote: draft.aiParsedNote || undefined,
      start_gps: "", end_gps: "", brand: "기타",
      ureaLiters: 0, ureaUnitPrice: 0, ureaStation: "", supplyItem: "", mileage: 0, waitingTime: 0,
      isStarted: false,
      orderNumber: draft.orderNumber,
      vehicleNo: draft.vehicleNo,
      floorInfo: draft.floorInfo,
      scheduledTime: draft.scheduledTime || (draft.time !== '00:00' ? draft.time : undefined)
    };

    // 주소나 메모가 입력되어 있으면 운송지역에 저장
    if (draft.from.name.trim() && (draft.from.address.trim() || draft.from.memo.trim())) {
      setLocations(prev => ({
        ...prev,
        [draft.from.name.trim()]: {
          address: draft.from.address.trim(),
          memo: draft.from.memo.trim()
        }
      }));
    }
    if (draft.to.name.trim() && (draft.to.address.trim() || draft.to.memo.trim())) {
      setLocations(prev => ({
        ...prev,
        [draft.to.name.trim()]: {
          address: draft.to.address.trim(),
          memo: draft.to.memo.trim()
        }
      }));
    }

    onParsed([record]);
    setDrafts(prev => prev.filter(d => d.id !== draft.id));
  };

  const updateDraft = (id: string, field: 'from' | 'to', key: 'name' | 'address' | 'memo', value: string) => {
    setDrafts(prev => prev.map(d => {
      if (d.id === id) {
        let updated = { ...d[field], [key]: value };
        if (key === 'name') {
          const match = getFuzzyLocation(value);
          if (match.address || match.memo) {
            updated = { ...updated, address: match.address, memo: match.memo };
          }
        }
        return { ...d, [field]: updated };
      }
      return d;
    }));
  };

  const saveAll = () => {
    const newRecords: TransportRecord[] = [];
    const locationUpdates: Record<string, LocationInfo> = {};

    drafts.forEach(draft => {
      if (draft.from.name.trim()) locationUpdates[draft.from.name.trim()] = { address: draft.from.address.trim(), memo: draft.from.memo.trim() };
      if (draft.to.name.trim()) locationUpdates[draft.to.name.trim()] = { address: draft.to.address.trim(), memo: draft.to.memo.trim() };

      const autoIncome = findPriceForRoute(records, draft.from.name, draft.to.name) || 0;

      newRecords.push({
        id: Date.now() + Math.random(),
        date: viewDate, // 현재 보고 있는 날짜에 등록
        time: '00:00', // 상차시간은 운행 시작시 스타트 (대기 시 00:00 표기)
        type: '대기',
        from: draft.from.name,
        to: draft.to.name,
        distance: 0,
        income: autoIncome,
        cost: 0,
        liters: 0,
        unitPrice: 0,
        memo: `${draft.from.memo || ''} ${draft.to.memo || ''}`.trim(),
        aiParsedNote: draft.aiParsedNote || undefined,
        start_gps: "", end_gps: "", brand: "기타",
        ureaLiters: 0, ureaUnitPrice: 0, ureaStation: "", supplyItem: "", mileage: 0, waitingTime: 0,
        isStarted: false,
        orderNumber: draft.orderNumber,
        vehicleNo: draft.vehicleNo,
        floorInfo: draft.floorInfo,
        scheduledTime: draft.scheduledTime || (draft.time !== '00:00' ? draft.time : undefined)
      });
    });

    if (Object.keys(locationUpdates).length > 0) {
      setLocations(prev => ({ ...prev, ...locationUpdates }));
    }

    onParsed(newRecords);
    setDrafts([]);
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `${newRecords.length}건이 일괄 등록되었습니다.` } }));
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 space-y-4 shadow-md animate-in fade-in zoom-in duration-200">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <button onClick={handlePaste} className="bg-white border border-amber-300 text-amber-600 text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1 active:scale-95 shadow-sm"><Copy size={10}/> 붙여넣기</button>
          <button onClick={handleClear} className="bg-white border border-amber-300 text-rose-600 text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1 active:scale-95 shadow-sm"><Trash2 size={10}/> 내용지우기</button>
        </div>
        <button onClick={() => { setIsOpen(false); setDrafts([]); }} className="text-amber-400 p-1 hover:text-amber-600 transition-colors"><X size={20} /></button>
      </div>
      <textarea 
        className="w-full h-32 p-3 rounded-xl border-amber-200 border bg-white text-sm outline-none font-sans leading-relaxed focus:ring-2 focus:ring-amber-300 transition-all" 
        placeholder="배차 문자를 여기에 붙여넣으세요..." 
        value={text} 
        onChange={e => setText(e.target.value)} 
      />
      
      <datalist id="location-list">
        {locationNames.map(name => <option key={name} value={name} />)}
      </datalist>

      <div className="flex gap-2">
        <button 
          onClick={handleAnalyze} 
          disabled={isAnalyzing}
          className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold shadow-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isAnalyzing ? (
            <><Loader2 size={18} className="animate-spin" /> AI 분석 중...</>
          ) : (
            "AI 분석 실행"
          )}
        </button>
        {drafts.length > 0 && (
          <button 
            onClick={saveAll} 
            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Save size={18} /> 전체 등록 ({drafts.length})
          </button>
        )}
      </div>
      
      {drafts.length > 0 && (
        <div className="mt-4 space-y-6 max-h-[400px] overflow-y-auto pr-1">
          {drafts.map((draft) => (
            <div key={draft.id} className="bg-white border-t-4 border-amber-400 rounded-xl p-4 shadow-sm relative space-y-4">
              <button onClick={() => setDrafts(p => p.filter(d => d.id !== draft.id))} className="absolute -top-3 -right-2 bg-white border rounded-full p-1 text-slate-400 shadow-sm active:scale-90"><X size={14} /></button>
              
              {(draft.vehicleNo || draft.scheduledTime || draft.floorInfo) && (
                <div className="flex flex-wrap items-center gap-1.5 pb-1 border-b border-slate-100">
                  {draft.vehicleNo && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[11px] font-black">
                      {draft.vehicleNo.includes('호') ? draft.vehicleNo : `[${draft.vehicleNo}호]`}
                    </span>
                  )}
                  {draft.scheduledTime && (
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[11px] font-bold">
                      🕒 지정: {draft.scheduledTime}
                    </span>
                  )}
                  {draft.floorInfo && (
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[11px] font-bold">
                      🏢 위치: {draft.floorInfo}
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 border-b pb-1">
                    <MapPin size={12} className="text-blue-500" />
                    <input 
                      list="location-list"
                      className="w-full text-sm font-bold border-none p-0 focus:ring-0 text-blue-600 outline-none" 
                      value={draft.from.name} 
                      onChange={e => updateDraft(draft.id, 'from', 'name', e.target.value)} 
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 p-1 rounded">
                    <FileText size={10} className="text-slate-400" />
                    <input placeholder="주소" className="w-full text-[10px] bg-transparent outline-none" value={draft.from.address} onChange={e => updateDraft(draft.id, 'from', 'address', e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 p-1 rounded">
                    <Info size={10} className="text-slate-400" />
                    <input placeholder="메모" className="w-full text-[10px] bg-transparent outline-none" value={draft.from.memo} onChange={e => updateDraft(draft.id, 'from', 'memo', e.target.value)} />
                  </div>
                </div>
                <div className="pt-10"><ArrowRight size={16} className="text-slate-300" /></div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 border-b pb-1">
                    <MapPin size={12} className="text-emerald-500" />
                    <input 
                      list="location-list"
                      className="w-full text-sm font-bold border-none p-0 focus:ring-0 text-emerald-600 outline-none" 
                      value={draft.to.name} 
                      onChange={e => updateDraft(draft.id, 'to', 'name', e.target.value)} 
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 p-1 rounded">
                    <FileText size={10} className="text-slate-400" />
                    <input placeholder="주소" className="w-full text-[10px] bg-transparent outline-none" value={draft.to.address} onChange={e => updateDraft(draft.id, 'to', 'address', e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 p-1 rounded">
                    <Info size={10} className="text-slate-400" />
                    <input placeholder="메모" className="w-full text-[10px] bg-transparent outline-none" value={draft.to.memo} onChange={e => updateDraft(draft.id, 'to', 'memo', e.target.value)} />
                  </div>
                </div>
              </div>
              {draft.orderNumber && (
                <button 
                  onClick={() => copyOrderNumber(draft.orderNumber!)}
                  className="w-full flex items-center justify-between bg-orange-50 p-2.5 rounded-lg border border-orange-200 hover:bg-orange-100 active:scale-[0.98] transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-orange-600 font-bold">밀크런 코드</span>
                    <span className="text-sm text-orange-900 font-black tracking-wider">{draft.orderNumber}</span>
                  </div>
                  <Copy size={14} className="text-orange-400 group-hover:text-orange-600 transition-colors" />
                </button>
              )}
              <button onClick={() => saveOne(draft, records)} className="w-full py-3 bg-emerald-500 text-white rounded-xl font-black text-sm shadow-md active:scale-95 flex items-center justify-center gap-2"><Save size={16} /> 대기 목록 등록</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SMSParser;
