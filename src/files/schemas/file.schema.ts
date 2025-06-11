import { Field } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum FileProcessingStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
}

@Schema({ timestamps: true })
export class File {
    @Field(() => String)
    _id: Types.ObjectId;

    @Field(() => String)
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ required: true })
    @Field()
    originalName: string;

    @Prop({ required: true })
    @Field()
    mimeType: string;

    @Prop({ required: true })
    @Field()
    size: number;

    @Prop({ type: Types.ObjectId, required: true })
    gridFSId: Types.ObjectId;

    @Prop({ enum: FileProcessingStatus, default: FileProcessingStatus.PENDING })
    processingStatus: FileProcessingStatus;

    @Prop({ type: String })
    processedContent: string;

    @Prop({ type: Types.ObjectId })
    thumbnail: Types.ObjectId;

    @Prop({ type: Object, default: {} })
    metadata: Record<string, any>;

    @Prop({ type: Date })
    expiresAt: Date;
}

export type FileDocument = File & Document;
export const FileSchema = SchemaFactory.createForClass(File);

FileSchema.index({ userId: 1, createdAt: -1 });
FileSchema.index({ gridFSId: 1 });
FileSchema.index({ processingStatus: 1 });
FileSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
FileSchema.index({ mimeType: 1 });
