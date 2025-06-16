import { Field, InputType } from '@nestjs/graphql';
import { IsString, Matches, MinLength } from 'class-validator';

@InputType()
export class ChangePasswordDto {
    @Field()
    @IsString()
    @MinLength(8, { message: 'Old password must be at least 8 characters' })
    @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/, {
        message: 'Old password must contain at least one letter and one number',
    })
    oldPassword: string;

    @Field()
    @IsString()
    @MinLength(8, { message: 'New password must be at least 8 characters' })
    @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/, {
        message: 'New password must contain at least one letter and one number',
    })
    newPassword: string;
}
