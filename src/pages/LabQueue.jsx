import React, { useState, useEffect } from 'react';
import { db } from '../db/IndexedDB';
import { syncManager } from '../db/SyncManager';

export default function LabQueue() {
  const [pendingInvestigations, setPendingInvestigations] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientTests, setPatientTests] = useState([]);

  // Result form inputs mapping: { testId: { result_value: '...', normal_range: '...' } }
  const [resultsForm, setResultsForm] = useState({});
  const [nextRouting, setNextRouting] = useState('cashier'); // 'doctor' | 'cashier'

  // Inline Editing States
  const [editingTestId, setEditingTestId] = useState(null);
  const [editTestName, setEditTestName] = useState('');
  const [editTestPrice, setEditTestPrice] = useState(0);

  useEffect(() => {
    loadLabQueue();
  }, []);

  const loadLabQueue = async () => {
    try {
      const allInv = await db.getAll('investigations');
      const allPatients = await db.getAll('patients');
      const allBookings = await db.getAll('bookings');
      const clinicId = syncManager.getClinicId();

      // Find all pending tests for this clinic
      const pendingTests = allInv.filter(i => i.status === 'pending' && i.clinic_id === clinicId);
      
      // Group by patient_id
      const uniquePatientIds = [...new Set(pendingTests.map(t => t.patient_id))];
      
      const queueItems = uniquePatientIds.map(pid => {
        const patient = allPatients.find(p => p.id === pid);
        const tests = pendingTests.filter(t => t.patient_id === pid);
        
        // Find booking to show slot/doctor
        const testObj = tests[0];
        const consultId = testObj.consultation_id;
        const bookingId = consultId.replace('CS-', '');
        const booking = allBookings.find(b => b.id === bookingId);

        return {
          patientId: pid,
          patientName: patient ? patient.name : 'Unknown Patient',
          patientAge: patient ? patient.age : 'N/A',
          patientGender: patient ? patient.gender : 'N/A',
          bookingId,
          testCount: tests.length,
          tests
        };
      });

      setPendingInvestigations(queueItems);
    } catch (e) {
      console.error(e);
    }
  };

  const selectPatientQueue = (item) => {
    setSelectedPatient(item);
    
    // Set up results input fields with default normal reference values
    const formInit = {};
    item.tests.forEach(test => {
      // Provide standard defaults
      let refRange = 'Normal';
      if (test.test_name.includes('CBC')) refRange = 'Hb: 12-16 g/dL, WBC: 4000-11000/uL';
      if (test.test_name.includes('Sugar') || test.test_name.includes('FBS')) refRange = '70-100 mg/dL';
      if (test.test_name.includes('Lipid')) refRange = 'Cholesterol < 200 mg/dL';
      if (test.test_name.includes('LFT')) refRange = 'ALT: 7-56 U/L, AST: 10-40 U/L';
      if (test.test_name.includes('KFT')) refRange = 'Creatinine: 0.6-1.2 mg/dL';

      formInit[test.id] = {
        result_value: '',
        normal_range: refRange
      };
    });
    setResultsForm(formInit);
    setPatientTests(item.tests);
  };

  const handleSaveResults = async (e) => {
    e.preventDefault();
    
    // Check if all fields filled
    for (const tid of Object.keys(resultsForm)) {
      if (!resultsForm[tid].result_value) {
        alert('Please fill out the result values for all tests.');
        return;
      }
    }

    try {
      const clinicId = syncManager.getClinicId();

      // 1. Save all test results
      for (const test of patientTests) {
        const input = resultsForm[test.id];
        const updatedTest = {
          ...test,
          status: 'completed',
          result_value: input.result_value,
          normal_range: input.normal_range,
          recorded_at: new Date().toISOString()
        };
        await db.save('investigations', updatedTest);
      }

      // 2. Check if this patient has *any other* pending tests for this booking/consultation
      const allInv = await db.getAll('investigations');
      const remainingPending = allInv.filter(i => 
        i.consultation_id === `CS-${selectedPatient.bookingId}` && 
        i.status === 'pending' && 
        i.clinic_id === clinicId
      );

      // If no more pending tests for this visit, forward booking status based on routing select
      if (remainingPending.length === 0) {
        const booking = await db.get('bookings', selectedPatient.bookingId);
        if (booking) {
          if (nextRouting === 'doctor') {
            booking.status = 'checked_in'; // Send back to waiting queue
            booking.lab_results_ready = true; // Flag for doctor
          } else {
            booking.status = 'pending_checkout'; // Send directly to cashier POS
            booking.lab_results_ready = false;
          }
          await db.save('bookings', booking);
        }
      }

      alert(nextRouting === 'doctor' 
        ? 'Results saved. Patient returned to Doctor Queue for clinical re-access.' 
        : 'Results saved. Patient forwarded to Cashier Billing POS.'
      );
      setSelectedPatient(null);
      setPatientTests([]);
      setNextRouting('cashier'); // reset default
      loadLabQueue();
    } catch (err) {
      console.error(err);
    }
  };

  const updateResultValue = (testId, field, val) => {
    setResultsForm({
      ...resultsForm,
      [testId]: {
        ...resultsForm[testId],
        [field]: val
      }
    });
  };

  const handleDeleteTest = async (testId) => {
    if (!confirm('Are you sure you want to delete/cancel this pending investigation?')) return;
    try {
      // 1. Delete from database
      await db.delete('investigations', testId);

      // 2. Filter from patientTests state
      const updatedTests = patientTests.filter(t => t.id !== testId);
      setPatientTests(updatedTests);

      // 3. Update resultsForm state
      const updatedForm = { ...resultsForm };
      delete updatedForm[testId];
      setResultsForm(updatedForm);

      // 4. Update selectedPatient count
      const updatedPatient = {
        ...selectedPatient,
        testCount: updatedTests.length,
        tests: updatedTests
      };

      // 5. Check if all tests for this patient are gone
      if (updatedTests.length === 0) {
        const booking = await db.get('bookings', selectedPatient.bookingId);
        if (booking) {
          booking.status = 'pending_checkout';
          await db.save('bookings', booking);
        }
        alert('All pending investigations deleted. Patient routed to Cashier Billing POS.');
        setSelectedPatient(null);
      } else {
        setSelectedPatient(updatedPatient);
      }

      loadLabQueue();
    } catch (err) {
      console.error('Failed to delete pending investigation:', err);
    }
  };

  const handleSaveEditTest = async (test) => {
    if (!editTestName.trim()) return;
    try {
      const updatedTest = {
        ...test,
        test_name: editTestName.trim(),
        price: Number(editTestPrice) || 0
      };
      
      await db.save('investigations', updatedTest);
      
      const updatedTests = patientTests.map(t => t.id === test.id ? updatedTest : t);
      setPatientTests(updatedTests);
      
      const updatedPatient = {
        ...selectedPatient,
        tests: updatedTests
      };
      setSelectedPatient(updatedPatient);
      
      setEditingTestId(null);
      loadLabQueue();
      alert('Investigation details updated successfully.');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <header className="flex-wrap-safe no-print" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '800' }}>Lab & Radiology Investigation Room</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Review pending test orders, fill in diagnostics results, and send back to patient files</p>
        </div>
      </header>

      {/* Main Grid */}
      <div className={selectedPatient ? "responsive-split-grid-50 no-print" : "no-print"}>
        
        {/* Left Side: Pending Queue */}
        <div className="glass-card">
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem' }}>Pending Investigation Queue</h2>
          {pendingInvestigations.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No pending investigations currently.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pendingInvestigations.map(item => (
                <div 
                  key={item.patientId} 
                  onClick={() => selectPatientQueue(item)}
                  style={{
                    padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '10px',
                    cursor: 'pointer', background: selectedPatient?.patientId === item.patientId ? 'var(--primary-light)' : 'var(--bg-surface-solid)',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <strong style={{ color: selectedPatient?.patientId === item.patientId ? 'var(--primary)' : 'var(--text-primary)' }}>{item.patientName}</strong>
                    <span className="badge badge-pending">{item.testCount} Tests Ordered</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Patient ID: {item.patientId} | {item.patientGender} | {item.patientAge} Yrs
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Results Input Form Sheet */}
        {selectedPatient && (
          <form onSubmit={handleSaveResults} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem' }}>Input Results: {selectedPatient.patientName}</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: {selectedPatient.patientId}</span>
              </div>
              <button type="button" onClick={() => setSelectedPatient(null)} className="btn btn-secondary btn-icon">✕</button>
            </div>

            {/* Test Forms mapping */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {patientTests.map(test => (
                <div key={test.id} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', background: 'var(--bg-app)' }}>
                  {editingTestId === test.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div style={{ flex: 2 }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Modify Test Name</label>
                          <input 
                            type="text" 
                            value={editTestName} 
                            onChange={e => setEditTestName(e.target.value)} 
                            style={{ minHeight: '34px', padding: '0.25rem 0.5rem' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Price (Ks)</label>
                          <input 
                            type="number" 
                            value={editTestPrice} 
                            onChange={e => setEditTestPrice(e.target.value)} 
                            style={{ minHeight: '34px', padding: '0.25rem 0.5rem' }}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button type="button" onClick={() => setEditingTestId(null)} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', minHeight: '28px', fontSize: '0.75rem' }}>Cancel</button>
                        <button type="button" onClick={() => handleSaveEditTest(test)} className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', minHeight: '28px', fontSize: '0.75rem' }}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                      <div>
                        <strong style={{ color: 'var(--primary)' }}>{test.test_name}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.75rem' }}>({(test.price || 0).toLocaleString()} Ks)</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginRight: '0.5rem' }}>{test.test_type}</span>
                        <button 
                          type="button" 
                          onClick={() => {
                            setEditingTestId(test.id);
                            setEditTestName(test.test_name);
                            setEditTestPrice(test.price || 0);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '0.2rem 0.4rem', minHeight: '26px', fontSize: '0.7rem' }}
                        >
                          ✏️
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleDeleteTest(test.id)}
                          className="btn btn-danger"
                          style={{ padding: '0.2rem 0.4rem', minHeight: '26px', fontSize: '0.7rem' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="form-row">
                    <div className="form-group">
                      <label>Result Findings / Value *</label>
                      <input 
                        type="text"
                        required
                        placeholder="e.g. 13.5 g/dL, or Clear, No consolidations"
                        value={resultsForm[test.id]?.result_value || ''}
                        onChange={e => updateResultValue(test.id, 'result_value', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Normal Reference Guide</label>
                      <input 
                        type="text"
                        placeholder="e.g. 12.0 - 16.0 g/dL"
                        value={resultsForm[test.id]?.normal_range || ''}
                        onChange={e => updateResultValue(test.id, 'normal_range', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Next Destination Workflow Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <label style={{ fontWeight: '700', fontSize: '0.85rem' }}>Select Patient Next Destination:</label>
              <div style={{ display: 'flex', gap: '2rem', marginTop: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: '500' }}>
                  <input 
                    type="radio" 
                    name="nextRouting" 
                    value="doctor" 
                    checked={nextRouting === 'doctor'} 
                    onChange={() => setNextRouting('doctor')}
                    style={{ width: '18px', height: '18px', minHeight: 'auto' }}
                  />
                  👨‍⚕️ Send back to Doctor (Re-access waitlist)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: '500' }}>
                  <input 
                    type="radio" 
                    name="nextRouting" 
                    value="cashier" 
                    checked={nextRouting === 'cashier'} 
                    onChange={() => setNextRouting('cashier')}
                    style={{ width: '18px', height: '18px', minHeight: 'auto' }}
                  />
                  💳 Send directly to Cashier POS (Checkout)
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button type="button" onClick={() => { setSelectedPatient(null); setNextRouting('cashier'); }} className="btn btn-secondary">Cancel</button>
              <button type="submit" className="btn btn-success">Save Results & Route Patient</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
