import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,InternalServerErrorException,BadRequestException,HttpException,NotFoundException
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { MailerService } from '@nestjs-modules/mailer';


@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
     private readonly mailerService: MailerService,
  ) {}
   private readonly logger = new Logger(AuthService.name);

  // async login(dto: LoginDto) {
  //   const { email, mobile_number, password, username } = dto;

  //   // Find user by email or mobile number
  //   const user = await this.prisma.users.findFirst({
  //     where: {
  //       OR: [{ email }, { mobile_number }, { username }],
  //     },
  //   });

  //      let vendor: any = null;
  //     if (user.vendors__id) {
  //       vendor = await this.prisma.vendors.findFirst({
  //         where: { id: user.vendors__id },
  //       });
  //     }

  //   if (!user || !(await bcrypt.compare(password, user.password))) {
  //     throw new UnauthorizedException('Invalid credentials');
  //   }

  
  //   const token = this.jwtService.sign({
  //     userId: user.id,
  //     email: user.email,
  //   });

  //   let hasActiveSubscription = false;

  //   if (vendor?.id) {
  //       const now = new Date();
    
  //       const activeSubscription = await this.prisma.manual_subscriptions.findFirst({
  //         where: {
  //           vendors__id: vendor.id,
  //           status: 'active',
  //           ends_at: {
  //             not: null,
  //             gt: now, // Strictly greater than current date/time
  //           },
  //         },
  //         select: { id: true },
  //       });
    
  //       hasActiveSubscription = !!activeSubscription;
  //     }

  //   return {
  //     status_code: 200,
  //     message: 'User logged in successfully',
  //     Islogin: 1,
  //     data: {
  //       product_synced: 0,
  //       email: user.email,
  //       username: user.username,
  //       mobile_number: user.mobile_number,
  //       access_token: token,
  //       ...(token ? { token } : {}),
  //       ...(user ? {
  //         vendor_id: user.vendors__id ?? null,
  //         vendor_uid: user.vendor?.uid ?? null,
  //         vendorName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
  //         has_active_subscription: hasActiveSubscription ?? false,
  //       } : {}),
  //     },
  //   };

  // }
      async login(dto: LoginDto) {
  const { email, mobile_number, password, username } = dto;
  console.log('Received DTO:', dto);

  if (!dto) {
    throw new BadRequestException('Request body is missing');
  }

  if (!email && !mobile_number && !username) {
    throw new BadRequestException('Please provide either email, mobile_number, or username');
  }

  try {
    const user = await this.prisma.users.findFirst({
      where: {
        OR: [{ email }, { mobile_number }, { username }],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    let vendor: {
  id: number;
  uid: string;
  created_at: Date;
  title: string;
  slug: string;
  percampaignamount: number | null;
  percampaignamountutility: number | null;
  wallet_total_amount: number | null;
  wallet_used_amount: number | null;
  wallet_balance_amount: number | null;
} | null = null;

    if (user.vendors__id) {
      vendor = await this.prisma.vendors.findUnique({ where: { id: user.vendors__id } });
    }

    let hasActiveSubscription = false;
    if (vendor?.id) {
      const now = new Date();
      const activeSubscription = await this.prisma.manual_subscriptions.findFirst({
        where: { vendors__id: vendor.id, status: 'active', ends_at: { not: null, gt: now } },
        select: { id: true },
      });
      hasActiveSubscription = !!activeSubscription;
    }

    const tokenRecord = await this.prisma.shopify_apptokens.findFirst({
      where: { shop_email: user.email},
      select: { access_token: true, shop_name: true },
    });

    const token = this.jwtService.sign({ userId: user.id, email: user.email });

    return {
      status_code: 200,
      message: 'User logged in successfully',
      Islogin: 1,
      data: {
        product_synced: 0,
        shop: tokenRecord?.shop_name ?? null,
        email: user.email,
        access_token: tokenRecord?.access_token ?? null,
        token,
        IsInstalled: tokenRecord ? 1 : 0,
        vendor_id: user.vendors__id ?? null,
        vendor_uid: vendor?.uid ?? null,
        vendorName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
        has_active_subscription: hasActiveSubscription,
      },
    };
  } catch (err) {
    // console.error('Login Error:', err);
    if (err instanceof HttpException) {
      throw err;
    }
    throw new InternalServerErrorException('Internal server error');
  }
}


  async register(dto: RegisterDto) {
    const {
      first_name,
      last_name,
      username,
      email,
      mobile_number,
      password,
      title,
      countries__id,
    } = dto;

    // Check if the email or username is already taken
    const existingUser = await this.prisma.users.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existingUser) {
      throw new ConflictException('Email or username already taken');
    }

    const uid = uuidv4();

    // Hash the password before storing it
    // const hashedPassword = await bcrypt.hash(password, 10);
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Step 1: Create the user first
    const user = await this.prisma.users.create({
      data: {
        uid,
        first_name,
        last_name,
        username,
        email,
        mobile_number,
        password: hashedPassword,
        countries__id,
        user_roles__id: 2,
      },
    });

    // Step 2: Create the vendor
    const vendor = await this.prisma.vendors.create({
      data: {
        uid,
        title,
        slug: username,
      },
    });

   
    // Step 3: Update the user's vendors__id with vendor.id
    await this.prisma.users.update({
      where: { id: user.id },
      data: {
        vendors__id: vendor.id,
      },
    });

    const token = this.jwtService.sign({
      userId: user.id,
      email: user.email,
    });

     // Step 4: Get access token using email
  const shopifyApp = await this.prisma.shopify_apptokens.findFirst({
    where: {
      shop_email: email,
    },
  });



    if (!shopifyApp) {
        this.logger.warn(`No Shopify app token found for email: ${email}`);
        return {
          message: 'User registered, but Shopify token not found for webhook setup',
          data: {
            userData: { ...user, vendors__id: vendor.id },
            vendorData: vendor,
            token: token,
          },
        };
      }

    const shop = shopifyApp.shop_name;
    const accessToken = shopifyApp.access_token;
    const vendorUid = vendor.uid;

    // Step 5: Register Webhooks
    const webhookTopics = [
      'orders/create',
      'orders/updated',
      'orders/cancelled',
      'customers/create',
      'customers/update',
      'products/create',
      'products/update',
      'products/delete',
      'checkouts/update',
      'checkouts/create',
      'recurring_application_charge/update',
      'recurring_application_charge/delete',
      'app/uninstalled',
    ];

    for (const topic of webhookTopics) {
      try {
        await axios.post(
          `https://${shop}/admin/api/2023-07/webhooks.json`,
          {
            webhook: {
              topic,
              address: `https://back.salegrowy.com/shopify/webhooks/${topic.replace('/', '_')}/${vendorUid}`,
              format: 'json',
            },
          },
          {
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (err) {
        this.logger.warn(`Failed to register webhook for ${topic}`, err.response?.data || err.message);
      }
    }

    // Final response
    return {
      message: 'User registered successfully',
      data: {
        userData: { ...user, vendors__id: vendor.id },
        vendorData: vendor,
        token: token,
      },
    };
  }

        async forgotPassword(email: string) {
        const user = await this.prisma.users.findUnique({ where: { email } });
        if (!user) throw new NotFoundException('User not found');

        const token = randomUUID();
        const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

        await this.prisma.users.update({
          where: { email },
          data: {
            reset_token: token,
            reset_token_expires: expires,
          },
        });

        await this.mailerService.sendMail({
          to: email,
          subject: 'Reset your password',
          template: 'reset-password', 
          context: {
            token,
            email,
            resetUrl: `https://front.salegrowy.com/authentication/update-password?token=${token}`,
          },
        });

        return { message: 'Password reset email sent' };
      }

      async resetPassword(token: string, newPassword: string) {
        const user = await this.prisma.users.findFirst({
          where: {
            reset_token: token,
            reset_token_expires: { gte: new Date() },
          },
        });

        if (!user) throw new BadRequestException('Invalid or expired token');

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await this.prisma.users.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
            reset_token: null,
            reset_token_expires: null,
          },
        });

        return { message: 'Password has been reset successfully' };
      }

     async changePassword(vendor_uid: string, oldPassword: string, newPassword: string) {
      // 1. Get user by ID
      const vendor = await this.prisma.users.findUnique({
        where: { uid: vendor_uid },
      });

      if (!vendor) throw new BadRequestException('Vendor not found');

       const user = await this.prisma.users.findUnique({
        where: { vendors__id: vendor.id },
      });

      if (!user) throw new BadRequestException('User not found');

      // 2. Compare old password with stored hashed password
      const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
      if (!isPasswordValid) {
        throw new BadRequestException('Invalid Old Password');
      }

      // 3. Hash the new password
      const newHashedPassword = await bcrypt.hash(newPassword, 10);

      // 4. Update user with new password
      await this.prisma.users.update({
        where: { id: user.id },
        data: {
          password: newHashedPassword,
        },
      });

      return { message: 'Password has been changed successfully' };
    }


}
