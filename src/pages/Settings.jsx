import React, { useState, useEffect } from 'react';
import { db } from '../db/IndexedDB';
import { syncManager } from '../db/SyncManager';
import { supabase, isSupabaseConfigured } from '../db/supabaseClient';
import { getDeviceUuid } from '../utils/LicenseVerifier';

export default function Settings() {
  const [clinicConfig, setClinicConfig] = useState({
    clinic_name: 'AURA CLINIC',
    address: 'Yangon, Myanmar',
    phone: '09-xxxxxxxxx',
    email: 'info@auraclinic.com',
    logo_base64: ''
  });
  
  const [doctorsList, setDoctorsList] = useState([]);
  const [labOptions, setLabOptions] = useState([]);
  const [radOptions, setRadOptions] = useState([]);
  const [servicesOptions, setServicesOptions] = useState([]);

  // License and Auth states
  const [licenseData, setLicenseData] = useState(null);
  const [deviceUuid, setDeviceUuid] = useState('');
  const [cloudUser, setCloudUser] = useState(null);

  // Form states
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [doctorForm, setDoctorForm] = useState({
    name: '',
    qualification: '',
    rank: '',
    specialty: 'General Physician',
    fees: 10000,
    paymentType: 'percentage',
    paymentValue: 70
  });

  const [newLabTest, setNewLabTest] = useState('');
  const [newLabTestFee, setNewLabTestFee] = useState(5000);
  const [newRadTest, setNewRadTest] = useState('');
  const [newRadTestFee, setNewRadTestFee] = useState(12000);
  const [newService, setNewService] = useState('');
  const [newServiceFee, setNewServiceFee] = useState(3000);

  useEffect(() => {
    loadSettings();
    loadLicenseAndAuth();
  }, []);

  const loadLicenseAndAuth = async () => {
    try {
      const uuid = await getDeviceUuid();
      setDeviceUuid(uuid);

      const activeKey = localStorage.getItem('medflow_activation_key');
      if (activeKey) {
        try {
          const payload = JSON.parse(window.atob(activeKey.split('.')[0]));
          setLicenseData(payload);
        } catch (e) {}
      }

      if (isSupabaseConfigured()) {
        const { data: { session } } = await supabase.auth.getSession();
        setCloudUser(session?.user || null);
      }
    } catch (err) {
      console.error('Error loading license metadata in settings:', err);
    }
  };

  const handleDeactivate = () => {
    if (confirm('Are you sure you want to deactivate and remove your license key?')) {
      localStorage.removeItem('medflow_activation_key');
      localStorage.removeItem('medflow_last_run');
      window.dispatchEvent(new Event('aura_data_mutated'));
      window.location.reload();
    }
  };

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out from the cloud?')) {
      await supabase.auth.signOut();
      localStorage.removeItem('aura_clinic_config');
      window.dispatchEvent(new Event('aura_data_mutated'));
      window.location.reload();
    }
  };

  const loadSettings = async () => {
    try {
      const clinicId = syncManager.getClinicId();

      // Load clinic configurations
      const config = await db.get('settings', 'clinic_config');
      if (config) {
        setClinicConfig({
          clinic_name: config.clinic_name || 'AURA CLINIC',
          address: config.address || 'Yangon, Myanmar',
          phone: config.phone || '09-xxxxxxxxx',
          email: config.email || '',
          logo_base64: config.logo_base64 || ''
        });
      }

      // Load investigations catalog
      const catalog = await db.get('settings', 'investigations_catalog');
      if (catalog) {
        setLabOptions(catalog.labOptions || []);
        setRadOptions(catalog.radOptions || []);
        setServicesOptions(catalog.servicesOptions || []);
      } else {
        // Fallback defaults
        const defaultLab = [
          { name: 'CBC (Blood Count)', default_fee: 5000 },
          { name: 'Lipid Profile', default_fee: 8000 },
          { name: 'LFT (Liver)', default_fee: 12000 },
          { name: 'KFT (Kidney)', default_fee: 12000 },
          { name: 'FBS (Blood Sugar)', default_fee: 4000 }
        ];
        const defaultRad = [
          { name: 'Chest X-Ray', default_fee: 12000 },
          { name: 'USG Abdomen & Pelvis', default_fee: 15000 },
          { name: 'CT Brain', default_fee: 45000 },
          { name: 'MRI Spine', default_fee: 85000 }
        ];
        const defaultServices = [
          { name: 'Dressing (Small/Medium)', default_fee: 3000 },
          { name: 'Nebulization', default_fee: 5000 },
          { name: 'IM Injection Administration', default_fee: 2000 },
          { name: 'IV Infusion Saline Setup', default_fee: 10000 }
        ];
        setLabOptions(defaultLab);
        setRadOptions(defaultRad);
        setServicesOptions(defaultServices);
        await db.save('settings', {
          id: 'investigations_catalog',
          labOptions: defaultLab,
          radOptions: defaultRad,
          servicesOptions: defaultServices
        });
      }

      // Load registered doctors
      const docs = await db.getAll('doctors');
      setDoctorsList(docs.filter(d => d.clinic_id === clinicId));
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const clinicId = syncManager.getClinicId();
      await db.save('settings', {
        id: 'clinic_config',
        clinic_id: clinicId,
        clinic_name: clinicConfig.clinic_name,
        address: clinicConfig.address,
        phone: clinicConfig.phone,
        email: clinicConfig.email,
        logo_base64: clinicConfig.logo_base64
      });
      window.dispatchEvent(new Event('aura_data_mutated'));
      alert('Clinic Profile configurations saved successfully!');
    } catch (err) {
      console.error(err);
    }
  };

  const openAddDoctor = () => {
    setEditingDoctor(null);
    setDoctorForm({
      name: '',
      qualification: '',
      rank: '',
      specialty: 'General Physician',
      fees: 10000,
      paymentType: 'percentage',
      paymentValue: 70
    });
    setShowDoctorModal(true);
  };

  const openEditDoctor = (doc) => {
    setEditingDoctor(doc);
    setDoctorForm({
      name: doc.name,
      qualification: doc.qualification || '',
      rank: doc.rank || '',
      specialty: doc.specialty || 'General Physician',
      fees: doc.fees || 10000,
      paymentType: doc.paymentType || 'percentage',
      paymentValue: doc.paymentValue || 70
    });
    setShowDoctorModal(true);
  };

  const handleSaveDoctor = async (e) => {
    e.preventDefault();
    if (!doctorForm.name) {
      alert('Please enter doctor name.');
      return;
    }

    try {
      const clinicId = syncManager.getClinicId();
      let docId = editingDoctor ? editingDoctor.id : '';
      
      if (!docId) {
        // Generate new ID
        const list = await db.getAll('doctors');
        docId = `DOC-${(list.length + 1).toString().padStart(2, '0')}`;
      }

      const docRecord = {
        id: docId,
        clinic_id: clinicId,
        name: doctorForm.name,
        qualification: doctorForm.qualification,
        rank: doctorForm.rank,
        specialty: doctorForm.specialty,
        fees: Number(doctorForm.fees) || 0,
        paymentType: doctorForm.paymentType,
        paymentValue: Number(doctorForm.paymentValue) || 0
      };

      await db.save('doctors', docRecord);
      setShowDoctorModal(false);
      window.dispatchEvent(new Event('aura_data_mutated'));
      loadSettings();
      alert(`Doctor Profile saved successfully!`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDoctor = async (docId) => {
    if (!confirm('Are you sure you want to delete this doctor?')) return;
    try {
      await db.delete('doctors', docId);
      window.dispatchEvent(new Event('aura_data_mutated'));
      loadSettings();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddLabTest = async (e) => {
    e.preventDefault();
    if (!newLabTest.trim()) return;
    try {
      const newTestObj = { name: newLabTest.trim(), default_fee: Number(newLabTestFee) || 5000 };
      const updated = [...labOptions, newTestObj];
      setLabOptions(updated);
      await db.save('settings', {
        id: 'investigations_catalog',
        labOptions: updated,
        radOptions,
        servicesOptions
      });
      setNewLabTest('');
      setNewLabTestFee(5000);
      window.dispatchEvent(new Event('aura_data_mutated'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLabTest = async (testName) => {
    if (!confirm(`Delete test "${testName}" from catalog?`)) return;
    try {
      const updated = labOptions.filter(t => t.name !== testName);
      setLabOptions(updated);
      await db.save('settings', {
        id: 'investigations_catalog',
        labOptions: updated,
        radOptions,
        servicesOptions
      });
      window.dispatchEvent(new Event('aura_data_mutated'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRadTest = async (e) => {
    e.preventDefault();
    if (!newRadTest.trim()) return;
    try {
      const newTestObj = { name: newRadTest.trim(), default_fee: Number(newRadTestFee) || 12000 };
      const updated = [...radOptions, newTestObj];
      setRadOptions(updated);
      await db.save('settings', {
        id: 'investigations_catalog',
        labOptions,
        radOptions: updated,
        servicesOptions
      });
      setNewRadTest('');
      setNewRadTestFee(12000);
      window.dispatchEvent(new Event('aura_data_mutated'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRadTest = async (testName) => {
    if (!confirm(`Delete imaging "${testName}" from catalog?`)) return;
    try {
      const updated = radOptions.filter(t => t.name !== testName);
      setRadOptions(updated);
      await db.save('settings', {
        id: 'investigations_catalog',
        labOptions,
        radOptions: updated,
        servicesOptions
      });
      window.dispatchEvent(new Event('aura_data_mutated'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    if (!newService.trim()) return;
    try {
      const newSrvObj = { name: newService.trim(), default_fee: Number(newServiceFee) || 3000 };
      const updated = [...servicesOptions, newSrvObj];
      setServicesOptions(updated);
      await db.save('settings', {
        id: 'investigations_catalog',
        labOptions,
        radOptions,
        servicesOptions: updated
      });
      setNewService('');
      setNewServiceFee(3000);
      window.dispatchEvent(new Event('aura_data_mutated'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteService = async (serviceName) => {
    if (!confirm(`Delete clinic service "${serviceName}" from catalog?`)) return;
    try {
      const updated = servicesOptions.filter(s => s.name !== serviceName);
      setServicesOptions(updated);
      await db.save('settings', {
        id: 'investigations_catalog',
        labOptions,
        radOptions,
        servicesOptions: updated
      });
      window.dispatchEvent(new Event('aura_data_mutated'));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <header className="flex-wrap-safe no-print" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '800' }}>Clinic Settings & Master Catalogs</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Configure clinic metadata, register doctors, set pay commissions, and customize lab test options</p>
        </div>
      </header>

      <div className="responsive-card-grid no-print">
        
        {/* Left Card: Clinic Profile Configurations */}
        <div className="glass-card" style={{ alignSelf: 'start' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            🏥 Clinic Profile Information
          </h2>
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Logo Upload */}
            <div className="form-group">
              <label>Clinic Custom Logo (Header & Letterhead)</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={e => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setClinicConfig(prev => ({ ...prev, logo_base64: reader.result }));
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                style={{ padding: '0.35rem 0.5rem', minHeight: 'auto' }}
              />
              {clinicConfig.logo_base64 && (
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-app)', padding: '0.5rem', borderRadius: '8px' }}>
                  <img 
                    src={clinicConfig.logo_base64} 
                    alt="Clinic Logo Preview" 
                    style={{ maxHeight: '45px', maxWidth: '120px', objectFit: 'contain' }} 
                  />
                  <button 
                    type="button"
                    onClick={() => setClinicConfig(prev => ({ ...prev, logo_base64: '' }))}
                    className="btn btn-danger"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', minHeight: '26px' }}
                  >
                    Remove Logo
                  </button>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Clinic Trade Name</label>
              <input 
                type="text"
                required
                value={clinicConfig.clinic_name}
                onChange={e => setClinicConfig({ ...clinicConfig, clinic_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Clinic Phone Contact</label>
              <input 
                type="text"
                required
                value={clinicConfig.phone}
                onChange={e => setClinicConfig({ ...clinicConfig, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Clinic Email (Optional)</label>
              <input 
                type="email"
                placeholder="e.g. info@clinic.com"
                value={clinicConfig.email || ''}
                onChange={e => setClinicConfig({ ...clinicConfig, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Physical Address</label>
              <textarea 
                rows={3}
                required
                value={clinicConfig.address}
                onChange={e => setClinicConfig({ ...clinicConfig, address: e.target.value })}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end', marginTop: '0.5rem' }}>
              Save Config Profile
            </button>
          </form>
        </div>

        {/* Monetization & Cloud Sync Management */}
        <div className="glass-card" style={{ alignSelf: 'start', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            🔑 License & Cloud Administration
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>License Holder:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{licenseData?.clinicName || 'N/A'}</strong>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Workflow Tier:</span>
              <strong style={{ color: 'var(--primary)' }}>
                {licenseData?.scale === 'solo_gp' && 'Solo Practitioner GP'}
                {licenseData?.scale === 'standard_gp' && 'Standard Doctor + Assistant'}
                {licenseData?.scale === 'medium_clinic' && 'Medium Multi-Department'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Expiry Date:</span>
              <strong style={{ color: '#cbd5e1' }}>
                {licenseData?.expiry ? new Date(licenseData.expiry).toLocaleDateString() : 'N/A'}
              </strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Hardware Footprint ID:</span>
              <code style={{ fontSize: '0.75rem', wordBreak: 'break-all', color: 'var(--accent)' }}>{deviceUuid}</code>
            </div>

            {isSupabaseConfigured() && cloudUser && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Cloud Connected:</span>
                <strong style={{ color: 'var(--accent)' }}>{cloudUser.email}</strong>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button 
              type="button" 
              onClick={handleDeactivate} 
              className="btn btn-danger" 
              style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', minHeight: '34px' }}
            >
              Deactivate License
            </button>
            {isSupabaseConfigured() && cloudUser && (
              <button 
                type="button" 
                onClick={handleSignOut} 
                className="btn btn-secondary" 
                style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', minHeight: '34px' }}
              >
                Sign Out Cloud
              </button>
            )}
          </div>
        </div>

        {/* Right Card: Doctor Registry Setup */}
        <div className="glass-card full-width-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>👨‍⚕️ Registered Doctors & Payout Commissions</h2>
            <button onClick={openAddDoctor} className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', minHeight: '34px', fontSize: '0.8rem' }}>
              + Add Doctor
            </button>
          </div>

          <div className="table-container">
            {doctorsList.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No doctors registered. Click button above to add.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Doctor Name</th>
                    <th>Specialty</th>
                    <th>Default Fee</th>
                    <th>Payout Commission Structure</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {doctorsList.map(doc => (
                    <tr key={doc.id}>
                      <td>
                        <strong>{doc.name}</strong>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>ID: {doc.id}</div>
                      </td>
                      <td>{doc.specialty}</td>
                      <td>{(doc.fees || 0).toLocaleString()} Ks</td>
                      <td>
                        {doc.paymentType === 'percentage' ? (
                          <span className="badge badge-active">{doc.paymentValue}% Commission Split</span>
                        ) : (
                          <span className="badge badge-success">{(doc.paymentValue || 0).toLocaleString()} Ks Flat Payout</span>
                        )}
                      </td>
                      <td style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => openEditDoctor(doc)} 
                          className="btn btn-secondary" 
                          style={{ padding: '0.2rem 0.5rem', minHeight: '28px', fontSize: '0.75rem' }}
                        >
                          ✏️ Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteDoctor(doc.id)} 
                          className="btn btn-danger" 
                          style={{ padding: '0.2rem 0.5rem', minHeight: '28px', fontSize: '0.75rem' }}
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Bottom Card: Lab Tests Catalog */}
        <div className="glass-card">
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            🔬 Laboratory Tests Catalog
          </h2>
          <form onSubmit={handleAddLabTest} className="catalog-form">
            <input 
              type="text" 
              placeholder="Lab test name (e.g. Widal)" 
              value={newLabTest}
              onChange={e => setNewLabTest(e.target.value)}
              style={{ flex: '2 1 180px', minHeight: '38px', padding: '0.35rem' }}
            />
            <input 
              type="number" 
              placeholder="Fee (Ks)" 
              value={newLabTestFee}
              onChange={e => setNewLabTestFee(e.target.value)}
              style={{ flex: '1 1 100px', minHeight: '38px', padding: '0.35rem' }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', minHeight: '38px', flexShrink: 0 }}>
              + Add
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
            {labOptions.map(test => (
              <div 
                key={test.name} 
                style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  background: 'var(--bg-app)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' 
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{test.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{(test.default_fee || 0).toLocaleString()} Ks</span>
                </div>
                <button 
                  onClick={() => handleDeleteLabTest(test.name)} 
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Card: Radiology & Imaging Catalog */}
        <div className="glass-card">
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            📷 Radiology & Imaging Catalog
          </h2>
          <form onSubmit={handleAddRadTest} className="catalog-form">
            <input 
              type="text" 
              placeholder="Imaging name (e.g. Pelvic USG)" 
              value={newRadTest}
              onChange={e => setNewRadTest(e.target.value)}
              style={{ flex: '2 1 180px', minHeight: '38px', padding: '0.35rem' }}
            />
            <input 
              type="number" 
              placeholder="Fee (Ks)" 
              value={newRadTestFee}
              onChange={e => setNewRadTestFee(e.target.value)}
              style={{ flex: '1 1 100px', minHeight: '38px', padding: '0.35rem' }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', minHeight: '38px', flexShrink: 0 }}>
              + Add
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
            {radOptions.map(test => (
              <div 
                key={test.name} 
                style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  background: 'var(--bg-app)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' 
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{test.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{(test.default_fee || 0).toLocaleString()} Ks</span>
                </div>
                <button 
                  onClick={() => handleDeleteRadTest(test.name)} 
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Card: Clinic Services Catalog */}
        <div className="glass-card">
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            💉 Clinic Services Catalog
          </h2>
          <form onSubmit={handleAddService} className="catalog-form">
            <input 
              type="text" 
              placeholder="Service name (e.g. Nebulization)" 
              value={newService}
              onChange={e => setNewService(e.target.value)}
              style={{ flex: '2 1 180px', minHeight: '38px', padding: '0.35rem' }}
            />
            <input 
              type="number" 
              placeholder="Fee (Ks)" 
              value={newServiceFee}
              onChange={e => setNewServiceFee(e.target.value)}
              style={{ flex: '1 1 100px', minHeight: '38px', padding: '0.35rem' }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', minHeight: '38px', flexShrink: 0 }}>
              + Add
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
            {servicesOptions.map(srv => (
              <div 
                key={srv.name} 
                style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  background: 'var(--bg-app)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' 
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{srv.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{(srv.default_fee || 0).toLocaleString()} Ks</span>
                </div>
                <button 
                  onClick={() => handleDeleteService(srv.name)} 
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Doctor Registration/Edit Modal */}
      {showDoctorModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>{editingDoctor ? 'Edit Doctor Profile' : 'Register New Doctor'}</h3>
              <button className="mobile-menu-btn" onClick={() => setShowDoctorModal(false)} style={{ color: 'var(--text-primary)' }}>✕</button>
            </div>
            
            <form onSubmit={handleSaveDoctor}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Dr. Zaw Min"
                    value={doctorForm.name}
                    onChange={e => setDoctorForm({ ...doctorForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Medical Qualifications (Degrees) (Optional)</label>
                  <input 
                    type="text"
                    placeholder="e.g. M.B.,B.S (Ygn), M.Med.Sc (Pediatrics)"
                    value={doctorForm.qualification || ''}
                    onChange={e => setDoctorForm({ ...doctorForm, qualification: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Official Rank / Title (Optional)</label>
                  <input 
                    type="text"
                    placeholder="e.g. Consultant Physician, Senior GP"
                    value={doctorForm.rank || ''}
                    onChange={e => setDoctorForm({ ...doctorForm, rank: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Specialty / Department *</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Pediatrician, General Practitioner"
                    value={doctorForm.specialty}
                    onChange={e => setDoctorForm({ ...doctorForm, specialty: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Default Consultation Fee (Ks) *</label>
                  <input 
                    type="number"
                    required
                    value={doctorForm.fees}
                    onChange={e => setDoctorForm({ ...doctorForm, fees: e.target.value })}
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Commission Payout Type</label>
                    <select 
                      value={doctorForm.paymentType} 
                      onChange={e => setDoctorForm({ ...doctorForm, paymentType: e.target.value })}
                    >
                      <option value="percentage">Percentage (%) split</option>
                      <option value="flat">Flat payout per visit (Ks)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Payout Rate Value *</label>
                    <input 
                      type="number"
                      required
                      placeholder={doctorForm.paymentType === 'percentage' ? 'e.g. 70' : 'e.g. 5000'}
                      value={doctorForm.paymentValue}
                      onChange={e => setDoctorForm({ ...doctorForm, paymentValue: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" onClick={() => setShowDoctorModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Doctor Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
