import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly masterKey: Buffer;
  private readonly masterIv: Buffer;

  constructor(config: ConfigService) {
    const encryptionKey = config.get<string>('ENCRYPTION_KEY');
    const encryptionIv = config.get<string>('ENCRYPTION_IV');

    if (!encryptionKey || encryptionKey.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 32-byte (64 hex chars) key');
    }

    if (!encryptionIv || encryptionIv.length !== 32) {
      throw new Error('ENCRYPTION_IV must be 16-byte (32 hex chars) key');
    }

    // Convert hex strings to buffers
    this.masterKey = Buffer.from(encryptionKey, 'hex');
    this.masterIv = Buffer.from(encryptionIv, 'hex');
  }

  encrypt(text: string, encryptKey: string): string {
    try {
      const iv = crypto.randomBytes(16);

      const key = this.deriveKey(encryptKey);

      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      let encrypted = cipher.update(text, 'utf-8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();
      return iv.toString('hex') + authTag.toString('hex') + encrypted;
    } catch (error) {
      console.error(error);
      throw new Error('Encryption failed');
    }
  }

  decrypt(encryptedKey: string, decryptKey: string): string {
    try {
      const iv = Buffer.from(encryptedKey.slice(0, 32), 'hex');

      const authTag = Buffer.from(encryptedKey.slice(32, 64), 'hex');

      const encrypted = encryptedKey.slice(64);

      const key = this.deriveKey(decryptKey);

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
      decrypted += decipher.final('utf-8');
      return decrypted;
    } catch (error) {
      console.error(error);
      throw new Error('Decryption failed');
    }
  }

  deriveKey(userKey: string): Buffer {
    return crypto.pbkdf2Sync(
      userKey,
      this.masterIv.toString('hex'),
      10000,
      32,
      'sha256',
    );
  }

  generateKeyPair(): { encryptKey: string; decryptKey: string } {
    const randomEnc = crypto.randomBytes(32).toString('hex');
    const encryptKey = this.deriveKey(randomEnc).toString('hex');

    const randomDec = crypto.randomBytes(32).toString('hex');
    const decryptKey = this.deriveKey(randomDec).toString('hex');

    return { encryptKey, decryptKey };
  }
}
