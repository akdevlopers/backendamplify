import { Module } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; 
import { BullModule } from '@nestjs/bull';
import { CronService } from './cron.service';
import { AbandonedProcessor } from './processor/abandoned.processor';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { MyLogger } from '../logger.service';
import { CampaignsModule } from '../campaigns/campaigns.module'; 
import { WhatsappserviceModule } from 'src/whatsappservice/whatsappservice.module';
import { EncryptionModule } from 'src/common/encryption/encryption.module';


@Module({
  imports: [
    EncryptionModule,
    WhatsappserviceModule,
    CampaignsModule,
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        // signOptions: { expiresIn: '1h' },
      }),
    }),
    ConfigModule,
   BullModule.registerQueue({
      name: 'abandonedQueue',
    }),
    MailerModule.forRoot({
      transport: {
        host: process.env.MAIL_HOST,
        port: process.env.MAIL_PORT,
        secure: false,
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASSWORD,
        },
      },
      defaults: {
        from: process.env.MAIL_FROM,
      },
      template: {
        dir: join(process.cwd(), 'src', 'automation', 'templates'),
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    }),
  ],
  providers: [AutomationService, CronService,AbandonedProcessor,MyLogger],
  controllers: [AutomationController]
})
export class AutomationModule {}
