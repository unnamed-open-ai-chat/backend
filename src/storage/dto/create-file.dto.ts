import { Field, InputType } from '@nestjs/graphql';
import { IsNumber, IsString } from 'class-validator';

@InputType()
export class CreateFileDto {
    @Field()
    @IsString()
    filename: string;

    @Field()
    @IsString()
    mimetype: string;

    @Field()
    @IsNumber()
    size: number;
}
