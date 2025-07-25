import { Module } from '@nestjs/common';
import { WhatsappSetupService } from './whatsappsetup.service';
import { HttpModule } from '@nestjs/axios';
import { HttpService } from '../common/utils/http.service';
import { WhatsappsetupController } from './whatsappsetup.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EncryptionModule } from '../common/encryption/encryption.module';
import { PusherModule } from 'src/pusher/pusher.module';
import { MyLogger } from '../logger.service';
import { ShopifyService } from 'src/shopify/shopify.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [HttpModule,
    JwtModule.register({}), 
    PrismaModule,EncryptionModule,PusherModule],
  providers: [WhatsappSetupService, HttpService,MyLogger,ShopifyService],
  exports: [WhatsappSetupService],
  controllers: [WhatsappsetupController],
})
export class WhatsappsetupModule {}
