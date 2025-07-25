import { Module } from '@nestjs/common';
import { TemplateService } from './template.service';
import { TemplateController } from './template.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { EncryptionModule } from '../common/encryption/encryption.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}),
    ConfigModule,EncryptionModule,HttpModule
  ],
  providers: [TemplateService],
  controllers: [TemplateController]
})
export class TemplateModule {}