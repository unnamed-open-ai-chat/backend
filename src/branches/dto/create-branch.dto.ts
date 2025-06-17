import { Field, InputType } from '@nestjs/graphql';
import { IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UpdateBranchModelConfigDto } from './update-branch.dto';

@InputType()
export class CreateBranchDto {
    @Field()
    @IsString()
    @MinLength(1, { message: 'Branch name must be at least 1 character' })
    @MaxLength(50, { message: 'Branch name must be at most 50 characters' })
    name: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    parentBranchId?: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsNumber()
    branchPoint?: number;

    @Field({ nullable: true })
    @IsOptional()
    modelConfig?: UpdateBranchModelConfigDto;
}
