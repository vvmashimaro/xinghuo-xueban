'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const proofUpload = require('./src/proof-upload');

function buildMultipart(boundary, fields, filePart) {
  const chunks = [];
  for (const [name, value] of Object.entries(fields || {})) {
    chunks.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
    );
  }
  if (filePart) {
    chunks.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filePart.name}"\r\nContent-Type: ${filePart.type}\r\n\r\n`
    );
    const head = Buffer.from(chunks.join(''));
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    return Buffer.concat([head, filePart.buffer, tail]);
  }
  chunks.push(`--${boundary}--\r\n`);
  return Buffer.from(chunks.join(''));
}

async function main() {
  const boundary = '----testboundary';
  const body = buildMultipart(
    boundary,
    { tag: '其它证明', originalName: 'demo-proof.pdf' },
    {
      name: 'demo-proof.pdf',
      type: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test proof upload')
    }
  );
  const parsed = proofUpload.parseMultipart(body, `multipart/form-data; boundary=${boundary}`);
  assert(parsed.file, 'file parsed');
  const saved = proofUpload.saveProofUpload(parsed.file, parsed.fields, { userId: 'AP-TEST', role: 'mentor' });
  assert(saved.ok, saved.error || 'save failed');
  assert(fs.existsSync(path.join(proofUpload.PROOF_DIR, saved.record.id)), 'file on disk');
  const meta = proofUpload.readProofMeta(saved.record.id);
  assert(meta && meta.ownerId === 'AP-TEST', 'owner meta written');
  fs.unlinkSync(path.join(proofUpload.PROOF_DIR, saved.record.id));
  try {
    fs.unlinkSync(path.join(proofUpload.PROOF_DIR, saved.record.id + '.meta.json'));
  } catch (_) {}

  const fakePdf = {
    buffer: Buffer.from('<html><script>alert(1)</script></html>'),
    originalname: 'evil.pdf',
    mimetype: 'application/pdf',
    size: 40
  };
  const rejected = proofUpload.saveProofUpload(fakePdf, { originalName: 'evil.pdf' });
  assert.strictEqual(rejected.ok, false, 'html disguised as pdf must be rejected');

  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  assert.strictEqual(proofUpload.detectMagicExt(jpeg), '.jpg');
  console.log('test-proof-upload: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
