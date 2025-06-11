import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateChatDto {
    @IsOptional()
    @IsString()
    @MinLength(1, { message: 'Chat name must be at least 1 character' })
    @MaxLength(100, { message: 'Chat name must be at most 100 characters' })
    name?: string;

    @IsOptional()
    @IsBoolean()
    isPublic?: boolean;

    @IsOptional()
    @IsBoolean()
    archived?: boolean;

    @IsOptional()
    @IsBoolean()
    pinned?: boolean;
}
