import { db } from './IndexedDB';
import { supabase, isSupabaseConfigured } from './supabaseClient';

class SyncManager {
  constructor() {
    this.syncStatus = 'idle'; // 'idle', 'syncing', 'error'
    this.lastSyncedAt = localStorage.getItem('aura_last_synced') || null;
    this.isOnline = navigator.onLine;

    // Listen for connection changes
    window.addEventListener('online', () => this.handleConnectionChange(true));
    window.addEventListener('offline', () => this.handleConnectionChange(false));
  }

  handleConnectionChange(status) {
    this.isOnline = status;
    console.log(`Clinic network status: ${status ? 'ONLINE' : 'OFFLINE'}`);
    if (status && localStorage.getItem('aura_pending_sync') === 'true') {
      this.syncNow();
    }
  }

  getClinicId() {
    const config = localStorage.getItem('aura_clinic_config');
    if (config) {
      try {
        return JSON.parse(config).clinic_id || 'CLINIC_DEFAULT_DEMO';
      } catch (e) {
        return 'CLINIC_DEFAULT_DEMO';
      }
    }
    return 'CLINIC_DEFAULT_DEMO';
  }

  // Bidirectional Synchronization (IndexedDB <-> Supabase)
  async syncNow() {
    if (!this.isOnline) {
      console.warn('Sync aborted: Client is currently offline.');
      localStorage.setItem('aura_pending_sync', 'true');
      return { success: false, reason: 'offline' };
    }

    this.syncStatus = 'syncing';
    this.triggerStatusCallback();

    try {
      const clinicId = this.getClinicId();
      console.log(`Starting cloud sync for clinic ID: "${clinicId}"`);

      // If Supabase credentials are not set, fall back to offline simulation
      if (!isSupabaseConfigured()) {
        await new Promise(resolve => setTimeout(resolve, 1200));
        console.log('Supabase credentials not configured. Running offline simulation.');
        this.lastSyncedAt = new Date().toISOString();
        localStorage.setItem('aura_last_synced', this.lastSyncedAt);
        localStorage.setItem('aura_pending_sync', 'false');
        this.syncStatus = 'idle';
        this.triggerStatusCallback();
        return { success: true, timestamp: this.lastSyncedAt };
      }

      // List of all database tables to sync
      const tables = [
        'patients', 
        'bookings', 
        'triage', 
        'consultations', 
        'inventory', 
        'sales', 
        'expenses', 
        'doctors', 
        'settings'
      ];

      for (const table of tables) {
        // 1. Push local changes
        const localRecords = await db.getAll(table);
        const clinicRecords = localRecords.filter(r => r.clinic_id === clinicId);
        
        if (clinicRecords.length > 0) {
          const { error: pushError } = await supabase
            .from(table)
            .upsert(clinicRecords);
          
          if (pushError) {
            console.warn(`Failed to push local records to Supabase table "${table}":`, pushError.message);
            // Continue to the next table so a single missing schema doesn't crash the whole sync loop
            continue;
          }
        }

        // 2. Pull remote changes
        const { data: remoteRecords, error: pullError } = await supabase
          .from(table)
          .select('*')
          .eq('clinic_id', clinicId);

        if (pullError) {
          console.warn(`Failed to pull remote records from Supabase table "${table}":`, pullError.message);
          continue;
        }

        // Save remote records into local IndexedDB
        if (remoteRecords && remoteRecords.length > 0) {
          for (const item of remoteRecords) {
            await db.save(table, item);
          }
        }
      }

      this.lastSyncedAt = new Date().toISOString();
      localStorage.setItem('aura_last_synced', this.lastSyncedAt);
      localStorage.setItem('aura_pending_sync', 'false');

      // Dispatch mutation event to refresh active page views
      window.dispatchEvent(new Event('aura_data_mutated'));

      this.syncStatus = 'idle';
      this.triggerStatusCallback();
      return { success: true, timestamp: this.lastSyncedAt };
    } catch (error) {
      console.error('Supabase Sync failed:', error);
      this.syncStatus = 'error';
      this.triggerStatusCallback();
      return { success: false, reason: error.message };
    }
  }

  onStatusChange(callback) {
    this.statusCallback = callback;
  }

  triggerStatusCallback() {
    if (this.statusCallback) {
      this.statusCallback({
        status: this.syncStatus,
        lastSynced: this.lastSyncedAt,
        isOnline: this.isOnline
      });
    }
  }
}

export const syncManager = new SyncManager();
