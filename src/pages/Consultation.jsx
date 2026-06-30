import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db/IndexedDB';
import { syncManager } from '../db/SyncManager';
import ClinicalReportPDF from '../components/ClinicalReportPDF';

export default function Consultation({ clinicMode, dutyDoctorId }) {
  const [activeQueue, setActiveQueue] = useState([]);
  const [activeDoctor, setActiveDoctor] = useState('');
  const [doctorsList, setDoctorsList] = useState([]);
  const [clinicConfig, setClinicConfig] = useState(null);
  const [pdfReportConsult, setPdfReportConsult] = useState(null);

  useEffect(() => {
    if ((clinicMode === 'solo_gp' || clinicMode === 'standard_gp') && dutyDoctorId) {
      setActiveDoctor(dutyDoctorId);
    }
  }, [clinicMode, dutyDoctorId]);

  useEffect(() => {
    const handleMutation = () => {
      loadDoctors();
    };
    window.addEventListener('aura_data_mutated', handleMutation);
    return () => window.removeEventListener('aura_data_mutated', handleMutation);
  }, []);
  
  // Current Consultation EMR States
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [triageData, setTriageData] = useState(null);
  const [pastVisits, setPastVisits] = useState([]);
  const [currentInvestigations, setCurrentInvestigations] = useState([]);
  
  // EMR Input Fields
  const [emrForm, setEmrForm] = useState({
    symptoms: '',
    history: '',
    current_problems: '',
    examination: '',
    diagnosis: '',
    ordered_investigations: [], // List of strings: e.g. ['CBC', 'CXR']
    investigation_fees: {}, // mapping of test name -> fee value
    consultation_fee: 5000,
    custom_services: [], // Array of { name, price }
    prescribed_medicines: [] // Array of {id, name, quantity, dosage, route, frequency, duration, instructions}
  });

  const [customServiceInput, setCustomServiceInput] = useState({ name: '', price: '' });

  // Prescribing tool helpers
  const [inventoryList, setInventoryList] = useState([]);
  const [prescInput, setPrescInput] = useState({
    medicine_id: '',
    quantity: '10',
    dosage: '500mg',
    route: 'PO (Oral)',
    frequency: 'BD (Twice Daily)',
    duration: '5',
    instructions: 'After Meal'
  });

  // Signature canvas
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureSaved, setSignatureSaved] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState('');

  // Investigation choices catalog
  const [labOptions, setLabOptions] = useState([
    { name: 'CBC (Blood Count)', default_fee: 5000 },
    { name: 'Lipid Profile', default_fee: 8000 },
    { name: 'LFT (Liver)', default_fee: 12000 },
    { name: 'KFT (Kidney)', default_fee: 12000 },
    { name: 'FBS (Blood Sugar)', default_fee: 4000 }
  ]);
  const [radOptions, setRadOptions] = useState([
    { name: 'Chest X-Ray', default_fee: 12000 },
    { name: 'USG Abdomen & Pelvis', default_fee: 15000 },
    { name: 'CT Brain', default_fee: 45000 },
    { name: 'MRI Spine', default_fee: 85000 }
  ]);
  const [servicesCatalog, setServicesCatalog] = useState([
    { name: 'Dressing (Small/Medium)', default_fee: 3000 },
    { name: 'Nebulization', default_fee: 5000 },
    { name: 'IM Injection Administration', default_fee: 2000 },
    { name: 'IV Infusion Saline Setup', default_fee: 10000 }
  ]);

  // Structured Physical Exam Helper States
  const [examGen, setExamGen] = useState('Active & Alert');
  const [examGenCustom, setExamGenCustom] = useState('');
  const [examHeart, setExamHeart] = useState('S1 + S2 Normal (I+II+0)');
  const [examHeartCustom, setExamHeartCustom] = useState('');
  const [examLungs, setExamLungs] = useState('VBS (+) normal both sides');
  const [examLungsCustom, setExamLungsCustom] = useState('');
  const [examLungZones, setExamLungZones] = useState({
    RUZ: false, RMZ: false, RLZ: false, LUZ: false, LLZ: false
  });
  const [examAbdomen, setExamAbdomen] = useState('Soft & non-tender');
  const [examAbdomenCustom, setExamAbdomenCustom] = useState('');
  const [examENT, setExamENT] = useState('Normal');
  const [examENTCustom, setExamENTCustom] = useState('');

  const handleCompileExamination = () => {
    const findings = [];
    
    // 1. General Condition
    const genText = examGen === 'Custom' ? examGenCustom : examGen;
    if (genText) findings.push(`Gen. Condition: ${genText}`);
    
    // 2. ENT / Throat
    const entText = examENT === 'Custom' ? examENTCustom : examENT;
    if (entText && entText !== 'Normal') findings.push(`ENT/Throat: ${entText}`);
    
    // 3. Heart
    const heartText = examHeart === 'Custom' ? examHeartCustom : examHeart;
    if (heartText) findings.push(`CVS (Heart): ${heartText}`);
    
    // 4. Lungs
    let lungsText = examLungs === 'Custom' ? examLungsCustom : examLungs;
    const selectedZones = Object.keys(examLungZones).filter(zone => examLungZones[zone]);
    if (selectedZones.length > 0) {
      lungsText += ` on [${selectedZones.join(', ')}]`;
    }
    if (lungsText) findings.push(`RS (Lungs): ${lungsText}`);
    
    // 5. Abdomen
    const abdText = examAbdomen === 'Custom' ? examAbdomenCustom : examAbdomen;
    if (abdText) findings.push(`Abdomen: ${abdText}`);
    
    const compiled = findings.join(' | ');
    setEmrForm(prev => ({
      ...prev,
      examination: prev.examination ? `${prev.examination}\n${compiled}` : compiled
    }));
  };

  useEffect(() => {
    loadDoctors();
    loadInventory();
    loadInvestigationsCatalog();
    loadClinicConfig();
  }, []);

  const loadClinicConfig = async () => {
    try {
      const config = await db.get('settings', 'clinic_config');
      setClinicConfig(config);
    } catch (e) {}
  };

  const loadInvestigationsCatalog = async () => {
    try {
      const catalog = await db.get('settings', 'investigations_catalog');
      if (catalog) {
        if (catalog.labOptions) setLabOptions(catalog.labOptions);
        if (catalog.radOptions) setRadOptions(catalog.radOptions);
        if (catalog.servicesOptions) setServicesCatalog(catalog.servicesOptions);
      }
    } catch (e) {
      console.error('Failed to load investigations catalog:', e);
    }
  };

  // Save EMR form progress draft to localStorage
  useEffect(() => {
    if (selectedBooking && emrForm && emrForm.bookingId === selectedBooking.id) {
      localStorage.setItem(`medflow_draft_emr_${selectedBooking.id}`, JSON.stringify({
        emrForm,
        signatureUrl
      }));
    }
  }, [emrForm, selectedBooking, signatureUrl]);

  useEffect(() => {
    if (activeDoctor) {
      loadQueue();
    } else {
      setActiveQueue([]);
      setSelectedBooking(null);
    }
  }, [activeDoctor]);

  const loadDoctors = async () => {
    const list = await db.getAll('doctors');
    const clinicId = syncManager.getClinicId();
    const clinicDocs = list.filter(d => d.clinic_id === clinicId);
    setDoctorsList(clinicDocs);
    const savedDuty = localStorage.getItem('aura_duty_doctor_id') || dutyDoctorId;
    if (savedDuty && clinicDocs.some(d => d.id === savedDuty)) {
      setActiveDoctor(savedDuty);
    } else if (clinicDocs.length > 0) {
      setActiveDoctor(clinicDocs[0].id);
    }
  };

  const loadInventory = async () => {
    const list = await db.getAll('inventory');
    const clinicId = syncManager.getClinicId();
    setInventoryList(list.filter(i => i.clinic_id === clinicId));
  };

  const loadQueue = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const bookings = await db.getAll('bookings');
      const patients = await db.getAll('patients');
      const clinicId = syncManager.getClinicId();

      const queue = bookings
        .filter(b => b.date === todayStr && 
                     b.doctor_id === activeDoctor && 
                     b.clinic_id === clinicId && 
                     (b.status === 'checked_in' || b.status === 'in_consultation' || b.status === 'pending_lab'))
        .map(b => {
          const patient = patients.find(p => p.id === b.patient_id);
          return {
            ...b,
            patientName: patient ? patient.name : 'Unknown Patient',
            patientAge: patient ? patient.age : 'N/A',
            patientGender: patient ? patient.gender : 'N/A'
          };
        });

      setActiveQueue(queue);
    } catch (e) {
      console.error(e);
    }
  };

  const startConsultation = async (booking) => {
    setSelectedBooking(booking);
    
    // Set booking status to 'in_consultation'
    const updated = { ...booking, status: 'in_consultation' };
    delete updated.patientName;
    delete updated.patientAge;
    delete updated.patientGender;
    await db.save('bookings', updated);
    
    // Load patient demographics
    const patient = await db.get('patients', booking.patient_id);
    setPatientData(patient);

    // Load triage vitals
    const triageRecords = await db.getAll('triage');
    const triage = triageRecords.find(t => t.booking_id === booking.id);
    setTriageData(triage || null);

    // Load past EMR history
    const consults = await db.getAll('consultations');
    const past = consults.filter(c => c.patient_id === booking.patient_id && c.id !== `CS-${booking.id}`);
    setPastVisits(past);

    // Load current booking's ordered investigations
    const allInv = await db.getAll('investigations');
    const bookingInv = allInv.filter(i => i.consultation_id === `CS-${booking.id}`);
    setCurrentInvestigations(bookingInv);

    // Resolve doctor default consultation fee
    const activeDocObj = doctorsList.find(d => d.id === activeDoctor);
    const defaultConsultFee = activeDocObj ? Number(activeDocObj.fees) || 5000 : 5000;

    // Check if there is an un-finalized draft in localStorage first
    const draftStr = localStorage.getItem(`medflow_draft_emr_${booking.id}`);
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr);
        setEmrForm({
          ...draft.emrForm,
          bookingId: booking.id
        });
        setSignatureUrl(draft.signatureUrl || '');
        setSignatureSaved(!!draft.signatureUrl);
        return;
      } catch (e) {
        console.error('Failed to parse draft EMR:', e);
      }
    }

    // Load existing consultation record if it exists (re-access scenario)
    const existingConsult = consults.find(c => c.booking_id === booking.id);

    // Pre-populate EMR form with existing values or defaults
    if (existingConsult) {
      setEmrForm({
        bookingId: booking.id,
        symptoms: existingConsult.symptoms || '',
        history: existingConsult.history || patient?.history_summary || '',
        current_problems: existingConsult.current_problems || booking.notes || '',
        examination: existingConsult.examination || '',
        diagnosis: existingConsult.diagnosis || '',
        ordered_investigations: existingConsult.investigations || [],
        investigation_fees: existingConsult.investigation_fees || {},
        consultation_fee: existingConsult.consultation_fee || defaultConsultFee,
        custom_services: existingConsult.custom_services || [],
        prescribed_medicines: existingConsult.prescriptions || []
      });
      if (existingConsult.doctor_signature) {
        setSignatureUrl(existingConsult.doctor_signature);
        setSignatureSaved(true);
      } else {
        setSignatureSaved(false);
        setSignatureUrl('');
      }
    } else {
      setEmrForm({
        bookingId: booking.id,
        symptoms: '',
        history: patient?.history_summary || '',
        current_problems: booking.notes || '',
        examination: '',
        diagnosis: '',
        ordered_investigations: [],
        investigation_fees: {},
        consultation_fee: defaultConsultFee,
        custom_services: [],
        prescribed_medicines: []
      });
      setSignatureSaved(false);
      setSignatureUrl('');
    }
  };

  // Helper to calculate total medication quantity based on dosage, frequency, and duration
  const calculateTotalQuantity = (doseStr, freqStr, durationDaysStr) => {
    let dailyFreq = 1;
    const freq = freqStr || '';
    if (freq.includes('BD')) dailyFreq = 2;
    else if (freq.includes('TDS')) dailyFreq = 3;
    else if (freq.includes('QDS')) dailyFreq = 4;
    else if (freq.includes('OD') || freq.includes('hs') || freq.includes('PRN')) dailyFreq = 1;

    const days = Number(durationDaysStr) || 0;
    
    let doseMultiplier = 1;
    if (doseStr) {
      const match = doseStr.trim().match(/^(\d+(\.\d+)?)\s*(tab|capsule|cap|pill|sachet)/i);
      if (match && match[1]) {
        doseMultiplier = parseFloat(match[1]) || 1;
      }
    }

    return Math.max(1, Math.ceil(dailyFreq * days * doseMultiplier));
  };

  const handlePrescInputChange = (field, value) => {
    setPrescInput(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'dosage' || field === 'frequency' || field === 'duration') {
        const autoQty = calculateTotalQuantity(
          field === 'dosage' ? value : prev.dosage,
          field === 'frequency' ? value : prev.frequency,
          field === 'duration' ? value : prev.duration
        );
        updated.quantity = String(autoQty);
      }
      return updated;
    });
  };

  // Prescription builder helper
  const addPrescribedMedicine = () => {
    if (!prescInput.medicine_id) {
      alert('Select a medicine from catalog first.');
      return;
    }
    
    const med = inventoryList.find(i => i.id === prescInput.medicine_id);
    if (!med) return;

    const finalQty = Number(prescInput.quantity) || calculateTotalQuantity(prescInput.dosage, prescInput.frequency, prescInput.duration);

    const newPrescription = {
      medicine_id: med.id,
      name: med.name,
      dosage: prescInput.dosage,
      route: prescInput.route,
      frequency: prescInput.frequency,
      duration: prescInput.duration,
      instructions: prescInput.instructions,
      quantity: finalQty // total tablets/ml needed
    };

    setEmrForm({
      ...emrForm,
      prescribed_medicines: [...emrForm.prescribed_medicines, newPrescription]
    });

    // Reset presc input selection
    setPrescInput({
      medicine_id: '',
      quantity: '10',
      dosage: '500mg',
      route: 'PO (Oral)',
      frequency: 'BD (Twice Daily)',
      duration: '5',
      instructions: 'After Meal'
    });
  };

  const removePrescribedMedicine = (index) => {
    const updated = [...emrForm.prescribed_medicines];
    updated.splice(index, 1);
    setEmrForm({ ...emrForm, prescribed_medicines: updated });
  };

  const toggleInvestigation = (testName) => {
    const activeList = [...emrForm.ordered_investigations];
    const updatedFees = { ...emrForm.investigation_fees };
    const idx = activeList.indexOf(testName);
    if (idx > -1) {
      activeList.splice(idx, 1);
      delete updatedFees[testName];
    } else {
      activeList.push(testName);
      const labMatch = labOptions.find(t => t.name === testName);
      const radMatch = radOptions.find(t => t.name === testName);
      const defaultFee = labMatch ? labMatch.default_fee : (radMatch ? radMatch.default_fee : 5000);
      updatedFees[testName] = defaultFee;
    }
    setEmrForm({ 
      ...emrForm, 
      ordered_investigations: activeList,
      investigation_fees: updatedFees
    });
  };

  // Canvas drawing routines
  const startDrawingSignature = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const drawSignature = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawingSignature = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureSaved(false);
    setSignatureUrl('');
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    const url = canvas.toDataURL('image/png');
    setSignatureUrl(url);
    setSignatureSaved(true);
  };

  const addCustomService = () => {
    if (!customServiceInput.name || !customServiceInput.price) return;
    const priceVal = parseFloat(customServiceInput.price) || 0;
    const newService = {
      name: customServiceInput.name,
      price: priceVal
    };
    setEmrForm(prev => ({
      ...prev,
      custom_services: [...(prev.custom_services || []), newService]
    }));
    setCustomServiceInput({ name: '', price: '' });
  };

  const removeCustomService = (idx) => {
    const updated = [...(emrForm.custom_services || [])];
    updated.splice(idx, 1);
    setEmrForm(prev => ({ ...prev, custom_services: updated }));
  };

  // Finalize EMR session
  const saveConsultation = async (e) => {
    e.preventDefault();
    if (!emrForm.diagnosis) {
      alert('Please enter a clinical diagnosis.');
      return;
    }

    try {
      const clinicId = syncManager.getClinicId();
      const consultId = `CS-${selectedBooking.id}`;

      // 1. Build and save consultation document
      const consultationRecord = {
        id: consultId,
        clinic_id: clinicId,
        booking_id: selectedBooking.id,
        patient_id: selectedBooking.patient_id,
        doctor_id: activeDoctor,
        symptoms: emrForm.symptoms,
        history: emrForm.history,
        current_problems: emrForm.current_problems,
        examination: emrForm.examination,
        diagnosis: emrForm.diagnosis,
        prescriptions: emrForm.prescribed_medicines,
        investigations: emrForm.ordered_investigations,
        investigation_fees: emrForm.investigation_fees || {},
        consultation_fee: emrForm.consultation_fee || 5000,
        custom_services: emrForm.custom_services || [],
        doctor_signature: signatureUrl,
        timestamp: new Date().toISOString()
      };

      await db.save('consultations', consultationRecord);

      // Load current investigations in DB for this consultation
      const existingInvs = await db.getAll('investigations');
      const consultationInvs = existingInvs.filter(i => i.consultation_id === consultId);

      // Delete investigations that were de-selected by doctor
      for (const existingInv of consultationInvs) {
        if (!emrForm.ordered_investigations.includes(existingInv.test_name)) {
          await db.delete('investigations', existingInv.id);
        }
      }

      // 2. Save ordered investigations in their own tables (if not already existing)
      for (const test of emrForm.ordered_investigations) {
        const testId = `INV-${selectedBooking.id}-${test.replace(/\s+/g, '')}`;
        const alreadyExists = consultationInvs.some(i => i.id === testId);
        
        if (!alreadyExists) {
          const testType = labOptions.some(t => t.name === test) ? 'lab' : 'radiology';
          const testPrice = Number(emrForm.investigation_fees?.[test]) || 5000;
          await db.save('investigations', {
            id: testId,
            clinic_id: clinicId,
            consultation_id: consultId,
            patient_id: selectedBooking.patient_id,
            test_name: test,
            test_type: testType,
            status: 'pending',
            price: testPrice,
            result_value: '',
            normal_range: testType === 'lab' ? 'Reference values pending' : 'Imaging reports pending',
            recorded_at: ''
          });
        }
      }

      // Clear EMR draft from localStorage
      localStorage.removeItem(`medflow_draft_emr_${selectedBooking.id}`);

      // 3. Update booking status
      // Calculate remaining pending tests in the DB
      const updatedInvs = await db.getAll('investigations');
      const remainingPending = updatedInvs.filter(i => 
        i.consultation_id === consultId && 
        i.status === 'pending' && 
        i.clinic_id === clinicId
      );

      const nextStatus = remainingPending.length > 0 ? 'pending_lab' : 'pending_checkout';
      
      const updatedBooking = {
        ...selectedBooking,
        status: nextStatus
      };
      delete updatedBooking.patientName;
      delete updatedBooking.patientAge;
      delete updatedBooking.patientGender;

      await db.save('bookings', updatedBooking);

      alert(`EMR finalized. Patient status updated to: ${nextStatus === 'pending_lab' ? 'Investigation Room' : 'Cashier Billing'}`);
      setSelectedBooking(null);
      loadQueue();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <header className="flex-wrap-safe no-print" style={{ justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '800' }}>Doctor's EMR & Consultation Workspace</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Log patient symptoms, evaluate physical exams, order tests, and digitally sign prescriptions</p>
        </div>
        
        {/* Doctor selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ margin: 0 }}>Practitioner:</label>
          <select 
            value={activeDoctor} 
            onChange={(e) => {
              setActiveDoctor(e.target.value);
              localStorage.setItem('aura_duty_doctor_id', e.target.value);
              window.dispatchEvent(new Event('aura_data_mutated'));
            }}
            style={{ width: 'auto', minHeight: '38px', padding: '0.35rem 1rem', borderRadius: '8px', border: '1px solid var(--primary)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: '600' }}
          >
            <option value="">-- Select Doctor --</option>
            {doctorsList.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>
            ))}
          </select>
        </div>
      </header>

      {/* Main EMR layout */}
      <div className={selectedBooking ? "responsive-split-grid no-print" : "no-print"}>
        
        {/* Left Side: Waiting Queue */}
        <div className="glass-card">
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem' }}>Patient Queue</h2>
          {activeQueue.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No active patients waiting in queue.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {activeQueue.map(b => (
                <div 
                  key={b.id} 
                  onClick={() => startConsultation(b)}
                  style={{
                    padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '10px',
                    cursor: 'pointer', background: selectedBooking?.id === b.id ? 'var(--primary-light)' : 'var(--bg-surface-solid)',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <strong style={{ color: selectedBooking?.id === b.id ? 'var(--primary)' : 'var(--text-primary)' }}>{b.patientName}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Slot: {b.time_slot}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {b.patientGender} | {b.patientAge} Yrs | Vitals: <strong style={{ color: 'var(--accent)' }}>Checked</strong>
                  </div>
                  {b.status === 'pending_lab' && (
                    <span className="badge badge-pending" style={{ marginTop: '0.5rem', fontSize: '0.7rem' }}>Waiting Lab Results</span>
                  )}
                  {b.lab_results_ready && (
                    <span className="badge badge-success" style={{ marginTop: '0.5rem', fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent)' }}>🔬 Lab Results Ready</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: EMR Form Sheet */}
        {selectedBooking ? (
          <form onSubmit={saveConsultation} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem' }}>Clinical File: {patientData?.name}</h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Age/Gender: <strong>{patientData?.age} Yrs / {patientData?.gender}</strong> | Allergies: <strong style={{ color: 'var(--danger)' }}>{patientData?.allergies}</strong>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedBooking(null)} className="btn btn-secondary btn-icon">
                ✕
              </button>
            </div>

            {/* Vitals Ribbon */}
            {triageData && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem', padding: '1rem', background: 'var(--bg-app)', borderRadius: '10px', fontSize: '0.8rem', textAlign: 'center' }}>
                <div>BP: <strong style={{ display: 'block', fontSize: '1rem' }}>{triageData.bp_sys}/{triageData.bp_dia}</strong></div>
                <div>Pulse: <strong style={{ display: 'block', fontSize: '1rem' }}>{triageData.pulse} bpm</strong></div>
                <div>Temp: <strong style={{ display: 'block', fontSize: '1rem' }}>{triageData.temperature} °F</strong></div>
                <div>SpO2: <strong style={{ display: 'block', fontSize: '1rem' }}>{triageData.spo2} %</strong></div>
                <div>Weight: <strong style={{ display: 'block', fontSize: '1rem' }}>{triageData.weight} lb</strong></div>
                <div>Height: <strong style={{ display: 'block', fontSize: '1rem' }}>{Math.floor(triageData.height / 12)}' {triageData.height % 12}"</strong></div>
                <div>BMI Score: <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--primary)' }}>{triageData.bmi || 'N/A'}</strong></div>
              </div>
            )}

            {/* Lab & Imaging Results Panel (Re-access review) */}
            {currentInvestigations.length > 0 && (
              <div style={{ padding: '1rem', border: '1px solid var(--primary)', borderRadius: '10px', background: 'rgba(14, 165, 233, 0.05)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                  🔬 Ordered Investigations & Results
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {currentInvestigations.map(inv => (
                    <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface-solid)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', borderLeft: inv.status === 'completed' ? '4px solid var(--accent)' : '4px solid var(--warning)' }}>
                      <div>
                        <strong>{inv.test_name}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '10px' }}>({inv.test_type})</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {inv.status === 'completed' ? (
                          <>
                            <span style={{ fontWeight: 'bold', color: 'var(--accent)' }}>{inv.result_value}</span>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Ref: {inv.normal_range}</div>
                          </>
                        ) : (
                          <span style={{ color: 'var(--warning)', fontStyle: 'italic' }}>Pending Result...</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Note Taking Sections */}
            <div className="form-group">
              <label>Chief Complaints & Symptoms</label>
              <textarea 
                value={emrForm.symptoms}
                onChange={e => setEmrForm({...emrForm, symptoms: e.target.value})}
                placeholder="List main complains: e.g. dry cough for 3 days, high grade fever..."
                rows={3}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Systemic History Summary</label>
                <textarea 
                  value={emrForm.history}
                  onChange={e => setEmrForm({...emrForm, history: e.target.value})}
                  placeholder="Medical/surgical histories..."
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Physical Examination Findings</label>
                <textarea 
                  value={emrForm.examination}
                  onChange={e => setEmrForm({...emrForm, examination: e.target.value})}
                  placeholder="e.g. Chest: clear, Abdomen: soft, Throat: congested..."
                  rows={3}
                />
                
                {/* Structured Exam Helper (Dropdowns) */}
                <div style={{ marginTop: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', color: 'var(--primary)' }}>
                    ⚡ Structured Exam Helper (Dropdowns)
                  </span>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                    {/* General Condition */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>General Condition</label>
                      <select value={examGen} onChange={e => setExamGen(e.target.value)} style={{ minHeight: '30px', padding: '0.2rem' }}>
                        <option value="Active & Alert">Active & Alert</option>
                        <option value="Fair">Fair</option>
                        <option value="Weak">Weak</option>
                        <option value="Lethargic">Lethargic</option>
                        <option value="Dyspnoeic">Dyspnoeic</option>
                        <option value="Ill-looking">Ill-looking</option>
                        <option value="Custom">Custom (Type below)</option>
                      </select>
                      {examGen === 'Custom' && (
                        <input type="text" placeholder="Specify..." value={examGenCustom} onChange={e => setExamGenCustom(e.target.value)} style={{ minHeight: '28px', padding: '0.2rem', marginTop: '0.2rem' }} />
                      )}
                    </div>

                    {/* ENT / Throat */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ENT / Throat</label>
                      <select value={examENT} onChange={e => setExamENT(e.target.value)} style={{ minHeight: '30px', padding: '0.2rem' }}>
                        <option value="Normal">Normal</option>
                        <option value="Throat congested">Throat congested</option>
                        <option value="Throat injected">Throat injected</option>
                        <option value="Tonsils enlarged">Tonsils enlarged</option>
                        <option value="Tonsillar exudates">Tonsillar exudates</option>
                        <option value="Custom">Custom (Type below)</option>
                      </select>
                      {examENT === 'Custom' && (
                        <input type="text" placeholder="Specify..." value={examENTCustom} onChange={e => setExamENTCustom(e.target.value)} style={{ minHeight: '28px', padding: '0.2rem', marginTop: '0.2rem' }} />
                      )}
                    </div>

                    {/* CVS / Heart */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CVS / Heart</label>
                      <select value={examHeart} onChange={e => setExamHeart(e.target.value)} style={{ minHeight: '30px', padding: '0.2rem' }}>
                        <option value="S1 + S2 Normal (I+II+0)">S1 + S2 Normal (I+II+0)</option>
                        <option value="Tachycardia">Tachycardia</option>
                        <option value="Bradycardia">Bradycardia</option>
                        <option value="Systolic Murmur">Systolic Murmur</option>
                        <option value="Diastolic Murmur">Diastolic Murmur</option>
                        <option value="Custom">Custom (Type below)</option>
                      </select>
                      {examHeart === 'Custom' && (
                        <input type="text" placeholder="Specify..." value={examHeartCustom} onChange={e => setExamHeartCustom(e.target.value)} style={{ minHeight: '28px', padding: '0.2rem', marginTop: '0.2rem' }} />
                      )}
                    </div>

                    {/* Abdomen */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Abdomen</label>
                      <select value={examAbdomen} onChange={e => setExamAbdomen(e.target.value)} style={{ minHeight: '30px', padding: '0.2rem' }}>
                        <option value="Soft & non-tender">Soft & non-tender</option>
                        <option value="Tender (Epigastrium)">Tender (Epigastrium)</option>
                        <option value="Tender (RHC)">Tender (RHC)</option>
                        <option value="Tender (LIF/RIF)">Tender (LIF/RIF)</option>
                        <option value="Distended">Distended</option>
                        <option value="Custom">Custom (Type below)</option>
                      </select>
                      {examAbdomen === 'Custom' && (
                        <input type="text" placeholder="Specify..." value={examAbdomenCustom} onChange={e => setExamAbdomenCustom(e.target.value)} style={{ minHeight: '28px', padding: '0.2rem', marginTop: '0.2rem' }} />
                      )}
                    </div>

                    {/* RS / Lungs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>RS / Lungs</label>
                      <select value={examLungs} onChange={e => setExamLungs(e.target.value)} style={{ minHeight: '30px', padding: '0.2rem' }}>
                        <option value="VBS (+) normal both sides">VBS (+) normal both sides</option>
                        <option value="VBS (+) with Crepitations">VBS (+) with Crepitations</option>
                        <option value="VBS (+) with Rhonchi">VBS (+) with Rhonchi</option>
                        <option value="Decreased breath sounds">Decreased breath sounds</option>
                        <option value="Custom">Custom (Type below)</option>
                      </select>
                      {examLungs === 'Custom' && (
                        <input type="text" placeholder="Specify..." value={examLungsCustom} onChange={e => setExamLungsCustom(e.target.value)} style={{ minHeight: '28px', padding: '0.2rem', marginTop: '0.2rem' }} />
                      )}

                      {/* Lung Zones Checkboxes */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem', background: 'rgba(255,255,255,0.01)', padding: '0.25rem', borderRadius: '4px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', alignSelf: 'center', marginRight: '0.25rem' }}>Zones:</span>
                        {['RUZ', 'RMZ', 'RLZ', 'LUZ', 'LLZ'].map(zone => (
                          <label key={zone} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', fontSize: '0.75rem', margin: 0 }}>
                            <input 
                              type="checkbox" 
                              checked={examLungZones[zone]} 
                              onChange={e => setExamLungZones({ ...examLungZones, [zone]: e.target.checked })} 
                              style={{ margin: 0 }}
                            />
                            {zone}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCompileExamination}
                    className="btn btn-primary"
                    style={{ width: '100%', minHeight: '30px', marginTop: '0.75rem', fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                  >
                    ⚡ Append Dropdown Findings to Exam Text
                  </button>
                </div>
              </div>
            </div>

            {/* Diagnosis (ICD-10/Custom) */}
            <div className="form-group">
              <label>Diagnosis / Assessment *</label>
              <input 
                type="text" 
                value={emrForm.diagnosis}
                onChange={e => setEmrForm({...emrForm, diagnosis: e.target.value})}
                placeholder="e.g. Acute Pharyngitis, Essential Hypertension"
                required
              />
            </div>

            {/* Investigations Grid */}
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Order Investigations (Results Pending System)</h3>
              
              <div className="responsive-split-grid-50" style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                <div>
                  <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>Laboratory Tests</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {labOptions.map(test => (
                      <label key={test.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'normal' }}>
                        <input 
                          type="checkbox" 
                          checked={emrForm.ordered_investigations.includes(test.name)}
                          onChange={() => toggleInvestigation(test.name)}
                          style={{ width: '16px', minHeight: '16px' }}
                        />
                        {test.name} <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({(test.default_fee || 0).toLocaleString()} Ks)</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--accent)' }}>Radiology & Imaging</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {radOptions.map(test => (
                      <label key={test.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'normal' }}>
                        <input 
                          type="checkbox" 
                          checked={emrForm.ordered_investigations.includes(test.name)}
                          onChange={() => toggleInvestigation(test.name)}
                          style={{ width: '16px', minHeight: '16px' }}
                        />
                        {test.name} <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({(test.default_fee || 0).toLocaleString()} Ks)</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Clinic Services / Procedures Ordered */}
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Add Clinic Services (e.g. Nebulizer, Dressing)</h3>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', background: 'var(--bg-app)', padding: '1rem', borderRadius: '10px' }}>
                <select
                  value={customServiceInput.name}
                  onChange={e => {
                    const srvName = e.target.value;
                    const srvObj = servicesCatalog.find(s => s.name === srvName);
                    setCustomServiceInput({
                      name: srvName,
                      price: srvObj ? String(srvObj.default_fee) : ''
                    });
                  }}
                  style={{ flex: 2, minHeight: '38px', padding: '0.5rem 1rem' }}
                >
                  <option value="">-- Choose Clinic Service --</option>
                  {servicesCatalog.map(srv => (
                    <option key={srv.name} value={srv.name}>{srv.name} ({(srv.default_fee || 0).toLocaleString()} Ks)</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addCustomService}
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.25rem', minHeight: '38px' }}
                >
                  + Add Service
                </button>
              </div>

              {/* Added services badge list */}
              {emrForm.custom_services && emrForm.custom_services.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  {emrForm.custom_services.map((item, idx) => (
                    <div 
                      key={idx} 
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                        background: 'var(--primary-light)', color: 'var(--primary)',
                        padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600'
                      }}
                    >
                      <span>{item.name} ({(item.price || 0).toLocaleString()} Ks)</span>
                      <button 
                        type="button" 
                        onClick={() => removeCustomService(idx)}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Medication Prescriber Tool */}
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Prescribe Medications (Unit Aware)</h3>
              
              <div className="form-row" style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', marginBottom: '1rem' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Select Drug</label>
                  <select 
                    value={prescInput.medicine_id}
                    onChange={e => handlePrescInputChange('medicine_id', e.target.value)}
                  >
                    <option value="">-- Choose Medicine --</option>
                    {inventoryList.map(item => {
                      const box = Math.floor(item.total_tablets / (item.strip_per_box * item.tablet_per_strip));
                      const remainingTabs = item.total_tablets % (item.strip_per_box * item.tablet_per_strip);
                      const strips = Math.floor(remainingTabs / item.tablet_per_strip);
                      const tabs = remainingTabs % item.tablet_per_strip;
                      
                      return (
                        <option key={item.id} value={item.id}>
                          {item.name} (Stock: {box} Box, {strips} Str, {tabs} Tab)
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="form-group">
                  <label>Dose (e.g. 500mg, 1 Tab)</label>
                  <input 
                    type="text" 
                    value={prescInput.dosage}
                    onChange={e => handlePrescInputChange('dosage', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Route</label>
                  <select value={prescInput.route} onChange={e => handlePrescInputChange('route', e.target.value)}>
                    <option>PO (Oral)</option><option>IV (Intravenous)</option>
                    <option>IM (Intramuscular)</option><option>SC (Subcutaneous)</option>
                    <option>Topical</option><option>Inhalation</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Frequency</label>
                  <select value={prescInput.frequency} onChange={e => handlePrescInputChange('frequency', e.target.value)}>
                    <option>OD (Once Daily)</option>
                    <option>BD (Twice Daily)</option>
                    <option>TDS (Three Times Daily)</option>
                    <option>QDS (Four Times Daily)</option>
                    <option>PRN (As Needed)</option>
                    <option>hs (At Bedtime)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Duration (Days)</label>
                  <input 
                    type="number" 
                    value={prescInput.duration}
                    onChange={e => handlePrescInputChange('duration', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Total Qty Needed (Units) *</label>
                  <input 
                    type="number" 
                    value={prescInput.quantity}
                    style={{ fontWeight: '700', color: 'var(--primary)' }}
                    onChange={e => handlePrescInputChange('quantity', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Special Instructions</label>
                  <input 
                    type="text" 
                    value={prescInput.instructions}
                    placeholder="e.g. Before Meal, After Meal, avoid dairy..."
                    onChange={e => handlePrescInputChange('instructions', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ justifyContent: 'flex-end', gridColumn: 'span 2' }}>
                  <button type="button" onClick={addPrescribedMedicine} className="btn btn-primary" style={{ width: '100%' }}>
                    + Add Drug
                  </button>
                </div>
              </div>

              {/* Prescription list */}
              {emrForm.prescribed_medicines.length > 0 && (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Medication Name</th>
                        <th>Directions</th>
                        <th>Total Units Required</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emrForm.prescribed_medicines.map((m, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: '600' }}>{m.name}</td>
                          <td>
                            {m.dosage} - {m.route} | {m.frequency} for {m.duration} days ({m.instructions})
                          </td>
                          <td>
                            <strong>{m.quantity} Tablets/Caps</strong>
                          </td>
                          <td>
                            <button type="button" onClick={() => removePrescribedMedicine(idx)} className="btn btn-danger" style={{ padding: '0.2rem 0.5rem', minHeight: '30px' }}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Doctor digital signature drawing canvas pad */}
            <div className="form-group">
              <label>Doctor's Digital Signature Authorized Stamp</label>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', background: '#fff', overflow: 'hidden' }}>
                  <canvas 
                    ref={canvasRef}
                    width={300}
                    height={100}
                    onMouseDown={startDrawingSignature}
                    onMouseMove={drawSignature}
                    onMouseUp={stopDrawingSignature}
                    onMouseLeave={stopDrawingSignature}
                    onTouchStart={startDrawingSignature}
                    onTouchMove={drawSignature}
                    onTouchEnd={stopDrawingSignature}
                    style={{ display: 'block', cursor: 'crosshair', touchAction: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
                  <button type="button" onClick={clearSignature} className="btn btn-secondary" style={{ padding: '0.35rem 1rem', minHeight: '35px' }}>
                    Clear Pad
                  </button>
                  <button 
                    type="button" 
                    onClick={saveSignature} 
                    className={`btn ${signatureSaved ? 'btn-success' : 'btn-primary'}`} 
                    style={{ padding: '0.35rem 1rem', minHeight: '35px' }}
                  >
                    {signatureSaved ? '✓ Signed' : 'Save Stamp'}
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                onClick={() => {
                  const currentDoc = doctorsList.find(d => d.id === activeDoctor);
                  setPdfReportConsult({
                    consultation: {
                      id: `CS-${selectedBooking.id}`,
                      symptoms: emrForm.symptoms,
                      history: emrForm.history,
                      examination: emrForm.examination,
                      diagnosis: emrForm.diagnosis,
                      prescriptions: emrForm.prescribed_medicines,
                      investigations: currentInvestigations,
                      doctor_signature: signatureUrl,
                      timestamp: new Date().toISOString()
                    },
                    patient: patientData,
                    doctor: currentDoc,
                    triage: triageData
                  });
                }} 
                className="btn btn-primary"
                style={{ fontWeight: '700' }}
              >
                📄 Generate Printable A4 Medical Certificate
              </button>
              <button type="button" onClick={() => setSelectedBooking(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn btn-success">
                Finalize EMR Consultation
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', border: '1px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
            Select a patient from the queue to start their clinical consultation.
          </div>
        )}
      </div>

      {/* Printable A4 Medical Summary Certificate Modal */}
      {pdfReportConsult && (
        <ClinicalReportPDF
          consultation={pdfReportConsult.consultation}
          patient={pdfReportConsult.patient}
          doctor={pdfReportConsult.doctor}
          triage={pdfReportConsult.triage}
          clinicConfig={clinicConfig}
          onClose={() => setPdfReportConsult(null)}
        />
      )}
    </div>
  );
}
