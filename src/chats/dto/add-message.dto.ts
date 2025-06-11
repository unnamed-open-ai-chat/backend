import { Field, InputType } from '@nestjs/graphql';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { MessageRole } from '../schemas/message.schema';

@InputType()
export class AddMessageDto {
    @Field()
    @IsString()
    branchId: string;

    @Field()
    @IsString()
    @MaxLength(50000, { message: 'Message content must be at most 50000 characters' })
    content: string;

    @Field()
    @IsEnum(MessageRole)
    role: MessageRole;

    @Field({ nullable: true })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    attachments?: string[];

    @Field()
    @IsString()
    modelUsed: string;
}
