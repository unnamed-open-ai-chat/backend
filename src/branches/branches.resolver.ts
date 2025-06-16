import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { GqlAuthGuard } from '@/auth/guards/gql-auth.guard';
import { AccessJwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { BranchesService } from './branches.service';
import { ChatBranch } from './schemas/chat-branch.schema';

@Resolver(() => ChatBranch)
export class BranchesResolver {
    constructor(private branchesService: BranchesService) {}

    @UseGuards(GqlAuthGuard)
    @Query(() => [ChatBranch])
    async getChatBranches(
        @CurrentUser() user: AccessJwtPayload,
        @Args('chatId') chatId: string
    ): Promise<ChatBranch[]> {
        return await this.branchesService.findByChatId(chatId, user.sub);
    }
}
