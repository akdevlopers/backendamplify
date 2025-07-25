import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WhatsAppService } from './whatsappservice.service';
import { WhatsappserviceController } from './whatsappservice.controller';
import { HttpService } from '../common/utils/http.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EncryptionModule } from '../common/encryption/encryption.module';
import { ContactRepository } from './contact.repository';  // Add this import
import { EncryptionService } from 'src/common/encryption/encryption.service';
import { MediaService } from 'src/media/media.service';
import { MessageLogRepository } from './message-log.repository';
import { ParameterHelper } from 'src/helper/parameter.helper';
import { MyLogger } from 'src/logger.service';
@Module({
  imports: [HttpModule,PrismaModule,EncryptionModule],
  providers: [HttpService,WhatsAppService,
    EncryptionService,
    MediaService,
    MessageLogRepository,
    ParameterHelper,
    ContactRepository,MyLogger],
  controllers: [WhatsappserviceController],
   exports: [WhatsAppService], 
})
export class WhatsappserviceModule {}

