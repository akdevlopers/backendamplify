import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsNotEmpty, IsJSON ,IsNumber} from 'class-validator';
import { Type } from 'class-transformer';

export class AutomationDto {
  @ApiProperty({
    description: 'Vendor ID associated with the automation',
    example: 87,
  })
  @IsInt()
  vendors__id: number;

  @ApiProperty({
    description: 'Name of the automation flow',
    example: 'Abandoned Cart Flow',
  })
  @IsString()
  @IsNotEmpty()
  flow_name: string;

  @ApiProperty({
    description: 'JSON definition of the automation flow',
    example: '{"steps":[{"type":"message","text":"Hello!"}]}',
  })
  @IsNotEmpty()
  @IsJSON()
  flow_json: any;
}

export class GetFlowDto {
  @IsNumber()
  @IsNotEmpty()
  vendorId: number;

  @IsNumber()
  @IsNotEmpty()
  flowId: number;
}
