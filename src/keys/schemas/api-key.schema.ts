import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

import { AIProviderId } from '@/ai/interfaces/ai-provider.interface';

@ObjectType()
@Schema({ timestamps: true })
export class ApiKey {
    @Field(() => String)
    _id: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Field(() => String)
    @Prop({
        type: String,
        enum: AIProviderId,
        required: true,
    })
    provider: AIProviderId;

    @Field()
    @Prop({ required: true })
    alias: string;

    @Prop({ required: true })
    encryptedApiKey: string;

    @Prop({ type: Boolean, default: true })
    isActive: boolean;

    @Field({ nullable: true })
    @Prop({ type: Date })
    lastUsed?: Date;

    @Field({ nullable: true })
    @Prop({ type: Date })
    lastRotated: Date;

    @Field({ nullable: true })
    @Prop({ type: Date })
    lastValidated: Date;
}

export type ApiKeyDocument = ApiKey & Document;
export const ApiKeySchema = SchemaFactory.createForClass(ApiKey);

ApiKeySchema.index({ userId: 1, provider: 1, alias: 1 }, { unique: true });
ApiKeySchema.index({ userId: 1, isActive: 1 });
ApiKeySchema.index({ lastValidated: 1 });
