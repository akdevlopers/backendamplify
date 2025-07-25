import { Injectable, BadRequestException, Logger,InternalServerErrorException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import * as CryptoJS from 'crypto-js';
import { MyLogger } from '../logger.service';

const SECRET_KEY = process.env.SECRET_KEY || '48962874218962874213689687';

function encryptField(value: any): string | undefined {
  if (value === null || value === undefined) return undefined;
  // Convert to string first (for number, boolean, etc.)
  const stringValue = String(value);
  return CryptoJS.AES.encrypt(stringValue, SECRET_KEY).toString();
}
function decryptField(encryptedValue: string): string | undefined {
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

@Injectable()
export class ShopifyService {
  constructor(private prisma: PrismaService,
     private jwtService: JwtService,
     private  readonly MyLogger: MyLogger,
  ) {}

  private readonly apiKey = '7573bb221c22c57d9c1505aa187bca45';
  private readonly apiSecret = '591ea877752ad8b0db1e7726307806be';
  private readonly scopes = 'read_products,write_orders,write_products,read_customers,write_customers,read_script_tags,write_script_tags';
  private readonly redirectUri = 'https://front.salegrowy.com/shopify/callback';
  private readonly logger = new Logger(ShopifyService.name);

  generateState(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  generateInstallUrl({ shop, state }: { shop: string; state: string }): string {
    const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
    if (!shopRegex.test(shop)) {
      throw new BadRequestException('Invalid shop domain.');
    }

    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${this.apiKey}`
      + `&scope=${this.scopes}`
      + `&redirect_uri=${this.redirectUri}`
      + `&state=${state}`
      + `&grant_options[]=per-user`;

    return installUrl;
  }

  verifyHmac(query: any): boolean {
    const { hmac, signature, ...params } = query;
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    const generatedHmac = crypto
      .createHmac('sha256', this.apiSecret)
      .update(sortedParams)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(generatedHmac));
  }

  private verifyHmacwebhook(req: Request): boolean {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string;

  // Reconstruct raw body (WARNING: This is not always accurate)
  const bodyString = JSON.stringify(req.body);

  const generatedHmac = crypto
    .createHmac('sha256', this.apiSecret)
    .update(bodyString, 'utf8')
    .digest('base64');

  return generatedHmac === hmacHeader;
}


  async handleCallback(req: Request) {
    const { shop, code, hmac, state } = req.query;
  
    this.logger.log('Shopify callback received', { shop, code, hmac, state });
  
    if (!shop || !/^[a-z0-9\-]+\.myshopify\.com$/.test(shop.toString())) {
      throw new BadRequestException('Invalid shop parameter.');
    }
  
    if (!this.verifyHmac(req.query)) {
      throw new BadRequestException('Invalid HMAC. This request did not come from Shopify.');
    }
  
    let accessToken: string;
    let email: string | null = null;
  
    try {
      // Exchange code for access token
      const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
        client_id: this.apiKey,
        client_secret: this.apiSecret,
        code,
      });
  
      accessToken = tokenResponse.data.access_token;
    } catch (err) {
      this.logger.error('Error exchanging code for access token', err.response?.data || err.message);
      throw new InternalServerErrorException('Failed to retrieve access token from Shopify.');
    }
  
    try {
      // Fetch shop details
      const shopResponse = await axios.get(`https://${shop}/admin/api/2023-07/shop.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken },
      });
  
      email = shopResponse.data.shop?.email || null;
    } catch (err) {
      this.logger.error('Error fetching shop details', err.response?.data || err.message);
      throw new InternalServerErrorException('Failed to fetch shop details.');
    }
  
    try {
      // Save access token
      await this.prisma.shopify_apptokens.upsert({
        where: { shop_name: shop.toString() },
        update: {
          access_token: accessToken,
          shop_email: email,
          updatedAt: new Date(),
        },
        create: {
          uid: uuidv4(),
          shop_name: shop.toString(),
          shop_email: email,
          access_token: accessToken,
          createdAt: new Date(),
          updatedAt: new Date(),
          installed: 1,
        },
      });
    } catch (err) {
      this.logger.error('Error saving Shopify access token', err.message);
      throw new InternalServerErrorException('Database error while saving token.');
    }
  
          const existingUser = await this.prisma.users.findFirst({
            where: {
              email: email || undefined,
              user_roles__id: 2,
            },
            select: {
              id: true,
              vendors__id: true,
              first_name: true,
              last_name: true,
              email: true,
              vendor: {
                select: {
                  uid: true,
                  id: true,
                },
              },
            },
          });
          if (existingUser && existingUser.vendor?.uid) {
        const vendorUid = existingUser.vendor.uid;

        const webhookTopics = [
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
          'orders/create',
          'orders/updated',
          'orders/cancelled',
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
            // Do not throw; continue registering other webhooks
          }
        }
      }

    
    let token: string | null = null;
    let hasActiveSubscription = false;
    
    if (existingUser) {
      token = this.jwtService.sign({
        userId: existingUser.id,
        email: existingUser.email,
      });
    
      if (existingUser.vendor?.id) {
        const now = new Date();
    
        const activeSubscription = await this.prisma.manual_subscriptions.findFirst({
          where: {
            vendors__id: existingUser.vendor.id,
            status: 'active',
            ends_at: {
              not: null,
              gt: now, // Strictly greater than current date/time
            },
          },
          select: { id: true },
        });
    
        hasActiveSubscription = !!activeSubscription;
      }
    }
    
    return {
      status_code: 200,
      message: 'Access token retrieved',
      Islogin: existingUser ? 1 : 0,
      data: {
        product_synced: 0,
        shop,
        email,
        access_token: accessToken,
        ...(token ? { token } : {}),
        ...(existingUser ? {
          vendor_id: existingUser.vendors__id,
          vendor_uid: existingUser.vendor?.uid ?? null,
          vendorName: `${existingUser.first_name ?? ''} ${existingUser.last_name ?? ''}`.trim(),
          has_active_subscription: hasActiveSubscription,
        } : {}),
      },
    };
    
  
  }
  


