import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { AIService } from '@/ai/ai.service';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { GqlAuthGuard } from '@/auth/guards/gql-auth.guard';
import { AccessJwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { EncryptionService } from '@/encryption/encryption.service';
import { ApiKeysService } from '@/keys/api-key.service';
import { Types } from 'mongoose';
import { BranchesService } from './branches.service';
import { ChatService } from './chats.service';
import { AddMessageDto } from './dto/add-message.dto';
import { GetChatDto, GetManyChatsDto } from './dto/get-chat-dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { MessagesService } from './messages.service';
import { ChatBranch } from './schemas/chat-branch.schema';
import { Chat, ChatsResponse, SingleChatResponse } from './schemas/chat.schema';
import { MessageRole, MessagesResponse } from './schemas/message.schema';

@Resolver(() => Chat)
export class ChatsResolver {
    constructor(
        private chatService: ChatService,
        private branchesService: BranchesService,
        private messagesService: MessagesService,
        private aiService: AIService,
        private apiKeyService: ApiKeysService,
        private encryptionService: EncryptionService
    ) {}

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
    @Query(() => [ChatBranch])
    async getChatBranches(
        @CurrentUser() user: AccessJwtPayload,
        @Args('chatId') chatId: string
    ): Promise<ChatBranch[]> {
        return await this.branchesService.findByChatId(chatId, user.sub);
    }

    @UseGuards(GqlAuthGuard)
    @Query(() => MessagesResponse)
    async getChatMessages(
        @CurrentUser() user: AccessJwtPayload,
        @Args('query') queryOptions: GetMessagesDto
    ): Promise<MessagesResponse> {
        if (!user?.sub) {
            throw new UnauthorizedException("User doesn't exist");
        }

        return await this.messagesService.findByBranchId(queryOptions, user.sub);
    }

    @UseGuards(GqlAuthGuard)
    @Mutation(() => Chat)
    async createChat(@CurrentUser() user: AccessJwtPayload) {
        return await this.chatService.createChat(user.sub);
    }

    @UseGuards(GqlAuthGuard)
    @Mutation(() => Boolean)
    async sendMessage(
        @CurrentUser() user: AccessJwtPayload,
        @Args('payload') payload: AddMessageDto
    ) {
        console.log(user);
        const branch = await this.branchesService.findById(payload.branchId, user.sub);

        // First, save the user message
        await this.messagesService.create({
            attachments: [],
            branchId: new Types.ObjectId(payload.branchId),
            content: [
                {
                    type: 'text',
                    text: payload.prompt, //
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

        await this.aiService.sendMessage(
            apiKey.provider,
            key,
            payload.modelId,
            chat.messages,
            {},
            {
                onEnd: async () => {
                    console.log('Chat ended');

                    // Save AI message
                    await this.messagesService.create({
                        attachments: [],
                        branchId: new Types.ObjectId(payload.branchId),
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
                },
                // eslint-disable-next-line @typescript-eslint/require-await
                onError: async error => {
                    console.log('Chat error', error);
                },
                // eslint-disable-next-line @typescript-eslint/require-await
                onText: async text => {
                    completedMessage += text;
                    console.log('Chat chunk', text);
                },
            }
        );

        return true;
    }
}
