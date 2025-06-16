import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { GqlAuthGuard } from '@/auth/guards/gql-auth.guard';
import { AccessJwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { GetMessagesDto } from './dto/get-messages.dto';
import { MessagesService } from './messages.service';
import { Message, MessagesResponse } from './schemas/message.schema';

@Resolver(() => Message)
export class MessagesResolver {
    constructor(private readonly messagesService: MessagesService) {}

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
