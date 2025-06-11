import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { GqlAuthGuard } from '@/auth/guards/gql-auth.guard';
import { AccessJwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { ApiKeysService } from './api-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';
import { ApiKey } from './schemas/api-key.schema';

@Resolver()
export class ApiKeyResolver {
    constructor(private apiKeysService: ApiKeysService) {}

    @UseGuards(GqlAuthGuard)
    @Query(() => [ApiKey])
    async getApiKeys(@CurrentUser() user: AccessJwtPayload): Promise<ApiKey[]> {
        return await this.apiKeysService.findAll(user.sub);
    }

    @UseGuards(GqlAuthGuard)
    @Mutation(() => ApiKey)
    async addApiKey(
        @Args('payload') payload: CreateApiKeyDto,
        @CurrentUser() user: AccessJwtPayload
    ): Promise<ApiKey> {
        return await this.apiKeysService.create(user.sub, payload);
    }

    @UseGuards(GqlAuthGuard)
    @Mutation(() => ApiKey)
    async updateApiKey(
        @Args('id') id: string,
        @Args('payload') payload: UpdateApiKeyDto,
        @CurrentUser() user: AccessJwtPayload
    ): Promise<ApiKey> {
        return await this.apiKeysService.update(id, user.sub, payload);
    }

    @UseGuards(GqlAuthGuard)
    @Mutation(() => Boolean)
    async deleteApiKey(
        @Args('id') id: string,
        @CurrentUser() user: AccessJwtPayload
    ): Promise<boolean> {
        await this.apiKeysService.delete(id, user.sub);
        return true;
    }
}