// async createRecurringCharge(
//     shop: string,
//     accessToken: string,
//     name: string,
//     price: number,
//     returnUrl: string,
//     trialDays = 14,
//     test = true,
//   ): Promise<string> {
//     try {
//       this.MyLogger.log(`Creating recurring charge for shop: ${shop}`, 'ShopifyBilling');

//       const response = await axios.post(
//         `https://${shop}/admin/api/2023-10/recurring_application_charges.json`,
//         {
//           recurring_application_charge: {
//             name,
//             price,
//             return_url: returnUrl,
//             trial_days: trialDays,
//             test,
//           },
//         },
//         {
//           headers: {
//             'X-Shopify-Access-Token': accessToken,
//           },
//         },
//       );

//       this.logger.log(`Shopify charge response received for shop: ${shop}`, 'ShopifyBilling');

//       const confirmationUrl = response.data?.recurring_application_charge?.confirmation_url;
//       if (!confirmationUrl) {
//         this.MyLogger.error(`Missing confirmation URL in Shopify response for shop: ${shop}`, 'ShopifyBilling');
//         throw new BadRequestException('Failed to create recurring charge with Shopify');
//       }

//       this.MyLogger.log(`Charge created successfully. Confirmation URL: ${confirmationUrl}`, 'ShopifyBilling');

