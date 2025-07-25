import {
    Controller,
    Post,
    Patch,
    Delete,
    Get,
    Body,
    Param,
    UseGuards,
    ParseIntPipe,
    Query,UseInterceptors,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiProperty, ApiResponse } from '@nestjs/swagger';
  import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
  import { AutomationService } from './automation.service';
  import { AutomationDto,GetFlowDto} from './dto/automation.dto';
  import { DecryptInterceptor } from 'src/common/interceptors/decrypt.interceptor';
  import { MyLogger } from 'src/logger.service';
  


@UseGuards(JwtAuthGuard)
@Controller('automation')
export class AutomationController {
     constructor(private AutomationService: AutomationService,private logger: MyLogger) {}

     @Post('create')
      
        async create(@Body() dto: AutomationDto) {
        const result = await this.AutomationService.create(dto);
        return {
          success: true,
          message: 'Automation flow created',
          data: result,
        };
      }

      @Get('get-flow-json')
      
      async getFlowJson(@Query() query: GetFlowDto) {
        return this.AutomationService.getFlowJson(query);
      }

      @Get('list-flows')
      
        async listFlows(@Query('vendorId') vendorId: number) {
          return this.AutomationService.listFlowsByVendorId(Number(vendorId));
        }

       @Get('get-cod-orders')
         
        async listCodOrders(
          @Query('vendor_uid') vendorUid: string,
          @Query('page') page = '1',
          @Query('limit') limit = '10',
          @Query('search') search = ''
        ) {
          return this.AutomationService.listCodOrders(vendorUid, +page, +limit, search);
        } 

        @Get('get-abandoned-cart')
         
        async listAbandonedCart(
          @Query('vendor_uid') vendorUid: string,
          @Query('page') page = '1',
          @Query('limit') limit = '10',
          @Query('search') search = ''
        ) {
          return this.AutomationService.listAbandonedCart(vendorUid, +page, +limit, search);
        }

          @Post('abandonedCheckouts')
            @UseInterceptors(DecryptInterceptor)
        async processAbandonedCheckouts() {
           await this.AutomationService.processAbandonedCheckouts();
        }

         @Post('payload')
          @UseInterceptors(DecryptInterceptor)
          handleEncryptedBody(@Body() body: any) {
            return { decrypted_body: body };
          }

          @Get('query')
          @UseInterceptors(DecryptInterceptor)
          handleEncryptedQuery(@Query() query: any) {
            return { decrypted_query: query };
          }

           @Post('getcheckoutmessage')
       @UseInterceptors(DecryptInterceptor)
        async getcheckoutDetails(@Body('checkout_id') checkout_id: number) {
          this.logger.log('Entered checkout function');

          if (!checkout_id) {
            return {
              success: false,
              message: 'checkout_id is required',
              data: null,
            };
          }

          try {
            const result = await this.AutomationService.getCheckoutWithLogs(checkout_id);

            if (!result) {
              return {
                success: false,
                message: 'Invalid checkout_id',
                data: null,
              };
            }

            return {
              success: true,
              message: 'Message details fetched successfully',
              data: result,
            };
          } catch (error) {
            this.logger.error('Error in getCampaignDetails:', error);
            return {
              success: false,
              message: error,
              data: null,
            };
          }
        }

             @Post('getcodmessage')
       @UseInterceptors(DecryptInterceptor)
        async getCODWithLogs(@Body('checkout_id') checkout_id: number) {
          this.logger.log('Entered checkout function');

          if (!checkout_id) {
            return {
              success: false,
              message: 'checkout_id is required',
              data: null,
            };
          }

          try {
            const result = await this.AutomationService.getCheckoutWithLogs(checkout_id);

            if (!result) {
              return {
                success: false,
                message: 'Invalid checkout_id',
                data: null,
              };
            }

            return {
              success: true,
              message: 'Message details fetched successfully',
              data: result,
            };
          } catch (error) {
            this.logger.error('Error in getCampaignDetails:', error);
            return {
              success: false,
              message: error,
              data: null,
            };
          }
        }



}
