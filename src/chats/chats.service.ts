import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, RootFilterQuery, Types } from 'mongoose';

import { BranchesService } from '@/branches/branches.service';
import { ApiKeysService } from '@/keys/api-key.service';
import { MessagesService } from '@/messages/messages.service';
import { WebsocketsService } from '@/websockets/websockets.service';
import { GetManyChatsDto } from './dto/get-chat-dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { Chat, ChatDocument, ChatsResponse } from './schemas/chat.schema';

@Injectable()
export class ChatService {
    constructor(
        @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
        private readonly messagesService: MessagesService,
        private readonly branchService: BranchesService,
        private readonly apiKeyService: ApiKeysService,
        private readonly websocketsService: WebsocketsService
    ) {}

    async createChat(userId: string): Promise<ChatDocument> {
        // Create chat
        const chat = new this.chatModel({
            userId: new Types.ObjectId(userId),
            title: 'New Chat',
            isPublic: false,
            lastActivityAt: new Date(),
        });

        await chat.save();

        // Create default branch
        const defaultBranch = await this.branchService.create(userId, chat, 'main');

        // update chat with default branch
        chat.defaultBranch = defaultBranch._id;
        await chat.save();

        const populated = await chat.populate('defaultBranch');
        this.websocketsService.emitChatCreated(userId, populated);
        return populated;
    }

    async findById(chatId: string, userId?: string, populate = true): Promise<ChatDocument> {
        if (!Types.ObjectId.isValid(chatId)) {
            throw new BadRequestException('Invalid chat id');
        }

        let operation = this.chatModel.findById(chatId);
        if (populate) {
            operation = operation.populate('defaultBranch');
        }

        const chat = await operation.exec();

        if (!chat) {
            throw new NotFoundException('Chat not found');
        }

        // Check permissions
        if (userId && !chat.isPublic && chat.userId.toString() !== userId) {
            throw new ForbiddenException('You do not have permission to access this chat');
        }

        return chat;
    }

    async findByUserId(userId: string, options: GetManyChatsDto): Promise<ChatsResponse> {
        const { limit = 20, offset = 0, archived = false, search } = options;

        const query: RootFilterQuery<ChatDocument> = {
            userId: new Types.ObjectId(userId),
            archived,
        };

        // Search functionality
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { 'metadata.description': { $regex: search, $options: 'i' } },
            ];
        }

        const [chats, total] = await Promise.all([
            await this.chatModel
                .find(query)
                .sort({ lastActivityAt: -1 })
                .skip(offset)
                .limit(limit)
                .populate('defaultBranch')
                .exec(),

            await this.chatModel.countDocuments(query).exec(),
        ]);

        return {
            chats,
            total,
            hasMore: offset + limit < total,
        };
    }

    async update(chatId: string, userId: string, updateData: UpdateChatDto): Promise<Chat> {
        const chat = await this.findById(chatId, userId);

        if (chat.userId.toString() !== userId) {
            throw new ForbiddenException('You do not have permission to update this chat');
        }

        // Update fields
        chat.title = updateData.name ?? chat.title;
        chat.isPublic = updateData.isPublic ?? chat.isPublic;
        chat.archived = updateData.archived ?? chat.archived;
        chat.pinned = updateData.pinned ?? chat.pinned;
        chat.modelId = updateData.modelId ?? chat.modelId;
        chat.apiKeyId = updateData.apiKeyId ?? chat.apiKeyId;

        if (updateData.apiKeyId) {
            await this.apiKeyService.findById(updateData.apiKeyId, userId);
        }

        const saved = await chat.save();
        await saved.populate('defaultBranch');
        this.websocketsService.emitChatUpdated(userId, saved);
        return saved;
    }

    async updateLastActivity(chatId: string): Promise<void> {
        await this.chatModel.findByIdAndUpdate(chatId, { lastActivityAt: new Date() }).exec();
    }

    async delete(chatId: string, userId: string): Promise<void> {
        const chat = await this.findById(chatId, userId);

        if (chat.userId.toString() !== userId) {
            throw new ForbiddenException('You do not have permission to delete this chat');
        }

        await this.chatModel.deleteOne({ _id: chatId }).exec();
        await this.branchService.deleteAllByChatId(chatId, userId);
        await this.messagesService.deleteAllByChatId(chatId);
        this.websocketsService.emitChatDeleted(userId, chatId);
    }
}
