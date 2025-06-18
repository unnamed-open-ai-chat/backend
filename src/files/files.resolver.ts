import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { AccessJwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator'; // Adjust path as needed
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard'; // Adjust path as needed
import { UpdateFileDto } from './dto/update-file.dto';
import { FileUploadService } from './files.service';
import { File, UserStorageStats } from './schemas/file.schema';

@Resolver(() => File)
@UseGuards(GqlAuthGuard)
export class FileUploadResolver {
    constructor(private readonly fileUploadService: FileUploadService) {}

    @Query(() => [File], { name: 'getUserFiles' })
    async getUserFiles(@CurrentUser() user: AccessJwtPayload): Promise<File[]> {
        return this.fileUploadService.getUserFiles(user.sub);
    }

    @Query(() => File, { name: 'getFileById' })
    async getFileById(
        @Args('id', { type: () => ID }) id: string,
        @CurrentUser() user: AccessJwtPayload
    ): Promise<File> {
        return this.fileUploadService.getFileById(id, user.sub);
    }

    @Query(() => UserStorageStats, { name: 'getUserStorageStats' })
    async getUserStorageStats(@CurrentUser() user: AccessJwtPayload): Promise<UserStorageStats> {
        return this.fileUploadService.getUserStorageStats(user.sub);
    }

    @Mutation(() => File, { name: 'updateFile' })
    async updateFile(
        @Args('id', { type: () => ID }) id: string,
        @Args('updateFileDto') updateFileDto: UpdateFileDto,
        @CurrentUser() user: AccessJwtPayload
    ): Promise<File> {
        return this.fileUploadService.updateFile(id, updateFileDto, user.sub);
    }

    @Mutation(() => Boolean, { name: 'deleteFile' })
    async deleteFile(
        @Args('id', { type: () => ID }) id: string,
        @CurrentUser() user: AccessJwtPayload
    ): Promise<boolean> {
        return this.fileUploadService.deleteFile(id, user.sub);
    }
}
