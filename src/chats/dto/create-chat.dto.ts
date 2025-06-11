import { Field, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType()
export class CreateChatDTO {
    @Field()
    @IsString()
    model: string;

    @Field()
    @IsString()
    firstPrompt: string;
}
