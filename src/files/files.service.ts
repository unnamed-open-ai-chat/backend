import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as fs from 'fs';
import { createWriteStream } from 'fs';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { Model } from 'mongoose';
import * as path from 'path';
import { pipeline, Readable, Transform } from 'stream';
import { v4 as uuidv4 } from 'uuid';

import { CreateFileDto } from './dto/create-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { File, FileDocument, UserStorageStats } from './schemas/file.schema';

export interface StreamUploadResult {
    success: boolean;
    file?: File;
    error?: string;
    bytesProcessed: number;
    quotaExceeded?: boolean;
    cancelled?: boolean;
}

@Injectable()
export class FileUploadService {
    private readonly MAX_STORAGE_PER_USER = 100 * 1024 * 1024; // 100MB per user
    private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
    private readonly TEMP_DIR = './uploads/temp';
    private readonly UPLOAD_DIR = './uploads';
    private readonly ALLOWED_MIMETYPES = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    constructor(
        @InjectModel(File.name)
        private fileModel: Model<FileDocument>
    ) {
        // Ensure directories exist
        if (!fs.existsSync(this.TEMP_DIR)) {
            fs.mkdirSync(this.TEMP_DIR, { recursive: true });
        }
        if (!fs.existsSync(this.UPLOAD_DIR)) {
            fs.mkdirSync(this.UPLOAD_DIR, { recursive: true });
        }
    }

    /**
     * Calculate total storage used by a user
     */
    async getUserStorageUsage(userId: string): Promise<number> {
        const result = await this.fileModel.aggregate([
            { $match: { userId } },
            { $group: { _id: null, totalSize: { $sum: '$size' } } },
        ]);

        return result.length > 0 ? result[0].totalSize : 0;
    }

    /**
     * Get remaining storage for a user
     */
    async getRemainingStorage(userId: string): Promise<number> {
        const currentUsage = await this.getUserStorageUsage(userId);
        return Math.max(0, this.MAX_STORAGE_PER_USER - currentUsage);
    }

    /**
     * Get remaining storage for a user
     */
    async getUserStorageStats(userId: string): Promise<UserStorageStats> {
        const used = await this.getUserStorageUsage(userId);
        const limit = this.MAX_STORAGE_PER_USER;
        const remaining = Math.max(0, limit - used);
        return { used, limit, remaining };
    }

    /**
     * Validate file mimetype
     */
    validateMimeType(mimetype: string): void {
        if (!this.ALLOWED_MIMETYPES.includes(mimetype)) {
            throw new BadRequestException('File type not allowed');
        }
    }

    /**
     * Create a quota-aware transform stream that monitors bytes and cuts off when quota exceeded
     */
    private createQuotaStream(userId: string, currentUsage: number): Transform {
        let bytesProcessed = 0;
        const remainingQuota = this.MAX_STORAGE_PER_USER - currentUsage;

        return new Transform({
            transform: function (chunk: Buffer, encoding, callback) {
                const chunkSize = chunk.length;

                // Check if this chunk would exceed file size limit
                if (bytesProcessed + chunkSize > this.MAX_FILE_SIZE) {
                    return callback(new Error('FILE_SIZE_EXCEEDED'));
                }

                // Check if this chunk would exceed user quota
                if (bytesProcessed + chunkSize > remainingQuota) {
                    return callback(new Error('QUOTA_EXCEEDED'));
                }

                bytesProcessed += chunkSize;
                callback(null, chunk);
            }.bind(this),
        });
    }

