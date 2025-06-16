import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
@ObjectType()
export class UserPreferences {
    @Field(() => String)
    _id: Types.ObjectId;

    @Field({ nullable: true })
    @Prop({ lowercase: true, trim: true })
    timezone?: string;

    @Field({ nullable: true })
    @Prop({ lowercase: true, trim: true })
    dateFormat?: string;

    @Field({ nullable: true })
    @Prop({ lowercase: true, trim: true })
    language?: string;

    @Field({ nullable: true })
    @Prop()
    use24HourFormat?: boolean;

    @Field({ nullable: true })
    @Prop()
    useMetricUnits?: boolean;

    @Field({ nullable: true })
    @Prop()
    showSidebar?: boolean;

    @Field({ nullable: true })
    @Prop()
    showTimestamps?: boolean;

    @Field({ nullable: true })
    @Prop({ lowercase: true, trim: true })
    theme?: string;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;
}

export type PreferencesDocument = UserPreferences & Document;
export const PreferencesSchema = SchemaFactory.createForClass(UserPreferences);

PreferencesSchema.index({ userId: 1 }, { unique: true });
