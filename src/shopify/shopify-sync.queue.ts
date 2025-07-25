// shopify.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import { ContactService } from '../contact/contact.service';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as CryptoJS from 'crypto-js';
import { EncryptionService } from 'src/common/encryption/encryption.service';

const SECRET_KEY = process.env.SECRET_KEY || '48962874218962874213689687';

function encryptField(value: any): string | undefined {
  if (value === null || value === undefined) return undefined;
  // Convert to string first (for number, boolean, etc.)
  const stringValue = String(value);
  return CryptoJS.AES.encrypt(stringValue, SECRET_KEY).toString();
}


@Processor('shopify-sync')
export class ShopifyProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly EncryptionService: EncryptionService,
    private readonly ContactService: ContactService,
  ) {}
  // @Process('sync-products')
  // async handleProductSync(job: Job) {
  //   console.log('Sync job data:', job.data);
  //   const { shopUrl, accessToken, vendorId } = job.data;
  //   console.log('Shop URL:', shopUrl);
  //   console.log('Access Token:', accessToken);
  //   console.log('Vendor ID:', vendorId);
  
  //   let hasNextPage = true;
  //   let afterCursor = null;
  
  //   while (hasNextPage) {
  //     const cursorPart = afterCursor ? `, after: "${afterCursor}"` : '';
  //     const query = `
  //       {
  //         products(first: 50${cursorPart}) {
  //           pageInfo { hasNextPage, endCursor }
  //           edges {
  //             node {
  //               id, title, bodyHtml, productType, handle, vendor, publishedAt,
  //               options { id, name, values },
  //               variants(first: 100) {
  //                 edges {
  //                   node {
  //                     id, title, price, sku,
  //                     inventoryItem { id }
  //                   }
  //                 }
  //               },
  //               images(first: 5) {
  //                 edges {
  //                   node { id, src }
  //                 }
  //               }
  //             }
  //           }
  //         }
  //       }
  //     `;
  
  //     let response;
  //     try {
  //       response = await firstValueFrom(this.httpService.post(
  //         `https://${shopUrl}/admin/api/2024-10/graphql.json`,
  //         { query },
  //         {
  //           headers: {
  //             'X-Shopify-Access-Token': accessToken,
  //             'Content-Type': 'application/json',
  //           },
  //         }
  //       ));
  //       console.log('data:', response);
  //     } catch (error) {
  //       console.error('Error fetching Shopify products:', error.message || error);
  //       break;
  //     }
  
  //     if (response.data.errors) {
  //       console.error('Shopify GraphQL errors:', response.data.errors);
  //       break;
  //     }
  
  //     const data = response.data?.data?.products;
  //     if (!data) {
  //       console.log('No products data received from Shopify.');
  //       break;
  //     }
  
  //     for (const edge of data.edges) {
  //       const product = edge.node;
  
  //       console.log(`Processing product ${product.title} (${product.id})`);
  
  //       const variants = product.variants.edges.map(v => ({
  //         id: v.node.id,
  //         title: v.node.title,
  //         price: v.node.price,
  //         sku: v.node.sku,
  //         inventory_item_id: v.node.inventoryItem?.id || null,
  //       }));
  
  //       const images = product.images.edges.map(i => ({
  //         id: i.node.id,
  //         src: i.node.src,
  //       }));
  
  //       try {
  //         await this.prisma.shopifyProduct.upsert({
  //           where: { shopify_id: product.id },
  //           update: {
  //             title: product.title,
  //             body_html: product.bodyHtml,
  //             vendor_id: vendorId,
  //             product_type: product.productType,
  //             published_at: product.publishedAt ? new Date(product.publishedAt) : null,
  //             product_link: `https://${shopUrl}/products/${product.handle}`,
  //             handle: product.handle,
  //             variants: JSON.stringify(variants),
  //             images: JSON.stringify(images),
  //             options: JSON.stringify(product.options),
  //           },
  //           create: {
  //             shopify_id: product.id,
  //             title: product.title,
  //             body_html: product.bodyHtml,
  //             vendor_id: vendorId,
  //             product_type: product.productType,
  //             published_at: product.publishedAt ? new Date(product.publishedAt) : null,
  //             product_link: `https://${shopUrl}/products/${product.handle}`,
  //             handle: product.handle,
  //             variants: JSON.stringify(variants),
  //             images: JSON.stringify(images),
  //             options: JSON.stringify(product.options),
  //           },
  //         });
  //         console.log(`Upserted product ${product.id}`);
  //       } catch (err) {
  //         console.error('Error upserting product:', product.id, err.message || err);
  //       }
  //     }
  
  //     hasNextPage = data.pageInfo.hasNextPage;
  //     afterCursor = data.pageInfo.endCursor;
  
  //     // Optional delay to prevent rate limiting
  //     await new Promise(res => setTimeout(res, 200));
  //   }
  
  //   console.log('Shopify product sync finished.');
  // }

  @Process('sync-products')
  async handleProductSync(job: Job) {
    try {
      console.log('Sync job received:', job.data);
      const { shopUrl, accessToken, vendorId } = job.data;

      if (!shopUrl || !accessToken || !vendorId) {
        throw new Error('Missing required job data (shopUrl, accessToken, vendorId)');
      }

      let hasNextPage = true;
      let afterCursor = null;

      while (hasNextPage) {
        const cursorPart = afterCursor ? `, after: "${afterCursor}"` : '';
        const query = `
          {
            products(first: 50${cursorPart}) {
              pageInfo {
                hasNextPage
                endCursor
              }
              edges {
                node {
                  id
                  title
                  bodyHtml
                  productType
                  handle
                  vendor
                  publishedAt
                  options {
                    id
                    name
                    values
                  }
                  variants(first: 100) {
                    edges {
                      node {
                        id
                        title
                        price
                        sku
                        inventoryItem {
                          id
                        }
                      }
                    }
                  }
                  images(first: 5) {
                    edges {
                      node {
                        id
                        src
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        let response;
        try {
          response = await firstValueFrom(
            this.httpService.post(
              `https://${shopUrl}/admin/api/2024-10/graphql.json`,
              { query },
              {
                headers: {
                  'X-Shopify-Access-Token': accessToken,
                  'Content-Type': 'application/json',
                },
              },
            ),
          );
        } catch (error) {
          console.error(' HTTP error while fetching products:', error.response?.data || error.message);
          throw new Error(`HTTP error: ${error.response?.data || error.message}`);
          // return;
        }

        if (response.data?.errors) {
          console.error(' Shopify GraphQL errors:', response.data.errors);
          throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
          // return;
        }

        const data = response.data?.data?.products;

        if (!data) {
          console.log(' No product data returned from Shopify.');
          // return;
          throw new Error('No product data returned from Shopify.');
        }

        for (const edge of data.edges) {
          const product = edge.node;

          console.log(`Processing product: ${product.title} (${product.id})`);

          const variants = product.variants.edges.map(v => ({
            id: v.node.id,
            title: v.node.title,
            price: v.node.price,
            sku: v.node.sku,
            inventory_item_id: v.node.inventoryItem?.id || null,
          }));

          const images = product.images.edges.map(i => ({
            id: i.node.id,
            src: i.node.src,
          }));

          const options = product.options.map(o => ({
            id: o.id,
            name: o.name,
            values: o.values,
          }));

          try {
            await this.prisma.shopifyProduct.upsert({
              where: { shopify_id: product.id },
              update: {
                title: product.title,
                body_html: product.bodyHtml,
                vendor_id: vendorId,
                product_type: product.productType,
                published_at: product.publishedAt ? new Date(product.publishedAt) : null,
                product_link: `https://${shopUrl}/products/${product.handle}`,
                handle: product.handle,
                variants: variants,
                images: images,
                options: options,
              },
              create: {
                shopify_id: product.id,
                title: product.title,
                body_html: product.bodyHtml,
                vendor_id: vendorId,
                product_type: product.productType,
                published_at: product.publishedAt ? new Date(product.publishedAt) : null,
                product_link: `https://${shopUrl}/products/${product.handle}`,
                handle: product.handle,
                variants: variants,
                images: images,
                options: options,
              },
            });

            console.log(`Upserted: ${product.title}`);
          } catch (err) {
            console.error(`Error saving product ${product.id}:`, err.message || err);
          }
        }

        hasNextPage = data.pageInfo.hasNextPage;
        afterCursor = data.pageInfo.endCursor;

        // Prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log('Shopify product sync completed.');
    } catch (err) {
      console.error('Fatal error in handleProductSync:', err.message || err);
      throw err; 
    }
  }


  @Process('sync-customers')
  async handleCustomerSync(job: Job) {
    const { shopUrl, accessToken, vendorId } = job.data;
    console.log(' Starting customer sync for:', job.data);
    console.log(' Starting customer sync for:', shopUrl);
  
    const countries = await this.ContactService.getCountry();
    const countryMap = new Map(
      countries.data.map(country => [country.name.toLowerCase(), country])
    );
  
    let hasNextPage = true;
    let afterCursor: string | null = null;
  
    while (hasNextPage) {
      const cursorPart = afterCursor ? `, after: "${afterCursor}"` : '';
      const query = `
        {
          customers(first: 100${cursorPart}) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                firstName
                lastName
                email
                phone
                defaultAddress {
                  country
                }
              }
            }
          }
        }
      `;
  
      const response = await axios.post(
        `https://${shopUrl}/admin/api/2024-10/graphql.json`,
        { query },
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );
  
      if (response.data.errors?.length) {
        throw new Error(response.data.errors[0].message);
      }
        await this.prisma.razorpayresponse.create({
          data: {
            razorpayresponse_value: JSON.stringify(response.data),
          },
        });

  
      const customers = response.data.data.customers.edges;
      console.log(customers);
  
      for (const edge of customers) {
        const c = edge.node;
  
        const countryName = c.defaultAddress?.country?.toLowerCase();
        const matchedCountry = countryMap.get(countryName);
        const phone = c.phone?.replace(/^\+|^0+/, '') ?? null;
  
        try {
          await this.prisma.contacts.upsert({
            where: {
              shopify_customer_id: c.id,
            },
            update: {
              first_name: this.EncryptionService.encryptUniversal(c.firstName),
              last_name: this.EncryptionService.encryptUniversal(c.lastName),
              wa_id: this.EncryptionService.encryptUniversal(phone),
              countries__id: matchedCountry?.id || 99,
              vendorId: vendorId,
              shopify_customer_id: c.id || 1,
            },
            create: {
              uid: uuidv4(),
              first_name: this.EncryptionService.encryptUniversal(c.firstName),
              last_name: this.EncryptionService.encryptUniversal(c.lastName),
              email: this.EncryptionService.encryptUniversal(c.email)?? null,
              wa_id: this.EncryptionService.encryptUniversal(phone),
              countries__id: matchedCountry?.id || 99,
              language_code: 'en',
              status: 0,
              vendorId: vendorId,
              disable_ai_bot: 1,
              whatsapp_opt_out: 0,
              shopify_customer_id: c.id,
            },
          });
  
          console.log(` Synced customer: ${c.firstName} ${c.lastName}`);
        } catch (err) {
          console.error(` Error syncing customer ${c.email || c.id}:`, err.message);
        }
      }
  
      hasNextPage = response.data.data.customers.pageInfo.hasNextPage;
      afterCursor = response.data.data.customers.pageInfo.endCursor;
  
      // Prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  
    console.log(' All Shopify customers synced.');
    return { message: 'All Shopify customers synced' };
  }
  

}