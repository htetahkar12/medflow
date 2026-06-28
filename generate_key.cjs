const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Target paths
const privateKeyPath = path.join(__dirname, 'private.pem');

// 1. Check if private key exists
if (!fs.existsSync(privateKeyPath)) {
  console.error('Error: private.pem key file not found in the scratch directory.');
  console.log('Run key_generator.js first to generate key pair.');
  process.exit(1);
}

const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');

// 2. Parse arguments
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('\n================================================================');
  console.log('            MEDFLOW LICENSE ACTIVATION KEY GENERATOR            ');
  console.log('================================================================');
  console.log('Usage:');
  console.log('  node generate_key.js "<Clinic_Name>" <Scale_Tier> <Expiry_Date_or_Days> [Device_Footprint_ID]');
  console.log('\nArguments:');
  console.log('  1. Clinic Name          : e.g. "My Clinic" (enclosed in double quotes)');
  console.log('  2. Scale Tier            : "solo_gp" | "standard_gp" | "medium_clinic"');
  console.log('  3. Expiry Date or Days   : YYYY-MM-DD format (e.g. "2027-12-31") or number of days (e.g. "365")');
  console.log('  4. Device Footprint ID   : (Optional) The user\'s Device ID or "ANY" (default: "ANY")');
  console.log('\nExample:');
  console.log('  node generate_key.js "Aura Clinic" medium_clinic 365 WEB-XXXX-XXXX');
  console.log('================================================================\n');
  process.exit(0);
}

const clinicName = args[0];
const scale = args[1];
const expiryArg = args[2];
const hardwareUuid = args[3] || 'ANY';

// Validate scale
const validScales = ['solo_gp', 'standard_gp', 'medium_clinic'];
if (!validScales.includes(scale)) {
  console.error(`Error: Invalid scale tier "${scale}". Valid tiers:`, validScales);
  process.exit(1);
}

// Parse expiry
let expiryDateString = '';
if (/^\d+$/.test(expiryArg)) {
  // If it's a number, calculate days from now
  const days = parseInt(expiryArg, 10);
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  // Set time to end of day
  expiryDate.setHours(23, 59, 59, 999);
  expiryDateString = expiryDate.toISOString();
} else {
  // Verify date format
  const dateObj = new Date(expiryArg);
  if (isNaN(dateObj.getTime())) {
    console.error(`Error: Invalid date format "${expiryArg}". Use YYYY-MM-DD.`);
    process.exit(1);
  }
  dateObj.setHours(23, 59, 59, 999);
  expiryDateString = dateObj.toISOString();
}

// 3. Construct Payload
const payload = {
  clinicName,
  scale,
  expiry: expiryDateString,
  hardwareUuid
};

// 4. Generate signature
const data = JSON.stringify(payload);
const sign = crypto.createSign('SHA256');
sign.update(data);
sign.end();

const signature = sign.sign(privateKeyPem, 'base64');
const payloadB64 = Buffer.from(data).toString('base64');

// Activation Key: payload.signature
const activationKey = `${payloadB64}.${signature}`;

console.log('\n================================================================');
console.log('✅ MEDFLOW LICENSE KEY GENERATED SUCCESSFULLY');
console.log('================================================================');
console.log(`Clinic Name   : ${payload.clinicName}`);
console.log(`Scale Tier    : ${payload.scale}`);
console.log(`Expiry Date   : ${new Date(payload.expiry).toLocaleString()}`);
console.log(`Device ID Lock: ${payload.hardwareUuid}`);
console.log('----------------------------------------------------------------');
console.log('COPY THIS KEY FOR THE CUSTOMER:');
console.log('\n' + activationKey + '\n');
console.log('================================================================\n');
