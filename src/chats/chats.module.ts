import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AIModule } from '@/ai/ai.module';
import { BranchesModule } from '@/branches/branches.module';
import { EncryptionModule } from '@/encryption/encryption.module';
import { ApiKeysModule } from '@/keys/api-key.module';
import { MessagesModule } from '@/messages/messages.module';
import { WebsocketsModule } from '@/websockets/websockets.module';
import { Message, MessageSchema } from '../messages/schemas/message.schema';
import { ChatsResolver } from './chats.resolver';
import { ChatService } from './chats.service';
import { Chat, ChatSchema } from './schemas/chat.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Chat.name, schema: ChatSchema },
            { name: Message.name, schema: MessageSchema },
        ]),
        AIModule,
        ApiKeysModule,
        EncryptionModule,
        BranchesModule,
        MessagesModule,
        WebsocketsModule,
    ],
    providers: [ChatService, ChatsResolver],
    exports: [ChatService],
})
export class ChatsModule {}
