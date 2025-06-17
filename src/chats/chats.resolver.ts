import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { AIService } from '@/ai/ai.service';
import { AIModel } from '@/ai/interfaces/ai-provider.interface';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { GqlAuthGuard } from '@/auth/guards/gql-auth.guard';
import { AccessJwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { BranchesService } from '@/branches/branches.service';
import { EncryptionService } from '@/encryption/encryption.service';
import { ApiKeysService } from '@/keys/api-key.service';
import { MessagesService } from '@/messages/messages.service';
import { WebsocketsService } from '@/websockets/websockets.service';
import { Types } from 'mongoose';
import { Message, MessageRole } from '../messages/schemas/message.schema';
import { ChatService } from './chats.service';
import { AddMessageDto } from './dto/add-message.dto';
import { GetChatDto, GetManyChatsDto } from './dto/get-chat-dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { Chat, ChatsResponse, SingleChatResponse } from './schemas/chat.schema';

@Resolver(() => Chat)
export class ChatsResolver {
    constructor(
        private chatService: ChatService,
        private branchesService: BranchesService,
        private messagesService: MessagesService,
        private aiService: AIService,
        private apiKeyService: ApiKeysService,
        private encryptionService: EncryptionService,
        private websocketsService: WebsocketsService
    ) {}

    @UseGuards(GqlAuthGuard)
    @Query(() => [AIModel])
    async getAvailableModels(
        @CurrentUser() user: AccessJwtPayload,
        @Args('rawDecryptKey') rawDecryptKey: string
    ): Promise<AIModel[]> {
        const models = new Map<string, AIModel>();

        const apiKeys = await this.apiKeyService.findAll(user.sub);
        for (const apiKey of apiKeys) {
            const decryptedApiKey = this.encryptionService.decryptWithKey(
                apiKey.encryptedApiKey,
                rawDecryptKey
            );
            const apiModels = await this.aiService.getModels(apiKey.provider, decryptedApiKey);

            for (const model of apiModels) {
                models.set(model.id, model);
            }
        }

        return Array.from(models.values());
    }

    @UseGuards(GqlAuthGuard)
    @Query(() => ChatsResponse)
    async getChats(
        @CurrentUser() user: AccessJwtPayload,
        @Args('query') queryOptions: GetManyChatsDto
    ): Promise<ChatsResponse> {
        const results = await this.chatService.findByUserId(user.sub, queryOptions);
        return results;
    }

    @UseGuards(GqlAuthGuard)
    @Query(() => SingleChatResponse)
    async getChat(
        @CurrentUser() user: AccessJwtPayload,
        @Args('query') queryOptions: GetChatDto
    ): Promise<SingleChatResponse> {
        const { chatId } = queryOptions;

        const chat = await this.chatService.findById(chatId, user.sub);
        const branches = await this.branchesService.findByChatId(chatId, user.sub);
        const totalMessages = branches.reduce((acc, branch) => acc + branch.messageCount, 0);

        return {
            chat,
            branches,
            totalMessages,
        };
    }

    @UseGuards(GqlAuthGuard)
    @Mutation(() => Chat)
    async createChat(@CurrentUser() user: AccessJwtPayload) {
        return await this.chatService.createChat(user.sub);
    }

    @UseGuards(GqlAuthGuard)
    @Mutation(() => Chat)
    async updateChat(
        @CurrentUser() user: AccessJwtPayload,
        @Args('id') chatId: string,
        @Args('payload') payload: UpdateChatDto
    ) {
        return await this.chatService.update(chatId, user.sub, payload);
    }

    @UseGuards(GqlAuthGuard)
    @Mutation(() => Message)
    async sendMessage(
        @CurrentUser() user: AccessJwtPayload,
        @Args('payload') payload: AddMessageDto
    ) {
        const branch = await this.branchesService.findById(payload.branchId, user.sub);

        // First, save the user message
        const userMessage = await this.messagesService.create({
            attachments: [],
            branchId: new Types.ObjectId(payload.branchId),
            chatId: branch.chatId,
            content: [
                {
                    type: 'text',
                    text: payload.prompt,
                },
            ],
            metadata: {},
            role: MessageRole.user,
            tokens: 0,
        });

        // Update branch and chat message counts
        await this.branchesService.incrementMessageCount(payload.branchId);
        await this.chatService.updateLastActivity(branch.chatId.toString());

        // Get API key
        const apiKey = await this.apiKeyService.findById(payload.apiKeyId, user.sub);

        // Get decrypt-key
        const key = this.encryptionService.decryptWithKey(
            apiKey.encryptedApiKey,
            payload.rawDecryptKey
        );

        //  Get previous history
        const chat = await this.messagesService.findByBranchId({
            branchId: payload.branchId,
        });

        let completedMessage = '';

        this.websocketsService.emitToBranch(user.sub, payload.branchId, 'message:start', null);

        this.aiService
            .sendMessage(
                apiKey.provider,
                key,
                payload.modelId,
                chat.messages,
                {},
                {
                    onEnd: async () => {
                        console.log('Chat ended');

                        // Save AI message
                        const message = await this.messagesService.create({
                            attachments: [],
                            branchId: new Types.ObjectId(payload.branchId),
                            chatId: branch.chatId,
                            content: [
                                {
                                    type: 'text',
                                    text: completedMessage,
                                },
                            ],
                            metadata: {},
                            role: MessageRole.assistant,
                            tokens: 0,
                        });

                        this.websocketsService.emitToBranch(
                            user.sub,
                            payload.branchId,
                            'message:end',
                            message
                        );
                    },
                    // eslint-disable-next-line @typescript-eslint/require-await
                    onError: async error => {
                        console.log('Chat error', error);

                        this.websocketsService.emitToBranch(
                            user.sub,
                            payload.branchId,
                            'message:error',
                            error
                        );
                    },
                    // eslint-disable-next-line @typescript-eslint/require-await
                    onText: async text => {
                        completedMessage += text;
                        console.log('Chat chunk', text);

                        this.websocketsService.emitToBranch(
                            user.sub,
                            payload.branchId,
                            'message:chunk',
                            text
                        );
                    },
                }
            )
            .catch(error => {
                this.websocketsService.emitToBranch(
                    user.sub,
                    payload.branchId,
                    'message:error',
                    error
                );
            });

        return userMessage;
    }
}
