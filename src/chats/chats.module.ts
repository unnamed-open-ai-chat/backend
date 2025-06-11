import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

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
    ],
    providers: [ChatService, BranchesService, MessagesService, ChatsResolver],
    exports: [ChatService, BranchesService, MessagesService],
})
export class ChatsModule {}
