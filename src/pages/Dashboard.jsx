import React, { useState, useEffect } from 'react';
import { db } from '../db/IndexedDB';
import { syncManager } from '../db/SyncManager';

export default function Dashboard({ setCurrentTab, clinicMode, userRole }) {
  const [stats, setStats] = useState({
    dailyPatients: 0,
    todayIncome: 0,
    activeQueue: 0,
    lowStock: 0
  });
  const [activeBookings, setActiveBookings] = useState([]);
  const [syncStatus, setSyncStatus] = useState({
    status: 'idle',
    lastSynced: localStorage.getItem('aura_last_synced') || 'Never',
    isOnline: navigator.onLine
  });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadDashboardData();
    
    // Listen to cloud sync status changes
    syncManager.onStatusChange((statusObj) => {
      setSyncStatus({
        status: statusObj.status,
        lastSynced: statusObj.lastSynced ? new Date(statusObj.lastSynced).toLocaleTimeString() : 'Never',
        isOnline: statusObj.isOnline
      });
    });
  }, []);

  const loadDashboardData = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const clinicId = syncManager.getClinicId();

      // Load patients, bookings, inventory, sales
      const bookings = await db.getAll('bookings');
      const inventory = await db.getAll('inventory');
      const sales = await db.getAll('sales');

      // Filter today's bookings for this clinic
      const todayBookings = bookings.filter(b => b.date === todayStr && b.clinic_id === clinicId);
      
      // Calculate stats
      const dailyPatients = todayBookings.length;
      
      const activeQueue = todayBookings.filter(b => 
        b.status === 'scheduled' || b.status === 'checked_in' || b.status === 'in_consultation' || b.status === 'pending_lab' || b.status === 'pending_checkout'
      ).length;

      // Filter inventory for this clinic and count low stock items
      const clinicInventory = inventory.filter(i => i.clinic_id === clinicId);
      const lowStock = clinicInventory.filter(item => {
        const baseQty = Number(item.total_tablets) || 0;
        const reorder = Number(item.reorder_level) || 0;
        return baseQty <= reorder;
      }).length;

      // Filter today's sales for this clinic
      const todaySales = sales.filter(s => {
        const saleDate = s.timestamp ? s.timestamp.split('T')[0] : '';
        return saleDate === todayStr && s.clinic_id === clinicId;
      });
      const todayIncome = todaySales.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);

      setStats({
        dailyPatients,
        todayIncome,
        activeQueue,
        lowStock
      });

      // Load active patients list with patient names and doctor names
      const patients = await db.getAll('patients');
      const doctors = await db.getAll('doctors');

      const fullBookings = todayBookings.map(b => {
        const patient = patients.find(p => p.id === b.patient_id);
        const doctor = doctors.find(d => d.id === b.doctor_id);
        return {
          ...b,
          patientName: patient ? patient.name : 'Unknown Patient',
          patientPhone: patient ? patient.phone : 'N/A',
          doctorName: doctor ? doctor.name : 'Unassigned'
        };
      });

      // Sort: Checked-in first, then alphabetical/time
      fullBookings.sort((a, b) => {
        const order = { 'checked_in': 1, 'in_consultation': 2, 'pending_lab': 3, 'pending_checkout': 4, 'scheduled': 5, 'completed': 6 };
        return (order[a.status] || 9) - (order[b.status] || 9);
      });

      setActiveBookings(fullBookings);
    } catch (e) {
      console.error('Error loading dashboard stats:', e);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    await syncManager.syncNow();
    setIsSyncing(false);
    loadDashboardData();
  };

  // Seed demo data so users can test all interconnected systems instantly
  const seedDemoData = async () => {
    const clinicId = syncManager.getClinicId();
    
    // 1. Save Settings
    await db.save('settings', {
      id: 'clinic_config',
      clinic_id: clinicId,
      clinic_name: 'Medflow Premium Clinic',
      address: 'No. 120, Pyay Road, Yangon',
      phone: '09-987654321',
      workflow_mode: clinicMode
    });
    localStorage.setItem('aura_clinic_config', JSON.stringify({ clinic_id: clinicId }));

    await db.save('settings', {
      id: 'investigations_catalog',
      labOptions: [
        { name: 'CBC (Blood Count)', default_fee: 5000 },
        { name: 'Lipid Profile', default_fee: 8000 },
        { name: 'LFT (Liver)', default_fee: 12000 },
        { name: 'KFT (Kidney)', default_fee: 12000 },
        { name: 'FBS (Blood Sugar)', default_fee: 4000 }
      ],
      radOptions: [
        { name: 'Chest X-Ray', default_fee: 12000 },
        { name: 'USG Abdomen & Pelvis', default_fee: 15000 },
        { name: 'CT Brain', default_fee: 45000 },
        { name: 'MRI Spine', default_fee: 85000 }
      ]
    });

    // 2. Save Doctors
    const doc1Id = 'DOC-01';
    const doc2Id = 'DOC-02';
    await db.save('doctors', { 
      id: doc1Id, 
      clinic_id: clinicId, 
      name: 'Dr. Hein Thant', 
      specialty: 'General Physician', 
      fees: 10000,
      paymentType: 'percentage',
      paymentValue: 70
    });
    await db.save('doctors', { 
      id: doc2Id, 
      clinic_id: clinicId, 
      name: 'Dr. Khin Myat', 
      specialty: 'Pediatrician', 
      fees: 12000,
      paymentType: 'flat',
      paymentValue: 4000
    });

    // 3. Save Patients
    const pat1Id = 'PT-26-0001';
    const pat2Id = 'PT-26-0002';
    await db.save('patients', {
      id: pat1Id,
      clinic_id: clinicId,
      name: 'U Aung Kyaw',
      age: 45,
      gender: 'Male',
      phone: '09-443322110',
      address: 'Hlaing Township, Yangon',
      blood_group: 'O+',
      allergies: 'Penicillin',
      history_summary: 'Hypertension diagnosed in 2024.',
      created_at: new Date().toISOString()
    });
    await db.save('patients', {
      id: pat2Id,
      clinic_id: clinicId,
      name: 'Daw Aye Aye',
      age: 32,
      gender: 'Female',
      phone: '09-556677889',
      address: 'Kamayut Township, Yangon',
      blood_group: 'B+',
      allergies: 'None',
      history_summary: 'Allergic rhinitis.',
      created_at: new Date().toISOString()
    });

    // 4. Save Inventory (Unit conversions box->strip->tab)
    // Paracetamol: 1 Box = 10 Strips, 1 Strip = 10 Tablets. Total tabs = 100
    await db.save('inventory', {
      id: 'MED-01',
      clinic_id: clinicId,
      name: 'Paracetamol 500mg',
      generic_name: 'Paracetamol',
      barcode: '8881234567890',
      category: 'Tablet',
      box_qty: 1,
      strip_per_box: 10,
      tablet_per_strip: 10,
      total_tablets: 100, // base unit stock
      reorder_level: 20,
      purchase_price: 1500, // per box
      selling_price_per_tab: 25, // 25 Kyats/tablet
      expiry_date: '2027-12-31',
      batches: [
        { batchNumber: 'B-PARA-001', expiryDate: '2027-12-31', costPrice: 12, quantityOnHand: 100 }
      ]
    });

    // Amoxicillin: 1 Box = 10 Strips, 1 Strip = 10 Capsules.
    await db.save('inventory', {
      id: 'MED-02',
      clinic_id: clinicId,
      name: 'Amoxicillin 500mg',
      generic_name: 'Amoxicillin',
      barcode: '8889876543210',
      category: 'Capsule',
      box_qty: 0,
      strip_per_box: 5,
      tablet_per_strip: 10,
      total_tablets: 15, // base unit stock (low stock alert will trigger)
      reorder_level: 30,
      purchase_price: 3500,
      selling_price_per_tab: 80,
      expiry_date: '2026-09-30',
      batches: [
        { batchNumber: 'B-AMOX-01', expiryDate: '2026-09-30', costPrice: 48, quantityOnHand: 15 }
      ]
    });

    // 5. Create Bookings (Today)
    const todayStr = new Date().toISOString().split('T')[0];
    await db.save('bookings', {
      id: 'BK-01',
      clinic_id: clinicId,
      patient_id: pat1Id,
      doctor_id: doc1Id,
      date: todayStr,
      time_slot: '09:00 AM',
      status: 'checked_in', // Triage done, waiting for consultation
      notes: 'Monthly blood pressure follow-up.'
    });

    // Set triage data for Booking 1
    await db.save('triage', {
      id: 'TR-01',
      clinic_id: clinicId,
      booking_id: 'BK-01',
      patient_id: pat1Id,
      bp_sys: 140,
      bp_dia: 90,
      pulse: 82,
      temperature: 98.6,
      resp_rate: 18,
      spo2: 98,
      weight: 72,
      recorded_by: 'Assistant Hein',
      timestamp: new Date().toISOString()
    });

    await db.save('bookings', {
      id: 'BK-02',
      clinic_id: clinicId,
      patient_id: pat2Id,
      doctor_id: doc2Id,
      date: todayStr,
      time_slot: '10:15 AM',
      status: 'scheduled', // Just scheduled
      notes: 'Running nose and mild fever.'
    });

    alert('Demo clinic data seeded successfully! Refreshing dashboard.');
    window.dispatchEvent(new Event('aura_data_mutated'));
    loadDashboardData();
  };

  return (
    <div>
      {/* Upper header segment */}
      <header className="flex-wrap-safe no-print" style={{ justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '800' }}>Clinic Workspace Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Clinic Mode: <strong style={{ color: 'var(--primary)' }}>{clinicMode.replace('_', ' ').toUpperCase()}</strong> | Role: <strong>{userRole.toUpperCase()}</strong>
          </p>
        </div>
        
        <div className="flex-wrap-safe">
          <button onClick={seedDemoData} className="btn btn-secondary">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '16px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Seed Demo Data
          </button>
          
          <button onClick={handleSync} className="btn btn-primary" disabled={isSyncing}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ 
              width: '16px', 
              animation: isSyncing ? 'spin 1.5s linear infinite' : 'none'
            }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
            </svg>
            {isSyncing ? 'Syncing...' : 'Cloud Sync'}
          </button>
        </div>
      </header>

      {/* Stats Counter Row */}
      <div className="dashboard-stats-grid">
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'var(--primary-light)', color: 'var(--primary)' }}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '28px', height: '28px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Daily Patient Registrations</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800' }}>{stats.dailyPatients}</div>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'var(--accent-light)', color: 'var(--accent)' }}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '28px', height: '28px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Today's POS Income</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800' }}>{stats.todayIncome.toLocaleString()} Ks</div>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '28px', height: '28px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Active Queue Length</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800' }}>{stats.activeQueue}</div>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'var(--danger-light)', color: 'var(--danger)' }}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '28px', height: '28px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Low Stock Alarms</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800' }}>{stats.lowStock}</div>
          </div>
        </div>
      </div>

      {/* Sync Status bar details */}
      <div className="glass-card" style={{ 
        padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', 
        alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem', fontSize: '0.85rem' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ 
            width: '8px', height: '8px', borderRadius: '50%', 
            backgroundColor: syncStatus.isOnline ? 'var(--accent)' : 'var(--danger)' 
          }} />
          <span style={{ color: 'var(--text-secondary)' }}>
            Network Status: <strong>{syncStatus.isOnline ? 'ONLINE' : 'OFFLINE (Offline-First cache enabled)'}</strong>
          </span>
        </div>
        <div style={{ color: 'var(--text-secondary)' }}>
          Cloud database sync state: <span style={{ textTransform: 'capitalize', fontWeight: '600' }}>{syncStatus.status}</span> | Last isolation sync: <strong>{syncStatus.lastSynced}</strong>
        </div>
      </div>

      {/* Live Patient Flow Queue Panel */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Live Interactive Patient Queue</h2>
          <button onClick={loadDashboardData} className="btn btn-secondary btn-icon">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
            </svg>
          </button>
        </div>

        <div className="table-container">
          {activeBookings.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No active patients registered in the queue today. Use the Quick Actions or Seed Demo Data to start.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Patient ID & Name</th>
                  <th>Contact</th>
                  <th>Assigned Doctor</th>
                  <th>Vitals / Triage</th>
                  <th>Workflow Status</th>
                  <th className="no-print">Quick Action</th>
                </tr>
              </thead>
              <tbody>
                {activeBookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div style={{ fontWeight: '600' }}>{b.patientName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.patient_id}</div>
                    </td>
                    <td>{b.patientPhone}</td>
                    <td>{b.doctorName}</td>
                    <td>
                      {b.status === 'scheduled' ? (
                        <span className="badge badge-pending">Vitals Missing</span>
                      ) : (
                        <span className="badge badge-success">Vitals Recorded</span>
                      )}
                    </td>
                    <td>
                      {b.status === 'scheduled' && <span className="badge badge-pending">Waiting Reception</span>}
                      {b.status === 'checked_in' && <span className="badge badge-active">Waiting Doctor</span>}
                      {b.status === 'in_consultation' && <span className="badge badge-active">In Consultation</span>}
                      {b.status === 'pending_lab' && <span className="badge badge-pending">Investigation Pending</span>}
                      {b.status === 'pending_checkout' && <span className="badge badge-pending">POS Checkout Ready</span>}
                      {b.status === 'completed' && <span className="badge badge-success">Finished & Checked out</span>}
                    </td>
                    <td className="no-print">
                      {b.status === 'scheduled' && (
                        <button 
                          onClick={() => setCurrentTab('appointments')} 
                          className="btn btn-secondary" 
                          style={{ padding: '0.25rem 0.75rem', minHeight: '32px' }}
                        >
                          Perform Triage
                        </button>
                      )}
                      {b.status === 'checked_in' && (
                        <button 
                          onClick={() => setCurrentTab('consultation')} 
                          className="btn btn-primary" 
                          style={{ padding: '0.25rem 0.75rem', minHeight: '32px' }}
                        >
                          Start Consultation
                        </button>
                      )}
                      {b.status === 'pending_lab' && (
                        <button 
                          onClick={() => setCurrentTab('lab')} 
                          className="btn btn-success" 
                          style={{ padding: '0.25rem 0.75rem', minHeight: '32px' }}
                        >
                          Fill Lab Values
                        </button>
                      )}
                      {b.status === 'pending_checkout' && (
                        <button 
                          onClick={() => setCurrentTab('pos')} 
                          className="btn btn-success" 
                          style={{ padding: '0.25rem 0.75rem', minHeight: '32px' }}
                        >
                          Collect Payment
                        </button>
                      )}
                      {b.status === 'completed' && (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No Action Needed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
