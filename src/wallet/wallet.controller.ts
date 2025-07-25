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
import { WalletService } from './wallet.service';
import {
  ApiTags,
  ApiOperation,
  ApiProperty,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  constructor(private WalletService: WalletService) {}

  @Get('/wallet')
  @ApiOperation({ summary: 'Get All Wallet (Paginated)' })
  getAllWallet(@Query('page') page: string, @Query('limit') limit: string) {
    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;
    return this.WalletService.getAllWallet(pageNumber, limitNumber);
  }
}
