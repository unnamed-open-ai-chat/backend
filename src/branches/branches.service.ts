import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Chat } from '@/chats/schemas/chat.schema';
import { ApiKeysService } from '@/keys/api-key.service';
import { MessagesService } from '@/messages/messages.service';
import { WebsocketsService } from '@/websockets/websockets.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { ForkBranchDto } from './dto/fork-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { ChatBranch, ChatBranchDocument } from './schemas/chat-branch.schema';

@Injectable()
export class BranchesService {
    constructor(
        @InjectModel(ChatBranch.name) private branchModel: Model<ChatBranch>,
        @InjectModel(Chat.name) private chatModel: Model<Chat>,
        private readonly messageService: MessagesService,
        private readonly apiKeyService: ApiKeysService,
        private readonly websocketsService: WebsocketsService
    ) {}

    async create(
        userId: string,
        chatId: string | Chat,
        data: CreateBranchDto,
        messageCount = 0,
        isActive = true
    ): Promise<ChatBranchDocument> {
        if (!Types.ObjectId.isValid(userId)) {
            throw new BadRequestException('Invalid user id');
        }

        const chat =
            typeof chatId === 'string' ? await this.chatModel.findById(chatId).exec() : chatId;

        if (!chat) {
            throw new NotFoundException('Chat not found');
        }

        if (chat.userId.toString() !== userId) {
            throw new NotFoundException('Chat not found');
        }

        const { parentBranchId, ...rest } = data;

        const branch = new this.branchModel({
            userId: chat.userId,
            chatId: chat._id,
            parentBranchId: parentBranchId ? new Types.ObjectId(parentBranchId) : undefined,
            messageCount,
            isActive,
            ...rest,
        });

        const saved = await branch.save();
        this.websocketsService.emitBranchCreated(userId, saved);
        return saved;
    }

    async findById(branchId: string, userId?: string): Promise<ChatBranchDocument> {
        if (!Types.ObjectId.isValid(branchId)) {
            throw new BadRequestException('Invalid branch id');
        }

        const branch = await this.branchModel.findById(branchId).exec();
        if (!branch) {
            throw new NotFoundException('Branch not found');
        }

        if (userId && branch.userId?.toString() !== userId) {
            console.log(userId, branch.userId.toString());
            throw new NotFoundException('Branch not found');
        }

        return branch;
    }

    async findByChatId(chatId: string, userId?: string): Promise<ChatBranch[]> {
        if (!Types.ObjectId.isValid(chatId)) {
            throw new BadRequestException('Invalid chat id');
        }

        if (userId && !Types.ObjectId.isValid(userId)) {
            throw new BadRequestException('Invalid user id');
        }

        const query = { chatId: new Types.ObjectId(chatId), isActive: true };

        if (userId) {
            query['userId'] = new Types.ObjectId(userId);
        }

        return this.branchModel.find(query).sort({ createdAt: 1 }).exec();
    }

    async update(
        branchId: string,
        userId: string,
        updateData: UpdateBranchDto
    ): Promise<ChatBranchDocument> {
        if (!userId) {
            throw new BadRequestException('User id is required');
        }

        const branch = await this.findById(branchId, userId);

        const apiKeyId = branch.modelConfig?.apiKeyId;
        if (apiKeyId) {
            await this.apiKeyService.findById(apiKeyId, userId);
        }

        Object.assign(branch, updateData);
        this.websocketsService.emitBranchUpdated(userId, branch);
        return await branch.save();
    }

    async updateMessageCount(branchId: string, count: number): Promise<ChatBranchDocument> {
        const branch = await this.branchModel
            .findByIdAndUpdate(branchId, { messageCount: count }, { new: true })
            .exec();
        if (!branch) {
            throw new NotFoundException('Branch not found');
        }
        return branch;
    }

    async incrementMessageCount(branchId: string): Promise<void> {
        await this.branchModel.findByIdAndUpdate(branchId, { $inc: { messageCount: 1 } }).exec();
    }

    async delete(branchId: string, userId?: string): Promise<number> {
        const branch = await this.findById(branchId, userId);

        // Delete all branch messages
        await this.messageService.deleteAllByBranchId(branchId);

        // Mark branch as inactive
        branch.isActive = false;
        await branch.save();

        if (userId) {
            this.websocketsService.emitBranchDeleted(userId, branchId);
        }

        return branch.messageCount;
    }

    async deleteAllByChatId(chatId: string, userId: string): Promise<ChatBranch[]> {
        if (!userId) {
            throw new BadRequestException('User id is required');
        }

        const branches = await this.findByChatId(chatId, userId);

        for (const branch of branches) {
            await this.delete(branch._id.toString());
        }

        return branches;
    }

    async forkBranch(
        userId: string,
        originalBranchId: string,
        payload: ForkBranchDto
    ): Promise<ChatBranch> {
        const { name, cloneMessages } = payload;

        const originalBranch = await this.findById(originalBranchId, userId);

        const newBranch = await this.create(
            userId,
            originalBranch.chatId.toString(),
            {
                name: name || `Fork of ${originalBranch.name}`,
                branchPoint: originalBranch.branchPoint + 1,
                modelConfig: originalBranch.modelConfig,
                parentBranchId: originalBranch._id.toString(),
            },
            originalBranch.messageCount,
            originalBranch.isActive
        );

        if (cloneMessages) {
            await this.messageService.cloneAllByBranchId(
                originalBranchId,
                newBranch._id.toString()
            );
        }

        return newBranch;
    }
}
