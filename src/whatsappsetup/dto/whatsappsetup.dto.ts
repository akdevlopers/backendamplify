import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsNotEmpty,
} from 'class-validator';


export class WhatsappSettingDto {
  @ApiProperty({ description: 'vendor Id', example: 1 })
  @IsInt()
  vendors__id: number;

  @ApiProperty({ description: 'Name type', example: 'John' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'value type', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiProperty({
    description: 'type',
    example: 101,
  })
  @IsInt()
  data_type: number;
}
