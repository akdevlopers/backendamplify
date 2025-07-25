import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsDate,
  IsOptional,
  IsEmail,
  IsNotEmpty,IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class NewFieldDto {
  @ApiProperty({
    description: 'Enter a Field Name',
    example: 'Decription',
  })
  @IsString()
  @IsNotEmpty()
  inputName: string;

  @ApiProperty({
    description: 'Enter a Field Type',
    example: 'Text',
  })
  @IsString()
  @IsNotEmpty()
  inputType: string;

  @ApiProperty({
    description: 'Vendor ID associated with the contact',
    example: 121,
  })
  @IsInt()
  vendors__id: number;
}

export class GroupDto {
  @ApiProperty({
    description: 'Enter The Title',
    example: 'Vendor',
  })
  @IsString()
  // @IsNotEmpty()
  type: string;

  @ApiProperty({
    description: 'Enter a Description',
    example: 'Sample Description for this group',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Vendor ID associated with the contact',
    example: 121,
  })
  @IsInt()
  vendors__id: number;
}

export class ContactDto {
  @ApiProperty({ description: 'Status of the contact', example: 1 })
  @IsInt()
  status: number;

  // @ApiProperty({
  //   description: 'Last updated date',
  //   example: new Date().toISOString(),
  // })
  // @IsOptional()
  // @IsDate()
  // updated_at?: Date;

  @ApiProperty({ description: 'First name of the contact', example: 'John' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ description: 'Last name of the contact', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty({
    description: 'Country ID associated with the contact',
    example: 101,
  })
  @IsInt()
  countries__id: number;

  @ApiProperty({
    description: 'Date when WhatsApp opt-out occurred',
    example: 0,
  })
  @IsOptional()
  whatsapp_opt_out: number;

  @ApiProperty({
    description: 'Date when the phone was verified',
    example: new Date().toISOString(),
  })
  @IsOptional()
  @IsDate()
  phone_verified_at?: Date;

  @ApiProperty({
    description: 'Email address of the contact',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Date when the email was verified',
    example: new Date().toISOString(),
  })
  @IsOptional()
  @IsDate()
  email_verified_at?: Date;

  @ApiProperty({
    description: 'Vendor ID associated with the contact',
    example: 121,
  })
  @IsInt()
 @IsNotEmpty()
  vendorId: number;


 @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  groups?: number[];

    // @IsOptional()
    // @IsInt()
    // groups?: number;


  @ApiProperty({
    description: 'WhatsApp ID of the contact',
    example: 'whatsapp:+1234567890',
  })

  @IsOptional()
  @IsString()
  wa_id?: string;

  @ApiProperty({ description: 'Language code for the contact', example: 'en' })
  @IsString()
  @IsNotEmpty()
  language_code: string;

  @ApiProperty({
    description: 'Flag to disable AI bot for the contact (0 or 1)',
    example: 0,
  })
  @IsInt()
  disable_ai_bot: number;

  @ApiProperty({
    description: 'Custom data for the contact',
    example: '{"preferences":{"newsletter":true}}',
  })
  @IsString()
  data?: string;

  @ApiProperty({ description: 'Assigned user ID', example: 42 })
  @IsInt()
  assigned_users__id?: number;
}


export class CountryDto {
  @ApiProperty({ description: 'ISO code of the country', example: 'US' })
  @IsString()
  @IsNotEmpty()
  iso_code: string;

  @ApiProperty({
    description: 'Capitalized name of the country',
    example: 'INDIA',
  })
  @IsString()
  @IsNotEmpty()
  name_capitalized: string;

  @ApiProperty({ description: 'Name of the country', example: 'India' })
  @IsString()
  @IsNotEmpty()
  name: string;
}