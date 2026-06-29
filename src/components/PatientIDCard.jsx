import React from 'react';

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

// Code39 Character Set Mapping for Barcode rendering
const CODE39_MAP = {
  '0': 'bwbwwwbbwb', '1': 'bbbwbwwwbb', '2': 'bwbwbwwwbb', '3': 'bbbwbwbwwb',
  '4': 'bwbwwwbbwb', '5': 'bbbwwwbwbwb', '6': 'bwbwwwbbbwb', '7': 'bwbwwwbwbww',
  '8': 'bbbwwwbwbwb', '9': 'bwbwwwbbbwb', 'A': 'bbbwbwbbwwb', 'B': 'bwbbwbwbbww',
  'C': 'bbbwbbwbwbb', 'D': 'bwbwbbwbbww', 'E': 'bbbwbbwbbww', 'F': 'bwbbwbbwbbw',
  'G': 'bwbwbwbbwbb', 'H': 'bbbwbwbwbbw', 'I': 'bwbbwbwbwbb', 'J': 'bwbwbbwbwbb',
  'K': 'bbbwbwbwwwb', 'L': 'bwbwbbbwwwb', 'M': 'bbbwbwbbbww', 'N': 'bwbwbbwwwbb',
  'O': 'bbbwbwbbwww', 'P': 'bwbbwbbwwwb', 'Q': 'bwbwbbwbbbww', 'R': 'bbbwbwbbwww',
  'S': 'bwbbwbbwwwb', 'T': 'bwbwbbwbbbww', 'U': 'bbbwbbwbwww', 'V': 'bwbbwbbwwww',
  'W': 'bbbwbbwbbww', 'X': 'bwbwbbwbbbww', 'Y': 'bbbwbbwbwww', 'Z': 'bwbbwbbwwww',
  '-': 'bwbwbbwwbww', '.': 'bbbwbbwwbww', ' ': 'bwbbwbbwwbww', '*': 'bwbwbwwbbww',
  '$': 'bwbwbwbwbww', '/': 'bwbwbwbwwbw', '+': 'bwbwwbwbwbw', '%': 'bwwbwbwbwbw'
};

