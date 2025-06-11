import { Field, InputType } from '@nestjs/graphql';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

@InputType()
export class GetMessagesDto {
    @Field()
    @IsString()
    branchId: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(1)
    limit?: number = 50;

    @Field({ nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
    offset?: number = 0;

    @Field({ nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
    fromIndex?: number = 0;
}
