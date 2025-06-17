import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Chat, ChatSchema } from '@/chats/schemas/chat.schema';
import { ApiKeysModule } from '@/keys/api-key.module';
import { MessagesModule } from '@/messages/messages.module';
import { WebsocketsModule } from '@/websockets/websockets.module';
import { BranchesResolver } from './branches.resolver';
import { BranchesService } from './branches.service';
import { ChatBranch, ChatBranchSchema } from './schemas/chat-branch.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: ChatBranch.name, schema: ChatBranchSchema },
            { name: Chat.name, schema: ChatSchema },
        ]),
        MessagesModule,
        ApiKeysModule,
        WebsocketsModule,
    ],
    providers: [BranchesService, BranchesResolver],
    exports: [BranchesService],
})
export class BranchesModule {}
