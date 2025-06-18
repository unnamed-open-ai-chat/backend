import { Field, InputType } from '@nestjs/graphql';
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

@InputType()
export class AddMessageDto {
    @Field()
    @IsString()
    branchId: string;

    @Field()
    @IsString()
    @MaxLength(50000, { message: 'Message content must be at most 50000 characters' })
    prompt: string;

    @Field()
    @IsString()
    modelId: string;

    @Field()
    @IsString()
    rawDecryptKey: string;

    @Field()
    @IsString()
    apiKeyId: string;

    @Field(() => [String], { nullable: true })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    attachments?: string[];

    @Field({ nullable: true })
    @IsOptional()
    @IsBoolean()
    useImageTool?: boolean;
}
