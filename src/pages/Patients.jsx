import React, { useState, useEffect } from 'react';
import { db } from '../db/IndexedDB';
import { syncManager } from '../db/SyncManager';
import PatientIDCard from '../components/PatientIDCard';
import ClinicalReportPDF from '../components/ClinicalReportPDF';

const MaleSilhouette = () => (
  <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', display: 'block', background: '#38bdf8' }}>
    <circle cx="50" cy="40" r="18" fill="#e0f2fe" />
    <path d="M50 62 c-20 0, -25 8, -25 18 l50 0 c0 -10, -5 -18, -25 -18 Z" fill="#e0f2fe" />
  </svg>
);

const FemaleSilhouette = () => (
  <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', display: 'block', background: '#f472b6' }}>
    <circle cx="50" cy="42" r="16" fill="#fce7f3" />
    <path d="M50 20 c-14 0, -18 10, -18 24 c0 10, 3 14, 3 14 c5 -4, 5 -12, 15 -12 s10 8, 15 12 c0 0, 3 -4, 3 -14 c0 -14, -4 -24, -18 -24 Z" fill="#db2777" />
    <path d="M50 64 c-18 0, -23 8, -23 16 l46 0 c0 -8, -5 -16, -23 -16 Z" fill="#fce7f3" />
  </svg>
);

