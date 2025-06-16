import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { GqlAuthGuard } from '@/auth/guards/gql-auth.guard';
import { AccessJwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { UpdatePreferencesDto } from './dto/update-preferences.schema';
import { PreferencesService } from './preferences.service';
import { UserPreferences } from './schema/user-preference.schema';

@Resolver(() => UserPreferences)
export class PreferencesResolver {
    constructor(private readonly userPreferencesService: PreferencesService) {}

    @UseGuards(GqlAuthGuard)
    @Query(() => UserPreferences)
    async getPreferences(@CurrentUser() user: AccessJwtPayload): Promise<UserPreferences> {
        return await this.userPreferencesService.findByUserId(user.sub);
    }

    @UseGuards(GqlAuthGuard)
    @Mutation(() => UserPreferences)
    async updatePreferences(
        @CurrentUser() user: AccessJwtPayload,
        @Args('payload') payload: UpdatePreferencesDto
    ): Promise<UserPreferences> {
        return await this.userPreferencesService.updatePreferences(user.sub, payload);
    }
}
