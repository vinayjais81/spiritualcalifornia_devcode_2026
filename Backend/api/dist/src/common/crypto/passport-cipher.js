"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptPassport = encryptPassport;
exports.decryptPassport = decryptPassport;
exports.maskPassport = maskPassport;
const crypto = __importStar(require("crypto"));
const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
let cachedKey = null;
function getKey() {
    if (cachedKey)
        return cachedKey;
    const hex = process.env.PASSPORT_ENCRYPTION_KEY;
    if (!hex) {
        throw new Error('PASSPORT_ENCRYPTION_KEY env var is not set. Generate one with: openssl rand -hex 32');
    }
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
        throw new Error('PASSPORT_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes / 256 bits)');
    }
    cachedKey = Buffer.from(hex, 'hex');
    return cachedKey;
}
function encryptPassport(plaintext) {
    if (plaintext == null || plaintext === '') {
        throw new Error('Cannot encrypt empty passport value');
    }
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [
        VERSION,
        iv.toString('base64'),
        authTag.toString('base64'),
        enc.toString('base64'),
    ].join(':');
}
function decryptPassport(stored) {
    if (!stored)
        throw new Error('Cannot decrypt empty value');
    const parts = stored.split(':');
    if (parts.length !== 4) {
        throw new Error('Invalid encrypted passport format');
    }
    const [version, ivB64, tagB64, ctB64] = parts;
    if (version !== VERSION) {
        throw new Error(`Unsupported passport cipher version: ${version}`);
    }
    const key = getKey();
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const ct = Buffer.from(ctB64, 'base64');
    if (authTag.length !== AUTH_TAG_LENGTH) {
        throw new Error('Invalid auth tag length');
    }
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
    return dec.toString('utf8');
}
function maskPassport(plaintext) {
    if (!plaintext)
        return '';
    if (plaintext.length <= 4)
        return '•'.repeat(plaintext.length);
    return '•'.repeat(plaintext.length - 4) + plaintext.slice(-4);
}
//# sourceMappingURL=passport-cipher.js.map