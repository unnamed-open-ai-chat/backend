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
     * Generates a new pair of RSA encryption keys (asymmetric)
     * @returns Object containing public key (for encryption) and private key (for decryption)
     */
    generateKeyPair(): { encryptKey: string; decryptKey: string } {
        try {
            // Generate RSA key pair (2048 bits for good security/performance balance)
            const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: {
                    type: 'spki',
                    format: 'pem',
                },
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: 'pem',
                },
            });

            return {
                encryptKey: publicKey, // Public key for encryption
                decryptKey: privateKey, // Private key for decryption
            };
        } catch (error) {
            console.error('Key pair generation error:', error);
            throw new Error('Key pair generation failed');
        }
    }

    /**
     * Encrypts text using RSA public key (asymmetric encryption)
     * @param text The text to encrypt
     * @param publicKey The RSA public key in PEM format
     * @returns Encrypted text as base64 string
     */
    encryptWithKey(text: string, publicKey: string): string {
        try {
            // RSA has size limitations, so for large texts we use hybrid encryption
            // For small texts (< 190 bytes with 2048-bit key), use direct RSA
            const textBuffer = Buffer.from(text, 'utf-8');

            if (textBuffer.length <= 190) {
                // Direct RSA encryption for small texts
                const encrypted = crypto.publicEncrypt(
                    {
                        key: publicKey,
                        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                        oaepHash: 'sha256',
                    },
                    textBuffer
                );
                return encrypted.toString('base64');
            } else {
                // Hybrid encryption for larger texts
                // Generate random AES key
                const aesKey = crypto.randomBytes(32);
                const iv = crypto.randomBytes(16);

                // Encrypt text with AES
                const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
                let encryptedText = cipher.update(text, 'utf-8', 'hex');
                encryptedText += cipher.final('hex');
                const authTag = cipher.getAuthTag();

                // Encrypt AES key with RSA
                const encryptedAesKey = crypto.publicEncrypt(
                    {
                        key: publicKey,
                        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                        oaepHash: 'sha256',
                    },
                    aesKey
                );

                // Combine: encryptedAesKey + iv + authTag + encryptedText
                const result = {
                    key: encryptedAesKey.toString('base64'),
                    iv: iv.toString('hex'),
                    authTag: authTag.toString('hex'),
                    data: encryptedText,
                };

                return Buffer.from(JSON.stringify(result)).toString('base64');
            }
        } catch (error) {
            console.error('RSA encryption error:', error);
            throw new Error('RSA encryption failed');
        }
    }

    /**
     * Decrypts text using RSA private key (asymmetric decryption)
     * @param encryptedText The encrypted text (base64 string)
     * @param privateKey The RSA private key in PEM format
     * @returns Decrypted text
     */
    decryptWithKey(encryptedText: string, privateKey: string): string {
        try {
            const encryptedBuffer = Buffer.from(encryptedText, 'base64');

            // Try direct RSA decryption first
            try {
                const decrypted = crypto.privateDecrypt(
                    {
                        key: privateKey,
                        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                        oaepHash: 'sha256',
                    },
                    encryptedBuffer
                );
                return decrypted.toString('utf-8');
            } catch {
                // If direct decryption fails, try hybrid decryption
                const hybridData = JSON.parse(encryptedBuffer.toString('utf-8'));

                // Decrypt AES key with RSA
                const encryptedAesKey = Buffer.from(hybridData.key, 'base64');
                const aesKey = crypto.privateDecrypt(
                    {
                        key: privateKey,
                        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                        oaepHash: 'sha256',
                    },
                    encryptedAesKey
                );

                // Decrypt text with AES
                const iv = Buffer.from(hybridData.iv, 'hex');
                const authTag = Buffer.from(hybridData.authTag, 'hex');

                const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
                decipher.setAuthTag(authTag);

                let decrypted = decipher.update(hybridData.data, 'hex', 'utf-8');
                decrypted += decipher.final('utf-8');

                return decrypted;
            }
        } catch (error) {
            console.error('RSA decryption error:', error);
            throw new Error('RSA decryption failed');
        }
    }

    /**
     * Validates the integrity of a user's encryption keys
     * @param encryptKey Public key for encryption
     * @param decryptKey Private key for decryption
     * @returns Boolean indicating if the keys work together
     */
    validateKeyIntegrity(encryptKey: string, decryptKey: string): boolean {
        try {
            // Test encryption/decryption with the keys
            const testMessage = 'encryption-test-' + Date.now();
            const encrypted = this.encryptWithKey(testMessage, encryptKey);
            const decrypted = this.decryptWithKey(encrypted, decryptKey);

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
