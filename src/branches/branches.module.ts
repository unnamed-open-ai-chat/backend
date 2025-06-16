import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { MessagesModule } from '@/messages/messages.module';
import { BranchesResolver } from './branches.resolver';
import { BranchesService } from './branches.service';
import { ChatBranch, ChatBranchSchema } from './schemas/chat-branch.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: ChatBranch.name, schema: ChatBranchSchema }]),
        MessagesModule,
    ],
    providers: [BranchesService, BranchesResolver],
    exports: [BranchesService],
})
export class BranchesModule {}