function generateCode39Svg(text) {
  const formatted = `*${text.toUpperCase()}*`;
  let result = '';
  
  for (let i = 0; i < formatted.length; i++) {
    const char = formatted[i];
    const pattern = CODE39_MAP[char] || CODE39_MAP[' '];
    
    // Convert 'b' and 'w' to stroke patterns
    // We add inter-character gap (narrow white bar 'w')
    result += pattern + 'w';
  }

  // Draw SVG based on result string
  const bars = [];
  let x = 0;
  const height = 40;
  const narrowWidth = 1.5;
  const wideWidth = 3.5;

  for (let i = 0; i < result.length; i++) {
    const isBar = result[i] === 'b';
    // Even indices/characters map width: let's do simple narrow/wide bar logic
    const isWide = (i % 2 === 1); 
    const width = isWide ? wideWidth : narrowWidth;

    if (isBar) {
      bars.push(
        <rect 
          key={i} 
          x={x} 
          y={0} 
          width={width} 
          height={height} 
          fill="#000000" 
        />
      );
    }
    x += width;
  }

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${x} ${height}`} style={{ display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' }}>
      {bars}
    </svg>
  );
}

export default function PatientIDCard({ patient, clinicConfig, onClose }) {
  if (!patient) return null;

  const handlePrint = () => {
    if (window.AndroidPrintBridge && typeof window.AndroidPrintBridge.printPage === 'function') {
      window.AndroidPrintBridge.printPage();
    } else {
      window.print();
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content no-print" style={{ maxWidth: '420px', width: '95%' }}>
        <div className="modal-header">
          <h3>Patient ID Card Issuing</h3>
          <button className="mobile-menu-btn" onClick={onClose} style={{ color: 'var(--text-primary)' }}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '24px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          
          {/* Card Frame (Visual Representation) */}
          <div className="id-card-print" style={{
            maxWidth: '100%',
            width: '320px',
            height: '200px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#fff',
            borderRadius: '12px',
            padding: '1rem',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            fontFamily: 'var(--font-body)',
            overflow: 'hidden'
          }}>
            {/* Background design accents */}
            <div style={{
              position: 'absolute', right: '-20px', top: '-20px', width: '120px', height: '120px',
              background: 'radial-gradient(circle, rgba(14,165,233,0.15) 0%, transparent 70%)',
              borderRadius: '50%'
            }} />

            {/* Clinic Details */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: '800', fontSize: '0.9rem', color: '#38bdf8', fontFamily: 'var(--font-display)' }}>
                  {clinicConfig?.clinic_name || 'AURA CLINIC'}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                  {clinicConfig?.phone || '09-xxxxxxxxx'}
                </div>
              </div>
              <div style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', background: 'rgba(56,189,248,0.1)', borderRadius: '4px', color: '#38bdf8', fontWeight: 'bold' }}>
                PATIENT PASS
              </div>
            </div>

            {/* Patient Details */}
            <div style={{ display: 'flex', gap: '1rem', flex: '1', margin: '0.5rem 0', alignItems: 'center' }}>
              {/* Photo Frame */}
              <div style={{
                width: '55px', height: '55px', borderRadius: '8px', 
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
              }}>
                {patient.photo_base64 ? (
                  <img 
                    src={patient.photo_base64} 
                    alt={patient.name} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : (
                  patient.gender === 'Female' ? <FemaleSilhouette /> : <MaleSilhouette />
                )}
              </div>

              {/* Text metadata */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', letterSpacing: '-0.01em', color: '#fff' }}>{patient.name}</div>
                <div style={{ fontSize: '0.7rem', color: '#e2e8f0' }}>ID: <strong style={{ color: '#38bdf8' }}>{patient.id}</strong></div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                  {patient.gender} | {patient.age} Yrs | Blood: <span style={{ color: '#34d399', fontWeight: 'bold' }}>{patient.blood_group || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Barcode scan rendering */}
            <div style={{ background: '#fff', padding: '4px', borderRadius: '4px', alignSelf: 'stretch' }}>
              {generateCode39Svg(patient.id)}
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            ID cards print cleanly on standard thermal cards or custom label templates.
          </p>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">Close</button>
          <button onClick={handlePrint} className="btn btn-primary">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '16px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Card
          </button>
        </div>
      </div>

      {/* Hidden print page block specifically rendered for `@media print` */}
      <div className="only-print print-area">
        <div className="id-card-print" style={{
          width: '85.6mm',
          height: '53.98mm',
          border: '1px solid #000',
          borderRadius: '6px',
          padding: '10px',
          fontFamily: 'monospace',
          color: '#000',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#fff'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '10pt' }}>{clinicConfig?.clinic_name || 'AURA CLINIC'}</div>
              <div style={{ fontSize: '7pt' }}>{clinicConfig?.phone || ''}</div>
            </div>
            <div style={{ fontSize: '8pt', fontWeight: 'bold' }}>PATIENT ID</div>
          </div>

          <div style={{ display: 'flex', gap: '10px', margin: '5px 0', alignItems: 'center' }}>
            <div style={{ width: '45px', height: '45px', border: '1px solid #000', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {patient.photo_base64 ? (
                <img src={patient.photo_base64} alt={patient.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                patient.gender === 'Female' ? <FemaleSilhouette /> : <MaleSilhouette />
              )}
            </div>
            <div style={{ fontSize: '8pt' }}>
              <div><strong>Name: {patient.name}</strong></div>
              <div>ID: {patient.id}</div>
              <div>Age/Sex: {patient.age} / {patient.gender}</div>
              <div>Blood: {patient.blood_group}</div>
            </div>
          </div>

          <div style={{ background: '#fff', borderTop: '1px solid #000', paddingTop: '4px' }}>
            {generateCode39Svg(patient.id)}
          </div>
        </div>
      </div>
    </div>
  );
}
