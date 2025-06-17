import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, RootFilterQuery, Types } from 'mongoose';

import { ChatBranch } from '@/branches/schemas/chat-branch.schema';
import { WebsocketsService } from '@/websockets/websockets.service';
import { GetMessagesDto } from './dto/get-messages.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { Message, MessageDocument, MessagesResponse } from './schemas/message.schema';

@Injectable()
export class MessagesService {
    constructor(
        @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
        @InjectModel(ChatBranch.name) private branchModel: Model<ChatBranch>,
        private websocketsService: WebsocketsService
    ) {}

    async create(
        messageData: Omit<Message, '_id' | 'originalContent' | 'index' | 'isEdited' | 'editedAt'>,
        userId?: string
    ): Promise<MessageDocument> {
        const { branchId, chatId, content, role, attachments, modelUsed, tokens } = messageData;

        if (!Types.ObjectId.isValid(branchId)) {
            throw new BadRequestException('Invalid branch id');
        }

        // Get next index for this branch
        const nextIndex = await this.getNextMessageIndex(branchId.toString());

        const message = new this.messageModel({
            attachments: attachments?.map(id => new Types.ObjectId(id)),
            branchId: new Types.ObjectId(branchId),
            chatId,
            content,
            metadata: {},
            role,
            index: nextIndex,
            modelUsed,
            tokens,
            isEdited: false,
        });

        if (userId) {
            this.websocketsService.emitToBranch(
                userId,
                branchId.toString(),
                'message:new',
                message
            );
        }

        return await message.save();
    }

    async findById(messageId: string): Promise<MessageDocument> {
        if (!Types.ObjectId.isValid(messageId)) {
            throw new BadRequestException('Invalid message id');
        }

        const message = await this.messageModel.findById(messageId).populate('attachments').exec();
        if (!message) {
            throw new NotFoundException('Message not found');
        }

        return message;
    }

    async findByBranchId(options: GetMessagesDto, userId?: string): Promise<MessagesResponse> {
        if (!Types.ObjectId.isValid(options.branchId)) {
            throw new BadRequestException('Invalid branch id');
        }

        const branch = await this.branchModel.findById(options.branchId).exec();
        if (!branch) {
            throw new NotFoundException('Branch not found');
        }

        if (userId && branch.userId?.toString() !== userId) {
            throw new NotFoundException('Branch not found');
        }

        const { limit = 50, offset = 0, fromIndex } = options;

        const query: RootFilterQuery<MessageDocument> = {
            branchId: new Types.ObjectId(options.branchId),
        };

        if (fromIndex !== undefined) {
            query.index = { $gte: fromIndex };
        }

        const [messages, total] = await Promise.all([
            this.messageModel
                .find(query)
                .sort({ index: 1 })
                .skip(offset)
                .limit(limit)
                .populate('attachments')
                .exec(),

            this.messageModel.countDocuments(query),
        ]);

        return {
            messages,
            total,
            hasMore: messages.length < total,
        };
    }

    async update(
        messageId: string,
        updateData: UpdateMessageDto,
        userId: string
    ): Promise<Message> {
        const message = await this.findById(messageId);

        // Get branch
        const branch = await this.branchModel.findById(message.branchId.toString());

        // Permission check
        if (!branch || branch.userId.toString() !== userId) {
            throw new NotFoundException('Message not found');
        }

        if (!message.isEdited) {
            message.originalContent = message.content;
        }

        message.content = [
            {
                type: 'text',
                text: updateData.content,
            },
        ];
        message.isEdited = true;
        message.editedAt = new Date();

        return await message.save();
    }

    async delete(messageId: string, userId: string): Promise<boolean> {
        const message = await this.findById(messageId);

        // Get branch
        const branch = await this.branchModel.findById(message.branchId.toString());

        // Permission check
        if (!branch || branch.userId.toString() !== userId) {
            throw new NotFoundException('Message not found');
        }

        await this.messageModel.findByIdAndDelete(messageId).exec();
        await this.reindexBranchMessages(message.branchId.toString());
        return true;
    }

    async deleteAllByBranchId(branchId: string) {
        await this.messageModel.deleteMany({ branchId: new Types.ObjectId(branchId) }).exec();
    }

    async deleteAllByChatId(chatId: string) {
        await this.messageModel.deleteMany({ chatId: new Types.ObjectId(chatId) }).exec();
    }

    async reindexBranchMessages(branchId: string) {
        const messages = await this.messageModel
            .find({ branchId: new Types.ObjectId(branchId) })
            .sort({ index: 1 })
            .exec();

        const updates = messages.map((message, i) => ({
            updateOne: {
                filter: { _id: message._id },
                update: { index: i },
            },
        }));

        if (updates.length > 0) {
            await this.messageModel.bulkWrite(updates);
        }
    }

    async getLastMessage(branchId: string): Promise<MessageDocument | null> {
        if (!Types.ObjectId.isValid(branchId)) {
            throw new BadRequestException('Invalid branch id');
        }

        return this.messageModel
            .findOne({ branchId: new Types.ObjectId(branchId) })
            .sort({ index: -1 })
            .populate('attachments')
            .exec();
    }

    async getNextMessageIndex(branchId: string): Promise<number> {
        const lastMessage = await this.getLastMessage(branchId);
        return lastMessage ? lastMessage.index + 1 : 0;
    }

    async cloneAllByBranchId(branchId: string, newBranchId: string) {
        const messages = await this.messageModel
            .find({ branchId: new Types.ObjectId(branchId) })
            .lean();

        const clonedMessages = messages.map(msg => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { _id, branchId, ...rest } = msg;

            return {
                ...rest,
                chatId: new Types.ObjectId(msg.chatId),
                branchId: new Types.ObjectId(newBranchId),
            };
        });

        await this.messageModel.insertMany(clonedMessages);
    }
}
