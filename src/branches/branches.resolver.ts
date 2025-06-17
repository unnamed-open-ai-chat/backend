import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { GqlAuthGuard } from '@/auth/guards/gql-auth.guard';
import { AccessJwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { BranchesService } from './branches.service';
import { ForkBranchDto } from './dto/fork-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
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

    @UseGuards(GqlAuthGuard)
    @Mutation(() => ChatBranch)
    async updateBranch(
        @CurrentUser() user: AccessJwtPayload,
        @Args('branchId') branchId: string,
        @Args('payload') payload: UpdateBranchDto
    ): Promise<ChatBranch> {
        return await this.branchesService.update(branchId, user.sub, payload);
    }

    @UseGuards(GqlAuthGuard)
    @Mutation(() => ChatBranch)
    async forkBranch(
        @CurrentUser() user: AccessJwtPayload,
        @Args('originalBranchId') originalBranchId: string,
        @Args('payload') payload: ForkBranchDto
    ): Promise<ChatBranch> {
        return await this.branchesService.forkBranch(user.sub, originalBranchId, payload);
    }
}
