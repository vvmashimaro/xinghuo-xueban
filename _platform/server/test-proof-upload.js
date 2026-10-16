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
  const saved = proofUpload.saveProofUpload(parsed.file, parsed.fields);
  assert(saved.ok, saved.error || 'save failed');
  assert(fs.existsSync(path.join(proofUpload.PROOF_DIR, saved.record.id)), 'file on disk');
  fs.unlinkSync(path.join(proofUpload.PROOF_DIR, saved.record.id));
  console.log('test-proof-upload: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
