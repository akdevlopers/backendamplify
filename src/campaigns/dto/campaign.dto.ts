import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsDateString,
  IsNumber,
} from 'class-validator';

export class CampaignDto {
  @ApiProperty({ description: 'Unique identifier for the campaign', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  @IsNotEmpty()
  _uid: string;

  @ApiProperty({ description: 'Status of the campaign (e.g., 0 = inactive, 1 = active)', example: 1, required: false })
  @IsOptional()
  @IsInt()
  status?: number;

  @ApiProperty({ description: 'Updated timestamp', example: '2025-05-05T10:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  updated_at?: string;

  @ApiProperty({ description: 'Created timestamp', example: '2025-05-05T09:00:00Z' })
  @IsDateString()
  created_at: string;

  @ApiProperty({ description: 'Title of the campaign', example: 'Spring Sale 2025' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'WhatsApp Template ID', example: 12, required: false })
  @IsOptional()
  @IsInt()
  whatsapp_templates__id?: number;

  @ApiProperty({ description: 'Scheduled date and time', example: '2025-05-06T14:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  scheduled_at?: string;

  @ApiProperty({ description: 'User ID', example: 101, required: false })
  @IsOptional()
  @IsInt()
  users__id?: number;

  @ApiProperty({ description: 'Vendor ID', example: 202, required: false })
  @IsOptional()
  @IsInt()
  vendors__id?: number;

  @ApiProperty({ description: 'Template name', example: 'PromoTemplate2025', required: false })
  @IsOptional()
  @IsString()
  template_name?: string;

  @ApiProperty({ description: 'Template data (usually JSON string)', example: '{"message":"Hello!"}', required: false })
  @IsOptional()
  @IsString()
  __data?: string;

  @ApiProperty({ description: 'Template language', example: 'en', required: false })
  @IsOptional()
  @IsString()
  template_language?: string;

  @ApiProperty({ description: 'Timezone of the campaign', example: 'Asia/Kolkata', required: false })
  @IsOptional()
  @IsString()
  timezone?: string;
}


export class UpdateFlowDto {
  @IsString()
  data: string;
}

export class CreateCampaignDto {
  @IsNumber()
  @IsNotEmpty()
  vendor_id: number;

  @IsString()
  @IsNotEmpty()
  template_uid: string;

  @IsString()
  @IsNotEmpty()
  contact_group: string;

  @IsString()
  @IsNotEmpty()
  timezone: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  schedule_at?: string;

  @IsOptional()
  restrict_by_templated_contact_language?: boolean;

  @IsOptional()
  from_phone_number_id?: string;

  [key: string]: any; 
}
