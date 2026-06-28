import { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Appointments from './pages/Appointments';
import Consultation from './pages/Consultation';
import LabQueue from './pages/LabQueue';
import Inventory from './pages/Inventory';
import POS from './pages/POS';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Activation from './pages/Activation';
import { verifyLicenseKey } from './utils/LicenseVerifier';
import Auth from './pages/Auth';
import { supabase, isSupabaseConfigured } from './db/supabaseClient';
import { db } from './db/IndexedDB';
import { syncManager } from './db/SyncManager';

function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [clinicMode, setClinicMode] = useState('solo_gp'); // Default to lowest, will be updated by license
  const [userRole, setUserRole] = useState('admin');
  const [theme, setTheme] = useState('light');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [license, setLicense] = useState(null);
  const [licenseLoading, setLicenseLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dutyDoctorId, setDutyDoctorId] = useState(() => {
    return localStorage.getItem('aura_duty_doctor_id') || '';
  });

  // Set initial theme, document attribute, check license, and check auth session
  useEffect(() => {
    const savedTheme = localStorage.getItem('aura_theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
    checkLicense();

    async function checkAuth() {
      if (localStorage.getItem('e2e_test_mode') === 'true') {
        setCurrentUser({ email: 'test@clinic.com', user_metadata: { clinic_id: 'test_clinic' } });
        setAuthLoading(false);
        return;
      }
      if (isSupabaseConfigured()) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          setCurrentUser(session?.user || null);
          
          if (session?.user) {
            const userClinicId = session.user.user_metadata?.clinic_id || 'CL-MED-DEFAULT';
            localStorage.setItem('aura_clinic_config', JSON.stringify({ clinic_id: userClinicId }));
          }
        } catch (err) {
          console.warn('Supabase Auth connection issue:', err.message);
        }
      }
      setAuthLoading(false);
    }
    checkAuth();

    let authListener = null;
    if (isSupabaseConfigured() && localStorage.getItem('e2e_test_mode') !== 'true') {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setCurrentUser(session?.user || null);
        if (session?.user) {
          const userClinicId = session.user.user_metadata?.clinic_id || 'CL-MED-DEFAULT';
          localStorage.setItem('aura_clinic_config', JSON.stringify({ clinic_id: userClinicId }));
        }
      });
      authListener = subscription;
    }

    return () => {
      if (authListener) authListener.unsubscribe();
    };
  }, []);

  const checkLicense = async () => {
    const activeKey = localStorage.getItem('medflow_activation_key');
    if (activeKey) {
      const result = await verifyLicenseKey(activeKey);
      if (result && result.status === 'active') {
        setLicense(result);
        setClinicMode(result.scale);
      } else {
        setLicense(null);
      }
    } else {
      setLicense(null);
    }
    setLicenseLoading(false);
  };

  // Load doctors for active duty assignment
  useEffect(() => {
    loadDoctors();
  }, [clinicMode]);

  useEffect(() => {
    const handleMutatedData = () => {
      loadDoctors();
      checkLicense();
    };
    window.addEventListener('aura_data_mutated', handleMutatedData);
    return () => window.removeEventListener('aura_data_mutated', handleMutatedData);
  }, []);

  const loadDoctors = async () => {
    try {
      const list = await db.getAll('doctors');
      const clinicId = syncManager.getClinicId();
      const filtered = list.filter(d => d.clinic_id === clinicId);
      setDoctors(filtered);
      
      const savedDuty = localStorage.getItem('aura_duty_doctor_id');
      if (!savedDuty && filtered.length > 0) {
        setDutyDoctorId(filtered[0].id);
        localStorage.setItem('aura_duty_doctor_id', filtered[0].id);
      } else if (savedDuty) {
        // Double check if the saved doctor ID still exists in the registry
        const exists = filtered.some(d => d.id === savedDuty);
        if (exists) {
          setDutyDoctorId(savedDuty);
        } else if (filtered.length > 0) {
          setDutyDoctorId(filtered[0].id);
          localStorage.setItem('aura_duty_doctor_id', filtered[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading doctors in App.jsx:', err);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('aura_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Adjust roles automatically when clinic mode changes
  const handleClinicModeChange = (mode) => {
    setClinicMode(mode);
    if (mode === 'solo_gp') {
      setUserRole('admin');
    } else if (mode === 'standard_gp') {
      setUserRole('doctor');
    } else {
      setUserRole('receptionist');
    }
    setCurrentTab('dashboard');
  };

  const isScaleAllowed = (scaleOption) => {
    if (!license) return false;
    const tiers = { 'solo_gp': 1, 'standard_gp': 2, 'medium_clinic': 3 };
    return tiers[scaleOption] <= tiers[license.scale];
  };

  if (licenseLoading || (license && license.scale === 'medium_clinic' && authLoading && isSupabaseConfigured())) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b1329',
        color: '#f8fafc',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          <img src="./logo.png" alt="Medflow Logo" style={{ width: '80px', height: '80px', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#94a3b8' }}>Loading Medflow Clinical Space...</h2>
        </div>
      </div>
    );
  }

  if (!license) {
    return <Activation onActivated={(lic) => { setLicense(lic); setClinicMode(lic.scale); }} />;
  }

  if (clinicMode === 'medium_clinic' && !currentUser && isSupabaseConfigured()) {
    return <Auth onAuthSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="app-layout">
      {/* Mobile Top Header Navigation */}
      <div className="mobile-nav-toggle no-print">
        <button className="mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '28px', height: '28px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img src="./logo.png" alt="Medflow Logo" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
          <span className="sidebar-logo" style={{ fontSize: '1.2rem', fontWeight: '800' }}>Medflow</span>
        </div>
        <button onClick={toggleTheme} className="mobile-menu-btn">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Side Navigation panel */}
      <Navigation 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        userRole={userRole}
        setUserRole={setUserRole}
        clinicMode={clinicMode}
        theme={theme}
        toggleTheme={toggleTheme}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main workspace frame */}
      <main className="main-content">
        
        {/* Dynamic Clinic Setup Config Switcher (Sticky top-bar on desktop) */}
        <div className="top-control-bar no-print">
          {/* Duty Doctor Selector for Solo and Standard GP scales */}
          {(clinicMode === 'solo_gp' || clinicMode === 'standard_gp') && (
            <div className="control-item">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                Active Physician on Duty:
              </span>
              <select 
                value={dutyDoctorId} 
                onChange={(e) => {
                  setDutyDoctorId(e.target.value);
                  localStorage.setItem('aura_duty_doctor_id', e.target.value);
                  window.dispatchEvent(new Event('aura_data_mutated')); // Notify other pages
                }}
                style={{ width: 'auto', padding: '0.35rem 1rem', minHeight: '34px', fontSize: '0.85rem', borderColor: 'var(--primary)' }}
              >
                {doctors.length === 0 ? (
                   <option value="">-- No Doctors Registered --</option>
                ) : (
                  doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>
                  ))
                )}
              </select>
            </div>
          )}

          <div className="control-item">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
              Change Clinic Scale Model:
            </span>
            <select 
              value={clinicMode} 
              onChange={(e) => handleClinicModeChange(e.target.value)}
              style={{ width: 'auto', padding: '0.35rem 1rem', minHeight: '34px', fontSize: '0.85rem' }}
            >
              {isScaleAllowed('solo_gp') && (
                <option value="solo_gp">1. Solo Practitioner (Doctor does everything)</option>
              )}
              {isScaleAllowed('standard_gp') && (
                <option value="standard_gp">2. Standard GP (Doctor + Assistant)</option>
              )}
              {isScaleAllowed('medium_clinic') && (
                <option value="medium_clinic">3. Medium Multi-Department Clinic (Full Staff)</option>
              )}
            </select>
          </div>
        </div>

        {/* Render Active Page Content */}
        {currentTab === 'dashboard' && (
          <Dashboard setCurrentTab={setCurrentTab} clinicMode={clinicMode} userRole={userRole} />
        )}
        {currentTab === 'patients' && <Patients />}
        {currentTab === 'appointments' && (
          <Appointments clinicMode={clinicMode} dutyDoctorId={dutyDoctorId} />
        )}
        {currentTab === 'consultation' && (
          <Consultation clinicMode={clinicMode} dutyDoctorId={dutyDoctorId} />
        )}
        {currentTab === 'lab' && <LabQueue />}
        {currentTab === 'inventory' && <Inventory />}
        {currentTab === 'pos' && (
          <POS clinicMode={clinicMode} dutyDoctorId={dutyDoctorId} />
        )}
        {currentTab === 'reports' && <Reports />}
        {currentTab === 'settings' && <Settings />}
      </main>
    </div>
  );
}

export default App;
