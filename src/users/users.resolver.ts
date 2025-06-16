import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { GqlAuthGuard } from '@/auth/guards/gql-auth.guard';
import { AccessJwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './schemas/user.schema';
import { UsersService } from './users.service';

@Resolver()
export class UsersResolver {
    constructor(private usersService: UsersService) {}

    @UseGuards(GqlAuthGuard)
    @Query(() => User)
    async getUser(@CurrentUser() user: AccessJwtPayload): Promise<User> {
        return await this.usersService.findById(user.sub);
    }

    @UseGuards(GqlAuthGuard)
    @Mutation(() => User)
    async updateUser(
        @CurrentUser() user: AccessJwtPayload,
        @Args('payload') payload: UpdateUserDto
    ): Promise<User> {
        return await this.usersService.updateUser(user.sub, payload);
    }
}
