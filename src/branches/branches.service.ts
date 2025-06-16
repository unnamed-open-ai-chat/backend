import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Chat } from '@/chats/schemas/chat.schema';
import { MessagesService } from '@/messages/messages.service';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { ChatBranch, ChatBranchDocument } from './schemas/chat-branch.schema';

@Injectable()
export class BranchesService {
    constructor(
        @InjectModel(ChatBranch.name) private branchModel: Model<ChatBranch>,
        private readonly messageService: MessagesService
    ) {}

    async create(
        userId: string,
        chat: Chat,
        name: string,
        parentBranchId?: string,
        branchPoint = 0
    ): Promise<ChatBranchDocument> {
        if (!Types.ObjectId.isValid(userId)) {
            throw new BadRequestException('Invalid user id');
        }

        if (chat.userId.toString() !== userId) {
            throw new NotFoundException('Chat not found');
        }

        const branch = new this.branchModel({
            userId: chat.userId,
            chatId: chat._id,
            name,
            parentBranchId: parentBranchId ? new Types.ObjectId(parentBranchId) : undefined,
            branchPoint: branchPoint,
            messageCount: 0,
            isActive: true,
        });

        return await branch.save();
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
        Object.assign(branch, updateData);
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
}
