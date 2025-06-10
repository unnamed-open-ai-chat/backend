import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
@ObjectType()
export class User {
  @Field()
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  @Field()
  email: string;

  @Prop({ required: true, default: false })
  @Field()
  emailVerified: boolean;

  @Prop()
  emailVerificationCode?: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true, trim: true })
  @Field()
  displayName: string;

  @Prop({ required: true })
  @Field()
  encryptKey: string;

  @Prop({ required: true })
  @Field()
  decryptKey: string;

  @Prop({ required: true, default: true })
  isActive: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
export type UserDocument = User & Document;

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ displayName: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ createdAt: -1 });

UserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

export function comparePassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
