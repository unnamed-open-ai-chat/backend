import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { AIService } from '@/ai/ai.service';
import { EncryptionService } from '@/encryption/encryption.service';
import { UsersService } from '@/users/users.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';
import { ApiKey, ApiKeyDocument } from './schemas/api-key.schema';

@Injectable()
export class ApiKeysService {
    constructor(
        @InjectModel(ApiKey.name) private apiKeyModel: Model<ApiKeyDocument>,
        private encryptionService: EncryptionService,
        private aiService: AIService,
        private usersService: UsersService
    ) {}

    async create(userId: string, data: CreateApiKeyDto) {
        const { provider, alias, apiKey } = data;

        // Check if alias is already in use
        const existingApiKey = await this.apiKeyModel.findOne({
            userId: new Types.ObjectId(userId),
            alias,
            isActive: true,
        });

        if (existingApiKey) {
            throw new ConflictException(`API key with alias "${alias}" already exists`);
        }

        // Validate API key format and test connection
        const valid = await this.aiService.validateKeyFormat(provider, apiKey);
        if (!valid) {
            throw new BadRequestException(`Invalid ${provider} API key`);
        }

        // Get user
        const user = await this.usersService.findById(userId);

        // Encrypt the API key
        const encryptedApiKey = this.encryptionService.encryptWithKey(apiKey, user.encryptKey);

        // Create new API key document
        const newApiKey = new this.apiKeyModel({
            userId: new Types.ObjectId(userId),
            provider,
            alias,
            encryptedApiKey,
            isActive: true,
            lastUsed: null,
            lastRotated: null,
        });

        // Save to database
        return await newApiKey.save();
    }

    async update(
        id: string,
        userId: string,
        updateApiKeyDto: UpdateApiKeyDto
    ): Promise<ApiKeyDocument> {
        const apiKey = await this.findById(id, userId);

        // Update fields
        if (updateApiKeyDto.alias) {
            // Check if alias is already used by another key
            const existingKey = await this.apiKeyModel
                .findOne({
                    userId: new Types.ObjectId(userId),
                    alias: updateApiKeyDto.alias,
                    _id: { $ne: new Types.ObjectId(id) },
                    isActive: true,
                })
                .exec();

            if (existingKey) {
                throw new ConflictException(
                    `API key with alias "${updateApiKeyDto.alias}" already exists`
                );
            }

            apiKey.alias = updateApiKeyDto.alias;
        }

        if (updateApiKeyDto.isActive !== undefined) {
            apiKey.isActive = updateApiKeyDto.isActive;
        }

        return apiKey.save();
    }

    async delete(id: string, userId: string): Promise<void> {
        const apiKey = await this.findById(id, userId);

        // Soft delete by setting isActive to false
        apiKey.isActive = false;
        await apiKey.save();
    }

    async findAll(userId: string): Promise<ApiKeyDocument[]> {
        return this.apiKeyModel.find({ userId: new Types.ObjectId(userId), isActive: true }).exec();
    }

    async findById(id: string, userId: string): Promise<ApiKeyDocument> {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('Invalid API key ID');
        }

        const apiKey = await this.apiKeyModel.findById(id).exec();

        if (!apiKey || apiKey.userId.toString() !== userId) {
            throw new NotFoundException('API key not found');
        }

        return apiKey;
    }
}
