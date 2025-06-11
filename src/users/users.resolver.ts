import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { GqlAuthGuard } from '@/auth/guards/gql-auth.guard';
import { AccessJwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { UpdateUserDTO } from './dto/update-user.dto';
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
    @Mutation(() => String)
    async updateProfile(
        @CurrentUser() user: AccessJwtPayload,
        @Args('payload') payload: UpdateUserDTO
    ): Promise<any> {
        return await this.usersService.updateProfile(user.sub, payload);
    }
}
