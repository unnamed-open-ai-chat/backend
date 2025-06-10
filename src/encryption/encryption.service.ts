import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';

@Injectable()
export class EncryptionService {
    private readonly algorithm = 'aes-256-gcm';
    private readonly masterKey: Buffer;
    private readonly masterIv: Buffer;

    constructor(config: ConfigService) {
        // Initialize encryption keys from environment variables
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

    /**
     * Encrypts text using AES-256-GCM
     * @param text The text to encrypt
     * @param encryptKey The encryption key (hex string)
     * @returns Encrypted text as a hex string with auth tag appended
     */
    encrypt(text: string, encryptKey: string): string {
        try {
            // Generate a random IV for each encryption
            const iv = crypto.randomBytes(16);

            // Derive a key from the user's encrypt key
            const key = this.deriveKey(encryptKey);

            // Create cipher
            const cipher = crypto.createCipheriv(this.algorithm, key, iv);

            // Encrypt the text
            let encrypted = cipher.update(text, 'utf-8', 'hex');
            encrypted += cipher.final('hex');

            // Get the auth tag
            const authTag = cipher.getAuthTag();

            // Combine IV, encrypted text, and auth tag
            // Format: iv (hex) + authTag (hex) + encrypted (hex)
            return iv.toString('hex') + authTag.toString('hex') + encrypted;
        } catch (error) {
            console.error(error);
            throw new Error('Encryption failed');
        }
    }

    /**
     * Decrypts text using AES-256-GCM
     * @param encryptedText The encrypted text (hex string with IV and auth tag)
     * @param decryptKey The decryption key (hex string)
     * @returns Decrypted text
     */
    decrypt(encryptedKey: string, decryptKey: string): string {
        try {
            // Extract IV (first 32 hex chars = 16 bytes)
            const iv = Buffer.from(encryptedKey.slice(0, 32), 'hex');

            // Extract auth tag (next 32 hex chars = 16 bytes)
            const authTag = Buffer.from(encryptedKey.slice(32, 64), 'hex');

            // Extract encrypted text (remaining chars)
            const encrypted = encryptedKey.slice(64);

            // Derive key from the user's decrypt key
            const key = this.deriveKey(decryptKey);

            // Create decipher
            const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
            decipher.setAuthTag(authTag);

            // Decrypt the text
            let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
            decrypted += decipher.final('utf-8');
            return decrypted;
        } catch (error) {
            console.error(error);
            throw new Error('Decryption failed');
        }
    }
    /**
     * Decrypts an API key using the user's decryption key
     * @param encryptedApiKey The encrypted API key
     * @param decryptKey The user's decryption key
     * @returns Decrypted API key
     */
    deriveKey(userKey: string): Buffer {
        return crypto.pbkdf2Sync(userKey, this.masterIv.toString('hex'), 10000, 32, 'sha256');
    }

    /**
     * Generates a new pair of encryption and decryption keys
     * @returns Object containing encrypt and decrypt keys
     */
    generateKeyPair(): { encryptKey: string; decryptKey: string } {
        const randomEnc = crypto.randomBytes(32).toString('hex');
        const encryptKey = this.deriveKey(randomEnc).toString('hex');

        const randomDec = crypto.randomBytes(32).toString('hex');
        const decryptKey = this.deriveKey(randomDec).toString('hex');

        return { encryptKey, decryptKey };
    }

    /**
     * Validates the integrity of a user's encryption keys
     * @param encryptKey Encryption key to validate
     * @param decryptKey Decryption key to validate
     * @returns Boolean indicating if the keys are valid
     */
    validateKeyIntegrity(encryptKey: string, decryptKey: string): boolean {
        try {
            // Test encryption/decryption with the keys
            const testMessage = 'encryption-test-' + Date.now();
            const encrypted = this.encrypt(testMessage, encryptKey);
            const decrypted = this.decrypt(encrypted, decryptKey);

            return testMessage === decrypted;
        } catch (error) {
            console.error(error);
            return false;
        }
    }
}
