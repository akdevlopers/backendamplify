import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  Req,
  ParseIntPipe,
  UseGuards,
  BadRequestException,
  NotFoundException,UseInterceptors
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UpdateFlowDto,CreateCampaignDto} from './dto/campaign.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { EncryptionService } from '../common/encryption/encryption.service';
import { MyLogger } from '../logger.service';
import { DecryptInterceptor } from 'src/common/interceptors/decrypt.interceptor';

// @UseGuards(JwtAuthGuard)
@ApiTags('Campaigns')
@Controller('campaigns')
export class CampaignsController {
  constructor(private campaignService: CampaignsService,private encryptionService: EncryptionService,private readonly logger: MyLogger) {}

  @Get()
  @ApiOperation({ summary: 'Get All Campaigns (Paginated)' })
  @ApiResponse({ status: 200, description: 'List of campaigns retrieved successfully' })
  getAllCampaigns(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('vendor_uid') Id: string,
     @Query('search') search: string,
  ) {
    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;
    return this.campaignService.getAllCampaigns(pageNumber, limitNumber,Id,search);
  }



@Put(':flow_id')
@ApiOperation({ summary: 'Update a Flow by flow_id (update or create)' })
@ApiResponse({ status: 200, description: 'Flow updated or created successfully' })
updateFlow(
  @Param('flow_id') flowId: string,
  @Body() dto: UpdateFlowDto,
) {
  return this.campaignService.updateOrCreateFlow(flowId, dto);
}
   


  @Post('create')
  @UseInterceptors(DecryptInterceptor)
  async create(@Body() dto: CreateCampaignDto, @Req() req) {
    console.log("erwerwer");
    return this.campaignService.processCampaignCreate(dto);
  }


    @Get('columns')
    async getColumns(@Query('vendor') vendorId: number) {
      console.log('Received vendorId:', vendorId); // Make sure this logs a valid number
      const columns = await this.campaignService.getTableColumns(vendorId);
      return { columns };
    }

     @Get('getMobileNumber')
     getMobileNumber(
      @Query('vendorUid') vendorUid: string
      ) {
        return this.campaignService.getMobileNumbers(vendorUid);
      }

      @Post('details')
       @UseInterceptors(DecryptInterceptor)
        async getCampaignDetails(@Body('camp_uid') camp_uid: string) {
          this.logger.log('Entered getCampaignDetails function');

          if (!camp_uid) {
            return {
              success: false,
              message: 'camp_uid is required',
              data: null,
            };
          }

          try {
            const result = await this.campaignService.getCampaignWithLogs(camp_uid);

            if (!result) {
              return {
                success: false,
                message: 'Invalid camp_uid',
                data: null,
              };
            }

            return {
              success: true,
              message: 'Campaign details fetched successfully',
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



    //    @Get('details/:camp_uid')
    // async getdetails(@Param('camp_uid') camp_uid: string) {

    //   this.logger.log(`entered in function`);
    //   try {
    //     if (!camp_uid) {
    //       throw new BadRequestException('camp_uid is required');
    //     }

    //     console.log('Received camp_uid:', camp_uid);

    //     const campaign = await this.campaignService.getdetails(camp_uid);

    //     if (!campaign) {
    //       throw new NotFoundException('Invalid camp_uid');
    //     }

    //     return campaign;
    //   } catch (err) {
    //     console.error('Error fetching campaign:', err);
    //     throw err;
    //   }
    // }

   @Get(':flow_id')
    @ApiOperation({ summary: 'Get a single Flow by flow_id' })
    @ApiResponse({ status: 200, description: 'Flow retrieved successfully' })
    getFlow(@Param('flow_id') flowId: string) {
      return this.campaignService.getFlowByFlowId(flowId);
    }


}