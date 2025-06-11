import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

@InputType()
export class GetManyChatsDto {
    @Field({ nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @Field({ nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
    offset?: number = 0;

    @Field({ nullable: true })
    @IsOptional()
    @IsBoolean()
    archived?: boolean = false;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    search?: string;
}

@InputType()
export class GetChatDto {
    @Field()
    @IsString()
    chatId: string;
}
