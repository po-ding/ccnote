
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { ForegroundService, Importance } from '@capawesome-team/capacitor-android-foreground-service';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  PlusCircle, 
  History, 
  Settings, 
  BarChart3, 
  Truck, 
  X,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  RotateCcw,
  Navigation,
  Fuel,
  Loader2,
  Sparkles
} from 'lucide-react';
import { 
  TransportRecord, 
  LocationInfo, 
  FixedExpense, 
  SalaryRecord, 
  Coords,
  RecordType
} from './types';
import { 
  getWorkDate, 
  calculateDistance,
  getCurrentTimeString
} from './utils';

import { analyzeReceipt } from './ocr';
import { saveToFirebase } from './firebase';

import RecordForm from './components/RecordForm';
import RecordList from './components/RecordList';
import Statistics from './components/Statistics';
import SettingsPage2 from './components/SettingsPage2';
import IncomeMatchingView from './components/IncomeMatchingModal';
import SMSParser from './components/SMSParser';
import DailyTableView from './components/DailyTableView';
import WeeklyTableView from './components/WeeklyTableView';
import MonthlyTableView from './components/MonthlyTableView';
import ReportModal from './components/ReportModal';

const App: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [records, setRecords] = useState<TransportRecord[]>([]);
  const [locations, setLocations] = useState<Record<string, LocationInfo>>({});
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [wasReportOpen, setWasReportOpen] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [editingRecord, setEditingRecord] = useState<TransportRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'daily' | 'stats' | 'settings' | 'matching'>('daily');
  const [viewType, setViewType] = useState<'today' | 'daily' | 'weekly' | 'monthly'>('today');
  const [viewDate, setViewDate] = useState(getWorkDate());
  const viewDateRef = useRef(viewDate);
  
  useEffect(() => {
    viewDateRef.current = viewDate;
  }, [viewDate]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  
  const [isTracking, setIsTracking] = useState(false);
  const [currentGpsDistance, setCurrentGpsDistance] = useState(0);
  const [currentCargoDistance, setCurrentCargoDistance] = useState(0);
  const [isDistanceModalOpen, setIsDistanceModalOpen] = useState(false);
  const isCargoActiveRef = useRef(false);

  const formatDist = (dist: number) => {
    if (dist < 10) return dist.toFixed(2);
    if (dist < 100) return dist.toFixed(1);
    return Math.round(dist).toString();
  };

  useEffect(() => {
    isCargoActiveRef.current = records.some(r => r.isStarted && r.type !== '공차거리');
  }, [records]);
  const accumulatedDistanceRef = useRef<number>(0);
  const watchIdRef = useRef<string | null>(null);
  const wakeLockRef = useRef<any>(null);
  const lastCoordsRef = useRef<Coords | null>(null);
  const lastBackupTimeRef = useRef<number>(Date.now());
  const sessionCargoDistanceRef = useRef<number>(0);
  const isStoppingRef = useRef<boolean>(false);

  const [isAnalyzingFuel, setIsAnalyzingFuel] = useState(false);
  const fuelFileInputRef = useRef<HTMLInputElement>(null);

  const handleFuelClick = () => {
    if (isAnalyzingFuel) return;
    if (fuelFileInputRef.current) {
      fuelFileInputRef.current.value = '';
      fuelFileInputRef.current.click();
    }
  };

  const handleFuelImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingFuel(true);
    showToast('영수증을 분석하고 있습니다...');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        const result = await analyzeReceipt(file.type, base64Data);
        
        const newRecord: TransportRecord = {
          id: Date.now(),
          date: result.date || viewDateRef.current,
          time: result.time || getCurrentTimeString(),
          type: '주유기록',
          from: '',
          to: '',
          distance: 0,
          start_gps: '',
          end_gps: '',
          cost: result.totalAmount || 0,
          income: 0,
          liters: result.liters || 0,
          unitPrice: result.unitPrice || 0,
          brand: '기타',
          ureaLiters: 0,
          ureaUnitPrice: 0,
          ureaStation: '',
          supplyItem: '',
          mileage: 0,
          waitingTime: 0,
          subsidy: result.subsidy || 0,
          actualCost: result.actualPayment || ((result.totalAmount || 0) - (result.subsidy || 0))
        };

        setEditingRecord(newRecord);
        setIsFormOpen(true);
        showToast('영수증 분석 완료! 내역을 확인해 주세요.');
      } catch (err: any) {
        console.error('Fuel OCR error:', err);
        showToast(err.message || '영수증 분석 중 오류가 발생했습니다.', 'error');
        
        const emptyFuelRecord: TransportRecord = {
          id: Date.now(),
          date: viewDateRef.current,
          time: getCurrentTimeString(),
          type: '주유기록',
          from: '', to: '', distance: 0, start_gps: '', end_gps: '',
          cost: 0, income: 0, liters: 0, unitPrice: 0, brand: '기타',
          ureaLiters: 0, ureaUnitPrice: 0, ureaStation: '', supplyItem: '', mileage: 0, waitingTime: 0,
          subsidy: 0, actualCost: 0
        };
        setEditingRecord(emptyFuelRecord);
        setIsFormOpen(true);
      } finally {
        setIsAnalyzingFuel(false);
      }
    };
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleResetDistance = () => {
    if (accumulatedDistanceRef.current > 0) {
      if (!window.confirm('이동거리를 초기화하시겠습니까?\n(현재까지의 공차거리가 기록됩니다)')) {
        return;
      }
      const today = viewDateRef.current;
      const nowTime = getCurrentTimeString();
      const emptyDist = Math.max(0, accumulatedDistanceRef.current - sessionCargoDistanceRef.current);

      setRecords(prev => {
        let updated = [...prev];
        if (emptyDist >= 0.1) {
          updated.push({
            id: Date.now(),
            date: today,
            time: nowTime,
            type: '공차거리',
            from: '거리 초기화',
            distance: emptyDist,
            income: 0, cost: 0, liters: 0, unitPrice: 0, brand: '기타', ureaLiters: 0, ureaUnitPrice: 0, ureaStation: '', supplyItem: '', mileage: 0, waitingTime: 0, start_gps: '', end_gps: '',
            isStarted: false,
            memo: `초기화 전 공차 합산`
          });
        }
        return updated;
      });

      accumulatedDistanceRef.current = 0;
      sessionCargoDistanceRef.current = 0;
      setCurrentGpsDistance(0);
      setCurrentCargoDistance(0);
      showToast('이동거리가 초기화되고 기록되었습니다.');
    } else {
      showToast('초기화할 이동거리가 없습니다.');
    }
  };

  // 로컬 스토리지 데이터 로드
  useEffect(() => {
    try {
      const savedRecordsRaw = localStorage.getItem('records');
      const savedLocsRaw = localStorage.getItem('saved_locations');
      const savedFixedRaw = localStorage.getItem('saved_fixed_expenses');
      const savedSalariesRaw = localStorage.getItem('salary_records');
      const savedTracking = localStorage.getItem('is_tracking') === 'true';

      const savedRecords = savedRecordsRaw ? JSON.parse(savedRecordsRaw) : [];
      
      // Data Migration: Convert old types to new types
      const migratedRecords = savedRecords.map((r: any) => {
        if (r.type === '주유소') return { ...r, type: '주유기록' };
        if (r.type === '공차이동') return { ...r, type: '공차거리' };
        return r;
      });

      setRecords(migratedRecords);
      setLocations(savedLocsRaw ? JSON.parse(savedLocsRaw) : {});
      setFixedExpenses(savedFixedRaw ? JSON.parse(savedFixedRaw) : []);
      setSalaryRecords(savedSalariesRaw ? JSON.parse(savedSalariesRaw) : []);
      setIsTracking(savedTracking);
    } catch (e) { console.error('Data loading error:', e); }
    setIsLoaded(true);

    const handleEditRecord = (e: any) => {
      setEditingRecord(e.detail);
      setWasReportOpen(true);
      setIsFormOpen(true);
    };
    const handleShowToast = (e: any) => {
      showToast(e.detail.message, e.detail.type || 'success');
    };
    window.addEventListener('edit-record', handleEditRecord);
    window.addEventListener('show-toast', handleShowToast);
    return () => {
      window.removeEventListener('edit-record', handleEditRecord);
      window.removeEventListener('show-toast', handleShowToast);
    };
  }, []);

  // 데이터 변경 시 저장
  useEffect(() => { if (isLoaded) localStorage.setItem('records', JSON.stringify(records)); }, [records, isLoaded]);
  useEffect(() => { if (isLoaded) localStorage.setItem('saved_locations', JSON.stringify(locations)); }, [locations, isLoaded]);
  useEffect(() => { if (isLoaded) localStorage.setItem('saved_fixed_expenses', JSON.stringify(fixedExpenses)); }, [fixedExpenses, isLoaded]);
  useEffect(() => { if (isLoaded) localStorage.setItem('salary_records', JSON.stringify(salaryRecords)); }, [salaryRecords, isLoaded]);
  useEffect(() => { if (isLoaded) localStorage.setItem('is_tracking', String(isTracking)); }, [isTracking, isLoaded]);

  const stopGpsTracking = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    try {
      if (watchIdRef.current) {
        await Geolocation.clearWatch({ id: watchIdRef.current });
        watchIdRef.current = null;
      }
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        } catch (e) {
          console.error('WakeLock release error:', e);
        }
      }
      lastCoordsRef.current = null;

      if (accumulatedDistanceRef.current > 0) {
      const today = viewDateRef.current;
      const nowTime = getCurrentTimeString();
      
      // 1. 현재 세션의 공차 거리 계산 (총 GPS 거리 - 화물 운송 거리)
      const emptyDist = Math.max(0, accumulatedDistanceRef.current - sessionCargoDistanceRef.current);

      setRecords(prev => {
        let updated = [...prev];
        
        // 2. 운행 중인 화물 자동 종료 처리
        updated = updated.map(r => {
          if (r.isStarted && r.type !== '공차거리') {
            return { ...r, isStarted: false, endTime: nowTime };
          }
          return r;
        });

        // 3. 공차 거리 기록 추가 (0.1km 미만은 노이즈로 간주하여 무시)
        if (emptyDist >= 0.1) {
          const newRecord: TransportRecord = {
            id: Date.now(),
            date: today,
            time: nowTime,
            type: '공차거리',
            from: 'GPS 공차 합산',
            distance: emptyDist,
            income: 0, cost: 0, liters: 0, unitPrice: 0, brand: '기타', ureaLiters: 0, ureaUnitPrice: 0, ureaStation: '', supplyItem: '', mileage: 0, waitingTime: 0, start_gps: '', end_gps: '',
            isStarted: false,
            memo: `총 GPS(${accumulatedDistanceRef.current.toFixed(1)}km) - 화물(${sessionCargoDistanceRef.current.toFixed(1)}km)`
          };
          updated.push(newRecord);
        }
        
        return updated;
      });

      accumulatedDistanceRef.current = 0;
      sessionCargoDistanceRef.current = 0;
      setCurrentGpsDistance(0);
      setCurrentCargoDistance(0);
    }

      if (Capacitor.getPlatform() === 'android') {
        await ForegroundService.stopForegroundService();
      }
    } finally {
      isStoppingRef.current = false;
    }
  }, []);

  const startGpsTracking = useCallback(async () => {
    if (isStoppingRef.current) {
      await new Promise(resolve => {
        const check = setInterval(() => {
          if (!isStoppingRef.current) {
            clearInterval(check);
            resolve(true);
          }
        }, 100);
      });
    }
    if (watchIdRef.current) {
      await stopGpsTracking();
    }

    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted') {
          showToast('GPS 권한이 필요합니다.', 'error');
          setIsTracking(false);
          return;
        }
      }
    } catch (e) {
      console.error("Permission check error:", e);
    }

    sessionCargoDistanceRef.current = 0; // 세션 시작 시 초기화
    accumulatedDistanceRef.current = 0;
    setCurrentGpsDistance(0);
    setCurrentCargoDistance(0);
    showToast('GPS 트래킹이 시작되었습니다.');
    
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (e) {
      console.error('WakeLock request error:', e);
    }

    try {
      if (Capacitor.getPlatform() === 'android') {
        await ForegroundService.startForegroundService({
          id: 1001,
          title: 'C-Note 실시간 거리 추적 중',
          body: '운행 거리를 정밀하게 측정하고 있습니다.',
          notificationChannelId: 'gps-channel',
          smallIcon: 'ic_launcher',
        });
      }

      watchIdRef.current = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        (position) => {
          if (!position) return;
          // 정확도가 100m 이상 떨어지면 무시 (튀는 현상 방지)
          if (position.coords.accuracy && position.coords.accuracy > 100) return;
          
          const current = { lat: position.coords.latitude, lng: position.coords.longitude };
          
          if (lastCoordsRef.current) {
            const dist = calculateDistance(
              lastCoordsRef.current.lat, lastCoordsRef.current.lng,
              current.lat, current.lng
            );
            
            if (dist >= 0.01) { // 10m 이상 이동 시 합산
              accumulatedDistanceRef.current += dist;
              
              if (isCargoActiveRef.current) {
                sessionCargoDistanceRef.current += dist;
              }

              setCurrentGpsDistance(accumulatedDistanceRef.current);
              setCurrentCargoDistance(sessionCargoDistanceRef.current);

              if (isCargoActiveRef.current) {
                setRecords(prev => {
                  const activeCargo = prev.find(r => r.isStarted && r.type !== '공차거리');
                  if (activeCargo) {
                    return prev.map(r => r.id === activeCargo.id ? { ...r, distance: (r.distance || 0) + dist } : r);
                  }
                  return prev;
                });
              }
              
              lastCoordsRef.current = current;
            }
          } else {
            lastCoordsRef.current = current;
          }
        }
      );
    } catch (err) { 
      console.error("GPS Watch Position Error:", err);
      showToast('GPS 권한을 확인해주세요.', 'error');
      setIsTracking(false);
    }
  }, []);

  useEffect(() => {
    if (isTracking) startGpsTracking();
    else stopGpsTracking();
    return () => { stopGpsTracking(); };
  }, [isTracking, startGpsTracking, stopGpsTracking]);

  const handleQuickUpdate = async (id: number, status: RecordType) => {
    const nowTime = getCurrentTimeString();
    const workDate = viewDateRef.current;

    setRecords(prev => {
      let updated = [...prev];
      
      // '화물운송' 시작 클릭 시
      if (status === '화물운송') {
        // 1. 현재 진행 중인 공차 거리를 모두 넘버링과 함께 종료 처리
        updated = updated.map(r => {
          if (r.isStarted && r.type === '공차거리') {
            // 현재 일자의 공차 순번 다시 확인
            const dailyEmptyCount = updated.filter(x => x.date === r.date && x.type === '공차거리' && x.id !== r.id).length;
            return { 
              ...r, 
              isStarted: false, 
              endTime: nowTime, 
              from: r.from || `공차 ${dailyEmptyCount + 1}`,
              memo: `${r.memo || ''} (운송시작으로 종료)`.trim()
            };
          }
          return r;
        });
        
        // 2. 선택한 화물 운송 시작
        const targetIdx = updated.findIndex(r => r.id === id);
        if (targetIdx > -1) {
          updated[targetIdx] = { 
            ...updated[targetIdx], 
            type: status, 
            isStarted: true, 
            time: nowTime, 
            date: workDate,
            distance: 0 
          };
        }
        // 글로벌 트래킹 강제 활성화
        if (!isTracking) setIsTracking(true);
      } 
      // 운행 종료/취소/회차 시
      else if (['운행종료', '운행회차', '운행취소'].includes(status)) {
        updated = updated.map(r => r.id === id ? { ...r, type: status, isStarted: false, endTime: nowTime, date: workDate } : r);
      }
      
      let message = `${status} 처리가 완료되었습니다.`;
      if (status === '화물운송') message = "운행이 시작되었습니다.";
      else if (status === '운행종료') message = "운행이 종료되었습니다.";
      else if (status === '운행회차') message = "운행이 회차 처리되었습니다.";
      else if (status === '운행취소') message = "운행이 취소 처리되었습니다.";
      
      showToast(message);
      return updated;
    });
  };

  const changeMonth = (delta: number) => {
    let newMonth = selectedMonth + delta;
    let newYear = selectedYear;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    else if (newMonth < 1) { newMonth = 12; newYear--; }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  const handleManualBackup = async (silent = false) => {
    const backupData = {
      version: 1,
      timestamp: new Date().toISOString(),
      data: {
        records,
        locations,
        fixedExpenses,
        salaryRecords
      }
    };
    
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    const monthDir = `CG_note_${year}_${month}`;
    const baseDir = `CG_note/${monthDir}`;
    
    let fileName = `backup_${dateStr}.json`;
    const jsonString = JSON.stringify(backupData, null, 2);

    try {
      if (Capacitor.getPlatform() !== 'web') {
        const perm = await Filesystem.requestPermissions();
        if (perm.publicStorage !== 'granted') {
          showToast('저장소 권한이 필요합니다.', 'error');
          // return; // Continue anyway, it might work on some versions
        }
      }

      if (Capacitor.getPlatform() === 'web') {
        if (silent) return; // Web auto-backup skip
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('백업 파일이 다운로드되었습니다.');
      } else {
        // Native: Specific path /storage/emulated/0/Download/CG_note/CG_note_YYYY_MM/backup_YYYYMMDD.json
        try {
            // Ensure directory exists
            await Filesystem.mkdir({
                path: `Download/CG_note`,
                directory: Directory.ExternalStorage,
                recursive: true
            }).catch(() => {});
            
            await Filesystem.mkdir({
                path: `Download/${baseDir}`,
                directory: Directory.ExternalStorage,
                recursive: true
            }).catch(() => {});

            let fullPath = `Download/${baseDir}/${fileName}`;
            
            // Check for duplicate
            if (!silent) {
              try {
                  await Filesystem.stat({
                      path: fullPath,
                      directory: Directory.ExternalStorage
                  });
                  // If exists, add (1)
                  fileName = `backup_${dateStr}(1).json`;
                  fullPath = `Download/${baseDir}/${fileName}`;
              } catch (e) {
                  // File doesn't exist, proceed
              }
            }

            await Filesystem.writeFile({
                path: fullPath,
                data: jsonString,
                directory: Directory.ExternalStorage,
                encoding: Encoding.UTF8
            });
            
            if (!silent) showToast(`백업이 완료되었습니다.`);
        } catch (e) {
            console.error('Native backup failed', e);
            if (!silent) showToast('백업 저장 실패', 'error');
        }
      }
    } catch (error) {
      console.error('Backup error:', error);
      if (!silent) showToast('백업 중 오류가 발생했습니다.', 'error');
    }
  };

  // 자동 백업 로직 (1시간 간격 또는 데이터 변경 시)
  useEffect(() => {
    if (!isLoaded) return;
    const now = Date.now();
    // 1시간(3600000ms) 지났거나 처음 로드된 경우
    if (now - lastBackupTimeRef.current > 3600000) {
      handleManualBackup(true);
      lastBackupTimeRef.current = now;
      
      // Firebase 클라우드에도 무음 자동 백업
      const cloudUserId = localStorage.getItem('cloud_user_id') || 'my_driver_data';
      saveToFirebase(cloudUserId, records, fixedExpenses, salaryRecords, locations).then(ok => {
        if (ok) {
          const timeNow = new Date().toISOString();
          localStorage.setItem('last_cloud_sync_time', timeNow);
        }
      }).catch(() => {});
    }
  }, [records, locations, fixedExpenses, salaryRecords, isLoaded]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-lg mx-auto shadow-xl relative pb-20 overflow-x-hidden">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-30 pt-[env(safe-area-inset-top)] shadow-sm">
        <div className="flex items-center gap-2 shrink-0">
          {/* 1. GPS 버튼 */}
          <button 
            onClick={() => {
              if (isTracking) {
                setIsTracking(false);
                showToast('GPS 트래킹이 종료되었습니다.');
              } else {
                setIsTracking(true);
              }
            }}
            className={`p-2 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95 ${
                isTracking 
                ? 'bg-blue-600 text-white shadow-blue-200' 
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
            }`}
            aria-label={isTracking ? 'GPS 종료' : 'GPS 시작'}
            title={isTracking ? 'GPS 종료' : 'GPS 시작'}
          >
            <Navigation className={`w-4 h-4 ${isTracking ? 'fill-current animate-pulse' : ''}`} />
          </button>

          {/* 2. 화물차 아이콘 (클릭 시 요약 팝업) */}
          <button
            onClick={() => setIsDistanceModalOpen(prev => !prev)}
            className="w-8 h-8 bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all rounded-xl flex items-center justify-center shadow-sm shrink-0"
            aria-label="이동거리 상세 요약"
            title="이동거리 상세 요약 보기"
          >
            <Truck className="text-white w-5 h-5" />
          </button>

          {/* 3. 배차문자 아이콘 */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('toggle-sms-parser'))}
            className="p-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white active:scale-95 transition-all shadow-sm flex items-center justify-center border border-amber-400 shrink-0"
            aria-label="배차문자 등록"
            title="배차문자 분석 및 자동 등록"
          >
            <Sparkles className="w-4 h-4 fill-white" />
          </button>
        </div>

        {/* 상단 가운데: 이동거리 숫자 표기 */}
        <button 
          onClick={() => setIsDistanceModalOpen(true)}
          className="flex items-baseline justify-center cursor-pointer px-2 py-0.5 rounded-xl hover:bg-slate-50 active:scale-95 transition-all"
          title="상세 이동거리 보기"
        >
          <span className="text-2xl font-black text-blue-600 tracking-tight leading-none">
            {formatDist(currentGpsDistance)}
          </span>
          <span className="text-sm font-bold text-slate-500 leading-none ml-1">km</span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <input 
            type="file" 
            ref={fuelFileInputRef} 
            accept="image/*" 
            onChange={handleFuelImageChange} 
            className="hidden" 
          />
          <button 
            onClick={handleFuelClick}
            disabled={isAnalyzingFuel}
            className="p-2 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200 active:scale-95 transition-all shadow-sm relative flex items-center justify-center disabled:opacity-50"
            aria-label="주유기록 영수증 촬영/선택"
            title="주유기록 영수증 촬영/선택"
          >
            {isAnalyzingFuel ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            ) : (
              <Fuel className="w-4 h-4" />
            )}
          </button>
          <button 
            onClick={handleResetDistance}
            className="p-2 rounded-full bg-slate-100 text-slate-500 active:scale-95 transition-all border border-slate-200 hover:bg-slate-200"
            aria-label="거리 초기화"
            title="거리 초기화"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={() => { setEditingRecord(null); setIsFormOpen(true); }} className="p-1.5 bg-blue-50 text-blue-600 rounded-full active:scale-90 transition-transform shrink-0" aria-label="기록 추가" title="기록 추가"><PlusCircle className="w-6 h-6" /></button>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        {activeTab === 'daily' && (
          <div className="space-y-6 flex flex-col">
            {viewType !== 'today' && (
              <>
                <div className="bg-slate-200/50 p-1 rounded-xl flex border border-slate-200">
                  {(['today', 'daily', 'weekly', 'monthly'] as const).map(t => (
                    <button key={t} onClick={() => setViewType(t)} className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all ${viewType === t ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500'}`}>{t === 'today' ? '오늘' : t === 'daily' ? '일별' : t === 'weekly' ? '주별' : '월별'}</button>
                  ))}
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 rounded-full active:scale-90"><ChevronLeft size={24} className="text-slate-400" /></button>
                    <div className="flex items-center gap-2 font-black text-slate-800 text-base">
                      <CalendarIcon size={18} className="text-blue-600" />
                      <span className="text-lg">{selectedYear}. {String(selectedMonth).padStart(2, '0')}.</span>
                    </div>
                    <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 rounded-full active:scale-90"><ChevronRight size={24} className="text-slate-400" /></button>
                  </div>
                </div>
              </>
            )}

            {viewType === 'today' && <SMSParser locations={locations} setLocations={setLocations} records={records} viewDate={viewDate} onParsed={(recs) => setRecords(prev => [...prev, ...recs])} />}
            {viewType === 'today' ? (
              <RecordList 
                records={records} 
                locations={locations} 
                setLocations={setLocations}
                setRecords={setRecords}
                viewDate={viewDate} 
                isTracking={isTracking}
                currentGpsDistance={currentGpsDistance}
                currentCargoDistance={currentCargoDistance}
                onEdit={(r) => { setEditingRecord(r); setIsFormOpen(true); }} 
                onQuickUpdate={handleQuickUpdate}
              />
            ) : (
              <div className="space-y-4">
                {viewType === 'daily' && <DailyTableView records={records} salaryRecords={salaryRecords} selectedYear={selectedYear} selectedMonth={selectedMonth} onViewDetail={(d) => { setViewDate(d); setViewType('today'); }} />}
                {viewType === 'weekly' && <WeeklyTableView records={records} selectedYear={selectedYear} selectedMonth={selectedMonth} />}
                {viewType === 'monthly' && <MonthlyTableView records={records} salaryRecords={salaryRecords} selectedYear={selectedYear} />}
              </div>
            )}
            
            {viewType === 'today' && (
              <>
                <div className="bg-slate-200/50 p-1 rounded-xl flex mt-4 border border-slate-200">
                  {(['today', 'daily', 'weekly', 'monthly'] as const).map(t => (
                    <button key={t} onClick={() => setViewType(t)} className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all ${viewType === t ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500'}`}>{t === 'today' ? '오늘' : t === 'daily' ? '일별' : t === 'weekly' ? '주별' : '월별'}</button>
                  ))}
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <button onClick={() => setViewDate(d => { const dt = new Date(d); dt.setDate(dt.getDate()-1); return dt.toISOString().split('T')[0]; })} className="p-2 hover:bg-slate-100 rounded-full active:scale-90"><ChevronLeft size={24} className="text-slate-400" /></button>
                    <div className="flex items-center gap-2 font-black text-slate-800 text-base">
                      <CalendarIcon size={18} className="text-blue-600" />
                      <input type="date" value={viewDate} onChange={(e) => setViewDate(e.target.value)} className="bg-transparent border-none text-center font-black outline-none w-full min-w-[150px] text-lg" />
                    </div>
                    <button onClick={() => setViewDate(d => { const dt = new Date(d); dt.setDate(dt.getDate()+1); return dt.toISOString().split('T')[0]; })} className="p-2 hover:bg-slate-100 rounded-full active:scale-90"><ChevronRight size={24} className="text-slate-400" /></button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'stats' && <Statistics records={records} salaryRecords={salaryRecords} fixedExpenses={fixedExpenses} />}
        {activeTab === 'matching' && (
          <IncomeMatchingView 
            isOpen={true} 
            onClose={() => setActiveTab('daily')} 
            records={records} 
            setRecords={setRecords} 
          />
        )}
        {activeTab === 'settings' && (
          <SettingsPage2 
            records={records} setRecords={setRecords}
            locations={locations} setLocations={setLocations} 
            fixedExpenses={fixedExpenses} setFixedExpenses={setFixedExpenses}
            salaryRecords={salaryRecords} setSalaryRecords={setSalaryRecords}
            onOpenReport={() => setIsReportOpen(true)}
            onManualBackup={handleManualBackup} 
            lastBackupTime={lastBackupTimeRef.current}
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around items-center h-16 max-w-lg mx-auto z-40 pb-[env(safe-area-inset-bottom)]">
        <button onClick={() => setActiveTab('daily')} className={`flex flex-col items-center gap-1 w-16 transition-all ${activeTab === 'daily' ? 'text-blue-600' : 'text-slate-400 opacity-60'}`}><History size={24}/><span className="text-[10px] font-black">일지</span></button>
        <button onClick={() => setActiveTab('matching')} className={`flex flex-col items-center gap-1 w-16 transition-all ${activeTab === 'matching' ? 'text-blue-600' : 'text-slate-400 opacity-60'}`}><DollarSign size={24}/><span className="text-[10px] font-black">금액매칭</span></button>
        <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center gap-1 w-16 transition-all ${activeTab === 'stats' ? 'text-blue-600' : 'text-slate-400 opacity-60'}`}><BarChart3 size={24}/><span className="text-[10px] font-black">통계</span></button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 w-16 transition-all ${activeTab === 'settings' ? 'text-blue-600' : 'text-slate-400 opacity-60'}`}><Settings size={24}/><span className="text-[10px] font-black">관리</span></button>
      </nav>

      <ReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} records={records} salaryRecords={salaryRecords} fixedExpenses={fixedExpenses} initialYear={selectedYear} initialMonth={selectedMonth} />

      {/* 화물차 아이콘 클릭 시 표시되는 이동거리 상세 모달 */}
      {isDistanceModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsDistanceModalOpen(false)}>
          <div className="bg-white rounded-3xl p-5 w-full max-w-xs space-y-4 shadow-2xl border border-slate-100 relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                  <Truck className="text-white w-5 h-5" />
                </div>
                <h3 className="font-black text-slate-800 text-base">이동거리 상세 요약</h3>
              </div>
              <button 
                onClick={() => setIsDistanceModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full active:scale-90 transition-transform"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              {/* 화물 */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-emerald-600">화물</span>
                <span className="text-xl font-black text-emerald-600 tracking-tight">
                  {formatDist(currentCargoDistance)}
                </span>
                <span className="text-[10px] font-bold text-slate-400">km</span>
              </div>

              {/* 총 이동거리 */}
              <div className="flex flex-col items-center gap-1 border-x border-slate-200 px-1">
                <span className="text-xs font-bold text-blue-600">총 이동</span>
                <span className="text-xl font-black text-blue-600 tracking-tight">
                  {formatDist(currentGpsDistance)}
                </span>
                <span className="text-[10px] font-bold text-slate-400">km</span>
              </div>

              {/* 공차 */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-red-500">공차</span>
                <span className="text-xl font-black text-red-500 tracking-tight">
                  {formatDist(Math.max(0, currentGpsDistance - currentCargoDistance))}
                </span>
                <span className="text-[10px] font-bold text-slate-400">km</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 text-center font-medium">
              GPS 트래킹 기반 실시간 이동거리입니다.
            </div>

            <button
              onClick={() => setIsDistanceModalOpen(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-md"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-t-[32px] h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50 rounded-t-[32px]">
              <h3 className="font-black text-slate-800 text-lg">{editingRecord ? '기록 수정' : '새 기록 추가'}</h3>
              <button onClick={() => { setIsFormOpen(false); if (wasReportOpen) { setIsReportOpen(true); setWasReportOpen(false); } }} className="p-2 bg-white rounded-full border active:scale-90 transition-transform"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <RecordForm 
                initialData={editingRecord} 
                locations={locations}
                records={records}
                viewDate={viewDateRef.current}
                onSubmit={(r) => { 
                  setRecords(prev => { 
                    let newRecords = [...prev];
                    const idx = newRecords.findIndex(old => old.id === r.id); 
                    
                    if (idx > -1) {
                      const oldRecord = newRecords[idx];
                      if (oldRecord.distance > r.distance && r.distance >= 0 && ['화물운송', '운송종료', '운행종료', '운행회차', '운행취소'].includes(oldRecord.type)) {
                        const diff = oldRecord.distance - r.distance;
                        const emptyRecord: TransportRecord = {
                          id: Date.now() + Math.floor(Math.random() * 1000),
                          date: r.date,
                          time: r.endTime || r.time,
                          type: '공차거리',
                          from: '운행거리 수정 반환',
                          distance: diff,
                          income: 0, cost: 0, liters: 0, unitPrice: 0, brand: '기타', ureaLiters: 0, ureaUnitPrice: 0, ureaStation: '', supplyItem: '', mileage: 0, waitingTime: 0, start_gps: '', end_gps: '',
                          isStarted: false,
                          memo: `화물거리 수정(${oldRecord.distance.toFixed(1)}->${r.distance.toFixed(1)})으로 인한 공차 전환`
                        };
                        newRecords.push(emptyRecord);
                        setTimeout(() => showToast(`수정된 거리 차이(${diff.toFixed(1)}km)가 공차거리로 변환되었습니다.`), 500);
                      }
                      newRecords = newRecords.map(old => old.id === r.id ? r : old);
                    } else {
                      newRecords = [...newRecords, r];
                    }

                    // 상하차지 단가 일괄 업데이트 로직 추가
                    if (r.from && r.to && r.income > 0 && ['화물운송', '운송종료', '운행종료', '운행회차', '운행취소', '대기'].includes(r.type)) {
                      const fromTrim = r.from.trim();
                      const toTrim = r.to.trim();
                      let updatedCount = 0;
                      newRecords = newRecords.map(old => {
                        if (old.from?.trim() === fromTrim && old.to?.trim() === toTrim && old.income !== r.income) {
                          updatedCount++;
                          return { ...old, income: r.income };
                        }
                        return old;
                      });
                      if (updatedCount > 0) {
                        setTimeout(() => showToast(`동일 구간 ${updatedCount}건의 금액이 함께 업데이트되었습니다.`), 100);
                      }
                    }
                    
                    return newRecords;
                  }); 
                  setIsFormOpen(false);
                  if (wasReportOpen) {
                    setIsReportOpen(true);
                    setWasReportOpen(false);
                  }
                  showToast('기록이 저장되었습니다.');
                }} 
                onDelete={(id) => {
                  setRecords(prev => prev.filter(r => String(r.id) !== String(id)));
                  setEditingRecord(null);
                  setIsFormOpen(false);
                  if (wasReportOpen) {
                    setIsReportOpen(true);
                    setWasReportOpen(false);
                  }
                  showToast('기록이 삭제되었습니다.');
                }}
              />
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in zoom-in duration-300">
          <div className={`px-6 py-3 rounded-full shadow-2xl font-black text-sm flex items-center gap-2 ${toast.type === 'success' ? 'bg-slate-900 text-white' : 'bg-red-600 text-white'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertCircle size={16} />}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
