import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class SendTemplateMessageDto {
  @IsString()
  @IsNotEmpty()
  template_uid: string;

  @IsString()
  @IsNotEmpty()
  contact_uid: string;

  @IsString()
  @IsNotEmpty()
  vendor_uid: string;

   @IsNumber()
  @IsNotEmpty()
  from_phone_number_id: number;
}

