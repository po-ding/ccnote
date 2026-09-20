import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyBFK9dJeGmwNH0WacPpTWAt1dXJaLSg5Bk",
  authDomain: "c-note-eb810.firebaseapp.com",
  projectId: "c-note-eb810",
  storageBucket: "c-note-eb810.firebasestorage.app",
  messagingSenderId: "881418057562",
  appId: "1:881418057562:web:087f2c200767ca0410e563",
  measurementId: "G-S6FH07RZZ6"
};

// 싱글톤 초기화
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

export interface CloudBackupData {
  version?: number;
  records: any[];
  fixedExpenses: any[];
  salaryRecords?: any[];
  locations?: Record<string, any>;
  updatedAt: string;
  totalRecordsCount: number;
}

// 클라우드에 백업 저장
export async function saveToFirebase(
  userId: string = 'my_driver_data',
  records: any[] = [],
  fixedExpenses: any[] = [],
  salaryRecords: any[] = [],
  locations: Record<string, any> = {}
): Promise<boolean> {
  try {
    const backupData: CloudBackupData = {
      version: 1,
      records: records || [],
      fixedExpenses: fixedExpenses || [],
      salaryRecords: salaryRecords || [],
      locations: locations || {},
      updatedAt: new Date().toISOString(),
      totalRecordsCount: (records || []).length
    };
    
    // cnote_backups 컬렉션의 사용자 문서에 저장
    const docRef = doc(db, 'cnote_backups', userId || 'my_driver_data');
    await setDoc(docRef, backupData);
    return true;
  } catch (error) {
    console.error('Firebase save error:', error);
    return false;
  }
}

// 클라우드에서 백업 불러오기
export async function loadFromFirebase(userId: string = 'my_driver_data'): Promise<CloudBackupData | null> {
  try {
    const docRef = doc(db, 'cnote_backups', userId || 'my_driver_data');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as CloudBackupData;
    }
    return null;
  } catch (error) {
    console.error('Firebase load error:', error);
    return null;
  }
}