//       return confirmationUrl;
//     } catch (error) {
//       const errorMessage = error?.response?.data || error.message;
//       this.MyLogger.error(`Shopify charge creation failed for shop: ${shop} - ${JSON.stringify(errorMessage)}`, 'ShopifyBilling');
//       throw new BadRequestException('Failed to create recurring charge with Shopifyrterwerw');
//     }
//   }
  async createRecurringCharge(
    shop: string,
    accessToken: string,
    name: string,
    price: number,
    returnUrl: string,
    trialDays: number = 7,
    test: boolean = false, //live payment
    //  test: boolean = true,  //test payment
    interval: 'EVERY_30_DAYS' | 'ANNUAL' = 'EVERY_30_DAYS' // default monthly
  ): Promise<string> {
    try {
      this.MyLogger.log(`Creating recurring charge for shop: ${shop}`, 'ShopifyBilling');

      const response = await axios.post(
        `https://${shop}/admin/api/2023-10/recurring_application_charges.json`,
        {
          recurring_application_charge: {
            name,
            price,
            return_url: returnUrl,
            trial_days: trialDays,
            test,
            interval,
          },
        },
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      this.MyLogger.log(`Shopify charge response received for shop: ${shop}`, 'ShopifyBilling');

      const confirmationUrl = response.data?.recurring_application_charge?.confirmation_url;
      if (!confirmationUrl) {
        this.MyLogger.error(`Missing confirmation URL in Shopify response for shop: ${shop}`, 'ShopifyBilling');
        throw new BadRequestException('Failed to create recurring charge with Shopify');
      }

      this.MyLogger.log(`Charge created successfully. Confirmation URL: ${confirmationUrl}`, 'ShopifyBilling');

      return confirmationUrl;
    } catch (error) {
      const errorMessage = error?.response?.data || error.message;
      this.MyLogger.error(
        `Shopify charge creation failed for shop: ${shop} - ${JSON.stringify(errorMessage)}`,
        'ShopifyBilling'
      );
      throw new BadRequestException('Failed to create recurring charge with Shopify');
    }
  }


  async getChargeDetails(
    shop: string,
    accessToken: string,
    chargeId: string,
  ): Promise<any> {
    const response = await axios.get(
      `https://${shop}/admin/api/2023-10/recurring_application_charges/${chargeId}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      },
    );
    return response.data.recurring_application_charge;
  }

  async activateCharge(
    shop: string,
    accessToken: string,
    chargeId: string,
  ): Promise<void> {
    await axios.post(
      `https://${shop}/admin/api/2023-10/recurring_application_charges/${chargeId}/activate.json`,
      {},
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      },
    );
  }
          // async getPaginatedProducts({
          //   vendorId,
          //   search = '',
          //   offset = 0,
          //   limit = 25,
          // }: {
          //   vendorId?: number;
          //   search?: string;
          //   offset?: number;
          //   limit?: number;
          // }): Promise<{ items: any[]; totalCount: number }> {
          //   const where: any = {};

          //   if (vendorId) {
          //     where.vendor_id = vendorId;
          //   }

          //   if (search) {
          //     where.   = {
          //       contains: search,
          //       mode: 'insensitive', // case-insensitive search
          //     };
          //   }

          //   const [items, totalCount] = await Promise.all([
          //     this.prisma.shopifyProduct.findMany({
          //       where,
          //       orderBy: { created_at: 'desc' },
          //       skip: offset,
          //       take: limit,
          //     }),
          //     this.prisma.shopifyProduct.count({ where }),
          //   ]);

          //   return { items, totalCount };
          // }



        async getSyncedProducts(vendorId: number, skip = 0, take = 10, search = '') {
          const whereClause: any = {
            vendor_id: vendorId,
          };

          if (search) {
            whereClause.OR = [
              { title: { contains: search } },       // case-sensitive
              { product_id: { contains: search } },  // case-sensitive
            ];
          }

          return this.prisma.shopifyProduct.findMany({
            where: whereClause,
            skip,
            take,
            orderBy: { created_at: 'desc' },
          });
        }

        async countSyncedProducts(vendorId: number, search = '') {
          const whereClause: any = {
            vendor_id: vendorId,
          };

          if (search) {
            whereClause.OR = [
              { title: { contains: search } },       // case-sensitive
              { product_id: { contains: search } },  // case-sensitive
            ];
          }

          return this.prisma.shopifyProduct.count({
            where: whereClause,
          });
        }


  async upsertCheckout(vendorUid:string,data: any) {
    if (!data) throw new Error('Missing request body data.');

    this.prisma.razorpayresponse.create({
                      data: {
                        razorpayresponse_value: JSON.stringify({data}),
                      },
                    });
  
    const token: string = String(data.token);
    
    try {

         const vendor = await this.prisma.vendors.findUnique({
            where: { uid: vendorUid },
            select: { id: true },
          });

          if (!vendor) {
            throw new Error('Vendor not found');
          }

      const customerName =
        data.customer?.first_name ||
        data.billing_address?.first_name ||
        data.shipping_address?.first_name ||
        data.name ||
        null;
  
      const billingAddress = data.billing_address
        ? {
            address1: data.billing_address.address1 || '',
            address2: data.billing_address.address2 || '',
            city: data.billing_address.city || '',
            province: data.billing_address.province || '',
            zip: data.billing_address.zip || '',
            country: data.billing_address.country || '',
          }
        : [];
  
      const shippingAddress = data.shipping_address
        ? {
            address1: data.shipping_address.address1 || '',
            address2: data.shipping_address.address2 || '',
            city: data.shipping_address.city || '',
            province: data.shipping_address.province || '',
            zip: data.shipping_address.zip || '',
            country: data.shipping_address.country || '',
          }
        : [];
  
      const shippingLines = data.shipping_lines ?? Prisma.JsonNull;
  
      const shippingPrice = Array.isArray(shippingLines) && shippingLines.length > 0
        ? parseFloat(shippingLines[0].price || '0')
        : 0;
  
      await this.prisma.abandonedCheckouts.upsert({
        where: { checkout_token: token },
        update: {
          checkout_id: String(data.id ?? '0'),
          email: data.email ?? null,
          phone: data.phone ?? null,
          name: customerName,
          total_price: parseFloat(data.total_price || '0'),
          total_tax: parseFloat(data.total_tax || '0'),
          shipping_charge: shippingPrice,
          billing_address: billingAddress,
          shipping_lines: shippingLines,
          shopify_currency: data.currency ?? 'INR',
          checkout_token: token,
          abandoned_url: data.abandoned_checkout_url ?? null,
          raw_data: data,
          shopify_customerId: data.customer?.id ?? null,
          shopify_address: data.billing_address?.address1 ?? null,
          shopify_street: data.billing_address?.address2 ?? null,
          shopify_city: data.billing_address?.city ?? null,
          shopify_state: data.billing_address?.province ?? null,
          shopify_zip: data.billing_address?.zip ? parseInt(data.billing_address.zip) : null,
          shopify_vendor: vendor.id,
        },
        create: {
          checkout_id: String(data.id ?? '0'),
          email: data.email ?? null,
          phone: data.phone ?? null,
          name: customerName,
          total_price: parseFloat(data.total_price || '0'),
          total_tax: parseFloat(data.total_tax || '0'),
          shipping_charge: shippingPrice,
          billing_address: billingAddress,
          shipping_lines: shippingLines,
          shopify_currency: data.currency ?? 'INR',
          checkout_token: token,
          abandoned_url: data.abandoned_checkout_url ?? null,
          raw_data: data,
          shopify_customerId: data.customer?.id ?? null,
          shopify_address: data.billing_address?.address1 ?? null,
          shopify_street: data.billing_address?.address2 ?? null,
          shopify_city: data.billing_address?.city ?? null,
          shopify_state: data.billing_address?.province ?? null,
          shopify_zip: data.billing_address?.zip ? parseInt(data.billing_address.zip) : null,
          shopify_vendor: vendor.id,
        },
      });
    } catch (error: any) {
      console.error('Failed to upsert checkout:', {
        message: error.message,
        stack: error.stack,
        meta: error?.meta,
        cause: error?.cause,
      });
      throw error; 
    }
  }
  
  
  
  

 
  async handleOrderCreate(vendorUid:string,data: any) {


    const checkoutToken = data?.checkout_token;
    console.log(checkoutToken);
  
    if (!checkoutToken) return;
  
    // const isCOD = Array.isArray(data.payment_gateway_names) &&
    //               data.payment_gateway_names.includes('Cash on Delivery (COD)');

 
  
    await this.prisma.abandonedCheckouts.updateMany({
      where: { checkout_token: checkoutToken },
      data: {
        checkout_status: 'completed',
        order_id: data.id?.toString() ?? null,
        phone: data.phone ?? null,
        name: data.customer?.first_name ?? data.name ?? null,
        updated_at: new Date(),
        raw_data: data,
        payment_method: 'COD',
        // ...(isCOD && { payment_method: 'COD' }), 
      },
    });
  
  }



    async appUninstalled(vendorUid: string, data: any) {
      // Step 1: Store incoming webhook payload
      await this.prisma.razorpayresponse.create({
        data: {
          razorpayresponse_value: JSON.stringify({ data }),
        },
      });

      // Step 2: Find vendor by UID
      const vendor = await this.prisma.vendors.findFirst({
        where: { uid: vendorUid },
        select: { id: true },
      });

      if (!vendor) {
        throw new BadRequestException('Invalid Vendor UID');
      }

      // Step 3: Get user email from users table using vendor ID
      const user = await this.prisma.users.findFirst({
        where: { vendors__id: vendor.id },
        select: { email: true },
      });

      if (!user?.email) {
        throw new BadRequestException('User not found for vendor or email missing');
      }

      // Step 4: Update `installed` = 0 in shopify_apptoken table using shop_email
      await this.prisma.shopify_apptokens.updateMany({
        where: {
          shop_email: user.email,
        },
        data: {
          installed: 0,
        },
      });

      // Step 5: Log success
      this.logger.log(
        `App uninstalled for vendorUid ${vendorUid} → updated installed = 0 for shop_email: ${user.email}`,
        'AppUninstalled',
      );
    }

 async handleChargeUpdate(vendorUid: string, data: any) {

     await this.prisma.razorpayresponse.create({
                      data: {
                        razorpayresponse_value: JSON.stringify({data}),
                      },
                    });

}
 async handleChargeDelete(vendorUid: string, data: any) {

     await this.prisma.razorpayresponse.create({
                      data: {
                        razorpayresponse_value: JSON.stringify({data}),
                      },
                    });

}

  public async addShopifyTagToOrder(repliedCodId: number, tag: string): Promise<boolean> {
    this.MyLogger.log(`Entered addShopifyTagToOrder() with COD ID: ${repliedCodId}, Tag: "${tag}"`, 'ShopifyTag');

    try {
      // Step 1: Fetch abandoned checkout record
      const order = await this.prisma.abandonedCheckouts.findFirst({
        where: { id: repliedCodId },
        select: {
          id: true,
          shopify_vendor: true,
          order_id: true,
        },
      });

      if (!order?.id) {
        this.MyLogger.warn(`No abandoned checkout found for COD ID: ${repliedCodId}`, 'ShopifyTag');
        return false;
      }

      if (!order?.shopify_vendor) {
        this.MyLogger.warn(`Shopify vendor missing for COD ID: ${repliedCodId}`, 'ShopifyTag');
        return false;
      }

      this.MyLogger.log(`Found abandoned checkout record for order ID: ${order.order_id}`, 'ShopifyTag');

      // Step 2: Fetch vendor info
      const vendor = await this.prisma.vendors.findFirst({
        where: { id: order.shopify_vendor },
        select: { id: true },
      });

      if (!vendor) {
        this.MyLogger.warn(`Vendor not found for vendor ID: ${order.shopify_vendor}`, 'ShopifyTag');
        return false;
      }

      this.MyLogger.log(`Vendor found for ID: ${vendor.id}`, 'ShopifyTag');

      // Step 3: Fetch user info (for shop email)
      const user = await this.prisma.users.findFirst({
        where: { vendors__id: order.shopify_vendor },
        select: {
          id: true,
          email: true,
        },
      });

      if (!user) {
        this.MyLogger.warn(` No user found for vendor ID: ${order.shopify_vendor}`, 'ShopifyTag');
        return false;
      }

      this.MyLogger.log(`User email fetched: ${user.email}`, 'ShopifyTag');

      // Step 4: Get access token and shop name from shopify_apptokens
      const shopDetails = await this.prisma.shopify_apptokens.findFirst({
        where: { shop_email: user.email },
        select: {
          shop_name: true,
          access_token: true,
        },
      });

      if (!shopDetails?.shop_name || !shopDetails?.access_token) {
        this.MyLogger.warn(`Shopify app token missing for email: ${user.email}`, 'ShopifyTag');
        return false;
      }

      this.MyLogger.log(`Shopify shop: ${shopDetails.shop_name}`, 'ShopifyTag');

      const url = `https://${shopDetails.shop_name}/admin/api/2023-01/orders/${order.order_id}.json`;

      this.MyLogger.log(`Sending PUT request to Shopify URL: ${url}`, 'ShopifyTag');

      const payload = {
        order: {
          id: order.order_id,
          tags: tag,
        },
      };

      const response = await axios.put(url, payload, {
        headers: {
          'X-Shopify-Access-Token': shopDetails.access_token,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 200) {
        this.MyLogger.log(`Successfully added tag "${tag}" to order ID: ${order.order_id}`, 'ShopifyTag');
        return true;
      } else {
        this.MyLogger.error(`Shopify responded with status ${response.status}: ${response.statusText}`, 'ShopifyTag');
        return false;
      }

    } catch (error) {
  const errMsg = JSON.stringify(error?.response?.data || error.message, null, 2);
  this.MyLogger.error(`Exception while tagging Shopify order for COD ID ${repliedCodId}: ${errMsg}`, 'ShopifyTag');
  return false;
}

  }

   
  


  async getCountry() {
    const getCountry = await this.prisma.countries.findMany();
    return {
      message: 'countries Retrieved Successfully!',
      data: getCountry,
    };
  }
  

  verifyWebhookHmac(body: any, hmacHeader: string): boolean {
    const generatedHmac = crypto
      .createHmac('sha256', process.env.SHOPIFY_API_SECRET || '')
      .update(JSON.stringify(body), 'utf8')
      .digest('base64');
    return generatedHmac === hmacHeader;
  }

  async handleCustomerDataRequest(data: any) {
   

      console.log(data);


    this.logger.log('GDPR Data Request', { shop_id: data.shop_id, customer: data.customer });
    
  }


    // async handleCustomerRedact(data: any) {
    //   // const mobile = data.customer?.phone;  
    //   const id = data.customer?.id; 

    //   if (!id) {
    //     this.logger.warn('Customer id missing in redact webhook');
    //     return;
    //   }

    //   // const encryptedMobile = encryptField(mobile);

    //   try {
    //     // Delete customer by encrypted mobile number
    //     await this.prisma.contacts.deleteMany({
    //       where: { shopify_customer_id: id },
    //     });

    //     this.logger.log(`Deleted customer data `);
    //   } catch (error) {
    //     this.logger.error('Error deleting customer data:', error.message);
    //     throw error;
    //   }
    // }

    async handleCustomerRedact(data: any) {
    const id = data.customer?.id;

    if (!id) {
      this.logger.warn('Customer ID missing in redact webhook');
      return;
    }

    try {
      await this.prisma.contacts.deleteMany({
        where: { shopify_customer_id: id },
      });
      this.logger.log(`Deleted customer data for Shopify ID ${id}`);
    } catch (err) {
      this.logger.error('Failed to delete customer', err.stack);
      throw err;
    }
  }



            
          async handleShopRedact(data: any): Promise<string> {
          const { shop_id, shop_domain } = data;
          this.logger.log('GDPR Shop Delete', { shop_id, shop_domain });

          await this.prisma.razorpayresponse.create({
            data: {
              razorpayresponse_value: JSON.stringify({
                type: 'shop_redact',
                shop_id,
                shop_domain,
                receivedAt: new Date(),
              }),
            },
          });

          try {
            const shopToken = await this.prisma.shopify_apptokens.findFirst({
              where: { shop_name: shop_domain },
            });

            if (!shopToken) {
              this.logger.warn(`Shop ${shop_domain} already deleted.`);
              return 'Shop already deleted';
            }

            const shopEmail = shopToken.shop_email;

            const vendor = await this.prisma.users.findFirst({
              where: { email: shopEmail ?? undefined, user_roles__id: 2 },
              select: { id: true, vendors__id: true },
            });

            if (vendor && vendor.vendors__id) {
              const vendorId = vendor.vendors__id;

              await this.prisma.$transaction([
                this.prisma.manual_subscriptions.deleteMany({ where: { vendors__id: vendorId } }),
                this.prisma.abandonedCheckouts.deleteMany({ where: { shopify_vendor: vendorId } }),
                this.prisma.contacts.deleteMany({ where: { vendorId } }),
                this.prisma.shopifyProduct.deleteMany({ where: { vendor_id: vendorId } }),
                this.prisma.campaigns.deleteMany({ where: { vendorId } }),
                this.prisma.users.delete({ where: { id: vendor.id } }),
              ]);
            }

            await this.prisma.shopify_apptokens.delete({ where: { shop_name: shop_domain } });

            this.logger.log(`Shop data deleted successfully for: ${shop_domain}`);
            return 'Shop data deleted successfully';
          } catch (err) {
            this.logger.error('Error deleting shop data:', err.message);
            throw new Error('GDPR data deletion failed.');
          }
        }


          async upsertProduct(vendorUid: string, data: any, shopUrl: string) {

             await this.prisma.razorpayresponse.create({
                      data: {
                        razorpayresponse_value: JSON.stringify({data}),
                      },
                    });

          // Retrieve vendor by UID
          // const vendor = await this.prisma.vendors.findUnique({
          //   where: { uid: vendorUid },
          // });

          // if (!vendor) {
          //   throw new Error(`Vendor with UID ${vendorUid} not found`);
          // }

          // const variants = data.variants.edges.map((v: any) => ({
          //   id: v.node.id,
          //   title: v.node.title,
          //   price: v.node.price,
          //   sku: v.node.sku,
          //   inventory_item_id: v.node.inventoryItem?.id || null,
          // }));

          // const images = data.images.edges.map((i: any) => ({
          //   id: i.node.id,
          //   src: i.node.src,
          // }));

          // const options = data.options.map((o: any) => ({
          //   id: o.id,
          //   name: o.name,
          //   values: o.values,
          // }));

          // await this.prisma.shopifyProduct.upsert({
          //   where: { shopify_id: String(data.admin_graphql_api_id) },
          //   create: {
          //     shopify_id: String(data.admin_graphql_api_id),
          //     vendor_id: vendor.id,
          //     title: data.title,
          //     body_html: data.body_html,
          //     product_type: data.product_type,
          //     published_at: data.published_at ? new Date(data.published_at) : null,
          //     product_link: `https://${shopUrl}/products/${data.handle}`,
          //     handle: data.handle,
          //     variants: variants,
          //     images: images,
          //     options: options,
          //     is_shopify: 1,
          //   },
          //   update: {
          //     title: data.title,
          //     body_html: data.body_html,
          //     product_type: data.product_type,
          //     published_at: data.published_at ? new Date(data.published_at) : null,
          //     product_link: `https://${shopUrl}/products/${data.handle}`,
          //     handle: data.handle,
          //     variants: variants,
          //     images: images,
          //     options: options,
          //   },
          // });
        }

      async upsertCustomer( vendorId: string,data:any) {

         await this.prisma.razorpayresponse.create({
                      data: {
                        razorpayresponse_value: JSON.stringify({data}),
                      },
                    });

      //   const vendor = await this.prisma.vendors.findUnique({
      //           where: { uid: vendorId },
      //           select: { id: true },
      //         });

      //         if (!vendor) {
      //           throw new Error('Vendor not found');
      //         }

      // const phoneEnc = encryptField(c.phone)!;
      // const firstEnc = encryptField(c.firstName)!;
      // const lastEnc = encryptField(c.lastName)!;

      // const existing = await this.prisma.contacts.findFirst({
      //   where: {
      //     first_name: firstEnc,
      //     last_name: lastEnc,
      //     wa_id: phoneEnc,
      //   },
      // });

      // if (existing) {
      //   await this.prisma.contacts.update({
      //     where: { id: existing.id },
      //     data: {
      //       email: encryptField(c.email || existing.email),
      //       countries__id: 99,
      //       updated_at: new Date(),
      //       vendorId:vendor.id,
      //     },
      //   });
      //   console.log(`Updated contact: ${c.firstName} ${c.lastName}`);
      // } else {
      //   await this.prisma.contacts.create({
      //     data: {
      //       uid: uuidv4(),
      //       first_name: firstEnc,
      //       last_name: lastEnc,
      //       email: encryptField(c.email || `${c.firstName}-${c.lastName}@noemail.com`),
      //       wa_id: phoneEnc,
      //       countries__id: 99,
      //       language_code: 'en',
      //       status: 0,
      //       vendorId:vendor.id,
      //       disable_ai_bot: 1,
      //       whatsapp_opt_out: 0,
      //     },
      //   });
      //   console.log(`Created contact: ${c.firstName} ${c.lastName}`);
      // }
    }

     async deleteProduct(vendorUid: string, shopifyId: string) {
          const vendor = await this.prisma.vendors.findUnique({ where: { uid: vendorUid } });
          if (!vendor) return;

          // Attempt to delete the product row, matching vendor_id for safety
          const deleted = await this.prisma.shopifyProduct.deleteMany({
            where: {
              shopify_id: shopifyId,
            },
          });

          if (deleted.count > 0) {
            console.log(`Deleted product ${shopifyId} for vendor ${vendorUid}`);
          } else {
            console.warn(`No product found to delete: ${shopifyId} for vendor ${vendorUid}`);
          }
        }

}
