import { Module } from '@nestjs/common';
import { ShopifyService } from './shopify.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ShopifyController } from './shopify.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { ShopifyProcessor } from './shopify-sync.queue'; 
import { ContactModule } from '../contact/contact.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Import JwtAuthGuard
import { MyLogger } from '../logger.service';
import { EncryptionModule } from 'src/common/encryption/encryption.module';

@Module({
  imports: [
    EncryptionModule,
    PrismaModule,
    HttpModule,
       JwtModule.registerAsync({
         imports: [ConfigModule],
         inject: [ConfigService],
         useFactory: (configService: ConfigService) => ({
           secret: configService.get<string>('JWT_SECRET'),
           // signOptions: { expiresIn: '1h' },
         }),
       }),
    ConfigModule,
    SubscriptionsModule,
    ContactModule,  
    BullModule.registerQueue({
      name: 'shopify-sync',
    }),
  ],
  providers: [ShopifyService,ShopifyProcessor,JwtAuthGuard,MyLogger],
  controllers: [ShopifyController],
   exports: [JwtModule, JwtAuthGuard], 
})
export class ShopifyModule {}
