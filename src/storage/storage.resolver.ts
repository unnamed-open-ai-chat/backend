import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { GqlAuthGuard } from '@/auth/guards/gql-auth.guard';
import { AccessJwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { CompleteFileDto } from './dto/complete-file.dto';
import { CreateFileDto } from './dto/create-file.dto';
import { File, UserStorageStats } from './schemas/file.schema';
import { StorageService } from './storage.service';

@Resolver(() => File)
@UseGuards(GqlAuthGuard)
export class StorageResolver {
    constructor(private readonly storageService: StorageService) {}

    @Mutation(() => File)
    async createFile(
        @CurrentUser() user: AccessJwtPayload,
        @Args('payload') payload: CreateFileDto
    ) {
        const { filename, mimetype, size } = payload;
        return this.storageService.createFile(user.sub, filename, mimetype, size);
    }

    @Mutation(() => File)
    async completeFile(
        @CurrentUser() user: AccessJwtPayload,
        @Args('payload') payload: CompleteFileDto
    ) {
        return this.storageService.completeFileUpload(user.sub, payload.fileId, payload.parts);
    }

    @Mutation(() => Boolean, { name: 'deleteFile' })
    async deleteFile(
        @Args('id') id: string,
        @CurrentUser() user: AccessJwtPayload
    ): Promise<boolean> {
        return this.storageService.deleteFile(id, user.sub);
    }

    @Query(() => [File])
    async getUserFiles(@CurrentUser() user: AccessJwtPayload): Promise<File[]> {
        return this.storageService.getUserFiles(user.sub);
    }

    @Query(() => File)
    async getFileById(
        @Args('id') id: string,
        @CurrentUser() user: AccessJwtPayload
    ): Promise<File> {
        return this.storageService.getFileById(id, user.sub);
    }

    @Query(() => UserStorageStats)
    async getUserStorageStats(@CurrentUser() user: AccessJwtPayload): Promise<UserStorageStats> {
        return this.storageService.getUserStorageStats(user.sub);
    }
}
