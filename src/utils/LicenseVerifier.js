import { Device } from '@capacitor/device';

// SPKI Public Key for Medflow License Verification (RSA-2048 SHA-256)
const PUBLIC_KEY_B64 = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1TllnNIponXKctT5w/HVTi8TnUCeIEsK+FH8IfWPY2MowcHCNizGophglQywENebIBSK6xTj19q7Sz52kgb6WiEZbQq/gElIX4/mdxsiLlqQohUguaD7Lfma1L0EjDh9bY9HdbMEcBt+McRne7SWGi2AZ6ezSM4yiJAdMlP5j/G3f9P+AfIsVa2mTXGlFufprNr1BwfnlDNC7czZaL3jeoyrJ58/5QjOvM1LiXWErkQjRWUmgU+NarHsGcgPi8TpLHZLMVM9uHuW9nKYEndD5h8d5iipFJhJc9A7DSxAO0e+DSmtDMIZ45L4+kAG6DP5o4HZ18XRuV74DyhZOzvLnQIDAQAB";

function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function getDeviceUuid() {
  // If running in Electron environment (Windows native app wrapper)
  if (window.electronAPI && typeof window.electronAPI.getMachineId === 'function') {
    try {
      return await window.electronAPI.getMachineId();
    } catch (err) {
      console.error('Failed to get native hardware ID:', err);
    }
  }

  // If running in Capacitor environment (Android/iOS native mobile wrapper)
  if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
    try {
      const deviceIdInfo = await Device.getId();
      return deviceIdInfo.uuid ? deviceIdInfo.uuid.toUpperCase() : 'UNKNOWN-MOBILE-ID';
    } catch (err) {
      console.error('Failed to get native mobile ID:', err);
    }
  }
  
  // Web Browser / Vercel deployment persistent fingerprint
  let browserUuid = localStorage.getItem('medflow_browser_uuid');
  if (!browserUuid) {
    const randomSeed = window.crypto && typeof window.crypto.randomUUID === 'function' 
      ? window.crypto.randomUUID() 
      : (Date.now().toString(36) + Math.random().toString(36).substring(2, 9));
    browserUuid = 'WEB-' + randomSeed.toUpperCase();
    localStorage.setItem('medflow_browser_uuid', browserUuid);
  }
  return browserUuid;
}

export async function verifyLicenseKey(activationKey) {
  if (!activationKey || typeof activationKey !== 'string') return null;

  try {
    const parts = activationKey.trim().split('.');
    if (parts.length !== 2) return null;

    const payloadB64 = parts[0];
    const signatureB64 = parts[1];

    const payloadStr = window.atob(payloadB64);
    const payload = JSON.parse(payloadStr);

    // 1. Import Public Key SPKI DER
    const pubKeyDer = base64ToArrayBuffer(PUBLIC_KEY_B64);
    const cryptoKey = await window.crypto.subtle.importKey(
      "spki",
      pubKeyDer,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: { name: "SHA-256" }
      },
      false,
      ["verify"]
    );

    // 2. Convert Data & Signature
    const sigBuffer = base64ToArrayBuffer(signatureB64);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(payloadStr);

    // 3. Perform Cryptographic Verification
    const isValid = await window.crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      sigBuffer,
      dataBuffer
    );

    if (!isValid) {
      console.warn('License key cryptographic signature is invalid or tampered.');
      return null;
    }

    const now = new Date();

    // 4. Enforce Expiry Date
    const expiryDate = new Date(payload.expiry);
    if (now > expiryDate) {
      return { ...payload, status: 'expired' };
    }

    // 5. Enforce Clock Tampering Safeguards
    const lastRunStr = localStorage.getItem('medflow_last_run');
    if (lastRunStr) {
      const lastRun = new Date(lastRunStr);
      // Allow 5 minutes of clock drift safety margin
      if (now.getTime() < lastRun.getTime() - 5 * 60 * 1000) {
        return { ...payload, status: 'clock_tampered' };
      }
    }

    // 6. Enforce Hardware Locking binding if set (not "ANY")
    if (payload.hardwareUuid && payload.hardwareUuid !== 'ANY') {
      const currentUuid = await getDeviceUuid();
      if (payload.hardwareUuid !== currentUuid) {
        return { ...payload, status: 'uuid_mismatch' };
      }
    }

    // Update anti-tamper log timestamp
    localStorage.setItem('medflow_last_run', now.toISOString());

    return { ...payload, status: 'active' };
  } catch (err) {
    console.error('License key verification parsing error:', err);
    return null;
  }
}
