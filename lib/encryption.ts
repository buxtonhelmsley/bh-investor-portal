import crypto from 'crypto';
import CryptoJS from 'crypto-js';
import fs from 'fs/promises';
import path from 'path';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const DOCUMENT_ENCRYPTION_KEY = process.env.DOCUMENT_ENCRYPTION_KEY!;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

/**
 * Encrypt text data (for tax IDs, sensitive fields in database)
 */
export function encryptText(text: string): string {
  if (!text) return '';
  
  const encrypted = CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
  return encrypted;
}

/**
 * Decrypt text data
 */
export function decryptText(encryptedText: string): string {
  if (!encryptedText) return '';
  
  const decrypted = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
  return decrypted.toString(CryptoJS.enc.Utf8);
}

/**
 * Encrypt file for storage
 */
export async function encryptFile(
  filePath: string,
  outputPath: string
): Promise<void> {
  const fileBuffer = await fs.readFile(filePath);
  
  // Generate random IV and salt
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  // Derive key from password and salt
  const key = crypto.pbkdf2Sync(
    DOCUMENT_ENCRYPTION_KEY,
    salt,
    100000,
    32,
    'sha512'
  );
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  // Encrypt the file
  const encrypted = Buffer.concat([
    cipher.update(fileBuffer),
    cipher.final(),
  ]);
  
  // Get auth tag
  const tag = cipher.getAuthTag();
  
  // Combine salt + iv + tag + encrypted data
  const result = Buffer.concat([salt, iv, tag, encrypted]);
  
  // Write encrypted file
  await fs.writeFile(outputPath, result);
}

/**
 * Decrypt file from storage
 */
export async function decryptFile(
  encryptedPath: string,
  outputPath?: string
): Promise<Buffer> {
  const encryptedBuffer = await fs.readFile(encryptedPath);
  
  // Extract components
  const salt = encryptedBuffer.subarray(0, SALT_LENGTH);
  const iv = encryptedBuffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = encryptedBuffer.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + TAG_LENGTH
  );
  const encrypted = encryptedBuffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  
  // Derive key from password and salt
  const key = crypto.pbkdf2Sync(
    DOCUMENT_ENCRYPTION_KEY,
    salt,
    100000,
    32,
    'sha512'
  );
  
  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  // Decrypt the file
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  
  // Optionally write to output path
  if (outputPath) {
    await fs.writeFile(outputPath, decrypted);
  }
  
  return decrypted;
}

/**
 * Generate file hash for integrity checking
 */
export function generateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Hash password for storage
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(password, 12);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(password, hash);
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const minLength = parseInt(process.env.PASSWORD_MIN_LENGTH || '12');
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  
  if (process.env.PASSWORD_REQUIRE_UPPERCASE === 'true' && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (process.env.PASSWORD_REQUIRE_LOWERCASE === 'true' && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (process.env.PASSWORD_REQUIRE_NUMBERS === 'true' && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (process.env.PASSWORD_REQUIRE_SPECIAL === 'true' && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  return path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_');
}
