import { IsString, IsNotEmpty, Matches,IsNumber } from 'class-validator';

export class ShopifyDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/, {
    message: 'Invalid Shopify domain format',
  })
  shop: string;
}
export class SyncShopifyDto {
  @IsString()
  shopUrl: string;

  @IsString()
  accessToken: string;

  @IsNumber()
  vendorId: number;
}

