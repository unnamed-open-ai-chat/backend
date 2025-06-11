import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

import { AIProviderId } from '@/ai/interfaces/ai-provider.interface';

@InputType()
export class CreateApiKeyDto {
    @Field(() => AIProviderId)
    @IsEnum(AIProviderId, { message: 'Invalid provider' })
    provider: AIProviderId;

    @Field()
    @IsString()
    @MinLength(3, { message: 'Alias must be at least 3 characters long' })
    @MaxLength(50, { message: 'Alias must not exceed 50 characters' })
    alias: string;

    @Field()
    @IsString()
    @MinLength(10, { message: 'API key must be at least 10 characters long' })
    apiKey: string;
}
