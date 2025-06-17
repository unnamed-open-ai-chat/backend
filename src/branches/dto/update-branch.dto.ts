import { Field, InputType } from '@nestjs/graphql';
import {
    IsMongoId,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';

@InputType()
export class UpdateBranchModelConfigDto {
    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    @MinLength(1, { message: 'Model ID must be at least 1 character' })
    @MaxLength(64, { message: 'Model ID must be at most 64 characters' })
    modelId?: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    @IsMongoId({ message: 'API Key ID is not valid' })
    apiKeyId?: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsNumber(
        { allowNaN: false, allowInfinity: false },
        { message: 'Temperature must be a valid number' }
    )
    temperature?: number;

    @Field({ nullable: true })
    @IsOptional()
    @IsNumber(
        { allowNaN: false, allowInfinity: false },
        { message: 'Max tokens must be a valid number' }
    )
    @Min(1, { message: 'Max tokens must be at least 1' })
    maxTokens?: number;
}

@InputType()
export class UpdateBranchDto {
    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    @MinLength(1, { message: 'Branch name must be at least 1 character' })
    @MaxLength(50, { message: 'Branch name must be at most 50 characters' })
    name?: string;

    @Field({ nullable: true })
    @IsOptional()
    modelConfig?: UpdateBranchModelConfigDto;
}
