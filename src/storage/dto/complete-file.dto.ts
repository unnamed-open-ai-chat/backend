import { Field, InputType } from '@nestjs/graphql';
import { IsNumber, IsString } from 'class-validator';

@InputType()
export class FilePart {
    @Field()
    @IsString()
    etag: string;

    @Field()
    @IsNumber()
    partNumber: number;
}

@InputType()
export class CompleteFileDto {
    @Field()
    @IsString()
    fileId: string;

    @Field(() => [FilePart])
    parts: FilePart[];
}
