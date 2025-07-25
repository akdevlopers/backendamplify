import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { EncryptionModule } from '../common/encryption/encryption.module';
import { MyLogger } from '../logger.service';
import { WhatsappserviceModule } from 'src/whatsappservice/whatsappservice.module';
import { MessageLogRepository } from 'src/whatsappservice/message-log.repository';

@Module({
    imports: [
      PrismaModule,
      JwtModule.register({}), // Provide default config, or import from AuthModule
      ConfigModule,EncryptionModule,WhatsappserviceModule
    ],
  providers: [CampaignsService,MyLogger,MessageLogRepository],
  controllers: [CampaignsController],
   exports: [CampaignsService],
})
export class CampaignsModule {}
