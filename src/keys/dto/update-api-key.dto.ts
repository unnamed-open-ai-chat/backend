import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class UpdateApiKeyDto {
    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    @MinLength(3, { message: 'Alias must be at least 3 characters long' })
    @MaxLength(50, { message: 'Alias must not exceed 50 characters' })
    alias?: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
