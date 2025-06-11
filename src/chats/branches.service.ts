import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UpdateBranchDTO } from './dto/update-branch.dto';
import { MessagesService } from './messages.service';
import { ChatBranch, ChatBranchDocument } from './schemas/chat-branch.schema';

@Injectable()
export class BranchesService {
    constructor(
        @InjectModel(ChatBranch.name) private branchModel: Model<ChatBranch>,
        private readonly messageService: MessagesService
    ) {}

    async create(
        chatId: string,
        name: string,
        parentBranchId?: string,
        branchPoint?: number
    ): Promise<ChatBranchDocument> {
        if (!Types.ObjectId.isValid(chatId)) {
            throw new BadRequestException('Invalid chat id');
        }

        // ToDo: Check permissions
        const branch = new this.branchModel({
            chatId: new Types.ObjectId(chatId),
            name,
            parentBranchId: parentBranchId ? new Types.ObjectId(parentBranchId) : undefined,
            branchPoint: branchPoint || 0,
            messageCount: 0,
            isActive: true,
        });

        return await branch.save();
    }

    async findById(branchId: string): Promise<ChatBranchDocument> {
        if (!Types.ObjectId.isValid(branchId)) {
            throw new BadRequestException('Invalid branch id');
        }

        // ToDo: Check permissions
        const branch = await this.branchModel.findById(branchId).exec();
        if (!branch) {
            throw new NotFoundException('Branch not found');
        }

        return branch;
    }

    async findByChatId(chatId: string): Promise<ChatBranch[]> {
        if (!Types.ObjectId.isValid(chatId)) {
            throw new BadRequestException('Invalid chat id');
        }

        // ToDo: Check permissions
        return this.branchModel
            .find({ chatId: new Types.ObjectId(chatId), isActive: true })
            .sort({ createdAt: 1 })
            .exec();
    }

    async update(branchId: string, updateData: UpdateBranchDTO): Promise<ChatBranchDocument> {
        const branch = await this.findById(branchId);
        // ToDo: Check permissions
        Object.assign(branch, updateData);
        return await branch.save();
    }

    async updateMessageCount(branchId: string, count: number): Promise<ChatBranchDocument> {
        // ToDo: Check permissions
        const branch = await this.branchModel
            .findByIdAndUpdate(branchId, { messageCount: count }, { new: true })
            .exec();
        if (!branch) {
            throw new NotFoundException('Branch not found');
        }
        return branch;
    }

    async incrementMessageCount(branchId: string): Promise<void> {
        // ToDo: Check permissions
        await this.branchModel.findByIdAndUpdate(branchId, { $inc: { messageCount: 1 } }).exec();
    }

    async delete(branchId: string): Promise<number> {
        // ToDo: Check permissions
        const branch = await this.findById(branchId);

        // Delete all branch messages
        await this.messageService.deleteAllByBranchId(branchId);

        // Mark branch as inactive
        branch.isActive = false;
        await branch.save();
        return branch.messageCount;
    }

    async deleteAllByChatId(chatId: string): Promise<void> {
        const branches = await this.findByChatId(chatId);

        for (const branch of branches) {
            await this.delete(branch._id.toString());
        }
    }
}
