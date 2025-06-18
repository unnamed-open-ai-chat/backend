import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum MessageRole {
    system = 'system',
    user = 'user',
    assistant = 'assistant',
    function = 'function',
    tool = 'tool',
}

registerEnumType(MessageRole, {
    name: 'MessageRole',
});

@ObjectType()
export class MessageContent {
    @Field()
    type: string;

    @Field({ nullable: true })
    id?: string;

    @Field({ nullable: true })
    name?: string;

    @Field({ nullable: true })
    text?: string;

    @Field({ nullable: true })
    tool_use_id?: string;

    input?: unknown;
}

@Schema({ timestamps: true })
@ObjectType()
export class Message {
    @Field(() => String)
    _id: Types.ObjectId;

    @Prop([{ type: Types.ObjectId, ref: 'File' }])
    @Field(() => [ID])
    attachments: Types.ObjectId[];

    @Prop({ types: Types.ObjectId, ref: 'Chat', required: true })
    @Field(() => String)
    chatId: Types.ObjectId;

    @Prop({ types: Types.ObjectId, ref: 'ChatBranch', required: true })
    @Field(() => String)
    branchId: Types.ObjectId;

    @Prop({ required: true })
    @Field()
    index: number;

    @Prop({ enum: MessageRole, required: true })
    @Field(() => String)
    role: MessageRole;

    @Prop({ type: ObjectType, required: true })
    @Field(() => [MessageContent])
    content: MessageContent[];

    @Prop()
    @Field({ nullable: true })
    modelUsed?: string;

    @Prop({ default: 0 })
    @Field({ nullable: true })
    tokens: number;

    @Prop({ type: Object, default: {} })
    metadata: Record<string, any>;

    @Prop({ type: Boolean, default: false })
    @Field()
    isEdited: boolean;

    @Prop()
    @Field({ nullable: true })
    editedAt?: Date;

    @Prop()
    @Field(() => [MessageContent], { nullable: true })
    originalContent?: MessageContent[];

    @Field()
    createdAt?: Date;
}

@ObjectType()
export class MessagesResponse {
    @Field(() => [Message])
    messages: Message[];
    @Field()
    total: number;
    @Field()
    hasMore: boolean;
}

export type MessageDocument = Message & Document;
export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ chatId: 1, createdAt: -1 });
MessageSchema.index({ chatId: 1, index: 1 }, { unique: true });
MessageSchema.index({ chatId: 1, index: 1 }, { unique: true });
MessageSchema.index({ chatId: 1, createdAt: 1 });
MessageSchema.index({ content: 'text' });
MessageSchema.index({ role: 1 });
MessageSchema.index({ attachments: 1 });
