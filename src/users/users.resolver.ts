import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AccessJwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateUserDTO } from './dto/update-user.dto';
import { User } from './schemas/user.schema';
import { UsersService } from './users.service';

@Resolver()
export class UsersResolver {
    constructor(private usersService: UsersService) {}

    @UseGuards(JwtAuthGuard)
    @Query(() => User)
    async getUser(@CurrentUser() user: AccessJwtPayload): Promise<User> {
        return await this.usersService.findById(user.sub);
    }

    @UseGuards(JwtAuthGuard)
    @Mutation(() => String)
    async updateProfile(
        @CurrentUser() user: AccessJwtPayload,
        @Args('payload') payload: UpdateUserDTO
    ): Promise<any> {
        return await this.usersService.updateProfile(user.sub, payload);
    }
}
