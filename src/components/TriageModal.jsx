import React, { useState, useEffect } from 'react';
import { db } from '../db/IndexedDB';
import { syncManager } from '../db/SyncManager';

export default function TriageModal({ booking, onClose, onComplete }) {
  const [form, setForm] = useState({
    bp_sys: '',
    bp_dia: '',
    pulse: '',
    temperature: '98.6',
    resp_rate: '16',
    spo2: '98',
    weight: '',
    height_ft: '5',
    height_in: '7'
  });

  const [bmi, setBmi] = useState(null);
  const [bmiCategory, setBmiCategory] = useState('');

  // Auto-calculate BMI using imperial formula: BMI = 703 * lbs / (inches * inches)
  useEffect(() => {
    const w = parseFloat(form.weight);
    const ft = parseFloat(form.height_ft) || 0;
    const inch = parseFloat(form.height_in) || 0;
    const h = ft * 12 + inch;
    
    if (w > 0 && h > 0) {
      const calculatedBmi = (703 * w) / (h * h);
      setBmi(calculatedBmi.toFixed(1));
      
      if (calculatedBmi < 18.5) {
        setBmiCategory('Underweight');
      } else if (calculatedBmi >= 18.5 && calculatedBmi < 25) {
        setBmiCategory('Normal Weight');
      } else if (calculatedBmi >= 25 && calculatedBmi < 30) {
        setBmiCategory('Overweight');
      } else {
        setBmiCategory('Obese');
      }
    } else {
      setBmi(null);
      setBmiCategory('');
    }
  }, [form.weight, form.height_ft, form.height_in]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.bp_sys || !form.bp_dia || !form.pulse || !form.weight) {
      alert('Please fill out essential fields: BP Systolic, BP Diastolic, Heart Rate, and Weight.');
      return;
    }

    try {
      const clinicId = syncManager.getClinicId();
      const triageId = `TR-${booking.id}`;
      const heightInches = (parseInt(form.height_ft, 10) || 0) * 12 + (parseInt(form.height_in, 10) || 0);

      const triageRecord = {
        id: triageId,
        clinic_id: clinicId,
        booking_id: booking.id,
        patient_id: booking.patient_id,
        bp_sys: parseInt(form.bp_sys),
        bp_dia: parseInt(form.bp_dia),
        pulse: parseInt(form.pulse),
        temperature: parseFloat(form.temperature),
        resp_rate: parseInt(form.resp_rate),
        spo2: parseInt(form.spo2),
        weight: parseFloat(form.weight),
        height: heightInches,
        bmi: bmi ? parseFloat(bmi) : null,
        recorded_by: 'Nurse / Triage Officer',
        timestamp: new Date().toISOString()
      };

      // 1. Save vital signs
      await db.save('triage', triageRecord);

      // 2. Update booking status to 'checked_in' (meaning patient enters doctor's queue)
      const updatedBooking = {
        ...booking,
        status: 'checked_in'
      };
      
      // Delete temporary join fields before saving
      delete updatedBooking.patientName;
      delete updatedBooking.doctorName;

      await db.save('bookings', updatedBooking);

      alert('Patient checked-in to active doctor queue with recorded vital signs.');
      onComplete();
      onClose();
    } catch (e) {
      console.error('Triage save error:', e);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '550px' }}>
        <div className="modal-header">
          <h3>Pre-Consultation Vitals & Triage</h3>
          <button className="mobile-menu-btn" onClick={onClose} style={{ color: 'var(--text-primary)' }}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '24px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ background: 'var(--primary-light)', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
              Patient: <strong>{booking.patientName}</strong> | Doctor: <strong>{booking.doctorName}</strong>
            </div>

            {/* Blood Pressure Row */}
            <div className="form-row">
              <div className="form-group">
                <label>BP Systolic (mmHg) *</label>
                <input 
                  type="number" 
                  required
                  placeholder="e.g. 120"
                  value={form.bp_sys}
                  onChange={e => setForm({...form, bp_sys: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>BP Diastolic (mmHg) *</label>
                <input 
                  type="number" 
                  required
                  placeholder="e.g. 80"
                  value={form.bp_dia}
                  onChange={e => setForm({...form, bp_dia: e.target.value})}
                />
              </div>
            </div>

            {/* Pulse & Temperature */}
            <div className="form-row">
              <div className="form-group">
                <label>Heart Pulse (bpm) *</label>
                <input 
                  type="number" 
                  required
                  placeholder="e.g. 72"
                  value={form.pulse}
                  onChange={e => setForm({...form, pulse: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Body Temperature (°F) *</label>
                <input 
                  type="number" 
                  step="0.1"
                  required
                  placeholder="e.g. 98.6"
                  value={form.temperature}
                  onChange={e => setForm({...form, temperature: e.target.value})}
                />
              </div>
            </div>

            {/* Respiration & SpO2 */}
            <div className="form-row">
              <div className="form-group">
                <label>Respiratory Rate (cpm)</label>
                <input 
                  type="number" 
                  placeholder="e.g. 16"
                  value={form.resp_rate}
                  onChange={e => setForm({...form, resp_rate: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Oxygen SpO2 (%)</label>
                <input 
                  type="number" 
                  placeholder="e.g. 98"
                  value={form.spo2}
                  onChange={e => setForm({...form, spo2: e.target.value})}
                />
              </div>
            </div>

            {/* Weight, Height, and BMI panel */}
            <div className="form-row" style={{ gridTemplateColumns: '1.2fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Weight (lb) *</label>
                <input 
                  type="number" 
                  step="0.1"
                  required
                  placeholder="Weight in lb"
                  value={form.weight}
                  onChange={e => setForm({...form, weight: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Height (ft) *</label>
                <input 
                  type="number" 
                  required
                  placeholder="Feet"
                  value={form.height_ft}
                  onChange={e => setForm({...form, height_ft: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Height (in) *</label>
                <input 
                  type="number" 
                  required
                  placeholder="Inches"
                  value={form.height_in}
                  onChange={e => setForm({...form, height_in: e.target.value})}
                />
              </div>
            </div>

            {/* Interactive BMI readout */}
            {bmi && (
              <div style={{
                background: 'var(--bg-app)', padding: '1rem', borderRadius: '10px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Calculated BMI Score</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>{bmi}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Weight Category</span>
                  <div style={{ 
                    fontWeight: '700', 
                    color: bmiCategory === 'Normal Weight' ? 'var(--accent)' : 
                           bmiCategory === 'Overweight' ? 'var(--warning)' : 'var(--danger)'
                  }}>
                    {bmiCategory}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Check In Patient</button>
          </div>
        </form>
      </div>
    </div>
  );
}
