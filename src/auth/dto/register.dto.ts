import { Field, InputType } from '@nestjs/graphql';
import { IsString, MaxLength, MinLength } from 'class-validator';

import { LoginDto } from './login.dto';

@InputType()
export class RegisterDto extends LoginDto {
    @Field()
    @IsString()
    @MinLength(3, { message: 'Display name must be at least 3 characters' })
    @MaxLength(50, { message: 'Display name must be at most 50 characters' })
    displayName: string;
}
