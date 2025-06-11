import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AIModule } from '@/ai/ai.module';
import { EncryptionModule } from '@/encryption/encryption.module';
import { ApiKeysModule } from '@/keys/api-key.module';
import { BranchesService } from './branches.service';
import { ChatsResolver } from './chats.resolver';
import { ChatService } from './chats.service';
import { MessagesService } from './messages.service';
import { ChatBranch, ChatBranchSchema } from './schemas/chat-branch.schema';
import { Chat, ChatSchema } from './schemas/chat.schema';
import { Message, MessageSchema } from './schemas/message.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Chat.name, schema: ChatSchema },
            { name: ChatBranch.name, schema: ChatBranchSchema },
            { name: Message.name, schema: MessageSchema },
        ]),
        AIModule,
        ApiKeysModule,
        EncryptionModule,
    ],
    providers: [ChatService, BranchesService, MessagesService, ChatsResolver],
    exports: [ChatService, BranchesService, MessagesService],
})
export class ChatsModule {}
