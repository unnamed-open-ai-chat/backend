import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@ObjectType()
export class MessageTokenUsage {
    @Field()
    promptTokens: number;

    @Field()
    completionTokens: number;

    @Field()
    totalTokens: number;
}

export enum MessageRole {
    SYSTEM = 'system',
    USER = 'user',
    ASSISTANT = 'assistant',
    FUNCTION = 'function',
    TOOL = 'tool',
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

    @Prop({ type: Object })
    @Field(() => MessageTokenUsage)
    tokens: MessageTokenUsage;

    @Prop([{ type: [Types.ObjectId], ref: 'File' }])
    @Field(() => [String])
    attachments: Types.ObjectId[];

    @Prop({ type: Object, default: {} })
    metadata: Record<string, any>;

    @Prop({ type: Boolean, default: false })
    @Field()
    isEdited: boolean;

    @Prop()
    @Field()
    editedAt?: Date;

    @Prop()
    @Field(() => [MessageContent])
    originalContent?: MessageContent[];
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

MessageSchema.index({ branchId: 1, index: 1 }, { unique: true });
MessageSchema.index({ branchId: 1, createdAt: 1 });
MessageSchema.index({ content: 'text' });
MessageSchema.index({ role: 1 });
MessageSchema.index({ attachments: 1 });
