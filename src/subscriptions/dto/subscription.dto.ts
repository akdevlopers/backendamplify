import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsDate,
  IsOptional,
  IsNumber,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';

export class SubscriptionDto {
  @ApiProperty({
    description: 'Subscription status',
    example: 'initiated',
  })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiProperty({
    description: 'Updated at timestamp',
    example: '2025-05-08T12:34:56.789Z',
    required: false,
  })
  @IsOptional()
  @IsDate()
  updated_at?: Date;

  @ApiProperty({
    description: 'Plan ID',
    example: 'plan_1',
    required: false,
  })
  @IsOptional()
  @IsString()
  plan_id?: string;

  @ApiProperty({
    description: 'Subscription end date',
    example: '2025-12-31T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @IsDate()
  ends_at?: Date;

  @ApiProperty({
    description: 'Remarks or comments',
    example: 'Customer upgraded to premium',
    required: false,
  })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({
    description: 'Vendor ID',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  vendors__id?: number;

  @ApiProperty({
    description: 'Charges amount',
    example: 299.99,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  charges?: number;

  @ApiProperty({
    description: 'Additional data (long text)',
    example: '{"notes":"Manual entry"}',
    required: false,
  })
  @IsOptional()
  @IsString()
  data?: string;

  @ApiProperty({
    description: 'Charge frequency',
    example: 'monthly',
    required: false,
  })
  @IsOptional()
  @IsString()
  charges_frequency?: string;
}
