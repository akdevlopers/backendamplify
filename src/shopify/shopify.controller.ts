import {
  Controller,
  Get,
  Query,
  Req,All,
  Post,
  Res,
 Body,
 HttpStatus,
 Param,Headers,HttpCode,
  BadRequestException,Logger,UseInterceptors
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ShopifyDto,SyncShopifyDto } from './dto/shopify.dto';
import { ShopifyService } from './shopify.service';

import { PrismaService } from 'src/prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuidv4 } from 'uuid';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiProperty, ApiResponse } from '@nestjs/swagger';
import * as crypto from 'crypto';
import { MyLogger } from '../logger.service';
import { DecryptInterceptor } from 'src/common/interceptors/decrypt.interceptor';
import { EncryptionService } from 'src/common/encryption/encryption.service';

@Controller('shopify')
export class ShopifyController {
  constructor(private readonly shopifyService: ShopifyService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly prisma: PrismaService,
    @InjectQueue('shopify-sync') private readonly shopifyQueue: Queue,private readonly logger: MyLogger,private readonly EncryptionService: EncryptionService) 
  {}

  @Get('Auth')
  redirect(@Query() query: ShopifyDto, @Res() res: Response) {
    const state = this.shopifyService.generateState(); // ✅ Generate state once

    const url = this.shopifyService.generateInstallUrl({
      shop: query.shop,
      state, 
    });

    // console.log('Access Token Response:', url);

   

    return res.redirect(url);
  }

  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.shopifyService.handleCallback(req);
      return res.json(result);
    } catch (error) {
      return res.status(error.status || 500).send(error.message);
    }
  }



  @Get('sample')
  async sample(@Req() req: Request, @Res() res: Response) {
    const result = 'helloo welcomeee';
    return res.json({ message: result }); // always wrap in an object
  }


      @Get('subscribe')
      async subscribeToPlan(
        @Query('shop') shop: string,
        @Query('access_token') accessToken: string,
        @Query('plan') planName: string,
        @Query('price') price: string,
        @Query('interval') interval: 'EVERY_30_DAYS' | 'ANNUAL' = 'ANNUAL', 
        @Res() res: Response,
      ) {
        if (!shop || !accessToken || !planName || !price) {
          throw new BadRequestException('Missing query parameters');
        }

        const returnUrl = `https://front.salegrowy.com/shopify/billing/callback?shop=${shop}&access_token=${accessToken}`;

        const confirmationUrl = await this.shopifyService.createRecurringCharge(
          shop,
          accessToken,
          planName,
          parseFloat(price),
          returnUrl,
          7, // trialDays
          false, // payment live mode
          //  true, // payment test mode
          interval,
        );

        return res.redirect(confirmationUrl);
      }

  // @Get('subscribe')
  // async subscribeToPlan(
  //   @Query('shop') shop: string,
  //   @Query('access_token') accessToken: string,
  //   @Query('plan') planName: string, // example: "Pro Plan"
  //   @Query('price') price: string, // example: "19.99"
  //   @Res() res: Response,
  // ) {
  //   if (!shop || !accessToken || !planName || !price) {
  //     throw new BadRequestException('Missing query parameters');
  //   }

  //   const returnUrl = `https://front.salegrowy.com/shopify/billing/callback?shop=${shop}&access_token=${accessToken}`;

  //   const confirmationUrl = await this.shopifyService.createRecurringCharge(
  //     shop,
  //     accessToken,
  //     planName,
  //     parseFloat(price),
  //     returnUrl,
  //     7,
  //     true,
  //   );

  //   return res.redirect(confirmationUrl);
  // }

  // async handleCallback(
  //   @Query('shop') shop: string,
  //   @Query('access_token') accessToken: string,
  //   @Query('charge_id') chargeId: string,
  //   @Body('vendor_id') vendorId: number,
  //   @Res() res: Response,
  // ) {
  //   if (!shop || !accessToken || !chargeId || !vendorId) {
  //     throw new BadRequestException('Missing required parameters');
  //   }

  //   // Step 1: Get charge details
  //   const chargeDetails = await this.shopifyService.getChargeDetails(
  //     shop,
  //     accessToken,
  //     chargeId,
  //   );

  //   if (chargeDetails.status !== 'accepted') {
  //     throw new BadRequestException('Charge not accepted');
  //   }

  //   // Step 2: Activate charge
  //   await this.shopifyService.activateCharge(shop, accessToken, chargeId);

  //   // Step 3: Store in DB
  //   await this.prisma.manual_subscriptions.create({
  //     data: {
  //       uid: uuidv4(),
  //       status: 'active',
  //       plan_id: chargeDetails.name,
  //       charges: new Decimal(chargeDetails.price),
  //       charges_frequency: chargeDetails.trial_days > 0 ? 'trial' : 'paid',
  //       vendors__id: vendorId,
  //       created_at: new Date(),
  //       updated_at: new Date(),
  //       ends_at: chargeDetails.billing_on ? new Date(chargeDetails.billing_on) : null,
  //       remarks: `Shopify Charge ID: ${chargeDetails.id}`,
  //       data: JSON.stringify(chargeDetails),
  //     },
  //   });

  //   return res.status(200).json({ message: 'Subscription saved successfully' });
  // }
  
  // @Get('billing/callback')
  // async handleCallback(
  //   @Query('shop') shop: string,
  //   @Query('access_token') accessToken: string,
  //   @Query('charge_id') chargeId: string,
  //   @Query('vendor_id', ParseIntPipe) vendorId: number,
  //   @Res() res: Response,
  // ) {
  //   if (!shop) {
  //     throw new BadRequestException('Missing required parameter: shop');
  //   }
    
  //   if (!accessToken) {
  //     throw new BadRequestException('Missing required parameter: access_token');
  //   }
    
  //   if (!chargeId) {
  //     throw new BadRequestException('Missing required parameter: charge_id');
  //   }
    
  //   if (!vendorId) {
  //     throw new BadRequestException('Missing required parameter: vendor_id');
  //   }
    

  //   const chargeDetails = await this.shopifyService.getChargeDetails(shop, accessToken, chargeId);


  //   // if (chargeDetails.status === 'cancelled') {
  //   //   return res.status(400).json({
  //   //     message: 'The charge was cancelled by the merchant.',
  //   //   });
  //   // }
    
  //   // if (chargeDetails.status === 'pending') {
  //   //   return res.status(400).json({
  //   //     message: 'The charge is still pending approval from the merchant.',
  //   //   });
  //   // }
    
  //   // if (chargeDetails.status !== 'accepted') {
  //   //   return res.status(400).json({
  //   //     message: `Charge not accepted. Current status: ${chargeDetails.status}`,
  //   //   });
  //   // }
    
  //   // await this.shopifyService.activateCharge(shop, accessToken, chargeId);

  //   const config = await this.prisma.configurations.findFirst({
  //     where: { name: 'subscription_plans' },
  //   });

  //   if (!config) throw new BadRequestException('Subscription config not found');

  //   const plans = JSON.parse(config.value); // value should contain the JSON string
  //   const planId = chargeDetails.name;
  //   const chargeAmount = parseFloat(chargeDetails.price);

 
  //   let frequency = 'unknown';
  //   const plan = plans.paid?.[planId];

  //   if (plan) {
  //     const monthly = plan.charges?.monthly;
  //     const yearly = plan.charges?.yearly;

  //     if (monthly?.enabled === 'on' && parseFloat(monthly.charge) === chargeAmount) {
  //       frequency = 'monthly';
  //     } else if (yearly?.enabled === 'on' && parseFloat(yearly.charge) === chargeAmount) {
  //       frequency = 'yearly';
  //     }
  //   }

  //   await this.prisma.manual_subscriptions.create({
  //     data: {
  //       uid: uuidv4(),
  //       status: 'active',
  //       plan_id: planId,
  //       charges: new Decimal(chargeDetails.price),
  //       charges_frequency: frequency,
  //       vendors__id: vendorId,
  //       created_at: new Date(),
  //       updated_at: new Date(),
  //       ends_at: chargeDetails.billing_on ? new Date(chargeDetails.billing_on) : null,
  //       remarks: `Shopify Charge ID: ${chargeDetails.id}`,
  //       data: JSON.stringify(chargeDetails),
  //     },
  //   });

  //   return res.status(200).json({ message: 'Subscription saved successfully' });
  // }


  // @Post('sync-products')
  // async syncProducts(@Body() body: SyncShopifyDto) {
  //   console.log('Received body:', body);
  //   await this.shopifyQueue.add('sync-products', body, {
  //     removeOnComplete: true,
  //   });
  //   return { message: 'Product sync job queued' };
  // }
    @Post('sync-products')
      @UseInterceptors(DecryptInterceptor)
    async syncProducts(@Body() body: SyncShopifyDto) {
      console.log('Received body:', body);
    
      const job = await this.shopifyQueue.add('sync-products', body, {
        removeOnComplete: true,
        removeOnFail: true, // Optional, helpful for retries
      });
    
      try {
        await job.finished(); 
        return { message: 'Product sync completed successfully' };
      } catch (error) {
        console.error(' Job failed with error:', error);
        throw new BadRequestException({
          message: 'Product sync failed',
          error: error.message || error,
        });
      }
    }
  

  

      @Post('sync-customers')
        @UseInterceptors(DecryptInterceptor)
      async syncCustomers(@Body() body: SyncShopifyDto) {
       const job =  await this.shopifyQueue.add('sync-customers', body, {
          removeOnComplete: true,
        });

          try {
        await job.finished(); 
        return { message: 'customer sync completed successfully' };
          } catch (error) {
            console.error(' Job failed with error:', error);
            throw new BadRequestException({
              message: 'customer sync failed',
              error: error.message || error,
            });
          } 
      
      }

      //   // shopify.controller.ts
      // @Get('products-list')
      // async getProductsList(@Query('vendorId') vendorId?: number) {
      //   const products = await this.shopifyService.getSyncedProducts(
      //     vendorId ? Number(vendorId) : undefined,
      //   );
      //   console.log(products);
      //   return { products };
      // }
      // @Get('products-list')
      //   async getProductsList(@Query('vendorId') vendorId?: string) {
      //     // Check if vendorId is provided
      //     if (!vendorId) {
      //       return {
      //         status: HttpStatus.BAD_REQUEST,
      //         message: 'vendorId is required',
      //         products: [],
      //       };
      //     }

      //     // Validate it's a positive number
      //     const vendorIdNum = Number(vendorId);
      //     if (isNaN(vendorIdNum) || vendorIdNum <= 0) {
      //       return {
      //         status: HttpStatus.BAD_REQUEST,
      //         message: 'vendorId must be a positive number',
      //         products: [],
      //       };
      //     }

      //     try {
      //       const products = await this.shopifyService.getSyncedProducts(vendorIdNum);
      //       return {
      //         status: HttpStatus.OK,
      //         message: 'Products retrieved successfully',
      //         products,
      //       };
      //     } catch (error) {
      //       return {
      //         status: HttpStatus.INTERNAL_SERVER_ERROR,
      //         message: 'Failed to fetch products',
      //         products: [],
      //         error: error.message,
      //       };
      //     }
      //   }

    //  @Get('products-list')
    //     async getProductsList(
    //       @Query('vendorId') vendorId?: string,
    //       @Query('search') search?: string,
    //       @Query('offset') offset?: string,
    //       @Query('limit') limit?: string,
    //     ) {
    //       const vendorIdNum = vendorId ? Number(vendorId) : undefined;
    //       const offsetNum = offset ? parseInt(offset, 10) : 0;
    //       const limitNum = limit ? parseInt(limit, 10) : 10;

    //       if (vendorId && (isNaN(vendorIdNum!) || vendorIdNum! <= 0)) {
    //         return {
    //           status: HttpStatus.BAD_REQUEST,
    //           message: 'vendorId must be a positive number',
    //           products: [],
    //         };
    //       }

    //       try {
    //         const { items, totalCount } = await this.shopifyService.getPaginatedProducts({
    //           vendorId: vendorIdNum,
    //           search,
    //           offset: offsetNum,
    //           limit: limitNum,
    //         });

    //         return {
    //           status: HttpStatus.OK,
    //           message: 'Products retrieved successfully',
    //           totalCount,
    //           products: items,
    //         };
    //       } catch (error) {
    //         return {
    //           status: HttpStatus.INTERNAL_SERVER_ERROR,
    //           message: 'Failed to fetch products',
    //           products: [],
    //           error: error.message,
    //         };
    //       }
    //     }


    @Get('products-list')
        async getProductsList(
          @Query('vendorId') vendorId?: string,
          @Query('page') page = '1',
          @Query('limit') limit = '10',
          @Query('search') search = ''
        ) {
          // Validate vendorId
          if (!vendorId) {
            return {
              status: HttpStatus.BAD_REQUEST,
              message: 'vendorId is required',
              products: [],
              meta: null,
            };
          }

          const vendorIdNum = Number(vendorId);
          if (isNaN(vendorIdNum) || vendorIdNum <= 0) {
            return {
              status: HttpStatus.BAD_REQUEST,
              message: 'vendorId must be a positive number',
              products: [],
              meta: null,
            };
          }

          const pageNum = Math.max(1, parseInt(page, 10) || 1);
          const limitNum = Math.max(1, parseInt(limit, 10) || 10);
          const skip = (pageNum - 1) * limitNum;

          try {
            const [products, total] = await Promise.all([
              this.shopifyService.getSyncedProducts(vendorIdNum, skip, limitNum, search),
              this.shopifyService.countSyncedProducts(vendorIdNum, search),
            ]);

            return {
              status: HttpStatus.OK,
              message: 'Products retrieved successfully',
              products,
              meta: {
                total,
                page: pageNum,
                limit: limitNum,
                lastPage: Math.ceil(total / limitNum),
              },
            };
          } catch (error) {
            return {
              status: HttpStatus.INTERNAL_SERVER_ERROR,
              message: 'Failed to fetch products',
              products: [],
              error: error.message,
            };
          }
        }



      @Get('billing/callback')
      async handleCallback(
        @Query('shop') shop: string,
        @Query('access_token') accessToken: string,
        @Query('charge_id') chargeId: string,
        @Query('vendor_id', ParseIntPipe) vendorId: number,
        @Res() res: Response,
      ) {

        console.log(vendorId)
        try {
          if (!shop) {
            return res.status(400).json({ message: 'Missing required parameter: shop' });
          }

          if (!accessToken) {
            return res.status(400).json({ message: 'Missing required parameter: access_token' });
          }

          if (!chargeId) {
            return res.status(400).json({ message: 'Missing required parameter: charge_id' });
          }

          if (!vendorId) {
            return res.status(400).json({ message: 'Missing required parameter: vendor_id' });
          }

          const chargeDetails = await this.shopifyService.getChargeDetails(shop, accessToken, chargeId);

          // Optional checks for charge status
          // if (chargeDetails.status === 'cancelled') {
          //   return res.status(400).json({ message: 'The charge was cancelled by the merchant.' });
          // }

          // if (chargeDetails.status === 'pending') {
          //   return res.status(400).json({ message: 'The charge is still pending approval from the merchant.' });
          // }

          // if (chargeDetails.status !== 'accepted') {
          //   return res.status(400).json({ message: `Charge not accepted. Current status: ${chargeDetails.status}` });
          // }

          // await this.shopifyService.activateCharge(shop, accessToken, chargeId);

            // const config = await this.prisma.configurations.findFirst({
            //   where: { name: 'subscription_plans' },
            // });

            // if (!config) {
            //   return res.status(400).json({ message: 'Subscription config not found' });
            // }
            // console.log('Inserting subscription:', chargeDetails);

            // const plans = JSON.parse(config.value);
            // const planId = chargeDetails.name;
            // const chargeAmount = parseFloat(chargeDetails.price);

            // let frequency = 'unknown';
            // const plan = plans.paid?.[planId];

            // if (plan) {
            //   const monthly = plan.charges?.monthly;
            //   const yearly = plan.charges?.yearly;

            //   if (monthly?.enabled === 'on' && parseFloat(monthly.charge) === chargeAmount) {
            //     frequency = 'monthly';
            //   } else if (yearly?.enabled === 'on' && parseFloat(yearly.charge) === chargeAmount) {
            //     frequency = 'yearly';
            //   }
            // }

            // await this.prisma.manual_subscriptions.create({
            //   data: {
            //     uid: uuidv4(),
            //     status: 'active',
            //     plan_id: planId,
            //     charges: new Decimal(chargeDetails.price),
            //     charges_frequency: frequency,
            //     vendors__id: vendorId,
            //     created_at: new Date(),
            //     updated_at: new Date(),
            //     ends_at: chargeDetails.billing_on ? new Date(chargeDetails.billing_on) : null,
            //     data: JSON.stringify(chargeDetails),
                
            //   },
            // });
            const config = await this.prisma.configurations.findFirst({
            where: { name: 'subscription_plans' },
          });

          if (!config) {
            return res.status(400).json({ message: 'Subscription config not found' });
          }

          console.log('Inserting subscription:', chargeDetails);

          const plans = JSON.parse(config.value);
          const planId = chargeDetails.name;
          const chargeAmount = parseFloat(chargeDetails.price);

          let frequency: 'monthly' | 'yearly'  = 'yearly';
          const plan = plans.paid?.[planId];

          if (plan) {
            const monthly = plan.charges?.monthly;
            const yearly = plan.charges?.yearly;

            const monthlyCharge = monthly?.enabled === 'on' ? parseFloat(monthly.charge) : null;
            const yearlyCharge = yearly?.enabled === 'on' ? parseFloat(yearly.charge) : null;

            if (monthlyCharge !== null && monthlyCharge === chargeAmount) {
              frequency = 'monthly';
            } else if (yearlyCharge !== null && yearlyCharge === chargeAmount) {
              frequency = 'yearly';
            } else if (
              yearlyCharge !== null &&
              parseFloat((chargeAmount / 12).toFixed(2)) === monthlyCharge
            ) {
              frequency = 'yearly'; // Charge is for 12 months (yearly), matches monthly when divided
            }
          }

        const createdAt = new Date();
        let endsAt: Date | null = null;

        if (frequency === 'monthly') {
          endsAt = new Date(createdAt);
          endsAt.setMonth(endsAt.getMonth() + 1);
          endsAt.setDate(endsAt.getDate() + 7); // Add 7 extra days
        } else if (frequency === 'yearly') {
          endsAt = new Date(createdAt);
          endsAt.setFullYear(endsAt.getFullYear() + 1);
          endsAt.setDate(endsAt.getDate() + 7); // Add 7 extra days
        }


          await this.prisma.manual_subscriptions.create({
            data: {
              uid: uuidv4(),
              status: 'active',
              plan_id: planId,
              charges: new Decimal(chargeDetails.price),
              charges_frequency: frequency,
              vendors__id: vendorId,
              created_at: createdAt,
              updated_at: createdAt,
              ends_at: endsAt,
              data: JSON.stringify(chargeDetails),
            },
          });


            return res.status(200).json({ message: 'Subscription saved successfully' });

          } catch (error) {
            console.error('Error in handleCallback:', error);

            return res.status(500).json({
              message: 'An error occurred while handling the billing callback.',
              error: error?.message || 'Unknown error',
            });
          }
        }


        @Post('webhooks/checkouts_create/:id')
         @HttpCode(200)
        async handleCheckoutCreate(@Param('id') vendorUid: string,@Body() data: any) {
         try {
            await this.shopifyService.upsertCheckout(vendorUid, data);
          } catch (error) {
            console.error('Checkout create error:', error);
          }
          return { message: 'Webhook received' };
        }

        @Post('webhooks/checkouts_update/:id')
         @HttpCode(200)
        async handleCheckoutUpdate(@Param('id') vendorUid: string,@Body() data: any) {
          try {
            await this.shopifyService.upsertCheckout(vendorUid, data);
          } catch (error) {
            console.error('Checkout create error:', error);
          }
          return { message: 'Webhook received' };
        }
        @Post('webhooks/orders_create/:id')
         @HttpCode(200)
        async handleOrderCreate(@Param('id') vendorUid: string,@Body() data: any) {
           try {
            await this.shopifyService.handleOrderCreate(vendorUid, data);
          } catch (error) {
            console.error('Order create error:', error);
          }
          return { message: 'Webhook received' };
        }

        @Post('webhooks/orders_updated/:id')
         @HttpCode(200)
        async handleOrderUpdate(@Param('id') vendorUid: string,@Body() data: any) {
           
          return { message: 'Webhook received' };
        }

         @Post('webhooks/orders_cancelled/:id')
         @HttpCode(200)
        async handleOrderCancelled(@Param('id') vendorUid: string,@Body() data: any) {
           
          return { message: 'Webhook received' };
        }

         @Post('webhooks/app_uninstalled/:id')
          @HttpCode(200)
        async appUninstalled(@Param('id') vendorUid: string,@Body() data: any) {
            try {
          await this.shopifyService.appUninstalled(vendorUid,data);
          } catch (error) {
            console.error('Order create error:', error);
          }
          return { message: 'Webhook received' };
        }


        @Post('webhooks/recurring_application_charge_update/:id')
         @HttpCode(200)
        async handleChargeUpdate(@Param('id') vendorUid: string,@Body() data: any) {
          try{
          await this.shopifyService.handleChargeUpdate(vendorUid,data);
          } catch (error) {
            console.error('Order create error:', error);
          }
          return { message: 'Webhook received' };
        }
        @Post('webhooks/recurring_application_charge_delete/:id')
         @HttpCode(200)
        async handleChargeDelete(@Param('id') vendorUid: string,@Body() data: any) {
          try{
          await this.shopifyService.handleChargeDelete(vendorUid,data);
          } catch (error) {
            console.error('Order create error:', error);
          }
          return { message: 'Webhook received' };
        }


        @Post('webhooks/products_delete/:vendorUid')
         @HttpCode(200)
        async handleProductDelete(
          @Param('vendorUid') vendorUid: string,
          @Body() payload: { id: string }
        ) {
          try{
          await this.shopifyService.deleteProduct(vendorUid, payload.id);
          } catch (error) {
            console.error('Order create error:', error);
          }
          return { message: 'Product delete webhook received' };
        }

         @Post('webhooks/products_create/:vendorUid')
          @HttpCode(200)
          async handleProductCreate(
            @Param('vendorUid') vendorUid: string,
            @Body() data: any
          ) {

            try{
           const vendor = await this.prisma.vendors.findUnique({
              where: { uid: vendorUid },
            });

            if (!vendor) {
              throw new Error(`Vendor with UID ${vendorUid} not found`);
            }

            const users = await this.prisma.users.findUnique({
              where: { id: vendor.id },
            });

            if (!users) {
              throw new Error('User not found');
            }

            // Use findFirst here (shop_email likely not unique)
            const shopifyAppToken = await this.prisma.shopify_apptokens.findFirst({
              where: { shop_email: users.email },
            });

            if (!shopifyAppToken) {
              throw new Error(`Shopify App Token for vendor ID ${vendor.id} not found`);
            }

            // Construct shop URL
            const shopUrl = `${shopifyAppToken.shop_name}.myshopify.com`;

            // Call the service method with shopUrl
            await this.shopifyService.upsertProduct(vendorUid, data, shopUrl);
            } catch (error) {
            console.error('Order create error:', error);
          }
            return { message: 'Product create webhook received' };
          }

       @Post('webhooks/products_update/:vendorUid')
        @HttpCode(200)
          async handleProductUpdate(
            @Param('vendorUid') vendorUid: string,
            @Body() data: any
          ) {

            try{
            // Retrieve vendor by UID
            const vendor = await this.prisma.vendors.findUnique({
              where: { uid: vendorUid },
            });

            if (!vendor) {
              throw new Error(`Vendor with UID ${vendorUid} not found`);
            }

            const users = await this.prisma.users.findUnique({
              where: { id: vendor.id },
            });

            if (!users) {
              throw new Error('User not found');
            }

            // Use findFirst here (shop_email likely not unique)
            const shopifyAppToken = await this.prisma.shopify_apptokens.findFirst({
              where: { shop_email: users.email },
            });

            if (!shopifyAppToken) {
              throw new Error(`Shopify App Token for vendor ID ${vendor.id} not found`);
            }

            // Construct shop URL
            const shopUrl = `${shopifyAppToken.shop_name}.myshopify.com`;

            // Call the service method with shopUrl
            await this.shopifyService.upsertProduct(vendorUid, data, shopUrl);
            } catch (error) {
            console.error('Order create error:', error);
          }

            return { message: 'Product update webhook received' };
          }


           @Post('webhooks/customers_create/:vendorUid')
           @HttpCode(200)
          async customerCreate(
            @Param('vendorUid') vendorUid: string,
            @Body() data: any,
          ) {
            try{
            await this.shopifyService.upsertCustomer(vendorUid, data);
            } catch (error) {
            console.error('Order create error:', error);
          }
            return { message: 'Customer create received' };
          }

              @Post('webhooks/customers_update/:vendorUid')
              @HttpCode(200)
              async customerUpdate(
                @Param('vendorUid') vendorUid: string,
                @Body() data: any,
              ) {
                try{
                await this.shopifyService.upsertCustomer(vendorUid, data);
                 } catch (error) {
                    console.error('Order create error:', error);
                  }
                
                return { message: 'Customer update received' };
              }


        @Get('countries')
        @ApiOperation({summary: 'Get countries'})
        @ApiResponse({ status: 201, description: 'The countries has been successfully Received.' })
        @ApiResponse({ status: 400, description: 'Bad Request.' })
        getCountry() {
          return this.shopifyService.getCountry();
        }

     @All('customers/data_request')
      @HttpCode(200)
          async handleCustomerDataRequest(@Req() req: Request, @Res() res: Response)  {
         
           try {
           
              let payload: any;
              try {
                payload = JSON.parse(req.body.toString('utf8'));
              } catch (e) {
                this.logger.warn('Failed to parse JSON payload', e.message);
                return res.status(HttpStatus.OK).send('OK'); // Still return 200
              }

              // 5. Process request (async fire-and-forget)
              this.shopifyService.handleCustomerDataRequest(payload)
                .catch(e => this.logger.error('Data request processing failed', e));

              return res.status(HttpStatus.OK).send('OK');

            } catch (error) {
              this.logger.error('Unexpected error during HMAC verification', error);
              return res.status(HttpStatus.OK).send('OK'); // Never return 500
            }
          }


        @All('customers/redact')
            async customersRedact(@Req() req: Request, @Res() res: Response) {

            try {
            
              this.shopifyService.handleCustomerRedact(req.body)
                .catch(e => this.logger.error('Redact processing failed', e));

              return res.status(HttpStatus.OK).send('OK');

              } catch (error) {
              this.logger.error('Unexpected error during function', error);
              return res.status(HttpStatus.OK).send('OK'); // Never return 500
            }
            }
      // @All('customers/redact')
      //   async handleCustomerRedact(
      //     @Headers('x-shopify-hmac-sha256') shopifyHmac: string,
      //     @Req() req: Request & { rawBody?: Buffer },
      //     @Res() res: Response
      //   ) {
      //     // 1. Validate raw body exists
      //     if (!req.rawBody || req.rawBody.length === 0) {
      //       this.logger.error('Empty request body received');
      //       return res.status(HttpStatus.BAD_REQUEST).json({
      //         error: 'Bad Request',
      //         message: 'Empty request body'
      //       });
      //     }

      //     // 2. Verify HMAC header exists
      //     if (!shopifyHmac) {
      //       this.logger.error('Missing HMAC header');
      //       return res.status(HttpStatus.UNAUTHORIZED).send('Unauthorized');
      //     }

      //     try {
      //       // 3. Verify HMAC
      //       const verified = this.verifyShopifyWebhook(
      //         req.rawBody,
      //         shopifyHmac,
      //         process.env.SHOPIFY_API_SECRET!
      //       );

      //       if (!verified) {
      //         this.logger.error('HMAC verification failed');
      //         return res.status(HttpStatus.UNAUTHORIZED).send('Unauthorized');
      //       }

      //       // 4. Parse payload
      //       let payload: any;
      //       try {
      //         payload = JSON.parse(req.rawBody.toString('utf8'));
      //       } catch (e) {
      //         this.logger.error('Failed to parse JSON payload', e.stack);
      //         return res.status(HttpStatus.OK).send('OK');
      //       }

      //       // 5. Process asynchronously (fire-and-forget)
      //       this.shopifyService.handleCustomerRedact(payload)
      //         .catch(e => this.logger.error('Redact processing failed', e.stack));

      //       return res.status(HttpStatus.OK).send('OK');

      //     } catch (error) {
      //       this.logger.error('Webhook processing error', error.stack);
      //       return res.status(HttpStatus.OK).send('OK');
      //     }
      //   }

