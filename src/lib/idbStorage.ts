import { StateStorage } from 'zustand/middleware';

const DB_NAME = 'ca_final_companion_db';
const STORE_NAME = 'zustand_store';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result !== undefined ? request.result : null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('⚠️ [IndexedDB Read Error]', err);
    return null;
  }
}

export async function idbSet(key: string, value: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('⚠️ [IndexedDB Write Error]', err);
  }
}

export async function idbRemove(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('⚠️ [IndexedDB Remove Error]', err);
  }
}

/**
 * Zustand async StateStorage implementation backed strictly by IndexedDB
 * with automatic fallback & migration from localStorage.
 */
export const idbStateStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    // 1. Try to read from high-capacity IndexedDB
    const val = await idbGet(name);
    if (val) {
      return val;
    }

    // 2. Migration: If not found in IndexedDB, attempt to restore legacy data from localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const localVal = localStorage.getItem(name);
        if (localVal) {
          console.log(`📦 [IndexedDB Migration] Migrating state '${name}' from localStorage to IndexedDB.`);
          await idbSet(name, localVal);
          return localVal;
        }
      }
    } catch (e) {
      console.warn('⚠️ [IndexedDB Storage Migration Warning]', e);
    }

    return null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    // Write strictly to IndexedDB to ensure persistent storage not cleared by browser memory pressure
    await idbSet(name, value);

    // Keep localStorage in sync if payload size is within limits, ignoring quota errors
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(name, value);
      }
    } catch (e) {
      // Ignored: IndexedDB is the primary high-capacity persistent storage engine
    }
  },
  removeItem: async (name: string): Promise<void> => {
    await idbRemove(name);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(name);
      }
    } catch (e) {
      // Ignored
    }
  },
};
