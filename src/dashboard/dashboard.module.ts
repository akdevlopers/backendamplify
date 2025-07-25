import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { EncryptionService } from '../common/encryption/encryption.service';
import { BullModule } from '@nestjs/bull';

@Module({
   imports: [
    PrismaModule,
    JwtModule.register({}), 
    ConfigModule,
      BullModule.registerQueue({
          name: 'abandonedQueue',
        }),
  ],
  providers: [DashboardService,EncryptionService],
  controllers: [DashboardController]
})
export class DashboardModule {}