    /**
     * Process file upload with real-time quota monitoring
     */
    async processStreamUpload(
        fileStream: NodeJS.ReadableStream,
        originalName: string,
        mimetype: string,
        userId: string,
        onProgress?: (bytesProcessed: number) => void
    ): Promise<StreamUploadResult> {
        // Validate mimetype first
        try {
            this.validateMimeType(mimetype);
        } catch (error) {
            return {
                success: false,
                error: error.message,
                bytesProcessed: 0,
            };
        }

        // Get current user storage usage
        const currentUsage = await this.getUserStorageUsage(userId);
        const remainingStorage = this.MAX_STORAGE_PER_USER - currentUsage;

        if (remainingStorage <= 0) {
            return {
                success: false,
                error: 'Storage quota exceeded',
                bytesProcessed: 0,
                quotaExceeded: true,
            };
        }

        // Generate unique filenames
        const fileExtension = path.extname(originalName);
        const filename = `${uuidv4()}${fileExtension}`;
        const tempPath = path.join(this.TEMP_DIR, `temp_${filename}`);
        const finalPath = path.join(this.UPLOAD_DIR, filename);

        let bytesProcessed = 0;
        let quotaExceeded = false;
        let fileSizeExceeded = false;

        try {
            // Create quota-aware stream
            const quotaStream = this.createQuotaStream(userId, currentUsage);
            const writeStream = createWriteStream(tempPath);

            // Track progress
            quotaStream.on('data', chunk => {
                bytesProcessed += chunk.length;
                onProgress?.(bytesProcessed);
            });

            // Handle quota/size exceeded
            quotaStream.on('error', error => {
                if (error.message === 'QUOTA_EXCEEDED') {
                    quotaExceeded = true;
                } else if (error.message === 'FILE_SIZE_EXCEEDED') {
                    fileSizeExceeded = true;
                }
                writeStream.destroy();
            });

            // Pipeline the streams
            await new Promise<void>((resolve, reject) => {
                pipeline(fileStream, quotaStream, writeStream, error => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });

            // Check for early termination reasons
            if (quotaExceeded) {
                this.cleanupTempFile(tempPath);
                return {
                    success: false,
                    error: 'Storage quota exceeded during upload',
                    bytesProcessed,
                    quotaExceeded: true,
                };
            }

            if (fileSizeExceeded) {
                this.cleanupTempFile(tempPath);
                return {
                    success: false,
                    error: 'File size limit exceeded (10MB)',
                    bytesProcessed,
                };
            }

            // Verify file integrity
            const stats = fs.statSync(tempPath);
            const actualSize = stats.size;

            if (actualSize !== bytesProcessed) {
                this.cleanupTempFile(tempPath);
                return {
                    success: false,
                    error: 'File upload corrupted - size mismatch',
                    bytesProcessed,
                };
            }

            // Move file from temp to final location atomically
            fs.renameSync(tempPath, finalPath);

            // Create database record - this reserves the storage space
            const createFileDto: CreateFileDto = {
                filename,
                originalName,
                mimetype,
                size: actualSize,
                path: finalPath,
                userId,
            };

            const createdFile = new this.fileModel(createFileDto);
            const savedFile = await createdFile.save();
            console.log(createdFile);

            return {
                success: true,
                file: savedFile,
                bytesProcessed: actualSize,
            };
        } catch (error) {
            // Clean up temp file on any error
            this.cleanupTempFile(tempPath);

            if (error.code === 'ECONNABORTED' || error.name === 'AbortError') {
                return {
                    success: false,
                    error: 'Upload cancelled',
                    bytesProcessed,
                    cancelled: true,
                };
            }

            return {
                success: false,
                error: error.message || 'Upload failed',
                bytesProcessed,
            };
        }
    }

    async uploadFromURL(
        url: string,
        userId: string,
        onProgress?: (bytesProcessed: number) => void
    ) {
        function createNetworkReadStream(url: string): Readable {
            const parsedUrl = new URL(url);
            const requester = parsedUrl.protocol === 'https:' ? httpsRequest : httpRequest;

            function proxyStream(): Readable {
                let stream: Readable;

                const out = new Readable({
                    read() {
                        // Do nothing, we'll push data from the response stream
                    },
                });

                const req = requester(parsedUrl, res => {
                    if (res.statusCode && res.statusCode >= 400) {
                        out.destroy(new Error(`Request failed with status ${res.statusCode}`));
                        return;
                    }

                    stream = res;

                    stream.on('data', chunk => out.push(chunk));
                    stream.on('end', () => out.push(null));
                    stream.on('error', err => out.destroy(err));
                });

                req.on('error', err => out.destroy(err));
                req.end();

                return out;
            }

            const readable = new Readable().wrap(proxyStream());

            return readable;
        }

        return this.processStreamUpload(
            createNetworkReadStream(url),
            url,
            'application/octet-stream',
            userId,
            onProgress
        );
    }

    /**
     * Clean up temporary file safely
     */
    cleanupTempFile(tempPath: string) {
        try {
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        } catch (error) {
            console.error('Failed to cleanup temp file:', tempPath, error);
        }
    }

    /**
     * Get all files for a user
     */
    async getUserFiles(userId: string): Promise<File[]> {
        return this.fileModel.find({ userId }).sort({ createdAt: -1 }).exec();
    }

    /**
     * Get file by ID with user ownership check
     */
    async getFileById(id: string, userId?: string): Promise<File> {
        const query = userId ? { _id: id, userId } : { _id: id };
        const file = await this.fileModel.findOne(query).exec();

        if (!file) {
            throw new NotFoundException('File with ID ' + id + ' not found');
        }
        return file;
    }

    /**
     * Update file metadata
     */
    async updateFile(id: string, updateFileDto: UpdateFileDto, userId: string): Promise<File> {
        const updatedFile = await this.fileModel
            .findOneAndUpdate(
                { _id: id, userId }, // Ensure user owns the file
                updateFileDto,
                { new: true }
            )
            .exec();

        if (!updatedFile) {
            throw new NotFoundException('File not found');
        }

        return updatedFile;
    }

    /**
     * Delete file and its physical file
     */
    async deleteFile(id: string, userId: string): Promise<boolean> {
        const file = await this.fileModel.findOne({ _id: id, userId }).exec();
        if (!file) {
            throw new NotFoundException('File not found');
        }

        // Delete physical file
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }

        // Delete database record
        await this.fileModel.findByIdAndDelete(id).exec();
        return true;
    }

    /**
     * Get file stream for serving with ownership check
     */
    async getFileStream(
        id: string,
        userId?: string
    ): Promise<{ stream: fs.ReadStream; file: File }> {
        const file = await this.getFileById(id, userId);

        if (!fs.existsSync(file.path)) {
            throw new NotFoundException('Physical file not found');
        }

        const stream = fs.createReadStream(file.path);
        return { stream, file };
    }
}
