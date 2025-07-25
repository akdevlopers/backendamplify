// src/media/media.controller.ts
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
  Req
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-temp')
  @UseInterceptors(FileInterceptor('filepond'))
  async uploadTempMedia(@UploadedFile() file: Express.Multer.File, @Body() body: any) {
    const { uploadfile, vendorId } = body ?? {}; // ✅ Safe destructuring

    if (!file) throw new BadRequestException('No file uploaded.');
    if (!uploadfile) throw new BadRequestException('Please select upload item.');

    return this.mediaService.uploadTempMedia(file, uploadfile, vendorId);
  }
}
