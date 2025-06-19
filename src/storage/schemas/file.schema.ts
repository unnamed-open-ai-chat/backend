import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({ timestamps: true })
@ObjectType()
export class File {
    @Field(() => String)
    @Prop({ type: String, default: uuidv4 }) // <- acá
    _id: string;

    @Prop({ required: true })
    @Field()
    filename: string;

    @Prop({ required: true })
    @Field()
    mimetype: string;

    @Prop({ required: true })
    @Field()
    size: number;

    @Prop({ required: true })
    userId: string;

    @Prop()
    @Field({ nullable: true })
    uploadId?: string;

    @Prop()
    @Field({ nullable: true })
    clientToken?: string;

    @Field()
    createdAt: Date;
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
