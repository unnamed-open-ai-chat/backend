import { Field, InputType } from '@nestjs/graphql';
import { IsString, MaxLength } from 'class-validator';

@InputType()
export class UpdateMessageDto {
    @Field()
    @IsString()
    messageId: string;

    @Field()
    @IsString()
    @MaxLength(50000, { message: 'Message content must be at most 50000 characters' })
    content: string;
}
