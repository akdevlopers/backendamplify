import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { HttpService } from '../common/utils/http.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EncryptionModule } from '../common/encryption/encryption.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule,PrismaModule,EncryptionModule],
  providers: [MediaService],
  controllers: [MediaController]
})
export class MediaModule {}
