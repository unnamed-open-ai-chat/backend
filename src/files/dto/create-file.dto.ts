import { Field, InputType } from '@nestjs/graphql';
import { IsNumber, IsOptional, IsString } from 'class-validator';

@InputType()
export class CreateFileDto {
    @Field()
    @IsString()
    filename: string;

    @Field()
    @IsString()
    originalName: string;

    @Field()
    @IsString()
    mimetype: string;

    @Field()
    @IsNumber()
    size: number;

    @Field()
    @IsString()
    path: string;

    @Field()
    @IsString()
    userId: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    description?: string;
}
