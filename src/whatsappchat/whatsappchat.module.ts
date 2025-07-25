import { Module } from '@nestjs/common';
import { WhatsappchatController } from './whatsappchat.controller';
import { WhatsappchatService } from './whatsappchat.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EncryptionModule } from '../common/encryption/encryption.module';
import { PusherModule } from 'src/pusher/pusher.module';
import { HttpModule } from '@nestjs/axios';


@Module({
  imports: [PrismaModule,EncryptionModule,PusherModule,HttpModule],
  controllers: [WhatsappchatController],
  providers: [WhatsappchatService]
})
export class WhatsappchatModule {}
