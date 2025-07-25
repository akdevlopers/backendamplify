import { Module,MiddlewareConsumer,RequestMethod} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { EncryptionInterceptor } from './common/interceptors/encryption.interceptor';
import { ContactModule } from './contact/contact.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { TemplateModule } from './template/template.module';
import { BotModule } from './bot/bot.module';
import { WalletModule } from './wallet/wallet.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ShopifyModule } from './shopify/shopify.module';
import { BullModule } from '@nestjs/bull';
import { AutomationModule } from './automation/automation.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MulterModule } from '@nestjs/platform-express';
import { WhatsappsetupModule } from './whatsappsetup/whatsappsetup.module';
import { EncryptionService } from './common/encryption/encryption.service';
import { EncryptionModule } from './common/encryption/encryption.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import * as path from 'path';
import { MyLogger } from './logger.service';
import { CronService } from './automation/cron.service'; 
import { AutomationService } from './automation/automation.service'; // 
import { DashboardModule } from './dashboard/dashboard.module';
import { PusherModule } from './pusher/pusher.module';
import { RawBodyMiddleware } from './middlewares/raw-body.middleware';
import { WhatsappserviceModule } from './whatsappservice/whatsappservice.module';
import { MediaModule } from './media/media.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { WhatsappchatModule } from './whatsappchat/whatsappchat.module';

@Module({
  imports: [
     ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/public', // serves files at /public/*
    }),
    ConfigModule.forRoot({ isGlobal: true }),
     MulterModule.register({
      dest: './uploads',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AutomationModule,
    AuthModule,
    ContactModule,
    CampaignsModule,
    TemplateModule,
    BotModule,
    WalletModule,
    SubscriptionsModule,
    ShopifyModule,
     BullModule.registerQueue({
      name: 'abandonedQueue',
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3,
        reconnectOnError: () => true,
      },
    }),    
    // BullModule.forRoot({
    //   redis: {
    //     host: '127.0.0.1',
    //     port: 6379,
    //     maxRetriesPerRequest: 3,      
    //     reconnectOnError: () => true, 
    //   },
    // }),
     WhatsappsetupModule, EncryptionModule, DashboardModule, PusherModule, WhatsappserviceModule, MediaModule,WhatsappchatModule
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: EncryptionInterceptor,
    },
    EncryptionService,MyLogger,
    CronService, AutomationService
  ],
  exports: [MyLogger],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RawBodyMiddleware)
      .forRoutes(
        { path: 'shopify/shop/redact', method: RequestMethod.ALL },
        { path: 'shopify/customers/redact', method: RequestMethod.ALL },
        { path: 'shopify/customers/data_request', method: RequestMethod.ALL },
        // Add more Shopify webhook routes as needed
      );
  }
}