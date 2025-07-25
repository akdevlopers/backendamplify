import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
// import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionDto } from './dto/subscription.dto';

// @UseGuards(JwtAuthGuard)
@ApiTags('Subscription')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subscriptionService: SubscriptionsService) {}

  @Post('initiate')
  @ApiOperation({ summary: 'initiatePlan ' })
  @ApiResponse({ status: 201, description: 'Initiated Successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  initiatePlan(@Body() dto: SubscriptionDto) {
    return this.subscriptionService.initiatePlan(dto);
  }

  @Get('plans')
  @ApiOperation({ summary: 'Get countries' })
  @ApiResponse({
    status: 201,
    description: 'The countries has been successfully Received.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  getPlans() {
    return this.subscriptionService.getPlans();
  }

  @Get('vendarplan')
  @ApiOperation({ summary: 'Get groups by vendor ID' })
  @ApiResponse({
    status: 200,
    description: 'Custom fields retrieved successfully.',
  })
  getAllGroups(
    @Query('vendors__id', ParseIntPipe) vendors__id: number,
    status: string,
  ) {
    return this.subscriptionService.getVendorPlan(vendors__id, status);
  }
}
