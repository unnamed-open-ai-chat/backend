import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
@ObjectType()
export class File {
    @Field(() => String)
    _id: Types.ObjectId;

    @Prop({ required: true })
    @Field()
    filename: string;

    @Prop({ required: true })
    @Field()
    originalName: string;

    @Prop({ required: true })
    @Field()
    mimetype: string;

    @Prop({ required: true })
    @Field()
    size: number;

    @Prop({ required: true })
    path: string;

    @Prop({ required: true })
    userId: string;

    @Prop()
    @Field({ nullable: true })
    description?: string;

    @Field()
    createdAt: Date;

    @Field()
    updatedAt: Date;
}

@ObjectType()
export class UserStorageStats {
    @Field()
    used: number;

    @Field()
    limit: number;

    @Field()
    remaining: number;
}

export const FileSchema = SchemaFactory.createForClass(File);
export type FileDocument = File & Document;