const calculatePatientCurrentAge = (patient) => {
  if (!patient) return 0;
  if (patient.dob) {
    const parts = patient.dob.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const birthDate = new Date(year, month, day);
      if (!isNaN(birthDate.getTime())) {
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age >= 0 ? age : 0;
      }
    }
  }
  
  if (patient.age !== undefined && patient.created_at) {
    const regDate = new Date(patient.created_at);
    const today = new Date();
    const diffYears = today.getFullYear() - regDate.getFullYear();
    const m = today.getMonth() - regDate.getMonth();
    let ageAdd = diffYears;
    if (m < 0 || (m === 0 && today.getDate() < regDate.getDate())) {
      ageAdd--;
    }
    return Math.max(0, patient.age + (ageAdd > 0 ? ageAdd : 0));
  }
  
  return patient.age || 0;
};

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientConsultations, setPatientConsultations] = useState([]);
  const [clinicConfig, setClinicConfig] = useState(null);
  
  // Registration Form
  const [showRegModal, setShowRegModal] = useState(false);
  const [regForm, setRegForm] = useState({
    name: '',
    dob: '',
    age: '',
    gender: 'Male',
    phone: '',
    address: '',
    blood_group: 'A+',
    allergies: '',
    history_summary: '',
    photo_base64: ''
  });
  
  // ID Card printing state
  const [idCardPatient, setIdCardPatient] = useState(null);
  const [pdfReportData, setPdfReportData] = useState(null);

  const openPdfReport = async (consultRecord) => {
    const doctors = await db.getAll('doctors');
    const doc = doctors.find(d => d.id === consultRecord.doctor_id);
    setPdfReportData({
      consultation: consultRecord,
      patient: selectedPatient,
      doctor: doc || { name: consultRecord.doctorName },
      triage: consultRecord.triage
    });
  };

  // Investigation Result Editing state for medical history sheet
  const [editingInvTest, setEditingInvTest] = useState(null);
  const [invResultVal, setInvResultVal] = useState('');
  const [invRefVal, setInvRefVal] = useState('');

  const openEditInv = (test) => {
    setEditingInvTest(test);
    setInvResultVal(test.result_value || '');
    setInvRefVal(test.normal_range || 'Normal');
  };

  const handleSaveInvResult = async (e) => {
    e.preventDefault();
    if (!editingInvTest) return;
    try {
      const updatedTest = {
        ...editingInvTest,
        status: 'completed',
        result_value: invResultVal.trim(),
        normal_range: invRefVal.trim(),
        recorded_at: editingInvTest.recorded_at || new Date().toISOString()
      };
      await db.save('investigations', updatedTest);
      setEditingInvTest(null);
      if (selectedPatient) {
        viewPatientDetails(selectedPatient);
      }
      alert('Diagnostic result successfully recorded in patient medical history.');
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadPatients();
    loadClinicConfig();
  }, []);

  const loadClinicConfig = async () => {
    const config = await db.get('settings', 'clinic_config');
    setClinicConfig(config);
  };

  const loadPatients = async () => {
    try {
      const allPatients = await db.getAll('patients');
      const clinicId = syncManager.getClinicId();
      // Filter patients by clinic
      const clinicPatients = allPatients.filter(p => p.clinic_id === clinicId);
      setPatients(clinicPatients);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDobChange = (e) => {
    let val = e.target.value.replace(/\D/g, ''); // digits only
    if (val.length > 8) val = val.slice(0, 8);
    
    let formatted = '';
    if (val.length > 0) {
      formatted += val.slice(0, 2);
    }
    if (val.length > 2) {
      formatted += '/' + val.slice(2, 4);
    }
    if (val.length > 4) {
      formatted += '/' + val.slice(4, 8);
    }
    
    let calculatedAge = regForm.age;
    if (val.length === 8) {
      const day = parseInt(val.slice(0, 2), 10);
      const month = parseInt(val.slice(2, 4), 10) - 1;
      const year = parseInt(val.slice(4, 8), 10);
      
      const birthDate = new Date(year, month, day);
      if (!isNaN(birthDate.getTime())) {
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        calculatedAge = String(Math.max(0, age));
      }
    }
    
    setRegForm(prev => ({
      ...prev,
      dob: formatted,
      age: calculatedAge
    }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regForm.name || !regForm.age) {
      alert('Please fill name and age.');
      return;
    }

    try {
      const clinicId = syncManager.getClinicId();
      
      // Auto-generate patient ID: e.g. PT-26-0005
      const currentYear = new Date().getFullYear().toString().slice(-2);
      const prefix = `PT-${currentYear}-`;
      const count = patients.length + 1;
      const patientId = `${prefix}${count.toString().padStart(4, '0')}`;

      const newPatient = {
        id: patientId,
        clinic_id: clinicId,
        name: regForm.name,
        dob: regForm.dob || '',
        age: parseInt(regForm.age),
        gender: regForm.gender,
        phone: regForm.phone,
        address: regForm.address,
        blood_group: regForm.blood_group,
        allergies: regForm.allergies || 'None',
        history_summary: regForm.history_summary || 'No chronic history logged.',
        photo_base64: regForm.photo_base64 || '',
        created_at: new Date().toISOString()
      };

      await db.save('patients', newPatient);
      
      // Reset and refresh
      setRegForm({
        name: '',
        dob: '',
        age: '',
        gender: 'Male',
        phone: '',
        address: '',
        blood_group: 'A+',
        allergies: '',
        history_summary: '',
        photo_base64: ''
      });
      setShowRegModal(false);
      loadPatients();
      alert(`Patient registered successfully with ID: ${patientId}`);
    } catch (e) {
      console.error(e);
    }
  };

  const viewPatientDetails = async (patient) => {
    setSelectedPatient(patient);
    
    // Load patient's past consultations
    const consults = await db.getAll('consultations');
    const doctors = await db.getAll('doctors');
    const triageRecords = await db.getAll('triage');
    const sales = await db.getAll('sales');
    const investigations = await db.getAll('investigations');
    const clinicId = syncManager.getClinicId();

    const patientConsults = consults
      .filter(c => c.patient_id === patient.id && c.clinic_id === clinicId)
      .map(c => {
        const doctor = doctors.find(d => d.id === c.doctor_id);
        const triage = triageRecords.find(t => t.booking_id === c.booking_id);
        const sale = sales.find(s => s.booking_id === c.booking_id);
        const testResults = investigations.filter(i => i.consultation_id === c.id);

        return {
          ...c,
          doctorName: doctor ? doctor.name : 'Unknown Doctor',
          triage,
          sale,
          investigations: testResults
        };
      });

    // Sort by date descending
    patientConsults.sort((a, b) => new Date(b.id.split('-').slice(-1)[0]) - new Date(a.id.split('-').slice(-1)[0]));
    setPatientConsultations(patientConsults);
  };

  // Filter patients by name, ID, or phone
  const filteredPatients = patients.filter(p => {
    const term = searchTerm.toLowerCase();
    return p.name.toLowerCase().includes(term) || 
           p.id.toLowerCase().includes(term) || 
           p.phone.includes(term);
  });

  return (
    <div>
      <header className="flex-wrap-safe no-print" style={{ justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '800' }}>Patient Records</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage demographics, history, and issue cards</p>
        </div>
        <button onClick={() => setShowRegModal(true)} className="btn btn-primary">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Register New Patient
        </button>
      </header>

      {/* Main Responsive Grid Layout */}
      <div className={selectedPatient ? "responsive-split-grid-50 no-print" : "no-print"}>
        
        {/* Left Side: Patient Directory */}
        <div className="glass-card">
          <div style={{ marginBottom: '1rem' }}>
            <input 
              type="text" 
              placeholder="Search by ID, Name, or Mobile Number..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="table-container">
            {filteredPatients.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No patient matches found.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Patient ID & Name</th>
                    <th>Age/Gender</th>
                    <th>Contact</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map(p => (
                    <tr key={p.id} style={{ cursor: 'pointer', background: selectedPatient?.id === p.id ? 'var(--primary-light)' : 'transparent' }} onClick={() => viewPatientDetails(p)}>
                      <td>
                        <div style={{ fontWeight: '600' }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.id}</div>
                      </td>
                      <td>{calculatePatientCurrentAge(p)} Yrs / {p.gender}</td>
                      <td>{p.phone}</td>
                      <td>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.25rem 0.5rem', minHeight: '30px', fontSize: '0.8rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIdCardPatient(p);
                          }}
                        >
                          🎫 ID Card
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Side: Patient Electronic Medical File Folder */}
        {selectedPatient && (
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {/* Photo base64 or silhouette */}
                {selectedPatient.photo_base64 ? (
                  <img 
                    src={selectedPatient.photo_base64} 
                    alt={selectedPatient.name} 
                    style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
                  />
                ) : (
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden' }}>
                    {selectedPatient.gender === 'Female' ? <FemaleSilhouette /> : <MaleSilhouette />}
                  </div>
                )}
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>{selectedPatient.name}</h2>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    ID: <strong>{selectedPatient.id}</strong> | Blood Group: <strong style={{ color: 'var(--accent)' }}>{selectedPatient.blood_group}</strong>
                  </div>
                </div>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setSelectedPatient(null)}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Demographics Sheet */}
            <div className="form-row" style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', fontSize: '0.9rem' }}>
              <div><strong>Age / Gender:</strong> {calculatePatientCurrentAge(selectedPatient)} Yrs / {selectedPatient.gender}</div>
              <div><strong>Phone Number:</strong> {selectedPatient.phone}</div>
              <div><strong>Address:</strong> {selectedPatient.address}</div>
              <div><strong>Drug Allergies:</strong> <span style={{ color: selectedPatient.allergies.toLowerCase() !== 'none' ? 'var(--danger)' : 'var(--text-primary)', fontWeight: 'bold' }}>{selectedPatient.allergies}</span></div>
            </div>

            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Chronic Medical Summary</h3>
              <p style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
                {selectedPatient.history_summary}
              </p>
            </div>

            {/* Visit History Folders */}
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Visit History ({patientConsultations.length})</h3>
              
              {patientConsultations.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No clinical visits logged yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '350px', overflowY: 'auto' }}>
                  {patientConsultations.map(c => (
                    <div key={c.id} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        <div>
                          <strong>Consultant: {c.doctorName}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>({c.id.split('-').slice(-1)[0]})</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => openPdfReport(c)}
                          className="btn btn-primary"
                          style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', minHeight: '26px' }}
                        >
                          📄 Print A4 Medical Certificate
                        </button>
                      </div>
                      
                      {c.triage && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <strong>Vitals:</strong> BP: {c.triage.bp_sys}/{c.triage.bp_dia} | Temp: {c.triage.temperature}°F | HR: {c.triage.pulse} | SpO2: {c.triage.spo2}% | Wt: {c.triage.weight} lb | Ht: {Math.floor(c.triage.height / 12)}' {c.triage.height % 12}"
                        </div>
                      )}
                      
                      <div style={{ fontSize: '0.85rem' }}>
                        <strong>Diagnosis:</strong> <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{c.diagnosis}</span>
                      </div>

                      <div style={{ fontSize: '0.85rem' }}>
                        <strong>Symptoms & Exam:</strong> {c.symptoms} | {c.examination}
                      </div>

                      {c.investigations && c.investigations.length > 0 && (
                        <div style={{ fontSize: '0.85rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                          <strong style={{ color: 'var(--primary)' }}>🔬 Diagnostic Investigations:</strong>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem', paddingLeft: '0.5rem' }}>
                            {c.investigations.map((test, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', margin: '0.2rem 0' }}>
                                <div>
                                  <strong style={{ color: 'var(--text-primary)' }}>{test.test_name}</strong>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>({test.test_type === 'lab' ? 'Lab' : 'Radiology'})</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  {test.status === 'completed' ? (
                                    <span style={{ fontSize: '0.85rem' }}>
                                      Result: <strong style={{ color: 'var(--accent)' }}>{test.result_value}</strong> 
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.4rem' }}>({test.normal_range})</span>
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--warning)', fontSize: '0.8rem', fontWeight: '600' }}>⚠️ Pending Results</span>
                                  )}
                                  <button 
                                    type="button"
                                    onClick={() => openEditInv(test)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.15rem 0.5rem', minHeight: '26px', fontSize: '0.75rem' }}
                                    title="Record or update external test result"
                                  >
                                    ✏️ {test.status === 'completed' ? 'Edit' : 'Add Result'}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {c.prescriptions && c.prescriptions.length > 0 && (
                        <div style={{ fontSize: '0.85rem' }}>
                          <strong>Medications:</strong>
                          <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
                            {c.prescriptions.map((m, idx) => (
                              <li key={idx}>
                                {m.name} - {m.qty_sold || m.quantity} units ({m.dosage} {m.frequency} for {m.duration} days)
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {c.sale && (
                        <div style={{ fontSize: '0.8rem', textAlign: 'right', color: 'var(--accent)', fontWeight: 'bold' }}>
                          Invoice paid: {c.sale.total.toLocaleString()} Ks ({c.sale.payment_method})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Register New Patient Modal */}
      {showRegModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>New Patient Registration</h3>
              <button className="mobile-menu-btn" onClick={() => setShowRegModal(false)} style={{ color: 'var(--text-primary)' }}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '24px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleRegister}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Photo upload input field */}
                <div className="form-group">
                  <label>Patient Portrait Photo (Optional)</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={e => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setRegForm(prev => ({ ...prev, photo_base64: reader.result }));
                        };
                        reader.readAsDataURL(file);
                      }
                    }} 
                    style={{ padding: '0.35rem 0.5rem', minHeight: 'auto' }}
                  />
                  {regForm.photo_base64 && (
                    <div style={{ marginTop: '0.5rem', position: 'relative', width: '60px', height: '60px' }}>
                      <img 
                        src={regForm.photo_base64} 
                        alt="Preview" 
                        style={{ width: '100%', height: '100%', borderRadius: '6px', objectFit: 'cover' }} 
                      />
                      <button 
                        type="button" 
                        onClick={() => setRegForm(prev => ({ ...prev, photo_base64: '' }))}
                        style={{
                          position: 'absolute', top: '-5px', right: '-5px', width: '18px', height: '18px',
                          borderRadius: '50%', background: 'var(--danger)', color: '#fff', border: 'none',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Full Name *</label>
                  <input 
                    type="text" 
                    required 
                    value={regForm.name} 
                    onChange={e => setRegForm({...regForm, name: e.target.value})} 
                    placeholder="e.g. U Aung Kyaw"
                  />
                </div>

                <div className="form-row" style={{ gridTemplateColumns: '1.5fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input 
                      type="text" 
                      value={regForm.dob || ''} 
                      onChange={handleDobChange} 
                      placeholder="DD/MM/YYYY"
                    />
                  </div>
                  <div className="form-group">
                    <label>Age *</label>
                    <input 
                      type="number" 
                      required 
                      value={regForm.age} 
                      onChange={e => setRegForm({...regForm, age: e.target.value})} 
                      placeholder="Age"
                    />
                  </div>
                  <div className="form-group">
                    <label>Gender *</label>
                    <select value={regForm.gender} onChange={e => setRegForm({...regForm, gender: e.target.value})}>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Phone Number (Optional)</label>
                    <input 
                      type="tel" 
                      value={regForm.phone} 
                      onChange={e => setRegForm({...regForm, phone: e.target.value})} 
                      placeholder="e.g. 09xxxxxxxx"
                    />
                  </div>
                  <div className="form-group">
                    <label>Blood Group</label>
                    <select value={regForm.blood_group} onChange={e => setRegForm({...regForm, blood_group: e.target.value})}>
                      <option>A+</option><option>A-</option>
                      <option>B+</option><option>B-</option>
                      <option>AB+</option><option>AB-</option>
                      <option>O+</option><option>O-</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Residential Address</label>
                  <input 
                    type="text" 
                    value={regForm.address} 
                    onChange={e => setRegForm({...regForm, address: e.target.value})} 
                    placeholder="Street, Township, City"
                  />
                </div>

                <div className="form-group">
                  <label>Known Drug/Food Allergies</label>
                  <input 
                    type="text" 
                    value={regForm.allergies} 
                    onChange={e => setRegForm({...regForm, allergies: e.target.value})} 
                    placeholder="e.g. Penicillin, Sulphur drugs (Write 'None' if none)"
                  />
                </div>

                <div className="form-group">
                  <label>Chronic Medical History Summary</label>
                  <textarea 
                    value={regForm.history_summary} 
                    onChange={e => setRegForm({...regForm, history_summary: e.target.value})} 
                    placeholder="e.g. Diabetes Mellitus (type II), G6PD deficiency, Asthma, past surgeries."
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" onClick={() => setShowRegModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Patient</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient ID Card print view modal overlay */}
      {idCardPatient && (
        <PatientIDCard 
          patient={idCardPatient} 
          clinicConfig={clinicConfig} 
          onClose={() => setIdCardPatient(null)} 
        />
      )}

      {/* Investigation Result Entry Modal */}
      {editingInvTest && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Record External Diagnostic Result</h3>
              <button className="mobile-menu-btn" onClick={() => setEditingInvTest(null)} style={{ color: 'var(--text-primary)' }}>✕</button>
            </div>
            <form onSubmit={handleSaveInvResult}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>{editingInvTest.test_name}</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>({editingInvTest.test_type === 'lab' ? 'Laboratory Test' : 'Radiology & Imaging'})</span>
                </div>

                <div className="form-group">
                  <label>Result Findings / Value *</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Hb: 13.2 g/dL, or Clear, No consolidations"
                    value={invResultVal}
                    onChange={e => setInvResultVal(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Normal Reference Guide</label>
                  <input 
                    type="text"
                    placeholder="e.g. 12.0 - 16.0 g/dL"
                    value={invRefVal}
                    onChange={e => setInvRefVal(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setEditingInvTest(null)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-success">Save to Patient Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable A4 Medical Summary Certificate Modal */}
      {pdfReportData && (
        <ClinicalReportPDF
          consultation={pdfReportData.consultation}
          patient={pdfReportData.patient}
          doctor={pdfReportData.doctor}
          triage={pdfReportData.triage}
          clinicConfig={clinicConfig}
          onClose={() => setPdfReportData(null)}
        />
      )}
    </div>
  );
}