//   @All('customers/redact')
// async handleCustomerRedact(
//   @Headers('x-shopify-hmac-sha256') shopifyHmac: string,
//   @Req() req: Request & { rawBody?: Buffer },
//   @Res() res: Response
// ) {
//   if (!shopifyHmac) {
//     return res.status(HttpStatus.UNAUTHORIZED).send('Unauthorized');
//   }

//   const rawBody = req.rawBody;

//   if (!rawBody || !rawBody.length) {
//     return res.status(HttpStatus.BAD_REQUEST).json({
//       error: 'Bad Request',
//       message: 'Empty request body',
//     });
//   }

//   try {
//     const verified = this.verifyShopifyWebhook(
//       rawBody,
//       shopifyHmac,
//       process.env.SHOPIFY_API_SECRET!
//     );

//     if (!verified) {
//       return res.status(HttpStatus.UNAUTHORIZED).send('Unauthorized');
//     }

//     let payload: any;
//     try {
//       payload = JSON.parse(rawBody.toString('utf8'));
//     } catch (e) {
//       return res.status(HttpStatus.OK).send('OK');
//     }

//     this.shopifyService.handleCustomerRedact(payload)
//       .catch(e => this.logger.error('Redact processing failed', e.stack));

//     return res.status(HttpStatus.OK).send('OK');
//   } catch (error) {
//     this.logger.error('Webhook processing error', error.stack);
//     return res.status(HttpStatus.OK).send('OK');
//   }
// }

