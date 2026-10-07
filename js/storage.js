/**
 * Storage Manager for Burmese Meeting Minutes AI
 * Uses IndexedDB for rich meeting history and localStorage for settings/API keys.
 * 100% Client-Side. No external database or server needed.
 */

const DB_NAME = 'BurmeseMeetingMinutesDB';
const DB_VERSION = 1;
const STORE_MEETINGS = 'meetings';

class StorageManager {
  constructor() {
    this.db = null;
    this._memStore = new Map();
    this._initPromise = this._initIndexedDB();
  }

  _initIndexedDB() {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        // Fallback for non-browser or test environments
        resolve(null);
        return;
      }

      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_MEETINGS)) {
            const store = db.createObjectStore(STORE_MEETINGS, { keyPath: 'id' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('title', 'title', { unique: false });
          }
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          resolve(this.db);
        };

        request.onerror = (event) => {
          console.warn("IndexedDB failed to open, using fallback:", event.target.error);
          resolve(null);
        };
      } catch (err) {
        console.warn("IndexedDB initialization error, using fallback:", err);
        resolve(null);
      }
    });
  }

  // --- Settings & LocalStorage ---

  getSetting(key, defaultValue = null) {
    if (typeof localStorage === 'undefined') {
      return this._memStore.has(`bmm_${key}`) ? this._memStore.get(`bmm_${key}`) : defaultValue;
    }
    try {
      const val = localStorage.getItem(`bmm_${key}`);
      return val !== null ? JSON.parse(val) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }

  setSetting(key, value) {
    if (typeof localStorage === 'undefined') {
      this._memStore.set(`bmm_${key}`, value);
      return;
    }
    try {
      localStorage.setItem(`bmm_${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn("LocalStorage set error:", e);
    }
  }

  removeSetting(key) {
    if (typeof localStorage === 'undefined') {
      this._memStore.delete(`bmm_${key}`);
      return;
    }
    localStorage.removeItem(`bmm_${key}`);
  }

  // --- Meeting Minutes Records (IndexedDB with LocalStorage fallback) ---

  async saveMeeting(meeting) {
    await this._initPromise;
    const record = {
      id: meeting.id || 'meet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: meeting.title || 'အမည်မရှိ အစည်းအဝေး (Untitled Meeting)',
      timestamp: meeting.timestamp || Date.now(),
      createdAt: new Date().toISOString(),
      mode: meeting.mode || 'detailed',
      language: meeting.language || 'bilingual',
      model: meeting.model || 'gemini-2.5-flash',
      content: meeting.content || '',
      summary: meeting.summary || '',
      audioName: meeting.audioName || '',
      actionItems: meeting.actionItems || []
    };

    if (this.db) {
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction([STORE_MEETINGS], 'readwrite');
          const store = tx.objectStore(STORE_MEETINGS);
          const req = store.put(record);
          req.onsuccess = () => resolve(record);
          req.onerror = () => resolve(this._saveFallback(record));
          tx.onerror = () => resolve(this._saveFallback(record));
        } catch (e) {
          resolve(this._saveFallback(record));
        }
      });
    } else {
      return this._saveFallback(record);
    }
  }

  _saveFallback(record) {
    const history = this.getSetting('history_fallback', []);
    const existingIdx = history.findIndex(m => m.id === record.id);
    if (existingIdx >= 0) {
      history[existingIdx] = record;
    } else {
      history.unshift(record);
    }
    this.setSetting('history_fallback', history.slice(0, 50));
    return record;
  }

  async getAllMeetings() {
    await this._initPromise;
    if (this.db) {
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction([STORE_MEETINGS], 'readonly');
          const store = tx.objectStore(STORE_MEETINGS);
          const req = store.getAll();
          req.onsuccess = () => {
            const sorted = (req.result || []).sort((a, b) => b.timestamp - a.timestamp);
            resolve(sorted);
          };
          req.onerror = () => resolve(this.getSetting('history_fallback', []));
        } catch (err) {
          resolve(this.getSetting('history_fallback', []));
        }
      });
    } else {
      return this.getSetting('history_fallback', []);
    }
  }

  async getMeetingById(id) {
    await this._initPromise;
    if (this.db) {
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction([STORE_MEETINGS], 'readonly');
          const store = tx.objectStore(STORE_MEETINGS);
          const req = store.get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => {
            const history = this.getSetting('history_fallback', []);
            resolve(history.find(m => m.id === id) || null);
          };
        } catch (err) {
          const history = this.getSetting('history_fallback', []);
          resolve(history.find(m => m.id === id) || null);
        }
      });
    } else {
      const history = this.getSetting('history_fallback', []);
      return history.find(m => m.id === id) || null;
    }
  }

  async deleteMeeting(id) {
    await this._initPromise;
    // Always clean from fallback to keep in sync
    let history = this.getSetting('history_fallback', []);
    history = history.filter(m => m.id !== id);
    this.setSetting('history_fallback', history);

    if (this.db) {
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction([STORE_MEETINGS], 'readwrite');
          const store = tx.objectStore(STORE_MEETINGS);
          const req = store.delete(id);
          req.onsuccess = () => resolve(true);
          req.onerror = () => resolve(true);
        } catch (err) {
          resolve(true);
        }
      });
    } else {
      return true;
    }
  }

  async clearAllMeetings() {
    await this._initPromise;
    this.setSetting('history_fallback', []);

    if (this.db) {
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction([STORE_MEETINGS], 'readwrite');
          const store = tx.objectStore(STORE_MEETINGS);
          const req = store.clear();
          req.onsuccess = () => resolve(true);
          req.onerror = () => resolve(true);
        } catch (err) {
          resolve(true);
        }
      });
    } else {
      return true;
    }
  }
}

// Export for both Browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageManager };
}
