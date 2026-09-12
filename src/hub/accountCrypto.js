'use strict';

const crypto = require('node:crypto');

const CREDENTIAL_ENVELOPE_VERSION = 1;
const AES_GCM_IV_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;

function keyFromMaterial(material) {
  if (Buffer.isBuffer(material)) {
    if (material.length !== 32) throw new Error('Hub credential encryption key must be 32 bytes');
    return Buffer.from(material);
  }
  const text = String(material || '').trim();
  if (!text) return null;
  if (/^[0-9a-f]{64}$/i.test(text)) return Buffer.from(text, 'hex');
  try {
    const decoded = Buffer.from(text, 'base64');
    if (decoded.length === 32 && decoded.toString('base64').replace(/=+$/, '') === text.replace(/=+$/, '')) {
      return decoded;
    }
  } catch (_) {
    // Fall through to the deterministic derivation below.
  }
  return crypto.createHash('sha256').update(text, 'utf8').digest();
}

function keyVersion(key) {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

function requireKey(material) {
  const key = keyFromMaterial(material);
  if (!key) {
    const error = new Error('Hub credential encryption key is not configured');
    error.code = 'credential_key_missing';
    throw error;
  }
  return key;
}

function encryptCredential(value, material) {
  const key = requireKey(material);
  const iv = crypto.randomBytes(AES_GCM_IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    version: CREDENTIAL_ENVELOPE_VERSION,
    keyVersion: keyVersion(key),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64')
  };
}

function decryptCredential(envelope, material) {
  if (!envelope || Number(envelope.version) !== CREDENTIAL_ENVELOPE_VERSION) {
    const error = new Error('Unsupported Hub credential envelope');
    error.code = 'credential_envelope_unsupported';
    throw error;
  }
  const key = requireKey(material);
  const iv = Buffer.from(String(envelope.iv || ''), 'base64');
  const tag = Buffer.from(String(envelope.tag || ''), 'base64');
  const ciphertext = Buffer.from(String(envelope.ciphertext || ''), 'base64');
  if (iv.length !== AES_GCM_IV_BYTES || tag.length !== AES_GCM_TAG_BYTES || ciphertext.length === 0) {
    const error = new Error('Invalid Hub credential envelope');
    error.code = 'credential_envelope_invalid';
    throw error;
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}

module.exports = {
  CREDENTIAL_ENVELOPE_VERSION,
  decryptCredential,
  encryptCredential,
  keyFromMaterial,
  keyVersion
};