// @Post('customers/redact')
// async handleCustomerRedact(@Body() body, @Res() res: Response) {
//   try {
//     console.log('Received body:', body);

//     // You can call your service here if needed
//     // await this.shopifyService.handleCustomerRedact(body);

//     return res.status(HttpStatus.OK).send('OK');
//   } catch (error) {
//     console.error('Error:', error);
//     return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Error');
//   }
// }

  // @Post('customers/redact')
  // async handleCustomerRedact(
  //   @Headers('x-shopify-hmac-sha256') hmac: string,
  //   @Req() req: Request & { rawBody?: Buffer },
  //   @Res() res: Response,
  // ) {
  //   if (!hmac) {
  //     return res.status(HttpStatus.UNAUTHORIZED).send('Unauthorized');
  //   }

  //   const rawBody = req.rawBody;

  //   if (!rawBody || !rawBody.length) {
  //     return res.status(HttpStatus.BAD_REQUEST).json({
  //       error: 'Bad Request',
  //       message: 'Empty request body',
  //     });
  //   }

  //   const secret = process.env.SHOPIFY_API_SECRET!;
  //   const generatedHmac = crypto
  //     .createHmac('sha256', secret)
  //     .update(rawBody)
  //     .digest('base64');

  //   if (generatedHmac !== hmac) {
  //     return res.status(HttpStatus.UNAUTHORIZED).send('HMAC verification failed');
  //   }

  //   let payload: any;
  //   try {
  //     payload = JSON.parse(rawBody.toString('utf-8'));
  //   } catch (err) {
  //     return res.status(HttpStatus.BAD_REQUEST).send('Invalid JSON');
  //   }

  //   await this.shopifyService.handleCustomerRedact(payload);

  //   return res.status(HttpStatus.OK).send('OK');
  // }

  //  @Post('customers/redact')
  // customerRedact(@Req() req: Request, @Res() res: Response) {
  //   console.log('Customer Redact Payload:', req.body);
  //   res.status(200).send('Customer redact processed');
  // }

  

            @All('shop/redact')
          async shopRedact(@Req() req: Request, @Res() res: Response)  {
             try {
              // ✅ Parse payload after HMAC verified
              let payload: any;
              try {
                payload = JSON.parse(req.body.toString('utf8'));
              } catch (e) {
                return res.status(HttpStatus.OK).send('OK');
              }

              // Call service
              const result = await this.shopifyService.handleShopRedact(payload);

              // Send 200 with service response message
              return res.status(HttpStatus.OK).json({ message: result });

            } catch (error) {
              console.error('Unexpected error during processing', error);
              return res.status(HttpStatus.OK).send('OK');
            }
          }


        // @All('shop/redact')
        // async shopRedact( @Headers('x-shopify-hmac-sha256') shopifyHmac: string,
        //       @Req() req: Request & { rawBody?: Buffer }, // Get raw body
        //       @Res() res: Response
        //     ) {
             
        //     if (!req.rawBody || req.rawBody.length === 0) {
        //     return res.status(400).json({
        //       error: 'No payload received',
        //       message: 'Expected a JSON payload but received empty content',
        //     });
        //     }


        //     if (!shopifyHmac) {
        //       this.logger.error('Missing Shopify HMAC header');
        //       return res.status(HttpStatus.UNAUTHORIZED).send('Unauthorized');
        //     }

        //     // 3. HMAC Verification
        //    // HMAC Verification
        //     try {
        //       const computedHmac = crypto
        //         .createHmac('sha256', process.env.SHOPIFY_API_SECRET!)
        //         .update(req.rawBody)
        //         .digest('base64');
        //     // Convert computed HMAC to Buffer
        //     const computedHmacBuffer = Buffer.from(computedHmac, 'base64'); // Base64 to Buffer
        //     // Convert received HMAC from hex to Buffer
        //     const shopifyHmacBuffer = Buffer.from(shopifyHmac, 'hex'); // Hex to Buffer
        //     // Length check before timingSafeEqual
        //     if (computedHmacBuffer.length !== shopifyHmacBuffer.length) {
        //       this.logger.error('HMAC length mismatch');
        //       return res.status(HttpStatus.UNAUTHORIZED).send('Unauthorized');
        //     }
           
        //       // 4. Parse payload
        //       let payload: any;
        //       try {
        //         payload = JSON.parse(req.rawBody.toString('utf8'));
        //       } catch (e) {
        //         this.logger.warn('Failed to parse JSON payload', e.message);
        //         return res.status(HttpStatus.OK).send('OK'); // Still return 200
        //       }

        //   await this.shopifyService.handleShopRedact(payload);
        //   return res.status(HttpStatus.OK).send('OK');
        //    } catch (error) {
        //       this.logger.error('Unexpected error during HMAC verification', error);
        //       return res.status(HttpStatus.OK).send('OK'); // Never return 500
        //     }
        // }
  
}
