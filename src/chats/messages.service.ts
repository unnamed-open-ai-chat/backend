import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, RootFilterQuery, Types } from 'mongoose';

import { AddMessageDto } from './dto/add-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { Message, MessageDocument, MessagesResponse } from './schemas/message.schema';

@Injectable()
export class MessagesService {
    constructor(@InjectModel(Message.name) private messageModel: Model<MessageDocument>) {}

    async create(messageData: AddMessageDto): Promise<MessageDocument> {
        const { branchId, content, role, attachments, modelUsed } = messageData;

        if (!Types.ObjectId.isValid(branchId)) {
            throw new BadRequestException('Invalid branch id');
        }

        // Get next index for this branch
        const nextIndex = await this.getNextMessageIndex(branchId);

        const message = new this.messageModel({
            branchId: new Types.ObjectId(branchId),
            index: nextIndex,
            role,
            content,
            modelUsed,
            attachments: attachments?.map(id => new Types.ObjectId(id)),
            metadata: {},
            isEdited: false,
        });

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

        if (userId && !Types.ObjectId.isValid(userId)) {
            throw new BadRequestException('Invalid user id');
        }

        const { limit = 50, offset = 0, fromIndex } = options;

        const query: RootFilterQuery<MessageDocument> = {
            branchId: new Types.ObjectId(options.branchId),
        };

        if (fromIndex !== undefined) {
            query.index = { $gte: fromIndex };
        }

        if (userId) {
            query.userId = new Types.ObjectId(userId);
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _userId: string
    ): Promise<Message> {
        const message = await this.findById(messageId);

        // ToDo: Add permission check
        /**
        if (message.userId.toString() !== userId) {
            throw new ForbiddenException('You do not have permission to update this message');
        } */

        if (!message.isEdited) {
            message.originalContent = message.content;
        }

        message.content = updateData.content;
        message.isEdited = true;
        message.editedAt = new Date();

        return await message.save();
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async delete(messageId: string, userId: string): Promise<boolean> {
        const message = await this.findById(messageId);

        // ToDo: Add permission check
        /**
        if (message.userId.toString() !== userId) {
            throw new ForbiddenException('You do not have permission to delete this message');
        } */

        await this.messageModel.findByIdAndDelete(messageId).exec();
        await this.reindexBranchMessages(message.branchId.toString());
        return true;
    }

    async deleteAllByBranchId(branchId: string) {
        await this.messageModel.deleteMany({ branchId: new Types.ObjectId(branchId) }).exec();
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
}
