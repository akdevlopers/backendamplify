import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsDate,
  IsOptional,
  IsEmail,
  IsNotEmpty,
} from 'class-validator';


// pusher.dto.ts
export class PusherTriggerDto {
  @ApiProperty({
    description: 'Enter Channel',
    example: 'test-channel',
  })
  @IsString()
  @IsNotEmpty()
  channel: string;

  @ApiProperty({
    description: 'Enter Event',
    example: 'test-event',
  })
  @IsString()
  @IsNotEmpty()
  event: string;

   @ApiProperty({
    description: 'Enter Message',
    example: '  Hello from NestJS!',
  })
  @IsString()
  @IsNotEmpty()
   message: string;
}
