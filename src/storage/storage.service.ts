import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import fetch from 'node-fetch';
import { R2WorkerClient } from './r2WorkerClient';
import { File, FileDocument, UserStorageStats } from './schemas/file.schema';

@Injectable()
export class StorageService {
    private readonly MAX_STORAGE_PER_USER = 50 * 1024 * 1024; // 50MB per user
    private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 25MB per file
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

    private readonly r2: R2WorkerClient;

    constructor(
        @InjectModel(File.name)
        private fileModel: Model<FileDocument>,
        private configService: ConfigService
    ) {
        const workerURL = this.configService.get<string>('R2_WORKER_URL');
        const workerSecret = this.configService.get<string>('R2_WORKER_SECRET');

        if (!workerURL || !workerSecret) {
            throw new Error('R2_WORKER_URL and R2_WORKER_SECRET must be set');
        }

        this.r2 = new R2WorkerClient(workerURL, workerSecret);
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
     * Get file by ID
     */
    async getFileById(id: string, userId?: string): Promise<FileDocument> {
        const query = userId ? { _id: id, userId } : { _id: id };
        const file = await this.fileModel.findOne(query).exec();

        if (!file) {
            throw new NotFoundException('File with ID ' + id + ' not found');
        }

        return file;
    }

    /**
     * Get by user
     */
    async getUserFiles(userId: string): Promise<File[]> {
        return this.fileModel.find({ userId }).sort({ createdAt: -1 }).exec();
    }

    /**
     * Create a new file
     */
    async createFile(userId: string, filename: string, mimetype: string, fileSize: number) {
        this.validateMimeType(mimetype);

        // Check if user has enough storage
        const currentUsage = await this.getUserStorageUsage(userId);
        if (currentUsage + fileSize > this.MAX_STORAGE_PER_USER) {
            throw new BadRequestException('Storage quota exceeded');
        }

        // Create file
        const file = new this.fileModel({ userId, filename, mimetype, size: fileSize });
        await file.save();

        // Create file using R2
        const upload = await this.r2.createUpload(file._id, fileSize, mimetype);
        if (!upload.success) {
            await file.deleteOne();
            throw new BadRequestException('File upload failed');
        }
        file.clientToken = upload.clientToken;
        file.uploadId = upload.uploadId;
        await file.save();

        return file;
    }

    /**
     * Complete file upload
     */
    async completeFileUpload(
        userId: string,
        fileId: string,
        parts: { partNumber: number; etag: string }[]
    ): Promise<FileDocument> {
        const file = await this.getFileById(fileId, userId);

        if (!file.clientToken || !file.uploadId) {
            throw new BadRequestException('File already completed.');
        }

        const completed = await this.r2.completeUpload(file.uploadId, fileId, parts);

        if (!completed.success) {
            throw new BadRequestException('File upload failed');
        }

        file.clientToken = undefined;
        file.uploadId = undefined;
        await file.save();

        return file;
    }

    /**
     * Delete already uploaded file
     */
    async deleteFile(fileId: string, userId?: string): Promise<boolean> {
        const file = await this.getFileById(fileId, userId);
        const success = await this.r2.deleteFile(file._id);
        if (!success) {
            throw new BadRequestException('File deletion failed');
        }

        await file.deleteOne();
        return true;
    }

    /**
     * Get absolute URL for file
     */
    getUrlForFile(id: string): string {
        return this.r2.getUrlForFile(id);
    }

    /**
     * Get file content
     */
    async readFileAsPlainText(id: string): Promise<string> {
        return await this.r2.readFileAsString(id);
    }

    /**
     * Get file as buffer
     */
    async readFileAsBuffer(id: string): Promise<Buffer> {
        return await this.r2.readFileAsBuffer(id);
    }

    async uploadFromURL(url: string, name: string, mimeType: string, userId: string) {
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const file = await this.createFile(userId, name, mimeType, buffer.byteLength);
        const parts = await this.r2.uploadFileBuffer(file.clientToken!, buffer);
        return await this.completeFileUpload(userId, file.id, parts);
    }
}
