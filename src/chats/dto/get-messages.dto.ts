import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class GetMessagesDto {
    @IsString()
    branchId: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    limit?: number = 50;

    @IsOptional()
    @IsNumber()
    @Min(0)
    offset?: number = 0;

    @IsOptional()
    @IsNumber()
    @Min(0)
    fromIndex?: number = 0;
}
