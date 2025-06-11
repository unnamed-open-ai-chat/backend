import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

import { DeviceInfo } from '@/auth/interfaces/device-info.interface';
import { User } from '@/users/schemas/user.schema';

@Schema({ timestamps: true })
@ObjectType()
export class Session {
    @Field()
    _id: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ required: true, unique: true })
    refreshToken: string;

    @Prop({ required: true, unique: true })
    accessToken: string;

    @Prop({ type: Object, required: true })
    @Field()
    deviceInfo: DeviceInfo;

    @Prop({ type: Date, required: true })
    @Field()
    expiresAt: Date;

    @Prop({ type: Boolean, default: true })
    @Field()
    isActive: boolean;

    @Prop({ type: Date, default: Date.now })
    @Field()
    lastUsedAt: Date;
}

@ObjectType()
export class SessionResponse {
    @Field()
    accessToken: string;
    @Field()
    refreshToken: string;
    @Field({ nullable: true })
    user?: User;
    @Field({ nullable: true })
    rawDecryptKey?: string;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
export type SessionDocument = Session & Document;

SessionSchema.index({ userId: 1 });
SessionSchema.index({ refreshToken: 1 }, { unique: true });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
SessionSchema.index({ isActive: 1 });
