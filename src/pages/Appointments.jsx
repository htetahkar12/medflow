import React, { useState, useEffect } from 'react';
import { db } from '../db/IndexedDB';
import { syncManager } from '../db/SyncManager';
import TriageModal from '../components/TriageModal';

export default function Appointments({ clinicMode, dutyDoctorId }) {
  const [bookings, setBookings] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Booking Form State
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    patient_id: '',
    doctor_id: '',
    time_slot: '09:00 AM',
    notes: ''
  });

  useEffect(() => {
    if ((clinicMode === 'solo_gp' || clinicMode === 'standard_gp') && dutyDoctorId) {
      setBookingForm(prev => ({ ...prev, doctor_id: dutyDoctorId }));
    }
  }, [clinicMode, dutyDoctorId, showBookingModal]);

  // Triage state
  const [triageBooking, setTriageBooking] = useState(null);

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    loadBookings();
  }, [selectedDate]);

  const loadBaseData = async () => {
    const clinicId = syncManager.getClinicId();
    const allPatients = await db.getAll('patients');
    const allDoctors = await db.getAll('doctors');
    
    setPatients(allPatients.filter(p => p.clinic_id === clinicId));
    setDoctors(allDoctors.filter(d => d.clinic_id === clinicId));
  };

  const loadBookings = async () => {
    try {
      const allBookings = await db.getAll('bookings');
      const allPatients = await db.getAll('patients');
      const allDoctors = await db.getAll('doctors');
      const clinicId = syncManager.getClinicId();

      const joinedBookings = allBookings
        .filter(b => b.date === selectedDate && b.clinic_id === clinicId)
        .map(b => {
          const patient = allPatients.find(p => p.id === b.patient_id);
          const doctor = allDoctors.find(d => d.id === b.doctor_id);
          return {
            ...b,
            patientName: patient ? patient.name : 'Unknown Patient',
            patientPhone: patient ? patient.phone : 'N/A',
            doctorName: doctor ? doctor.name : 'Unassigned'
          };
        });

      // Sort by time slot
      joinedBookings.sort((a, b) => a.time_slot.localeCompare(b.time_slot));
      setBookings(joinedBookings);
    } catch (e) {
      console.error('Error loading bookings:', e);
    }
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    if (!bookingForm.patient_id || !bookingForm.doctor_id) {
      alert('Please select a patient and a doctor.');
      return;
    }

    try {
      const clinicId = syncManager.getClinicId();
      const bookingId = `BK-${Date.now()}`;

      const newBooking = {
        id: bookingId,
        clinic_id: clinicId,
        patient_id: bookingForm.patient_id,
        doctor_id: bookingForm.doctor_id,
        date: selectedDate,
        time_slot: bookingForm.time_slot,
        status: 'scheduled', // default
        notes: bookingForm.notes
      };

      await db.save('bookings', newBooking);
      setShowBookingModal(false);
      setBookingForm({
        patient_id: '',
        doctor_id: '',
        time_slot: '09:00 AM',
        notes: ''
      });
      loadBookings();
      alert('Appointment booked successfully.');
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelBooking = async (booking) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      const updated = { ...booking, status: 'cancelled' };
      delete updated.patientName;
      delete updated.doctorName;
      delete updated.patientPhone;
      await db.save('bookings', updated);
      loadBookings();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      <header className="flex-wrap-safe no-print" style={{ justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '800' }}>Receptionist Queue & Booking</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Schedule visits, review active queues, and perform pre-consultation check-in</p>
        </div>
        <button onClick={() => setShowBookingModal(true)} className="btn btn-primary">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Schedule Appointment
        </button>
      </header>

      {/* Date selector filter toolbar */}
      <div className="glass-card flex-wrap-safe no-print" style={{ marginBottom: '1.5rem', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ margin: 0 }}>Target Date:</label>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ width: 'auto', minHeight: '38px', padding: '0.5rem 1rem' }}
          />
        </div>
        <div>
          <strong>Today's Bookings:</strong> {bookings.length}
        </div>
      </div>

      {/* Bookings Queue listing */}
      <div className="glass-card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Appointments for {selectedDate}</h2>
        
        <div className="table-container">
          {bookings.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No appointments scheduled for this date.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Time Slot</th>
                  <th>Patient Name & ID</th>
                  <th>Contact</th>
                  <th>Assigned Practitioner</th>
                  <th>Status</th>
                  <th className="no-print">Triage / Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{b.time_slot}</td>
                    <td>
                      <div style={{ fontWeight: '600' }}>{b.patientName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.id} ({b.patient_id})</div>
                    </td>
                    <td>{b.patientPhone}</td>
                    <td>{b.doctorName}</td>
                    <td>
                      {b.status === 'scheduled' && <span className="badge badge-pending">Scheduled</span>}
                      {b.status === 'checked_in' && <span className="badge badge-active">Checked In</span>}
                      {b.status === 'in_consultation' && <span className="badge badge-active">Consulting</span>}
                      {b.status === 'pending_lab' && <span className="badge badge-pending">Lab Pending</span>}
                      {b.status === 'pending_checkout' && <span className="badge badge-pending">POS Billing</span>}
                      {b.status === 'completed' && <span className="badge badge-success">Completed</span>}
                      {b.status === 'cancelled' && <span className="badge badge-danger">Cancelled</span>}
                    </td>
                    <td className="no-print">
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {b.status === 'scheduled' && (
                          <>
                            <button 
                              onClick={() => setTriageBooking(b)} 
                              className="btn btn-success"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', minHeight: '32px' }}
                            >
                              Check In & Triage
                            </button>
                            <button 
                              onClick={() => handleCancelBooking(b)} 
                              className="btn btn-danger btn-icon"
                              style={{ width: '32px', height: '32px', minHeight: '32px' }}
                            >
                              ✕
                            </button>
                          </>
                        )}
                        {b.status === 'checked_in' && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Waiting for Doctor</span>
                        )}
                        {b.status === 'completed' && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>Finished</span>
                        )}
                        {b.status === 'cancelled' && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>Voided</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Appointment Booking Modal */}
      {showBookingModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Schedule New Appointment</h3>
              <button className="mobile-menu-btn" onClick={() => setShowBookingModal(false)} style={{ color: 'var(--text-primary)' }}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '24px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateBooking}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                <div className="form-group">
                  <label>Select Registered Patient *</label>
                  <select 
                    required 
                    value={bookingForm.patient_id}
                    onChange={e => setBookingForm({...bookingForm, patient_id: e.target.value})}
                  >
                    <option value="">-- Choose Patient --</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.id} - {p.phone})</option>
                    ))}
                  </select>
                </div>

                 <div className="form-group">
                  <label>Physician *</label>
                  {clinicMode === 'solo_gp' || clinicMode === 'standard_gp' ? (
                    (() => {
                      const dutyDoc = doctors.find(d => d.id === dutyDoctorId);
                      return (
                        <input 
                          type="text" 
                          readOnly 
                          value={dutyDoc ? `${dutyDoc.name} (${dutyDoc.specialty})` : 'No doctor on duty selected'} 
                          style={{ background: 'var(--bg-app)', cursor: 'not-allowed' }}
                        />
                      );
                    })()
                  ) : (
                    <select 
                      required 
                      value={bookingForm.doctor_id}
                      onChange={e => setBookingForm({...bookingForm, doctor_id: e.target.value})}
                    >
                      <option value="">-- Choose Doctor --</option>
                      {doctors.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="form-group">
                  <label>Preferred Time Slot *</label>
                  <select 
                    required 
                    value={bookingForm.time_slot}
                    onChange={e => setBookingForm({...bookingForm, time_slot: e.target.value})}
                  >
                    <option>09:00 AM</option><option>09:30 AM</option>
                    <option>10:00 AM</option><option>10:30 AM</option>
                    <option>11:00 AM</option><option>11:30 AM</option>
                    <option>12:00 PM</option><option>01:00 PM</option>
                    <option>01:30 PM</option><option>02:00 PM</option>
                    <option>02:30 PM</option><option>03:00 PM</option>
                    <option>03:30 PM</option><option>04:00 PM</option>
                    <option>04:30 PM</option><option>05:00 PM</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Reason for Visit / Special Notes</label>
                  <textarea 
                    placeholder="Describe main complaints or reason..."
                    value={bookingForm.notes}
                    onChange={e => setBookingForm({...bookingForm, notes: e.target.value})}
                    rows={3}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowBookingModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Book Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Triage Form overlay */}
      {triageBooking && (
        <TriageModal 
          booking={triageBooking}
          onClose={() => setTriageBooking(null)}
          onComplete={loadBookings}
        />
      )}
    </div>
  );
}
