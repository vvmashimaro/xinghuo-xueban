'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const PROOF_DIR = path.join(UPLOAD_ROOT, 'proofs');

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.pdf']);
const MAX_BYTES = 10 * 1024 * 1024;

function ensureDirs() {
  fs.mkdirSync(PROOF_DIR, { recursive: true });
}

function sanitizeBaseName(name) {
  const base = path.basename(String(name || 'file'));
  return base.replace(/[^\w.\-()\u4e00-\u9fff]/g, '_').slice(0, 120) || 'file';
}

function extFromName(name) {
  const ext = path.extname(String(name || '')).toLowerCase();
  return ALLOWED_EXT.has(ext) ? ext : '';
}

function extFromMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (m === 'image/jpeg') return '.jpg';
  if (m === 'image/png') return '.png';
  if (m === 'application/pdf') return '.pdf';
  return '';
}

function detectMagicExt(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 5) return '';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return '.png';
  }
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d) {
    return '.pdf';
  }
  return '';
}

function mimeFromExt(ext) {
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

function proofMetaPath(storedName) {
  return path.join(PROOF_DIR, `${storedName}.meta.json`);
}

function writeProofMeta(storedName, meta) {
  try {
    fs.writeFileSync(proofMetaPath(storedName), JSON.stringify(meta || {}), 'utf8');
  } catch (err) {
    console.warn('[proof-upload] write meta failed', err && err.message);
  }
}

function readProofMeta(storedName) {
  try {
    const raw = fs.readFileSync(proofMetaPath(storedName), 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function formatSizeMb(bytes) {
  return ((Number(bytes) || 0) / (1024 * 1024)).toFixed(1) + 'MB';
}

/**
 * Parse one multipart file from raw body (minimal parser for wx.uploadFile).
 * @returns {{ fields: Record<string,string>, file: { buffer, originalname, mimetype, size } | null }}
 */
function parseMultipart(buffer, contentType) {
  const ct = String(contentType || '');
  const match = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) {
    throw new Error('invalid multipart boundary');
  }
  const boundary = match[1] || match[2];
  const delim = Buffer.from('--' + boundary);
  const parts = [];
  let start = buffer.indexOf(delim);
  if (start < 0) throw new Error('multipart parse failed');
  start += delim.length;
  if (buffer[start] === 0x0d && buffer[start + 1] === 0x0a) start += 2;
  else if (buffer[start] === 0x0a) start += 1;

  while (start < buffer.length) {
    const next = buffer.indexOf(delim, start);
    const chunk = next < 0 ? buffer.subarray(start) : buffer.subarray(start, next);
    if (chunk.length === 0) break;
    let body = chunk;
    if (body.length >= 2 && body[body.length - 2] === 0x0d && body[body.length - 1] === 0x0a) {
      body = body.subarray(0, body.length - 2);
    }
    if (body.length >= 2 && body[0] === 0x2d && body[1] === 0x2d) break;
    parts.push(body);
    start = next + delim.length;
    if (buffer[start] === 0x0d && buffer[start + 1] === 0x0a) start += 2;
    else if (buffer[start] === 0x0a) start += 1;
  }

  const fields = {};
  let file = null;

  for (const part of parts) {
    const sep = part.indexOf(Buffer.from('\r\n\r\n'));
    if (sep < 0) continue;
    const head = part.subarray(0, sep).toString('utf8');
    const content = part.subarray(sep + 4);
    const nameMatch = head.match(/name="([^"]+)"/i);
    if (!nameMatch) continue;
    const fieldName = nameMatch[1];
    const fnMatch = head.match(/filename="([^"]*)"/i);
    if (fnMatch) {
      const mimeMatch = head.match(/Content-Type:\s*([^\r\n]+)/i);
      file = {
        buffer: content,
        originalname: fnMatch[1] || 'file',
        mimetype: mimeMatch ? mimeMatch[1].trim() : 'application/octet-stream',
        size: content.length
      };
    } else {
      fields[fieldName] = content.toString('utf8').replace(/\r\n$/, '');
    }
  }

  return { fields, file };
}

function saveProofUpload(file, fields, owner) {
  ensureDirs();
  if (!file || !file.buffer || !file.buffer.length) {
    return { ok: false, error: '未收到文件' };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: '文件超过 10MB 上限' };
  }

  const originalFromField = fields && fields.originalName ? String(fields.originalName) : '';
  const originalName = sanitizeBaseName(originalFromField || file.originalname || 'file');
  const magicExt = detectMagicExt(file.buffer);
  if (!magicExt) {
    return { ok: false, error: '文件内容校验失败：仅支持真实的 JPG、PNG、PDF 文件' };
  }
  const claimedExt = extFromName(originalName) || extFromName(file.originalname) || extFromMime(file.mimetype);
  const claimedNorm = claimedExt === '.jpeg' ? '.jpg' : claimedExt;
  if (claimedNorm && claimedNorm !== magicExt) {
    return { ok: false, error: '文件扩展名与实际内容不符' };
  }

  const storedName = `${Date.now().toString(36)}-${crypto.randomBytes(16).toString('hex')}${magicExt}`;
  const absPath = path.join(PROOF_DIR, storedName);
  fs.writeFileSync(absPath, file.buffer);

  const tag = (fields && fields.tag ? String(fields.tag).trim() : '') || '佐证材料';
  const publicUrl = `/uploads/proofs/${storedName}`;
  const mimeType = mimeFromExt(magicExt);

  if (owner && owner.userId) {
    writeProofMeta(storedName, {
      ownerId: owner.userId,
      ownerRole: owner.role || '',
      createdAt: new Date().toISOString()
    });
  }

  return {
    ok: true,
    record: {
      id: storedName,
      name: originalName,
      size: formatSizeMb(file.size),
      tag,
      url: publicUrl,
      path: `uploads/proofs/${storedName}`,
      mimeType
    }
  };
}

function resolveProofFile(fileName) {
  const storedName = path.basename(String(fileName || ''));
  if (!storedName || storedName !== fileName || storedName.indexOf('..') >= 0) {
    return { ok: false, error: 'invalid name' };
  }
  const absPath = path.join(PROOF_DIR, storedName);
  if (!absPath.startsWith(PROOF_DIR) || !fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
    return { ok: false, error: 'not found' };
  }
  return {
    ok: true,
    storedName,
    absPath,
    mimeType: mimeFromExt(path.extname(storedName).toLowerCase()),
    meta: readProofMeta(storedName)
  };
}

module.exports = {
  UPLOAD_ROOT,
  PROOF_DIR,
  ensureDirs,
  parseMultipart,
  saveProofUpload,
  detectMagicExt,
  resolveProofFile,
  readProofMeta,
  MAX_BYTES
};
