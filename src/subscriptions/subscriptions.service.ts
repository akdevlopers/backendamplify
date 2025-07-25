import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SubscriptionDto } from './dto/subscription.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  async initiatePlan(dto: SubscriptionDto) {
    try{
    const { plan_id, ends_at, vendors__id, charges, data } = dto;

    const iitiatePlan = await this.prisma.manual_subscriptions.create({
      data: {
        uid: uuidv4(),
        status: 'initiated',
        plan_id,
        ends_at,
        vendors__id,
        charges,
        data,
      },
    });

    return{
      Message: "Plan Initiated Successfully",
      data: iitiatePlan
    }}catch (error) {
      throw new HttpException(
        {
          message: 'Failed to initiate Plan',
          error: error.message || error,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updatePlan(dto: SubscriptionDto) {
    try{
    const { plan_id, ends_at, vendors__id, charges, data } = dto
    const iitiatePlan = await this.prisma.manual_subscriptions.create({
      data: {
        uid: uuidv4(),
        status: 'activated',
        plan_id,
        ends_at,
        vendors__id,
        charges,
        updated_at: new Date(),
        data,
      },
    });

    return{
      Message: "Plan Update Successfully",
      data: iitiatePlan
    }}catch (error) {
      throw new HttpException(
        {
          message: 'Failed to Update Plan',
          error: error.message || error,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getPlans() {
    try {
      const field = await this.prisma.configurations.findFirst({
        where: {
          name: 'subscription_plans',
        },
        select: {
          value: true,
        },
      });
      return {
        message: 'Planes Fetched Successfully',
        data: field,
      };
    } catch (err) {
      throw new HttpException(
        {
          message: 'Error Fetching The Data',
          Error: err,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

    async getVendorPlan(vendors__id: number, status: string) {
      const fields = await this.prisma.manual_subscriptions.findFirst({
        where: {
          vendors__id: vendors__id,
          status: status,
          NOT: [{ data: null }, { data: '[]' }],
        },
        orderBy: {
          created_at: 'desc', 
        },
      });

      return { data: fields };
    }

}
