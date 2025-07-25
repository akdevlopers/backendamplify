import {
  Controller,
  Post,
  Patch,
  Delete,
  Get,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { BotService } from './bot.service';
import {
  ApiTags,
  ApiOperation,
  ApiProperty,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@ApiTags('Bot')
@Controller('bot')
export class BotController {
  constructor(private BotService: BotService) {}

  @Get('/bots')
  @ApiOperation({ summary: 'Get All Bot Flow (Paginated)' })
  getAllBot(@Query('page') page: string, @Query('limit') limit: string) {
    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;
    return this.BotService.getAllBot(pageNumber, limitNumber);
  }
}
