import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

import { ChatBranch } from './chat-branch.schema';

@Schema({ timestamps: true })
@ObjectType()
export class Chat {
    @Field(() => String)
    _id: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ required: true, maxlength: 100 })
    @Field()
    title: string;

    @Prop({ default: false })
    @Field()
    isPublic: boolean;

    @Prop({ types: Types.ObjectId, ref: 'ChatBranch' })
    @Field(() => ChatBranch, { nullable: true })
    defaultBranch?: Types.ObjectId;

    @Prop({ type: Object, default: {} })
    metadata: Record<string, any>;

    @Prop({ type: Date, default: Date.now })
    @Field()
    lastActivityAt: Date;

    @Prop({ default: false })
    @Field()
    archived: boolean;

    @Prop({ default: false })
    @Field()
    pinned: boolean;
}

export type ChatDocument = Chat & Document;
export const ChatSchema = SchemaFactory.createForClass(Chat);

@ObjectType()
export class ChatsResponse {
    @Field(() => [Chat])
    chats: Chat[];

    @Field()
    total: number;

    @Field()
    hasMore: boolean;
}

@ObjectType()
export class SingleChatResponse {
    @Field(() => Chat)
    chat: Chat;

    @Field(() => [ChatBranch])
    branches: ChatBranch[];

    @Field()
    totalMessages: number;
}

ChatSchema.index({ userId: 1, lastActivityAt: -1 });
ChatSchema.index({ userId: 1, archived: 1, lastActivityAt: -1 });
ChatSchema.index({ isPublic: 1, lastActivityAt: -1 });
ChatSchema.index({ title: 'text' });
