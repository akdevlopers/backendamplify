import {
  Controller,
  Post,
  Patch,
  Delete,
  Get,
  Body,
  Param,
  UseGuards,
  Query,
  BadRequestException,
  UploadedFiles,
  UseInterceptors,
  Req,
  ParseIntPipe,Res
} from '@nestjs/common';

import { WhatsappchatService } from './whatsappchat.service';
import {
  ApiTags,
  ApiOperation,
  ApiProperty,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

@Controller('whatsappchat')
export class WhatsappchatController {
  constructor(private WhatsappchatService: WhatsappchatService) {}

  @Get('contact/:contactId')
  async getLogsByContactId(
    @Param('contactId', ParseIntPipe) contactId: number,
  ) {
    return this.WhatsappchatService.getLogsByContactId(contactId);
  }

  // @Post('send/:contactId')
  // async sendMessage(
  //   @Param('contactId', ParseIntPipe) contactId: number,
  //   @Body() messageData: any,
  // ) {
  //   return this.WhatsappchatService.sendMessageToContact(
  //     contactId,
  //     messageData,
  //   );
  // }
     @Post('send/:contactId')
      async sendMessage(
        @Param('contactId', ParseIntPipe) contactId: number,
        @Body() messageData: any,
        @Res() res: Response,
      ) {
        try {
          const result = await this.WhatsappchatService.sendMessageToContact(contactId, messageData);

          if (!result.success) {
            return res.status(result.statusCode || 500).json({
              success: false,
              message: result.message || 'Something went wrong',
            });
          }

          return res.status(result.statusCode || 200).json({
            success: true,
            message: result.message || 'Message sent successfully',
            data: result.data || null,
          });
        } catch (error) {
          console.error('Unhandled Error in Controller:', error);

          return res.status(500).json({
            success: false,
            message: 'Internal server error: ' + error.message,
          });
        }
      }


    @Post('/getChatContacts')
    @ApiOperation({ summary: 'Get All Chat Contacts' })
    getChatContacts( @Query('page') page: string,@Query('limit') limit: string,@Query('vendorUid') vendorUid: string) {
        const pageNumber = parseInt(page) || 1;
        const limitNumber = parseInt(limit) || 10;
    
        if (vendorUid == "") {
            throw new BadRequestException('Invalid vendorId');
        }
    
        return this.WhatsappchatService.getChatContacts(pageNumber, limitNumber, vendorUid);
    }
}
