import {
  Controller,
  Post,
  Patch,
  Delete,
  ParseIntPipe,
  Get,
  Body,
  Param,
  UseGuards,HttpStatus,
  Query,Res,UseInterceptors
} from '@nestjs/common';
import { WhatsappSetupService } from './whatsappsetup.service';
import {
  ApiTags,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { DecryptInterceptor } from 'src/common/interceptors/decrypt.interceptor';
import { PrismaService } from 'src/prisma/prisma.service';
import { EncryptionService} from 'src/common/encryption/encryption.service';
import { MyLogger } from '../logger.service';

@ApiTags('Whatsappsetup')
@Controller('whatsappsetup')
export class WhatsappsetupController {
    constructor( private readonly prisma: PrismaService,private WhatsappSetupService: WhatsappSetupService,private EncryptionService: EncryptionService,private readonly logger: MyLogger) {}

  @Post('/processEmbeddedSignUp')
  @ApiOperation({ summary: 'Facebook Setup' })

  @UseInterceptors(DecryptInterceptor)
  processEmbeddedSignUp(
      @Body('request_code') request_code: string, @Body('waba_id') waba_id: string,@Body('phone_number_id') phone_number_id: string,@Body('vendorUid') vendorUid: string
    ) {
      return this.WhatsappSetupService.processEmbeddedSignUp(request_code,waba_id,phone_number_id,vendorUid);
    }



  @Post('/refreshHealthStatus')
  @ApiOperation({ summary: 'Refresh Health Status' })
   @UseInterceptors(DecryptInterceptor)
  refreshHealthStatus(
     @Body('vendorUid') vendorUid: string
    ) {
      return this.WhatsappSetupService.refreshHealthStatus(vendorUid);
    }

  @Post('/syncPhoneNumbers')
  @ApiOperation({ summary: 'Sync PhoneNumbers' })
  @UseInterceptors(DecryptInterceptor)
  syncPhoneNumbers(
     @Body('vendorUid') vendorUid: string
    ) {
      return this.WhatsappSetupService.syncPhoneNumbers(vendorUid);
    }
    
     @Post('/whatsappCloudApiSetup')
    @ApiOperation({ summary: 'whatsappCloudApiSetup' })
      @UseInterceptors(DecryptInterceptor)
    whatsappCloudApiSetup(
      @Body('vendorUid') vendorUid: string
      ) {
        return this.WhatsappSetupService.whatsappCloudApiSetup(vendorUid);
      }

      @Post('/createTestContact')
    @ApiOperation({ summary: 'createTestContact' })
     @UseInterceptors(DecryptInterceptor)
    createTestContact(@Body('phoneNumber') phoneNumber: number|string,@Body('vendorUid') vendorUid: string) {
        return this.WhatsappSetupService.createTestContact(phoneNumber,vendorUid);
    }


     @Get('/whatsappwebhook/:id')
      @ApiOperation({ summary: 'whatsapp-webhook' })

      whatsappwebhook(@Param('id') vendorUid: string,@Query('hub.mode') mode: string,
      @Query('hub.verify_token') token: string,
      @Query('hub.challenge') challenge: string,@Res() res: Response,) {
        return this.WhatsappSetupService.whatsappwebhook(vendorUid,mode,token,challenge,res);
    }


    @Post('/saveDefaultNumber')
    @ApiOperation({ summary: 'Save default verified WhatsApp number' })
    @UseInterceptors(DecryptInterceptor)
    async saveDefaultNumber(
      @Body('vendorUid') vendorUid: string,
      @Body('phoneNumberId') phoneNumberId: number
    ): Promise<any> {
      return this.WhatsappSetupService.saveDefaultNumber(vendorUid, phoneNumberId);
    }

      @Post('/whatsappwebhook/:id')
        @ApiOperation({ summary: 'Handle WhatsApp webhook events' })
        @ApiBody({ description: 'Webhook payload from WhatsApp' })
        async handleWebhookEvents(
          @Param('id') vendorUid: string,
          @Body() payload: any,
        ) {
          this.logger.log('--- Incoming WhatsApp Webhook ---', 'WhatsappWebhook');
          this.logger.log(`Vendor UID: ${vendorUid}`, 'WhatsappWebhook');
          this.logger.debug(`Payload: ${JSON.stringify(payload)}`, 'WhatsappWebhook');

          try {
            const result = await this.WhatsappSetupService.handleWebhookEvents(vendorUid, payload);

            this.logger.log('Webhook processed successfully', 'WhatsappWebhook');
            return {
              success: true,
              result,
            };
          } catch (error) {
            this.logger.error(`Error processing webhook: ${error.message}`, 'WhatsappWebhook');

            await this.prisma.razorpayresponse.create({
              data: {
                razorpayresponse_value: error.message || 'Unknown error',
              },
            });

            return {
              success: false,
              message: 'Failed to store message',
              error: error.message || 'Unknown error occurred',
            };
          }
        }

      

       @Post('encrypt-token')
      encryptToken(@Body('text') text: string) {
        if (!text) {
          return {
            success: false,
            message: 'Text is required for encryption',
          };
        }

        const encrypted = this.EncryptionService.encrypt(text);

        return {
          success: true,
          encryptedText: encrypted,
        };
      }




}

