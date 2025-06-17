import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class UpdateChatDto {
    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    @MinLength(1, { message: 'Chat name must be at least 1 character' })
    @MaxLength(100, { message: 'Chat name must be at most 100 characters' })
    name?: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsBoolean()
    isPublic?: boolean;

    @Field({ nullable: true })
    @IsOptional()
    @IsBoolean()
    archived?: boolean;

    @Field({ nullable: true })
    @IsOptional()
    @IsBoolean()
    pinned?: boolean;
}
