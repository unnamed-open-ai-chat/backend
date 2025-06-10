import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

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
     * @param userKey The user's key (raw string, will be derived)
     * @returns Encrypted text as a hex string with IV and auth tag prepended
     */
    encrypt(text: string, userKey: string): string {
        try {
            // Generate a random IV for each encryption
            const iv = crypto.randomBytes(16);

            // Derive a key from the user's key
            const derivedKey = this.deriveKey(userKey);

            // Create cipher
            const cipher = crypto.createCipheriv(this.algorithm, derivedKey, iv);

            // Encrypt the text
            let encrypted = cipher.update(text, 'utf-8', 'hex');
            encrypted += cipher.final('hex');

            // Get the auth tag
            const authTag = cipher.getAuthTag();

            // Combine IV, auth tag, and encrypted text
            // Format: iv(32 hex) + authTag(32 hex) + encrypted(variable hex)
            return iv.toString('hex') + authTag.toString('hex') + encrypted;
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Encryption failed');
        }
    }

    /**
     * Decrypts text using AES-256-GCM
     * @param encryptedText The encrypted text (hex string with IV and auth tag)
     * @param userKey The user's key (raw string, will be derived)
     * @returns Decrypted text
     */
    decrypt(encryptedText: string, userKey: string): string {
        try {
            // Validate minimum length (32 + 32 + at least some encrypted data)
            if (encryptedText.length < 66) {
                throw new Error('Invalid encrypted text format');
            }

            // Extract IV (first 32 hex chars = 16 bytes)
            const iv = Buffer.from(encryptedText.slice(0, 32), 'hex');

            // Extract auth tag (next 32 hex chars = 16 bytes)
            const authTag = Buffer.from(encryptedText.slice(32, 64), 'hex');

            // Extract encrypted text (remaining chars)
            const encrypted = encryptedText.slice(64);

            // Derive key from the user's key
            const derivedKey = this.deriveKey(userKey);

            // Create decipher
            const decipher = crypto.createDecipheriv(this.algorithm, derivedKey, iv);
            decipher.setAuthTag(authTag);

            // Decrypt the text
            let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
            decrypted += decipher.final('utf-8');

            return decrypted;
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Decryption failed');
        }
    }

    /**
     * Derives a key from user input using PBKDF2
     * @param userKey The user's raw key
     * @returns Derived key buffer (32 bytes)
     */
    private deriveKey(userKey: string): Buffer {
        return crypto.pbkdf2Sync(
            userKey,
            this.masterIv, // Using masterIv as salt
            100000, // Increased iterations for better security
            32,
            'sha256'
        );
    }

    /**
     * Generates a new pair of encryption and decryption keys
     * @returns Object containing raw encrypt and decrypt keys (not derived)
     */
    generateKeyPair(): { encryptKey: string; decryptKey: string } {
        // Generate raw random keys (these will be derived when used)
        const encryptKey = crypto.randomBytes(32).toString('hex');
        const decryptKey = crypto.randomBytes(32).toString('hex');

        return { encryptKey, decryptKey };
    }

    /**
     * Validates the integrity of a user's encryption keys
     * @param encryptKey Raw encryption key to validate
     * @param decryptKey Raw decryption key to validate
     * @returns Boolean indicating if the keys work together
     */
    validateKeyIntegrity(encryptKey: string, decryptKey: string): boolean {
        try {
            // Test encryption/decryption with the keys
            const testMessage = 'encryption-test-' + Date.now();
            const encrypted = this.encrypt(testMessage, encryptKey);
            const decrypted = this.decrypt(encrypted, decryptKey);

            return testMessage === decrypted;
        } catch (error) {
            console.error('Key validation error:', error);
            return false;
        }
    }

    /**
     * Encrypts sensitive data using the master key (for database storage)
     * @param text The text to encrypt with master key
     * @returns Encrypted text
     */
    encryptWithMasterKey(text: string): string {
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);

            let encrypted = cipher.update(text, 'utf-8', 'hex');
            encrypted += cipher.final('hex');

            const authTag = cipher.getAuthTag();
            return iv.toString('hex') + authTag.toString('hex') + encrypted;
        } catch (error) {
            console.error('Master encryption error:', error);
            throw new Error('Master encryption failed');
        }
    }

    /**
     * Decrypts sensitive data using the master key (from database storage)
     * @param encryptedText The encrypted text
     * @returns Decrypted text
     */
    decryptWithMasterKey(encryptedText: string): string {
        try {
            if (encryptedText.length < 66) {
                throw new Error('Invalid encrypted text format');
            }

            const iv = Buffer.from(encryptedText.slice(0, 32), 'hex');
            const authTag = Buffer.from(encryptedText.slice(32, 64), 'hex');
            const encrypted = encryptedText.slice(64);

            const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
            decrypted += decipher.final('utf-8');

            return decrypted;
        } catch (error) {
            console.error('Master decryption error:', error);
            throw new Error('Master decryption failed');
        }
    }
}
