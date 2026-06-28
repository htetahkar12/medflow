import React, { useState, useEffect } from 'react';
import { db } from '../db/IndexedDB';

export default function Navigation({ 
  currentTab, 
  setCurrentTab, 
  userRole, 
  setUserRole, 
  clinicMode, 
  theme, 
  toggleTheme,
  mobileOpen,
  setMobileOpen
}) {
  const [clinicConfig, setClinicConfig] = useState(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await db.get('settings', 'clinic_config');
        setClinicConfig(config);
      } catch (e) {
        console.error('Failed to load clinic config in Nav:', e);
      }
    };
    loadConfig();
    
    // Auto-update clinic name instantly if changed in settings
    const handleMutation = () => loadConfig();
    window.addEventListener('aura_data_mutated', handleMutation);
    return () => window.removeEventListener('aura_data_mutated', handleMutation);
  }, []);
  
  // Icon SVG paths
  const icons = {
    dashboard: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
      </svg>
    ),
    patients: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    appointments: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    consultation: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    lab: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    inventory: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    pos: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    reports: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    settings: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  };

  // Define menu items and sub-systems mapping
  const menuConfig = [
    { id: 'dashboard', label: 'Dashboard', icon: icons.dashboard, roles: ['admin', 'doctor', 'assistant', 'receptionist', 'pharmacist', 'lab_tech', 'cashier'] },
    { id: 'patients', label: 'Patients', icon: icons.patients, roles: ['admin', 'doctor', 'assistant', 'receptionist'] },
    { id: 'appointments', label: 'Queue & Booking', icon: icons.appointments, roles: ['admin', 'assistant', 'receptionist'] },
    { id: 'consultation', label: 'Doctor EMR', icon: icons.consultation, roles: ['admin', 'doctor'] },
    { id: 'lab', label: 'Lab & Radiology', icon: icons.lab, roles: ['admin', 'lab_tech'] },
    { id: 'inventory', label: 'Pharmacy & Stock', icon: icons.inventory, roles: ['admin', 'assistant', 'pharmacist'] },
    { id: 'pos', label: 'Billing POS', icon: icons.pos, roles: ['admin', 'assistant', 'cashier'] },
    { id: 'reports', label: 'Reports & Stats', icon: icons.reports, roles: ['admin', 'assistant', 'cashier'] },
    { id: 'settings', label: 'Clinic Settings', icon: icons.settings, roles: ['admin'] }
  ];

  // If clinic mode is Solo GP, force Admin role (allows everything)
  const activeRole = clinicMode === 'solo_gp' ? 'admin' : userRole;

  // Filter menu items by active role
  const visibleMenuItems = menuConfig.filter(item => item.roles.includes(activeRole));

  return (
    <>
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Sidebar Logo Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="./logo.png" alt="Medflow Logo" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
            <span className="sidebar-logo">Medflow</span>
          </div>
          <button 
            onClick={() => setMobileOpen(false)}
            className="mobile-close-btn"
            title="Hide Navigation Sidebar"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#fff',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              transition: 'background 0.2s'
            }}
          >
            ✕
          </button>
        </div>

        {/* Dynamic Clinic Name Display */}
        {clinicConfig?.clinic_name && (
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--primary)', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              🏢 {clinicConfig.clinic_name}
            </span>
          </div>
        )}

        {/* Dynamic Role / Clinic Mode configuration switcher in Sidebar */}
        <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <label style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            User Role Profile
          </label>
          {clinicMode === 'solo_gp' ? (
            <div style={{ 
              color: '#34d399', fontSize: '0.85rem', fontWeight: '600', 
              padding: '0.5rem', background: 'rgba(52, 211, 153, 0.1)', borderRadius: '6px', marginTop: '0.25rem' 
            }}>
              Solo Doctor GP (Full Admin)
            </div>
          ) : (
            <select 
              value={userRole} 
              onChange={(e) => {
                setUserRole(e.target.value);
                setMobileOpen(false);
              }}
              style={{
                width: '100%', padding: '0.5rem', background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff', borderRadius: '8px', marginTop: '0.25rem', fontSize: '0.85rem'
              }}
            >
              {clinicMode === 'standard_gp' ? (
                <>
                  <option value="doctor">Doctor</option>
                  <option value="assistant">Assistant</option>
                </>
              ) : (
                <>
                  <option value="admin">Administrator (Owner)</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="doctor">Doctor (EMR)</option>
                  <option value="lab_tech">Lab & X-Ray</option>
                  <option value="pharmacist">Pharmacist</option>
                  <option value="cashier">Cashier / POS</option>
                </>
              )}
            </select>
          )}
        </div>

        <ul className="sidebar-menu">
          {visibleMenuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => {
                  setCurrentTab(item.id);
                  setMobileOpen(false);
                }}
                className={`sidebar-item ${currentTab === item.id ? 'active' : ''}`}
                style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left' }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>

        {/* Footer utilities: theme toggle, last sync indicator */}
        <div style={{ 
          padding: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', 
          display: 'flex', flexDirection: 'column', gap: '0.75rem' 
        }}>
          <button 
            onClick={toggleTheme}
            className="btn btn-secondary"
            style={{ 
              width: '100%', background: 'rgba(255, 255, 255, 0.05)', 
              color: '#fff', borderColor: 'rgba(255, 255, 255, 0.1)', minHeight: '38px' 
            }}
          >
            {theme === 'dark' ? (
              <>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px', marginRight: '6px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m2.828 0l-.707-.707m2.828-11.314l-.707-.707M12 5a7 7 0 000 14 7 7 0 000-14z" />
                </svg>
                Light Mode
              </>
            ) : (
              <>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px', marginRight: '6px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                Dark Mode
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Screen reader / backdrop overlay when mobile drawer is open */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 98
          }}
        />
      )}
    </>
  );
}
