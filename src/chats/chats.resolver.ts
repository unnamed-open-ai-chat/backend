import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { GqlAuthGuard } from 'src/auth/guards/gql-auth.guard';
import { AccessJwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { BranchesService } from './branches.service';
import { ChatService } from './chats.service';
import { GetManyChatsDto } from './dto/get-chat-dto';
import { MessagesService } from './messages.service';
import { Chat, ChatsResponse } from './schemas/chat.schema';

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
}
