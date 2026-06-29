import React, { useState } from 'react';

export default function ClinicalReportPDF({ 
  consultation, 
  patient, 
  doctor, 
  triage, 
  clinicConfig, 
  onClose 
}) {
  const [recommendation, setRecommendation] = useState('');

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = consultation?.timestamp 
    ? new Date(consultation.timestamp).toLocaleString('en-US', { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit', hour12: true 
      })
    : new Date().toLocaleString();

  return (
    <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.85)', zIndex: 99999 }}>
      <div className="modal-content no-print-modal-box" style={{ maxWidth: '850px', width: '95%', maxHeight: '92vh', overflowY: 'auto', background: '#fff', color: '#0f172a', padding: '0', borderRadius: '12px' }}>
        
        {/* Control Bar (Hidden on Print) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', background: '#1e293b', color: '#fff', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>📄 Clinical Medical Summary Certificate (A4)</h3>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Preview before printing or saving as PDF</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button onClick={handlePrint} className="btn btn-primary" style={{ padding: '0.4rem 1.25rem', fontWeight: '700', fontSize: '0.9rem' }}>
              🖨️ Print / Save as PDF
            </button>
            <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem' }}>
              ✕ Close
            </button>
          </div>
        </div>

        {/* Doctor Recommendation Input Bar (Hidden on Print) */}
        <div className="no-print" style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <label style={{ fontWeight: '700', fontSize: '0.85rem', display: 'block', marginBottom: '0.35rem', color: '#334155' }}>
            ✏️ Doctor's Additional Recommendation & Special Instructions (Optional):
          </label>
          <textarea 
            rows={2}
            placeholder="e.g. Complete 5 days antibiotic course, rest for 3 days, avoid heavy lifting. Follow up in 1 week if symptoms persist."
            value={recommendation}
            onChange={e => setRecommendation(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', color: '#0f172a', background: '#fff' }}
          />
        </div>

        {/* Printable A4 Document Body */}
        <div className="printable-a4-document print-area" style={{ padding: '2.5rem 3rem', fontFamily: 'Inter, Arial, sans-serif', color: '#0f172a', background: '#fff' }}>
          
          {/* Header / Letterhead */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #0284c7', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <img 
                src={clinicConfig?.logo_base64 || "./logo.png"} 
                alt="Clinic Logo" 
                style={{ height: '65px', width: 'auto', maxWidth: '150px', objectFit: 'contain' }} 
              />
              <div>
                <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800', color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {clinicConfig?.clinic_name || 'MEDFLOW CLINIC'}
                </h1>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#475569' }}>
                  {clinicConfig?.address || 'Yangon, Myanmar'}
                </p>
                <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.85rem', color: '#475569' }}>
                  <strong>Ph:</strong> {clinicConfig?.phone || 'N/A'} {clinicConfig?.email ? ` | Email: ${clinicConfig.email}` : ''}
                </p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'inline-block', background: '#e0f2fe', color: '#0369a1', padding: '0.25rem 0.75rem', borderRadius: '4px', fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                MEDICAL SUMMARY
              </span>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}><strong>Visit Date:</strong> {formattedDate}</p>
              <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}><strong>Report ID:</strong> {consultation?.id || 'CS-REC'}</p>
            </div>
          </div>

          {/* Patient Profile Metadata Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: '0.75rem', background: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            <div><strong>Patient Name:</strong> <span style={{ color: '#0f172a', fontWeight: '700' }}>{patient?.name || 'N/A'}</span></div>
            <div><strong>Patient ID:</strong> {patient?.id || 'N/A'}</div>
            <div><strong>Age / Gender:</strong> {patient?.age || 'N/A'} Yrs / {patient?.gender || 'N/A'}</div>
            <div><strong>Blood Group:</strong> {patient?.blood_group || 'N/A'}</div>
          </div>

          {/* Vitals Summary Strip */}
          {triage && (
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', background: '#fafafa', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px border #e2e8f0', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#334155' }}>
              <span><strong>BP:</strong> {triage.bp_sys}/{triage.bp_dia} mmHg</span>
              <span><strong>Pulse:</strong> {triage.pulse} bpm</span>
              <span><strong>Temp:</strong> {triage.temperature} °F</span>
              <span><strong>SpO2:</strong> {triage.spo2}%</span>
              <span><strong>Weight:</strong> {triage.weight} lb</span>
            </div>
          )}

          {/* 1. Clinical Symptoms & Medical History */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0369a1', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem', marginTop: 0, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
              1. Chief Complaints & Clinical History
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.5', color: '#1e293b' }}>
              <strong>Symptoms:</strong> {consultation?.symptoms || 'None reported'}<br/>
              {consultation?.history && (<span><strong>Past Medical History:</strong> {consultation.history}</span>)}
            </p>
          </div>

          {/* 2. Physical Examination */}
          {consultation?.examination && (
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0369a1', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem', marginTop: 0, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                2. Physical Examination Findings
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.5', color: '#1e293b' }}>
                {consultation.examination}
              </p>
            </div>
          )}

          {/* 3. Diagnostic Investigations & Results */}
          {consultation?.investigations && consultation.investigations.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0369a1', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem', marginTop: 0, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                3. Diagnostic Investigations & Results
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginTop: '0.35rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', textTransform: 'uppercase' }}>
                    <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Investigation Test</th>
                    <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Type</th>
                    <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Findings / Result Value</th>
                    <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Reference Range</th>
                  </tr>
                </thead>
                <tbody>
                  {consultation.investigations.map((inv, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', fontWeight: '600' }}>{inv.test_name}</td>
                      <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0' }}>{inv.test_type === 'lab' ? 'Laboratory' : 'Radiology'}</td>
                      <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', color: inv.status === 'completed' ? '#0284c7' : '#d97706', fontWeight: '600' }}>
                        {inv.status === 'completed' ? inv.result_value : 'Pending Results'}
                      </td>
                      <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', color: '#64748b' }}>{inv.normal_range || 'Normal'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 4. Clinical Diagnosis */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0369a1', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem', marginTop: 0, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
              4. Clinical Diagnosis
            </h3>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '6px', borderLeft: '4px solid #0284c7' }}>
              {consultation?.diagnosis || 'Unspecified'}
            </p>
          </div>

          {/* 5. Treatment Plan & Prescribed Medications */}
          {consultation?.prescriptions && consultation.prescriptions.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0369a1', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem', marginTop: 0, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                5. Treatment Plan (Prescribed Medications)
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginTop: '0.35rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', textTransform: 'uppercase' }}>
                    <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Medication</th>
                    <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Dose & Route</th>
                    <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Frequency</th>
                    <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Duration</th>
                    <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>Total Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {consultation.prescriptions.map((m, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', fontWeight: '600' }}>{m.name}</td>
                      <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0' }}>{m.dosage} ({m.route})</td>
                      <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0' }}>{m.frequency}</td>
                      <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0' }}>{m.duration} Days</td>
                      <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '700' }}>{m.qty_sold || m.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 6. Doctor Recommendations & Advice (Optional) */}
          {recommendation && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0369a1', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem', marginTop: 0, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                6. Doctor's Recommendation & Special Advice
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.5', color: '#334155', background: '#fffbebf5', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #fef3c7' }}>
                {recommendation}
              </p>
            </div>
          )}

          {/* Footer Authorization / Doctor Signature Block */}
          <div style={{ marginTop: '2.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', pageBreakInside: 'avoid' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Verified Official Record</p>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>Date Issued: {formattedDate}</p>
            </div>
            
            <div style={{ textAlign: 'center', minWidth: '220px' }}>
              {consultation?.doctor_signature ? (
                <img 
                  src={consultation.doctor_signature} 
                  alt="Doctor Signature" 
                  style={{ maxHeight: '55px', maxWidth: '180px', objectFit: 'contain', marginBottom: '0.2rem' }} 
                />
              ) : (
                <div style={{ height: '45px', borderBottom: '1px dashed #cbd5e1', marginBottom: '0.4rem' }}></div>
              )}
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>
                {doctor?.name || 'Attending Medical Officer'}
              </h4>
              {doctor?.qualification && (
                <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.8rem', color: '#475569', fontWeight: '600' }}>
                  {doctor.qualification}
                </p>
              )}
              {doctor?.rank && (
                <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  {doctor.rank}
                </p>
              )}
            </div>
          </div>

          {/* Very End System Footer */}
          <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8', letterSpacing: '0.02em', textTransform: 'uppercase', fontWeight: '600' }}>
              MedFlow Clinic Management System : Powered by Vitalyx Medtech
            </p>
          </div>

        </div>
      </div>

      {/* Embedded Print CSS for exact A4 rendering */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: #fff !important;
            color: #000 !important;
          }
          .modal-overlay {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: #fff !important;
            z-index: 999999 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print-modal-box {
            max-width: 100% !important;
            width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: #fff !important;
          }
          .printable-a4-document {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 15mm 15mm !important;
            margin: 0 !important;
            background: #fff !important;
            color: #0f172a !important;
            visibility: visible !important;
            box-sizing: border-box !important;
          }
          .printable-a4-document * {
            visibility: visible !important;
          }
        }
      `}</style>
    </div>
  );
}
