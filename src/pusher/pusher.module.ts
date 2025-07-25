import { Module } from '@nestjs/common';
import { PusherController } from './pusher.controller';
import { PusherService } from './pusher.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MyLogger } from '../logger.service';
import { EncryptionModule } from '../common/encryption/encryption.module';

@Module({
  imports: [
    PrismaModule,
    EncryptionModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
    }),
    ConfigModule,
  ],
  controllers: [PusherController],
  providers: [PusherService], 
  exports: [PusherService],
})
export class PusherModule {}