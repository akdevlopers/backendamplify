// src/media/media.service.ts
import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { extname } from 'path';
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';


@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService,private readonly ConfigService: ConfigService) {}

    private elements = {
          whatsapp_image: {
            restrictions: {
              allowedFileTypes: ['image/jpeg', 'image/png'],
              allowedFileExtensions: ['jpg', 'jpeg', 'png'],
            },
          },
          whatsapp_video: {
            restrictions: {
              allowedFileTypes: ['video/mp4'],
              allowedFileExtensions: ['mp4'],
            },
          },
          whatsapp_document: {
            restrictions: {
              allowedFileTypes: [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'text/plain',
              ],
              allowedFileExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'],
            },
          },
           whatsapp_audio: {
              restrictions: {
                allowedFileTypes: ['audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/webm'],
                allowedFileExtensions: ['mp3', 'ogg', 'm4a', 'aac', 'webm'],
              },
            },
        };

  async uploadTempMedia(file: Express.Multer.File, uploadItem: string, vendorId: number) {
    const vendor = await this.prisma.vendors.findUnique({ where: {  id: Number(vendorId),  } });
    if (!vendor) throw new BadRequestException('Invalid vendor ID');

    const user = await this.prisma.users.findFirst({ where: { vendors__id: vendor.id } });
    if (!user) throw new BadRequestException('Vendor user not found');

    const userId = user.uid;
    const tempFolderPath = join(__dirname, '../../public/uploads/temp', userId);
    if (!existsSync(tempFolderPath)) mkdirSync(tempFolderPath, { recursive: true });

    this.deleteOldFiles(tempFolderPath);

    return this.processUpload(file, tempFolderPath, uploadItem);
  }

    private processUpload(file: Express.Multer.File, folderPath: string, requestFor: string) {
      const originalName = file.originalname;
      const extension = extname(originalName).substring(1);
      const mimeType = file.mimetype;

      const restrictions = this.elements[requestFor]?.restrictions;
      if (!restrictions) throw new BadRequestException('Invalid upload type');

      if (!restrictions.allowedFileExtensions.includes(extension)) {
        throw new BadRequestException(`Only ${restrictions.allowedFileExtensions.join(', ')} accepted.`);
      }

      if (!restrictions.allowedFileTypes.includes(mimeType)) {
        throw new BadRequestException(`Only ${restrictions.allowedFileTypes.join(', ')} accepted.`);
      }

      const safeName = `${uuidv4()}-${originalName.replace(/\s+/g, '-')}`;
      const fullPath = join(folderPath, safeName);

      const writeStream = createWriteStream(fullPath);
      writeStream.write(file.buffer);
      writeStream.end();

      const baseUrl = this.ConfigService.get<string>('BASE_URL'); // example: http://localhost:5000

      // Extract user folder name from path
      const userId = folderPath.split('/').pop(); // OR use a variable if passed

      return {
        success: true,
        file_path: `/uploads/temp/${userId}/${safeName}`,
        url: `${baseUrl}/public/uploads/temp/${userId}/${safeName}`,
        message: 'File uploaded successfully.',
      };
    }


  private deleteOldFiles(dir: string, maxAgeSeconds = 3600) {
    const now = Date.now();
    const files = readdirSync(dir);

    for (const file of files) {
      const fullPath = join(dir, file);
      const stats = statSync(fullPath);

      if (stats.isFile() && now - stats.mtimeMs > maxAgeSeconds * 1000) {
        unlinkSync(fullPath);
      }
    }
  }
}