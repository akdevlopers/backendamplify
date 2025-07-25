// src/dashboard/dashboard.controller.ts
import { Controller, Get, Query,UseGuards,BadRequestException,Post,Body,UseInterceptors} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { ApiTags, ApiOperation, ApiProperty, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import * as CryptoJS from 'crypto-js';
import { NewFieldDto} from './dto/dashboard.dto';
import { DecryptInterceptor } from 'src/common/interceptors/decrypt.interceptor';

const SECRET_KEY = process.env.SECRET_KEY || '48962874218962874213689687';

export function encryptField(value: any): string | undefined {
  if (value === null || value === undefined) return undefined;
  const stringValue = String(value);
  return CryptoJS.AES.encrypt(stringValue, SECRET_KEY).toString();
}

export function decryptField(encryptedValue: string): string | undefined {
  if (!encryptedValue) return undefined;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedValue, SECRET_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || undefined;
  } catch (err) {
    console.error('Decryption error:', err);
    return undefined;
  }
}


  
  @UseGuards(JwtAuthGuard)
  @ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly encryptionService: EncryptionService,
  ) {}

      @Get()
      async getStats(@Query('vendor_uid') VendorId: string) {
        if (!VendorId) {
          throw new BadRequestException('Invalid vendor ID');
        }
        return this.dashboardService.getDashboardStats(VendorId);
      }

       @Post('create')
         @UseInterceptors(DecryptInterceptor)
      async createSettings(@Body() dto: NewFieldDto) {
        return await this.dashboardService.saveVendorSettings(dto);
      }

      @Get('vendor-settings')
      async getVendorSettings(@Query('vendorUid') vendorUid: string) {
        try{
        const result = await this.dashboardService.getVendorSettings(vendorUid);
        return result;
        }catch (error) {
            throw new BadRequestException({
              message: 'Failed to fetch settings',
              error: error.message || error,
            });
          } 
      }

        @Post('CheckWhatsappOnboardSetup')
        @UseInterceptors(DecryptInterceptor)
          async CheckWhatsappOnboardSetup(@Body('vendor_uid') VendorId: string) {
            if (!VendorId) {
              throw new BadRequestException('Invalid vendor ID');
            }
            return this.dashboardService.CheckWhatsappOnboardSetup(VendorId);
          }

}
