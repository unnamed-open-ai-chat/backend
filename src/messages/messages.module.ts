import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ChatBranch, ChatBranchSchema } from '@/branches/schemas/chat-branch.schema';
import { MessagesResolver } from './messages.resolver';
import { MessagesService } from './messages.service';
import { Message, MessageSchema } from './schemas/message.schema';
import { WebsocketsModule } from '@/websockets/websockets.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: ChatBranch.name, schema: ChatBranchSchema },
            { name: Message.name, schema: MessageSchema },
        ]),
        WebsocketsModule,
    ],
    providers: [MessagesService, MessagesResolver],
    exports: [MessagesService],
})
export class MessagesModule {}
