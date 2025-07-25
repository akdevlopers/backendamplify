import { Controller, Post, Body ,BadRequestException,UseInterceptors, NotFoundException} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto,ForgotPasswordDto,ResetPasswordDto,ChangePasswordDto } from './dto/auth.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DecryptInterceptor } from 'src/common/interceptors/decrypt.interceptor';

@ApiTags('Authentication')
@Controller('auth')

export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login' })
  @UseInterceptors(DecryptInterceptor)
 async login(@Body() dto: LoginDto) {

  console.log('Decrypted',dto); 
  if (!dto) {
    throw new BadRequestException('Missing request body');
  }
  return await this.authService.login(dto);
  }

  @Post('register')
  @UseInterceptors(DecryptInterceptor)
  @ApiOperation({ summary: 'Registration' })
  register(@Body() dto: RegisterDto) {
    console.log('Decrypted',dto); 
    return this.authService.register(dto);
  }

  @Post('forgot-password')
   @UseInterceptors(DecryptInterceptor)
    @ApiOperation({ summary: 'Send password reset email' })
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
      if (!dto?.email) {
          throw new NotFoundException('Email is required');
        }
      return this.authService.forgotPassword(dto.email);
    }

        @Post('reset-password')
        @UseInterceptors(DecryptInterceptor)
        @ApiOperation({ summary: 'Reset password using token' })
        async resetPassword(@Body() dto: ResetPasswordDto) {
          if (!dto?.token) {
              throw new NotFoundException('Token is required');
            }

            if (!dto?.newPassword) {
              throw new NotFoundException('Password is required');
            }
          return this.authService.resetPassword(dto.token, dto.newPassword);
        }

        @Post('change-password')
        @UseInterceptors(DecryptInterceptor)
        @ApiOperation({ summary: 'Reset password using token' })
        async changePassword(@Body() dto: ChangePasswordDto) {

            if (!dto?.vendor_uid) {
              throw new NotFoundException('Vendor Uid is required');
            }

            if (!dto?.oldPassword) {
              throw new NotFoundException('Old Password is required');
            }

            if (!dto?.newPassword) {
              throw new NotFoundException('New Password is required');
            }
          // return this.authService.changePassword(dto.oldPassword, dto.newPassword);

          return this.authService.changePassword(dto.vendor_uid,dto.oldPassword, dto.newPassword);
        }

}

