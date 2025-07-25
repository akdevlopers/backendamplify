import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [
      PrismaModule,
      JwtModule.register({}),
      ConfigModule,
    ],
  providers: [WalletService],
  controllers: [WalletController]
})
export class WalletModule {}
