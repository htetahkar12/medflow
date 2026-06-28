const DB_NAME = 'AuraClinicDB';
const DB_VERSION = 1;

let dbInstance = null;

export const initDB = () => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      console.log('Upgrading database schema...');

      // Patients store
      if (!db.objectStoreNames.contains('patients')) {
        const patientStore = db.createObjectStore('patients', { keyPath: 'id' });
        patientStore.createIndex('name', 'name', { unique: false });
        patientStore.createIndex('phone', 'phone', { unique: false });
      }

      // Doctors store
      if (!db.objectStoreNames.contains('doctors')) {
        db.createObjectStore('doctors', { keyPath: 'id' });
      }

      // Bookings store
      if (!db.objectStoreNames.contains('bookings')) {
        const bookingStore = db.createObjectStore('bookings', { keyPath: 'id' });
        bookingStore.createIndex('date', 'date', { unique: false });
        bookingStore.createIndex('doctor_id', 'doctor_id', { unique: false });
      }

      // Triage store
      if (!db.objectStoreNames.contains('triage')) {
        const triageStore = db.createObjectStore('triage', { keyPath: 'id' });
        triageStore.createIndex('booking_id', 'booking_id', { unique: false });
      }

      // Consultations store
      if (!db.objectStoreNames.contains('consultations')) {
        const consultStore = db.createObjectStore('consultations', { keyPath: 'id' });
        consultStore.createIndex('booking_id', 'booking_id', { unique: false });
        consultStore.createIndex('patient_id', 'patient_id', { unique: false });
      }

      // Investigations store (Lab/Radiology tests)
      if (!db.objectStoreNames.contains('investigations')) {
        const invStore = db.createObjectStore('investigations', { keyPath: 'id' });
        invStore.createIndex('status', 'status', { unique: false });
        invStore.createIndex('consultation_id', 'consultation_id', { unique: false });
      }

      // Inventory store
      if (!db.objectStoreNames.contains('inventory')) {
        const invStore = db.createObjectStore('inventory', { keyPath: 'id' });
        invStore.createIndex('barcode', 'barcode', { unique: false });
        invStore.createIndex('name', 'name', { unique: false });
      }

      // Sales/Billing store
      if (!db.objectStoreNames.contains('sales')) {
        const salesStore = db.createObjectStore('sales', { keyPath: 'id' });
        salesStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Expenses store
      if (!db.objectStoreNames.contains('expenses')) {
        const expStore = db.createObjectStore('expenses', { keyPath: 'id' });
        expStore.createIndex('date', 'date', { unique: false });
      }

      // Clinic Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    };
  });
};

// Generic Database CRUD operations helper
const getStore = async (storeName, mode = 'readonly') => {
  const db = await initDB();
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
};

export const db = {
  // Put (Insert or Update)
  async save(storeName, data) {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve(data);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Get by ID
  async get(storeName, id) {
    const store = await getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Delete by ID
  async delete(storeName, id) {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(id);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Get All records
  async getAll(storeName) {
    const store = await getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Query by index value
  async queryByIndex(storeName, indexName, value) {
    const store = await getStore(storeName, 'readonly');
    const index = store.index(indexName);
    return new Promise((resolve, reject) => {
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Export full database to JSON
  async exportBackup() {
    const stores = ['patients', 'doctors', 'bookings', 'triage', 'consultations', 'investigations', 'inventory', 'sales', 'expenses', 'settings'];
    const backup = {};
    for (const store of stores) {
      backup[store] = await this.getAll(store);
    }
    return JSON.stringify(backup, null, 2);
  },

  // Import full database from JSON
  async importBackup(jsonString) {
    const backup = JSON.parse(jsonString);
    const db = await initDB();
    
    for (const storeName in backup) {
      if (db.objectStoreNames.contains(storeName)) {
        const records = backup[storeName];
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        
        // Clear current store first
        store.clear();
        
        for (const record of records) {
          store.put(record);
        }
      }
    }
    return true;
  }
};
