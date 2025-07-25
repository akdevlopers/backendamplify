import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AutomationService } from './automation.service';
import { CampaignsService } from 'src/campaigns/campaigns.service';

@Injectable()
export class CronService {
  constructor(private readonly automationService: AutomationService,private readonly CampaignsService: CampaignsService) {}

  // Run every 5 minutes
  @Cron('*/1 * * * *')
  async handleCron() {
    console.log('Running scheduled task every 1 minutes...');
    await this.automationService.processAbandonedCheckouts();
    await this.automationService.processCodOrders();
    await this.CampaignsService.processCampaignQueue();
  }
}
