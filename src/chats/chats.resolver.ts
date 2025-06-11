import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { GqlAuthGuard } from '@/auth/guards/gql-auth.guard';
import { AccessJwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { BranchesService } from './branches.service';
import { ChatService } from './chats.service';
import { GetChatDto, GetManyChatsDto } from './dto/get-chat-dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { MessagesService } from './messages.service';
import { ChatBranch } from './schemas/chat-branch.schema';
import { Chat, ChatsResponse, SingleChatResponse } from './schemas/chat.schema';
import { MessagesResponse } from './schemas/message.schema';

@Resolver(() => Chat)
export class ChatsResolver {
    constructor(
        private chatService: ChatService,
        private branchesService: BranchesService,
        private messagesService: MessagesService
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
}
