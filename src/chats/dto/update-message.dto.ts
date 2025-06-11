import { IsString, MaxLength } from 'class-validator';

export class UpdateMessageDto {
    @IsString()
    messageId: string;

    @IsString()
    @MaxLength(50000, { message: 'Message content must be at most 50000 characters' })
    content: string;
}
