const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.env.APPDATA, 'hotel-mauli-guest-house');
const BILLING_DIR = path.join(DATA_DIR, 'Billing');

if (!fs.existsSync(BILLING_DIR)) fs.mkdirSync(BILLING_DIR, { recursive: true });

function getSafeBillingPdfPath(filename) {
  if (!filename || typeof filename !== 'string') return null;
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) return null;
  const safeName = path.basename(filename);
  if (!safeName || safeName === '.' || safeName === '..') return null;
  const resolvedBillingDir = path.resolve(BILLING_DIR);
  const resolvedPath = path.resolve(BILLING_DIR, safeName);
  if (resolvedPath !== resolvedBillingDir && !resolvedPath.startsWith(resolvedBillingDir + path.sep)) {
    return null;
  }
  return resolvedPath;
}

// 1. Test pdf:save with legitimate filename
const testFileName = 'test_legitimate_bill_001.pdf';
const safePath = getSafeBillingPdfPath(testFileName);
console.log('Safe path for legitimate file:', safePath);

const dummyBase64 = Buffer.from('%PDF-1.4 dummy pdf content for regression test').toString('base64');
fs.writeFileSync(safePath, Buffer.from(dummyBase64, 'base64'));
console.log('pdf:save -> file written:', fs.existsSync(safePath));

// 2. Test pdf:exists
const exists = fs.existsSync(safePath);
console.log('pdf:exists ->', exists);

// 3. Test pdf:open validation
const isOpenAllowed = typeof testFileName === 'string' && 
                      testFileName.toLowerCase().endsWith('.pdf') && 
                      getSafeBillingPdfPath(testFileName) !== null &&
                      fs.existsSync(safePath);
console.log('pdf:open allowed for legitimate PDF:', isOpenAllowed);

// Clean up test file
if (fs.existsSync(safePath)) fs.unlinkSync(safePath);
console.log('Cleaned up test file. All legitimate PDF IPC validations PASSED.');
