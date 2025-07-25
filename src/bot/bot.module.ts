import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BotController } from './bot.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [
      PrismaModule,
      JwtModule.register({}),
      ConfigModule,
    ],
  providers: [BotService],
  controllers: [BotController]
})
export class BotModule {}
