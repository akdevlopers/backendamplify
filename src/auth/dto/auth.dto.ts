import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsPhoneNumber,IsOptional,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Enter The Title',
    example: 'AK Info',
  })
  @IsString()
  @IsNotEmpty()
  title: string;
  @ApiProperty({
    description: 'The first name of the user',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({
    description: 'The last name of the user',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty({
    description: 'The username of the user',
    example: 'johndoe123',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'The email address of the user',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'The mobile number of the user',
    example: '1234567890',
  })
  @IsPhoneNumber()
  @IsNotEmpty()
  mobile_number: string;

  @ApiProperty({
    description: 'The password for the user account',
    example: 'StrongPassword123!',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    description: 'Enter The Country ID',
    example: '99',
  })
  
  @IsNotEmpty()
  countries__id: number;
}

// --------- Login -----------

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email', required: false })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'john_doe', description: 'Username', required: false })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ example: '+1234567890', description: 'Mobile number', required: false })
  @IsPhoneNumber()
  @IsOptional()
  mobile_number?: string;

  @ApiProperty({ example: 'securepassword', description: 'User password' })
  @IsString()
  @IsNotEmpty()
  password: string;
}


//Forget password Link

export class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}


export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  newPassword: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @IsString()
  @IsNotEmpty()
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  vendor_uid:string;

}


