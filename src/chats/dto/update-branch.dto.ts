import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class UpdateBranchDTO {
    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    @MinLength(1, { message: 'Branch name must be at least 1 character' })
    @MaxLength(50, { message: 'Branch name must be at most 50 characters' })
    name?: string;
}
