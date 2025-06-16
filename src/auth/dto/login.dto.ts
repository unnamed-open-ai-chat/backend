import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

@InputType()
export class LoginDto {
    @Field()
    @IsEmail({}, { message: 'Email is not valid' })
    email: string;

    @Field()
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/, {
        message: 'Password must contain at least one letter and one number',
    })
    password: string;
}
