import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

@InputType()
export class UpdatePreferencesDto {
    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    dateFormat?: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    language?: string;

    @Field({ nullable: true })
    @IsOptional()
    @IsBoolean()
    use24HourFormat?: boolean;

    // UI Preferences
    @Field({ nullable: true })
    @IsOptional()
    @IsBoolean()
    showSidebar?: boolean;

    @Field({ nullable: true })
    @IsOptional()
    @IsBoolean()
    showTimestamps?: boolean;

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    theme?: string;
}
