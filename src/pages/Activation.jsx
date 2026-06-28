import React, { useState, useEffect } from 'react';
import { getDeviceUuid, verifyLicenseKey } from '../utils/LicenseVerifier';

export default function Activation({ onActivated }) {
  const [deviceUuid, setDeviceUuid] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadUuid() {
      const uuid = await getDeviceUuid();
      setDeviceUuid(uuid);
    }
    loadUuid();
  }, []);

  const handleCopyUuid = () => {
    navigator.clipboard.writeText(deviceUuid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!keyInput.trim()) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const result = await verifyLicenseKey(keyInput);
      if (!result) {
        setErrorMsg('Invalid Activation Key. The cryptographic signature did not match.');
      } else if (result.status === 'expired') {
        setErrorMsg(`Activation Key has expired on ${new Date(result.expiry).toLocaleDateString()}.`);
      } else if (result.status === 'clock_tampered') {
        setErrorMsg('System clock manipulation detected. Please correct your date & time settings.');
      } else if (result.status === 'uuid_mismatch') {
        setErrorMsg('This Activation Key is locked to a different device.');
      } else if (result.status === 'active') {
        // Save to storage
        localStorage.setItem('medflow_activation_key', keyInput.trim());
        localStorage.setItem('aura_clinic_scale', result.scale);
        
        // Dispatch mutate event to update layouts
        window.dispatchEvent(new Event('aura_data_mutated'));
        
        if (typeof onActivated === 'function') {
          onActivated(result);
        }
      }
    } catch (err) {
      setErrorMsg('Failed to process key. Ensure format is correct.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0b1329 0%, #1c2541 100%)',
      fontFamily: 'Inter, sans-serif',
      color: '#f8fafc',
      padding: '1rem'
    }}>
      <div className="glass-card" style={{
        maxWidth: '480px',
        width: '100%',
        padding: '2.5rem',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        textAlign: 'center'
      }}>
        {/* Header Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <img src="./logo.png" alt="Medflow Logo" style={{ width: '64px', height: '64px', borderRadius: '14px', boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)' }} />
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', margin: 0, background: 'linear-gradient(135deg, #38bdf8, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Medflow
          </h1>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Developed by Vitalyx Medtech</span>
        </div>

        <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: '0 0 0.25rem 0', color: '#f1f5f9' }}>License Activation Required</h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>Activate your offline clinical workspace to proceed.</p>
        </div>

        {/* Device ID Display */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '12px',
          padding: '1rem',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Your Device Footprint ID
          </label>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <code style={{ fontSize: '0.85rem', color: '#cbd5e1', wordBreak: 'break-all', fontFamily: 'monospace' }}>
              {deviceUuid || 'Retrieving ID...'}
            </code>
            <button 
              onClick={handleCopyUuid} 
              type="button" 
              className="btn" 
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: '#cbd5e1',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleActivate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ color: '#e2e8f0', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>
              Enter Activation Key
            </label>
            <textarea
              required
              rows={4}
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="Paste your base64 activation key here..."
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '0.75rem',
                color: '#f8fafc',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                resize: 'none',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            />
          </div>

          {errorMsg && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              padding: '0.75rem',
              color: '#fca5a5',
              fontSize: '0.8rem',
              lineHeight: '1.4'
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || !keyInput.trim()}
            style={{
              background: 'linear-gradient(135deg, #0ea5e9, #10b981)',
              border: 'none',
              color: '#ffffff',
              padding: '0.85rem',
              borderRadius: '10px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              opacity: (loading || !keyInput.trim()) ? 0.6 : 1,
              marginTop: '0.5rem',
              minHeight: '44px'
            }}
          >
            {loading ? 'Validating License...' : 'Activate Medflow'}
          </button>
        </form>

        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
          Need assistance or a license renewal?<br/>
          Contact: <a href="mailto:vitalyxmedtech@protonmail.com" style={{ color: '#38bdf8', textDecoration: 'none' }}>vitalyxmedtech@protonmail.com</a>
        </div>
      </div>
    </div>
  );
}
