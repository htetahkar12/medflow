import React, { useState } from 'react';
import { supabase } from '../db/supabaseClient';

export default function Auth({ onAuthSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isSignUp) {
        // Register new user and generate a unique clinical partition ID in metadata
        const clinicId = 'CL-MED-' + Math.random().toString(36).substring(2, 11).toUpperCase();
        
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              clinic_id: clinicId,
              role: 'admin'
            }
          }
        });

        if (error) throw error;

        setSuccessMsg('Registration successful! Please check your email inbox to confirm your account verification.');
      } else {
        // Sign in existing user
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        // Retrieve clinic ID partition from user metadata and save to local config
        const userClinicId = data.user?.user_metadata?.clinic_id || 'CL-MED-DEFAULT';
        localStorage.setItem('aura_clinic_config', JSON.stringify({ clinic_id: userClinicId }));
        
        if (typeof onAuthSuccess === 'function') {
          onAuthSuccess(data.user);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
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
        maxWidth: '420px',
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
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Cloud Synchronization Space</span>
        </div>

        <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: '0 0 0.25rem 0', color: '#f1f5f9' }}>
            {isSignUp ? 'Create Clinic Account' : 'Sign In to Clinic'}
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
            {isSignUp ? 'Register to initialize your cloud database' : 'Log in to synchronize patient records'}
          </p>
        </div>

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ color: '#e2e8f0', fontSize: '0.85rem', marginBottom: '0.35rem', display: 'block' }}>Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. doctor@clinic.com"
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '0.65rem 0.75rem',
                color: '#f8fafc',
                fontSize: '0.85rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ color: '#e2e8f0', fontSize: '0.85rem', marginBottom: '0.35rem', display: 'block' }}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '0.65rem 0.75rem',
                color: '#f8fafc',
                fontSize: '0.85rem',
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
              padding: '0.65rem 0.75rem',
              color: '#fca5a5',
              fontSize: '0.8rem',
              lineHeight: '1.4'
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '8px',
              padding: '0.65rem 0.75rem',
              color: '#a7f3d0',
              fontSize: '0.8rem',
              lineHeight: '1.4'
            }}>
              ✓ {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #0ea5e9, #10b981)',
              border: 'none',
              color: '#ffffff',
              padding: '0.75rem',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              opacity: loading ? 0.6 : 1,
              marginTop: '0.5rem',
              minHeight: '40px'
            }}
          >
            {loading ? 'Processing...' : (isSignUp ? 'Register Account' : 'Sign In')}
          </button>
        </form>

        <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
          {isSignUp ? 'Already have a clinic account?' : "First time setting up Medflow Cloud?"}{' '}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#38bdf8',
              cursor: 'pointer',
              fontWeight: '600',
              padding: 0,
              textDecoration: 'underline'
            }}
          >
            {isSignUp ? 'Sign In instead' : 'Register Clinic Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
