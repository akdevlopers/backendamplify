import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsDate,
  IsOptional,
  IsEmail,
  IsNotEmpty,
} from 'class-validator';

export class NewFieldDto {
 
  @IsString()
  @IsNotEmpty()
  vendor_uid: string;

  @ApiProperty({ example: 'user@example.com', required: false })
  @IsString()
  @IsNotEmpty()
  contact_email?: string;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsString()
 @IsNotEmpty()
  contact_phone?: string;

  @ApiProperty({ example: '123 Main St', required: false })
  @IsString()
  @IsNotEmpty()
  address?: string;

  @ApiProperty({ example: '560001', required: false })
  @IsString()
  @IsNotEmpty()
  postal_code?: string;

  @ApiProperty({ example: 'Bangalore', required: false })
  @IsString()
  @IsNotEmpty()
  city?: string;

  @ApiProperty({ example: 'Karnataka', required: false })
  @IsString()
  @IsNotEmpty()
  state?: string;

  @ApiProperty({ example: '1', required: false })
  @IsString()
  @IsNotEmpty()
  country?: number;

  @ApiProperty({ example: 'en', required: false })
  @IsString()
  @IsNotEmpty()
  default_language?: string;

  @ApiProperty({ example: 'Asia/Kolkata', required: false })
  @IsString()
  @IsNotEmpty()
  timezone?: string;
}

