import { Module } from '@nestjs/common';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { MyLogger } from '../logger.service';
import { EncryptionModule } from 'src/common/encryption/encryption.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}), // Provide default config, or import from AuthModule
    ConfigModule,
    EncryptionModule
  ],
  providers: [ContactService,MyLogger],
  controllers: [ContactController],
  exports: [ContactService],
})
export class ContactModule {}
