import { Field, InputType } from '@nestjs/graphql';
import { IsString, MaxLength } from 'class-validator';

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
}
