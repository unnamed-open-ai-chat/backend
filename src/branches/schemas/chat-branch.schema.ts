import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@ObjectType()
export class ModelConfig {
    @Field(() => String, { nullable: true })
    modelId?: string;

    @Field(() => String, { nullable: true })
    apiKeyId?: string;

    @Field(() => Number, { nullable: true })
    temperature?: number;

    @Field(() => Number, { nullable: true })
    maxTokens?: number;
}

@Schema({ timestamps: true })
@ObjectType()
export class ChatBranch {
    @Field(() => String)
    _id: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Chat', required: true })
    chatId: Types.ObjectId;

    @Prop({ required: true, maxlength: 50 })
    @Field()
    name: string;

    @Prop({ type: Types.ObjectId, ref: 'ChatBranch' })
    @Field(() => ChatBranch, { nullable: true })
    parentBranchId?: Types.ObjectId;

    @Prop({ type: Number, default: 0 })
    @Field()
    branchPoint: number;

    @Prop({ type: Number, default: 0 })
    @Field()
    messageCount: number;

    @Prop({ default: false })
    @Field()
    isActive: boolean;

    @Prop({ type: Object, default: {} })
    metadata: Record<string, any>;

    @Prop()
    @Field(() => ModelConfig, { nullable: true })
    modelConfig?: ModelConfig;
}

export type ChatBranchDocument = ChatBranch & Document;
export const ChatBranchSchema = SchemaFactory.createForClass(ChatBranch);

ChatBranchSchema.index({ chatId: 1, isActive: 1 });
ChatBranchSchema.index({ parentBranchId: 1 });
ChatBranchSchema.index({ chatId: 1, name: 1 });
