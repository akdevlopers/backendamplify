import { Controller,Post,Body,Req,BadRequestException,Get,UseInterceptors,Logger} from '@nestjs/common';
import { WhatsAppService } from './whatsappservice.service';
import {SendTemplateMessageDto } from './dto/whatsappservice.dto';
import { DecryptInterceptor } from 'src/common/interceptors/decrypt.interceptor';
import { EncryptionService } from 'src/common/encryption/encryption.service';

@Controller('whatsappservice')
export class WhatsappserviceController {constructor(private WhatsAppService: WhatsAppService,private EncryptionService: EncryptionService) {}
onModuleInit() {
    console.log('✅ WhatsappserviceController initialized');
  }


 @Get('health')
  healthCheck() {
    return { status: 'ok' };
  }


  @Post('send-template-message')
    @UseInterceptors(DecryptInterceptor)
  async sendTemplateMessageProcess(
    @Body() body: SendTemplateMessageDto,
    @Req() req: Request,
  ) {

    Logger.log(JSON.stringify(body), 'DecryptedRequest');

    if (!body.template_uid || !body.contact_uid) {
      throw new BadRequestException(
        'template_uid and contact_uid are required',
      );
    }

    const processReaction = await this.WhatsAppService.processSendMessageForContact(body);

    
    if (processReaction.failed) {
      return {
        success: false,
        message: processReaction.message,
        data: processReaction.data || {},
      };
    }

    return {
      success: true,
      message: processReaction.message,
    };
  }

      @Post('decryptPayload')
      @UseInterceptors(DecryptInterceptor)
      decryptPayload(@Body() encryptedData: string) {
        
        Logger.log(JSON.stringify(encryptedData), 'DecryptedRequest');
        return JSON.stringify(encryptedData);
      }

       @Post('encryptPayload')
  encryptPayload(@Body() body: any) {
    const encrypted = this.EncryptionService.encrypt(body);
    return {
      encrypted,
    };


}

}