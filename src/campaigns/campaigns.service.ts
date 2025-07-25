import { Injectable,BadRequestException,NotFoundException} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateFlowDto,CreateCampaignDto} from './dto/campaign.dto';
import * as moment from 'moment-timezone';
import { DateTime } from 'luxon';
import { MyLogger } from '../logger.service';
import { WhatsAppService } from 'src/whatsappservice/whatsappservice.service';
import { JsonObject } from '@prisma/client/runtime/library';
import { v4 as uuidv4 } from 'uuid';  // make sure uuid is installed
import { EncryptionService } from '../common/encryption/encryption.service';
import { addMinutes } from 'date-fns';
import { MessageLogRepository } from 'src/whatsappservice/message-log.repository';


  @Injectable()
  export class CampaignsService {
    constructor(private prisma: PrismaService,private readonly logger: MyLogger,private WhatsAppService: WhatsAppService,
      private EncryptionService: EncryptionService,
       private MessageLogRepository: MessageLogRepository,
    ) {}



          async getCampaignWithLogs(camp_uid: string) {
            const campaign = await this.prisma.campaigns.findFirst({
              where: { uid: camp_uid },
            });

            if (!campaign) return null;

            const logs = await this.prisma.whatsAppMessageLog.findMany({
              where: { campaignId: campaign.id },
              orderBy: { createdAt: 'desc' },
            });

            if (logs.length === 0) {
              return {
                campaign,
                logs: [],
                total_contacts: 0,
                delivered_percent: 0,
                read_percent: 0,
                failed_percent: 0,
              };
            }

            const contactIds = logs
              .map(log => log.contactId)
              .filter((id): id is number => id !== null);

            const contacts = await this.prisma.contacts.findMany({
              where: { id: { in: contactIds } },
            });

            const contactMap = new Map<number, { first_name: string; wa_id: string }>();
            for (const contact of contacts) {
              const rawFirstName = contact.first_name?.trim();
              const rawWaId = contact.wa_id?.trim();

              const first_name = rawFirstName
                ? this.EncryptionService.decryptUniversal(rawFirstName)
                : 'Customer';

              const wa_id = rawWaId
                ? this.EncryptionService.decryptUniversal(rawWaId)
                : '';

              contactMap.set(contact.id, { first_name, wa_id });
            }

            let delivered = 0;
            let read = 0;
            let failed = 0;

            const formattedLogs = logs.map(log => {
              const contactInfo = log.contactId !== null
                ? contactMap.get(log.contactId)
                : { first_name: '', wa_id: '' };

              // Count status categories
              const status = log.status?.toLowerCase();
              if (status === 'delivered') delivered++;
              else if (status === 'read') read++;
              else if (status === 'failed') failed++;

              return {
                status: log.status,
                first_name: contactInfo?.first_name || '',
                wa_id: contactInfo?.wa_id || '',
                time: log.createdAt,
              };
            });

            const total = logs.length;
            const delivered_percent = Math.round((delivered / total) * 100);
            const read_percent = Math.round((read / total) * 100);
            const failed_percent = Math.round((failed / total) * 100);

            return {
              campaign,
              logs: formattedLogs,
              total_contacts: total,
              delivered_percent,
              read_percent,
              failed_percent,
            };
          }





          async getAllCampaigns(page: number, limit: number, Id: string, search: string) {

            this.logger.log('Fetching campaigns');
            const vendor = await this.prisma.vendors.findUnique({
              where: { uid: Id },
              select: { id: true },
            });

            if (!vendor) {
              throw new BadRequestException('Invalid Vendor UID');
            }

            const skip = (page - 1) * limit;

            const searchFilter = search
              ? {
                  OR: [
                    { title: { contains: search } },
                    { templateName: { contains: search } },
                    { templateLanguage: { contains: search } },
                  ],
                }
              : {};

            const whereCondition = {
              vendorId: vendor.id,
              ...searchFilter,
            };

            const [data, total] = await Promise.all([
              this.prisma.campaigns.findMany({
                where: whereCondition,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
              }),
              this.prisma.campaigns.count({
                where: whereCondition,
              }),
            ]);

             console.log(data);

            return {
              data,
              meta: {
                total,
                page,
                lastPage: Math.ceil(total / limit),
              },
            };
          }


          async getFlowByFlowId(flowId: string) {
            return this.prisma.flow_select.findUnique({
              where: { flow_id: flowId },
            });
          }


          async updateOrCreateFlow(flowId: string, dto: UpdateFlowDto) {
            const existingFlow = await this.prisma.flow_select.findUnique({
              where: { flow_id: flowId },
            });

            if (existingFlow) {
              return this.prisma.flow_select.update({
                where: { flow_id: flowId },
                data: { data: dto.data },
              });
            } else {
              return this.prisma.flow_select.create({
                data: {
                  flow_id: flowId,
                  data: dto.data,
                },
              });
            }
          }

      async getdetails(camp_uid: string) {
        return this.prisma.campaigns.findUnique({
          where: { uid: camp_uid },
        });
      }



async processCampaignCreate(dto: CreateCampaignDto) {
  let campaignId: number | null = null;
  let vendorId = dto.vendor_id;
  let userId: number | null = null;

  // try {
    // Transaction starts
    await this.prisma.$transaction(async (tx) => {
      const vendor = await tx.users.findUnique({
        where: { vendors__id: vendorId },
        select: { id: true },
      });

      if (!vendor) {
        throw new BadRequestException('Vendor not found.');
      }
      userId = vendor.id;

      const countCampaigns = await tx.campaigns.count({ where: { vendorId } });
      const subscription = await this.getVendorCurrentActiveSubscription(vendorId);

      if (!subscription?.created_at) {
        console.warn('Subscription start date is null');
      }

      const count = await this.countByVendorId(vendorId);

      let plan = subscription?.plan_id 
        ? await this.getManualSubscriptionPlan(subscription.plan_id) 
        : null;

      if (!plan) {
        throw new BadRequestException('Subscription plan not found.');
      }

      const campaignsLimitRaw = plan?.features?.campaigns?.limit;
      const campaignsLimit = campaignsLimitRaw != null ? Number(campaignsLimitRaw) : undefined;

      if (
        campaignsLimit != null && campaignsLimit >= 0 &&
        countCampaigns >= campaignsLimit
      ) {
        throw new BadRequestException(
          `Campaigns limit exceeded. Your plan allows only ${campaignsLimit} campaigns.`,
        );
      }

      const scheduleAt = dto.schedule_at ?? '';
      const timezone = dto.timezone ?? 'UTC';
      const utcSchedule = this.getScheduleUtc(scheduleAt, timezone);

      const template = await this.getTemplate(dto.template_uid);
      if (!template) {
        throw new BadRequestException('Template not found.');
      }


      console.log({
        templateId: template.id,
        whatsappTemplate: template, // full object
      });


      const { contactIds, groupMeta } = await this.getContactGroupData(dto.contact_group, vendorId);
      if (!contactIds.length) {
        throw new BadRequestException('No contacts found');
      }

      const campaign = await this.createCampaign({
        vendorId,
        userId,
        title: dto.title,
        templateId: template.id,
        timezone,
        scheduleAt: utcSchedule,
        contactIds,
        dto,
        template,
        groupMeta,
      });

      campaignId = campaign.id;
    });

    return { success: true, campaignId };

}


    //   async processCampaignCreate(dto: CreateCampaignDto) {
    //   try {
    //     const vendorId = dto.vendor_id;

    //     const vendor = await this.prisma.users.findUnique({
    //       where: { vendors__id: dto.vendor_id },
    //       select: { id: true },
    //     });

    //     if (!vendor) {
    //       throw new BadRequestException('Vendor not found.');
    //     }

    //     const userId = vendor.id;

    //     const countCampaigns = await this.prisma.campaigns.count({
    //       where: { vendorId },
    //     });

    //     const subscription = await this.getVendorCurrentActiveSubscription(vendorId);
    //     if (!subscription?.created_at) {
    //       console.warn('Subscription start date is null');
    //     }

    //     const count = await this.countByVendorId(vendorId);

    //     interface PlanFeatures {
    //       campaigns?: {
    //         limit?: number | string;
    //       };
    //     }

    //     interface Plan {
    //       features?: PlanFeatures | null;
    //     }

    //     let plan: Plan | null = null;

    //     if (subscription?.plan_id) {
    //       plan = await this.getManualSubscriptionPlan(subscription.plan_id) as Plan;
    //     } else {
    //       console.warn('Subscription plan_id is null');
    //     }

    //     if (!plan) {
    //       throw new BadRequestException('Subscription plan not found.');
    //     }

    //     const campaignsLimitRaw = plan.features?.campaigns?.limit;
    //     const campaignsLimit =
    //       campaignsLimitRaw !== undefined && campaignsLimitRaw !== null
    //         ? Number(campaignsLimitRaw)
    //         : undefined;

    //     if (
    //       campaignsLimit !== undefined &&
    //       campaignsLimit !== -1 &&
    //       Number.isInteger(campaignsLimit) &&
    //       campaignsLimit >= 0 &&
    //       countCampaigns >= campaignsLimit
    //     ) {
    //       throw new BadRequestException(
    //         `Campaigns limit exceeded. Your plan allows only ${campaignsLimit} campaigns.`,
    //       );
    //     }

    //     const scheduleAt = dto.schedule_at ?? '';
    //     const timezone = dto.timezone ?? 'UTC';
    //     const utcSchedule = this.getScheduleUtc(scheduleAt, timezone);

    //     const template = await this.getTemplate(dto.template_uid);
    //     if (!template) {
    //       throw new BadRequestException('Template not found.');
    //     }

    //     // Optional wallet check
    //     // const walletOk = await this.checkWalletAmount(dto.contact_group, template.id, vendorId);
    //     // if (!walletOk) {
    //     //   throw new BadRequestException('Insufficient Fund In Your Wallet');
    //     // }

    //     const { contactIds, groupMeta } = await this.getContactGroupData(dto.contact_group, vendorId);
    //     if (!contactIds.length) {
    //       throw new BadRequestException('No contacts found');
    //     }

    //     const campaign = await this.createCampaign({
    //       vendorId,
    //       userId,
    //       title: dto.title,
    //       templateId: template.id,
    //       timezone,
    //       scheduleAt: utcSchedule,
    //       contactIds,
    //       dto,
    //       template,
    //       groupMeta,
    //     });

    //     return { success: true, campaignId: campaign.id };
    //   } catch (error) {
    //     console.error('Error creating campaign:', error);
    //     if (error instanceof BadRequestException) {
    //       throw error;
    //     }
    //    throw new BadRequestException(`Failed to create campaign: ${error.message}`);
    //   }
    // }

  // async processCampaignCreate(dto: CreateCampaignDto) {
  //   const vendorId = dto.vendor_id;

  //   const vendor = await this.prisma.users.findUnique({
  //       where: { vendors__id: dto.vendor_id },
  //       select: { id: true },
  //     });

  //    const countCampaigns = await this.prisma.campaigns.count({
  //       where: { vendorId: dto.vendor_id },
  //     });


  //     if (!vendor) {
  //       throw new BadRequestException('Vendor not found.');
  //     }

  //     const userId = vendor.id;

  //   const variable_data=dto.variable_data;
  //   const subscription = await this.getVendorCurrentActiveSubscription(vendorId);
  //   if (subscription?.created_at) {
  //     const currentBillingCycle = this.getCurrentBillingCycleDates(subscription.created_at);
  //   } else {
  //     console.warn('Subscription start date is null');
  //   }
  //   const count = await this.countByVendorId(vendorId);

  //   interface PlanFeatures {
  //     campaigns?: {
  //       limit?: number | string; // your DB may return string for JSON numbers
  //     };
  //     // add other features if needed
  //   }
    
  //   interface Plan {
  //     features?: PlanFeatures | null;
  //     // other plan properties if neededcurrentCampaignsCount
  //   }
    
  //   let plan: Plan | null = null;
    
  //   if (subscription?.plan_id) {
  //     plan = await this.getManualSubscriptionPlan(subscription.plan_id) as Plan;
  //   } else {
  //     console.warn('Subscription plan_id is null');
  //   }
    
  //   if (!plan) {
  //     throw new BadRequestException('Subscription plan not found.');
  //   }
    
  //   const campaignsLimitRaw = plan.features?.campaigns?.limit;
    
  //   // Normalize limit as number, handle string and number cases
  //   const campaignsLimit = campaignsLimitRaw !== undefined && campaignsLimitRaw !== null
  //     ? Number(campaignsLimitRaw)
  //     : undefined;
    
  //   if (
  //     campaignsLimit !== undefined &&
  //     campaignsLimit !== -1 && // assuming -1 means unlimited
  //     Number.isInteger(campaignsLimit) &&
  //     campaignsLimit >= 0
  //   ) {
     
     
  //     if (countCampaigns >= campaignsLimit) {
  //       throw new BadRequestException(
  //         `Campaigns limit exceeded. Your plan allows only ${campaignsLimit} campaigns.`
  //       );
  //     }
  //   }
    
  //   const scheduleAt = dto.schedule_at ?? '';
  //     const timezone = dto.timezone ?? 'UTC';

  //     const utcSchedule = this.getScheduleUtc(scheduleAt, timezone);

    
  //       // 6. Get template by UID
  //       const template = await this.getTemplate(dto.template_uid);
  //       if (!template) {
  //         throw new BadRequestException('Template not found.');
  //       }

  //       // // 7. Check wallet balance for this contact group and template
  //       // const walletOk = await this.checkWalletAmount(dto.contact_group, template.id,dto.vendor_id);
  //       // if (!walletOk) {
  //       //   throw new BadRequestException('Insufficient Fund In Your Wallet');
  //       // }

  //       // 8. Get contact IDs with filters (like opted-in etc.)
  //     const { contactIds, groupMeta } = await this.getContactGroupData(dto.contact_group, vendorId);
  //           if (!contactIds.length) {
  //             throw new BadRequestException('No contacts found');
  //           }





  //       const campaign = await this.createCampaign({
  //       vendorId,
  //       userId,
  //       title: dto.title,
  //       templateId: template.id,
  //       timezone,
  //       scheduleAt: utcSchedule,
  //       contactIds,
  //       dto,
  //       template,
  //       groupMeta, // pass this instead of extracting from dto
  //     });

  //   // await this.queueContacts(
  //   //   contactIds,
  //   //   campaign.id,
  //   //   vendorId,
  //   //   template.id,
  //   //   testMessage.inputs,
  //   //   scheduleAt,
  //   // );

  //   return { success: true, campaignId: campaign.id };
  // }

 
  private async getTemplate(uid: string) {
    const template = await this.prisma.whatsappTemplate.findFirst({ where: { uid } });
    if (!template) throw new BadRequestException('Template not found');
    return template;
  }

  private getScheduleUtc(scheduleAt: string, timezone: string): Date {
    if (scheduleAt) {
      try {
        const rawTime = DateTime.fromISO(scheduleAt, { zone: timezone });
        if (!rawTime.isValid) {
          throw new Error('Invalid datetime format or timezone');
        }
  
        return rawTime.toUTC().toJSDate();
      } catch (error) {
        throw new BadRequestException('Failed to recognize the datetime, please reload and try again.');
      }
    }
  
    throw new BadRequestException('scheduleAt is required');
  }
  
    private async getContactGroupData(groupId: string, vendorId: number): Promise<{
      contactIds: number[];
      groupMeta?: {
        id: number;
        uid: string;
        title: string;
        description: string | null;
      };
    }> {
      if (groupId === 'all_contacts') {
        const contacts = await this.prisma.contacts.findMany({
          where: { vendorId },
          select: { id: true },
        });

        return {
          contactIds: contacts.map(c => c.id),
        };
      }

      const groupIdNumber = Number(groupId);

      const group = await this.prisma.contact_groups.findUnique({
        where: { id: groupIdNumber },
        select: {
          id: true,
          uid: true,
          title: true,
          description: true,
        },
      });

      const groupItems = await this.prisma.group_contacts.findMany({
        where: { contactGroupsId: groupIdNumber },
        select: { contactsId: true },
      });

      return {
        contactIds: groupItems.map(i => i.contactsId),
        groupMeta: group ?? undefined,
      };
    }



  async getVendorCurrentActiveSubscription(vendorId: number) {
    const vendorIdNumber = Number(vendorId);
  
      const manualSubscription = await this.prisma.manual_subscriptions.findFirst({
        where: {
          vendors__id: vendorIdNumber,
          status: 'active',
        },
        orderBy: {
          created_at: 'desc',
        },
      });
      return manualSubscription;
  } 
  getCurrentBillingCycleDates(subscriptionStartDate: Date | string) {
    const today = moment();
    const startOfMonth = moment(subscriptionStartDate).year(today.year()).month(today.month());
  
    if (today.date() < startOfMonth.date()) {
      startOfMonth.subtract(1, 'month');
    }
  
    const endOfMonth = moment(startOfMonth).add(1, 'month').subtract(1, 'day');
  
    return {
      start: startOfMonth.startOf('day').toDate(),
      end: endOfMonth.endOf('day').toDate(),
    };
  }

  async countByVendorId(vendorId: Number): Promise<number> {
    const vendorIdNumber = Number(vendorId);
    return this.prisma.campaigns.count({
      where: { vendorId: vendorIdNumber },
    });
  }

  async getManualSubscriptionPlan(planId: string): Promise<any | null> {
    if (!planId) return null;
  
    const configRecord = await this.prisma.configurations.findFirst({
      where: {
        name: 'subscription_plans',
      },
      select: {
        value: true,
      },
    });
  
    if (!configRecord?.value) return null;
  
    let config: any;
    try {
      config = typeof configRecord.value === 'string'
        ? JSON.parse(configRecord.value)
        : configRecord.value;
    } catch (error) {
      console.error('Invalid JSON in subscription_plans config:', error);
      return null;
    }
  
    const plan = config?.paid?.[planId];
    return plan || null;
  }


  async checkWalletAmount(contactGroupId: string, templateId: number,vendorId: number): Promise<boolean> {
    // 1. Get template category
    const contactID = Number(contactGroupId);
    const template = await this.prisma.whatsappTemplate.findFirst({
      where: { id: templateId },
      select: { category: true },
    });
  
    const templateType = template?.category ?? 'MARKETING';
  
    // 2. Determine setting key based on template category
    const templateCategoryKey =
      templateType === 'MARKETING'
        ? 'perusercampaignamountMARKETING'
        : 'perusercampaignamountUTILITY';
  
    // 3. Get setting value for that key (default 0.86)
    const setting = await this.prisma.settings.findFirst({
      where: { type: templateCategoryKey },
      select: { value: true },
    });
  
    const settingAmount = setting ? setting.value : 0.86;

    const vendor = await this.prisma.vendors.findFirst({
      where: { id: vendorId },
      select: {
        percampaignamount: true,
        percampaignamountutility: true,
        wallet_balance_amount: true,
      },
    });
    
    if (!vendor) return false;
    
    const marketingAmount = vendor.percampaignamount ?? 0;
    const utilityAmount = vendor.percampaignamountutility ?? 0;
    
    const amount =
      templateType === 'MARKETING'
        ? (marketingAmount > 0 ? marketingAmount : settingAmount)
        : (utilityAmount > 0 ? utilityAmount : settingAmount);
    
    const groupContactCount = await this.prisma.group_contacts.count({
      where: { contactGroupsId: contactID }, 
    });
    
    const eligibilityAmount = amount * groupContactCount;
    
    if (eligibilityAmount <= 0) return false;
    
    return (vendor.wallet_balance_amount ?? 0) >= eligibilityAmount;
    
  }

  async getTableColumns(vendorId: number): Promise<{ [key: string]: string }> {
  const columns = await this.prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'contacts'
  `;

  const allowedWithLabels: Record<string, string> = {
    first_name: 'Contact First Name',
    last_name: 'Contact Last Name',
    countries__id: 'Country Name',
    wa_id: 'Contact Mobile Number',
    email: 'Contact Email',
  };

  const columnNames = columns.map(col => col.COLUMN_NAME);

  const filtered = Object.entries(allowedWithLabels)
    .filter(([key]) => columnNames.includes(key))
    .reduce((obj, [key, label]) => {
      obj[key] = label;
      return obj;
    }, {} as Record<string, string>);

  return filtered;
}


async getMobileNumbers(vendorUid: string): Promise<{
  success: boolean;
  message: string;
  data?: {
    phoneNumbers: {
      phoneNumberId: number;
      phoneNumber: number;
    }[];
  };
}> {
  if (!vendorUid) {
    return { success: false, message: 'Vendor UID is required' };
  }

  // Find vendor by UID
  const vendorRecord = await this.prisma.vendors.findFirst({
    where: { uid: vendorUid },
  });

  if (!vendorRecord) {
    return { success: false, message: 'Invalid Vendor UID' };
  }

  const vendorID = vendorRecord.id;

  // Fetch whatsapp_phone_numbers from vendorSettings
  const phoneNumbersSetting = await this.prisma.vendorSettings.findFirst({
    where: {
      vendors__id: vendorID,
      name: 'whatsapp_phone_numbers',
    },
  });

  if (!phoneNumbersSetting || !phoneNumbersSetting.value) {
    return { success: false, message: 'Whatsapp phone numbers not found' };
  }

  let phoneNumbersArray: any[] = [];
  try {
    phoneNumbersArray = JSON.parse(phoneNumbersSetting.value);
  } catch (err) {
    return { success: false, message: 'Invalid JSON format in whatsapp_phone_numbers' };
  }

  const filteredNumbers = phoneNumbersArray
    .filter(p => ['VERIFIED', 'EXPIRED'].includes(p.code_verification_status))
    .map(p => ({
      phoneNumberId: Number(p.id),
      phoneNumber: Number(p.display_phone_number.replace(/\D/g, '')),
      status: p.code_verification_status
    }));

  if (filteredNumbers.length === 0) {
    return { success: false, message: 'No VERIFIED or EXPIRED phone numbers found' };
  }

  return {
    success: true,
    message: 'Verified phone numbers found',
    data: {
      phoneNumbers: filteredNumbers,
    },
  };
}

private async createCampaign(data: {
  vendorId: number;
  userId: number;
  title: string;
  templateId: number;
  timezone: string;
  scheduleAt: Date;
  contactIds: number[];
  dto: CreateCampaignDto;
  template: any;
  groupMeta?: {
    id: number;
    uid: string;
    title: string;
    description: string | null;
  };
}) {
  const { vendorId, contactIds, dto, template, scheduleAt } = data;

  const templateRecord = await this.prisma.whatsappTemplate.findUnique({
    where: { uid: dto.template_uid },
  });

  if (!templateRecord) {
    throw new Error('Template not found');
  }

  const inputFields: Record<string, any> = {};
  for (const [key, value] of Object.entries(dto)) {
    if (
      key.startsWith('field_') ||
      key.startsWith('header_') ||
      key.startsWith('button_') ||
      key.startsWith('copy_code') ||
      key.startsWith('location_') ||
      key.startsWith('header_field_')
    ) {
      inputFields[key] = value;
    }
  }

  const request: any = {
    template_name: template.templateName,
    template_language: template.language,
    from_phone_number_id: dto.from_phone_number_id ?? null,
    ...inputFields,
  };

console.log(`Input Fields: ${JSON.stringify(request)}`);



  const campaign = await this.prisma.campaigns.create({
    data: {
      uid: crypto.randomUUID(),
      vendorId,
      userId: data.userId,
      title: data.title,
      templateName: template.templateName,
      templateLanguage: template.language,
      timezone: data.timezone,
      scheduledAt: data.scheduleAt,
      createdAt: new Date(),
      status: 1,
      totalContacts: contactIds.length,
      data: '{}',
    },
  });

  const decryptIfNotEmpty = async (value: string | null) => {
    if (!value || value.trim() === '') return value;
    return await this.EncryptionService.decryptUniversal(value);
  };

  for (const contactId of contactIds) {
    const contact = await this.prisma.contacts.findFirst({
      where: { id: contactId, vendorId },
    });

    if (!contact) continue;

    const decryptedContact = {
      ...contact,
      first_name: await decryptIfNotEmpty(contact.first_name),
      last_name: await decryptIfNotEmpty(contact.last_name),
      wa_id: await decryptIfNotEmpty(contact.wa_id),
      email: await decryptIfNotEmpty(contact.email),
    };

    if (!decryptedContact.wa_id) continue;

    const message = await this.WhatsAppService.sendTemplateMessageProcess(
      request,
      decryptedContact,
      true,
      campaign.id.toString(),
      vendorId,
      template,
      inputFields,
    );

    const item = {
      uid: crypto.randomUUID(),
      status: 1,
      vendorId,
      scheduledAt: scheduleAt,
      phoneWithCountryCode:  String(decryptedContact.wa_id),
      campaignId: campaign.id,
      contactId: decryptedContact.id,
      data: {
        contact_data: {
          id: decryptedContact.id,
          uid: decryptedContact.uid,
          first_name: decryptedContact.first_name,
          last_name: decryptedContact.last_name,
          countries__id: decryptedContact.countries__id,
        },
        campaign_data: {
          whatsAppTemplateName: template.templateName,
          whatsAppTemplateLanguage: template.language,
          templateProforma: message.data.templateProforma,
          templateComponents: message.data.templateComponents,
          messageComponents: message.data.messageComponents,
          inputs: message.data.inputFields,
          fromPhoneNumberId: message.data.fromPhoneNumberId,
        },
      },
    };

    await this.prisma.whatsAppMessageQueue.create({ data: item });
  }

  return campaign;
}




//   private async createCampaign(data: {
//   vendorId: number;
//   userId: number;
//   title: string;
//   templateId: number;
//   timezone: string;
//   scheduleAt: Date;
//   contactIds: number[];
//   dto: CreateCampaignDto;
//   template: any;
//   groupMeta?: {
//     id: number;
//     uid: string;
//     title: string;
//     description: string | null;
//   };
// }) {
//   const { vendorId, contactIds, dto, template } = data;

//   console.log(contactIds);

//   const contact = await this.prisma.contacts.findFirst({
//     where: { id: contactIds[0], vendorId },
//   });

//   if (!contact) throw new BadRequestException('No valid contact found for vendor');

//   // ✅ Extract dynamic input fields
//   const inputFields: Record<string, any> = {};
//   for (const [key, value] of Object.entries(dto)) {
//     if (
//       key.startsWith('field_') ||
//       key.startsWith('header_') ||
//       key.startsWith('button_') ||
//       key.startsWith('copy_code') ||
//       key.startsWith('location_')||
//       key.startsWith('header_field_') 
//     ) {
//       inputFields[key] = value;
//     }
//   }

//   // ✅ Build request for template processing
//   const request: any = {
//     template_name: template.templateName,
//     template_language: template.language,
//     from_phone_number_id: dto.from_phone_number_id ?? null,
//     ...inputFields,
//   };

//   console.log(request);

//   // ✅ Generate message components
//   const preparedMessage = await this.WhatsAppService.sendTemplateMessageProcess(
//     request,
//     contact,
//     true,          // isForCampaign
//     null,          // campaignId not created yet
//     vendorId,
//     template,
//     inputFields     // pass cleaned dynamic fields
//   );

//   const messagequeue=await this.storeInMessageQueue({
//   contacts,
//   request,
//   campaign,
//   vendorId,
//   scheduleAt,
//   whatsAppTemplate,
//   inputs: isTestMessageProcessed.data('inputs'),
// });


//   console.log(preparedMessage);

//   try {
//     return await this.prisma.campaigns.create({
//       data: {
//         uid: crypto.randomUUID(),
//         vendorId,
//         userId: data.userId,
//         title: data.title,
//         whatsappTemplateId: data.templateId,
//         templateName: template.templateName,
//         templateLanguage: template.language,
//         timezone: data.timezone,
//         scheduledAt: data.scheduleAt,
//         createdAt: new Date(),
//         status: 1,
//         totalContacts: contactIds.length,
//         data: JSON.stringify({
//           total_contacts: contactIds.length,
//           is_for_template_language_only: dto.restrict_by_templated_contact_language ?? false,
//           is_for_opted_only_contacts: true,
//           is_all_contacts: dto.contact_group === 'all_contacts',
//           selected_groups:
//             dto.contact_group === 'all_contacts' || !data.groupMeta
//               ? []
//               : {
//                   [data.groupMeta.uid]: {
//                     _id: data.groupMeta.id,
//                     _uid: data.groupMeta.uid,
//                     title: data.groupMeta.title,
//                     description: data.groupMeta.description,
//                     total_group_contacts: contactIds.length,
//                   },
//                 },
//           messageComponents: preparedMessage.data.messageComponents,
//           from_phone_number_id: preparedMessage.data.fromPhoneNumberId,
//         }),
//       },
//     });
//   } catch (err) {
//     this.logger.error('Failed to save campaign:', err);
//     throw new BadRequestException('Failed to create campaign. Please try again later.');
//   }
// }


// private async createCampaign(data: {
//   vendorId: number;
//   userId: number;
//   title: string;
//   templateId: number;
//   timezone: string;
//   scheduleAt: Date;
//   contactIds: number[];
//   dto: CreateCampaignDto;
//   template: any;
//   groupMeta?: {
//     id: number;
//     uid: string;
//     title: string;
//     description: string | null;
//   };
// }) {
//   const { vendorId, contactIds, dto, template, scheduleAt } = data;

//   // console.log(data);
//   const templateRecord = await this.prisma.whatsappTemplate.findUnique({
//   where: { uid: dto.template_uid },
//     });

//     if (!templateRecord) {
//       throw new Error('Template not found');
//     }

//     console.log(templateRecord);

//   // ✅ Extract dynamic input fields from DTO
//   const inputFields: Record<string, any> = {};
//   for (const [key, value] of Object.entries(dto)) {
//     if (
//       key.startsWith('field_') ||
//       key.startsWith('header_') ||
//       key.startsWith('button_') ||
//       key.startsWith('copy_code') ||
//       key.startsWith('location_') ||
//       key.startsWith('header_field_')
//     ) {
//       inputFields[key] = value;
//     }
//   }

//   const request: any = {
//     template_name: template.templateName,
//     template_language: template.language,
//     from_phone_number_id: dto.from_phone_number_id ?? null,
//     ...inputFields,
//   };


//   const campaign = await this.prisma.campaigns.create({
//     data: {
//       uid: crypto.randomUUID(),
//       vendorId,
//       userId: data.userId,
//       title: data.title,
//       templateName: template.templateName,
//       templateLanguage: template.language,
//       timezone: data.timezone,
//       scheduledAt: data.scheduleAt,
//       createdAt: new Date(),
//       status: 1,
//       totalContacts: contactIds.length,
//       data: '{}',
//     },
//   });

  


//   const queueData = [];

//       const decryptIfNotEmpty = async (value: string | null) => {
//       if (!value || value.trim() === '') {
//         return value;
//       }
//       return await this.EncryptionService.decryptUniversal(value);
//     };

//     for (const contactId of contactIds) {
//       const contact = await this.prisma.contacts.findFirst({
//         where: { id: contactId, vendorId },
//       });

//       if (!contact) continue;

//       const decryptedContact = {
//         ...contact,
//         first_name: await decryptIfNotEmpty(contact.first_name),
//         last_name: await decryptIfNotEmpty(contact.last_name),
//         wa_id: await decryptIfNotEmpty(contact.wa_id),
//         email: await decryptIfNotEmpty(contact.email),
//       };

//       if (!decryptedContact.wa_id) continue;

//       // Use `decryptedContact` instead of `contact`
//       console.log(decryptedContact);
//       // your logic here...
//     }

//   const message = await this.WhatsAppService.sendTemplateMessageProcess(
//     request,
//     decryptedContact,
//     true,
//     campaign.id.toString(),
//     vendorId,
//     template,
//     inputFields,
//   );

//   console.log(message);

//   const item = {
//     uid: crypto.randomUUID(),
//     status: 1,
//     vendorId,
//     scheduledAt: scheduleAt,
//     phoneWithCountryCode: decryptedContact.wa_id,
//     campaignId: campaign.id,
//     contactId: decryptedContact.id,
//     data: {
//       contact_data: {
//         id: decryptedContact.id,
//         uid: decryptedContact.uid,
//         first_name: decryptedContact.first_name,
//         last_name: decryptedContact.last_name,
//         countries__id: decryptedContact.countries__id,
//       },
//       campaign_data: {
//         whatsAppTemplateName: template.templateName,
//         whatsAppTemplateLanguage: template.language,
//         templateProforma:message.data.templateProforma,
//         templateComponents:message.data.templateComponents,
//         messageComponents: message.data.messageComponents,
//         inputs:message.data.inputFields,
//         fromPhoneNumberId: message.data.fromPhoneNumberId,
//       },
//     },
    
//   };

//   await this.prisma.whatsAppMessageQueue.create({ data: item });

//   return campaign;
// }






//  async processCampaignQueue(): Promise<void> {
//     const now = new Date();
//     console.log(now);

//     const dueMessages = await this.prisma.whatsAppMessageQueue.findMany({
//       where: {
//         status: 2, // pending
//         scheduledAt: {
//           lte: now,
//         },
//       },
//     });
//      console.log(dueMessages);

//     for (const queueItem of dueMessages) {
//   try {
    
//     const rawData = queueItem.data;
//     //  console.log(rawData);

//     if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
//       throw new Error('Invalid JSON in `data`');
//     }

//     const data = rawData as any;
//     const fromPhoneNumberId = data.fromPhoneNumberId;
//     const campaignData = data.campaign_data;
//     const templateProforma = campaignData?.whatsAppTemplateName;
//      const whatsAppTemplateLanguage = campaignData?.whatsAppTemplateLanguage;
   
//     const messageComponents = data.messageComponents || [];

//           await this.WhatsAppService.sendTemplateMessage(
//             queueItem.vendorId, // vendorId
//             queueItem.phoneWithCountryCode, // toNumber 
//             templateProforma,
//             whatsAppTemplateLanguage,
//             messageComponents,  
//             fromPhoneNumberId,   // queueId
//           );

//           await this.prisma.whatsAppMessageQueue.update({
//             where: { id: queueItem.id },
//             data: {
//               status: 1,
//               updatedAt: new Date(),
//             },
//           });

//           this.logger.log(`Sent message for queue ID ${queueItem.id}`);
//         } catch (error) {
//           this.logger.error(`Error in queue ID ${queueItem.id}: ${error.message}`);

//           await this.prisma.whatsAppMessageQueue.update({
//             where: { id: queueItem.id },
//             data: {
//               status: 3,
//               updatedAt: new Date(),
//               retries: (queueItem.retries ?? 0) + 1,
//             },
//           });
//         }
//       }




// }

// async processCampaignQueue(): Promise<void> {
//   const allPendingMessages = await this.prisma.whatsAppMessageQueue.findMany({
//     where: {
//       status: 1,
//     },
//   });

//   this.logger.log(`Found ${allPendingMessages.length} pending messages to process.`);

//   for (const queueItem of allPendingMessages) {
//     try {
//       const rawData = queueItem.data;

//       if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
//         throw new Error('Invalid JSON in `data`');
//       }

//       this.logger.warn(`Raw Queue Data: ${JSON.stringify(queueItem.data, null, 2)}`);


//       const data = rawData as any;
//       const campaignData = data.campaign_data;
//       const fromPhoneNumberId = campaignData?.fromPhoneNumberId;

//         if (!fromPhoneNumberId) {
//         this.logger.log(`Missing FromNumberId`);
//       }

//       const templateProforma = campaignData?.whatsAppTemplateName;
//       const whatsAppTemplateLanguage = campaignData?.whatsAppTemplateLanguage;
//       const messageComponents = campaignData.messageComponents || [];

//       // await this.WhatsAppService.sendTemplateMessage(
//       //   queueItem.vendorId,
//       //   queueItem.phoneWithCountryCode,
//       //   templateProforma,
//       //   whatsAppTemplateLanguage,
//       //   messageComponents,
//       //   fromPhoneNumberId,
//       // );

//       // //  Delete the queue record after success
//       // await this.prisma.whatsAppMessageQueue.delete({
//       //   where: { id: queueItem.id },
//       // });

//       await this.prisma.$transaction(async (tx) => {
//           await tx.whatsAppMessageQueue.update({
//             where: { id: queueItem.id },
//             data: {
//               status: 2, // mark as processing
//               updatedAt: new Date(),
//             },
//           });

//           await this.WhatsAppService.sendTemplateMessage(
//             queueItem.vendorId,
//             queueItem.phoneWithCountryCode,
//             templateProforma,
//             whatsAppTemplateLanguage,
//             messageComponents,
//             fromPhoneNumberId,
//           );

//           await tx.whatsAppMessageQueue.delete({
//             where: { id: queueItem.id },
//           });
//         });

//       this.logger.log(`Sent and deleted queue ID ${queueItem.id}`);
//     } catch (error) {
//       this.logger.error(` Error in queue ID ${queueItem.id}: ${error.message}`);

//       // Update status to failed and increment retry count
//       await this.prisma.whatsAppMessageQueue.update({
//         where: { id: queueItem.id },
//         data: {
//           status: 3,
//           updatedAt: new Date(),
//           retries: (queueItem.retries ?? 0) + 1,
//         },
//       });
//     }
//   }
// }

async processCampaignQueue(): Promise<void> {
  // 1. Get 50 pending messages
  const allPendingMessages = await this.prisma.whatsAppMessageQueue.findMany({
    where: { status: 1 },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  this.logger.log(`Found ${allPendingMessages.length} pending messages to process.`);

  for (const queueItem of allPendingMessages) {
    try {
      // 2. Lock the item first (skip if another worker already picked it)
      const lockResult = await this.prisma.whatsAppMessageQueue.updateMany({
        where: {
          id: queueItem.id,
          status: 1,
        },
        data: {
          status: 2,
          updatedAt: new Date(),
        },
      });

      if (lockResult.count === 0) {
        this.logger.warn(`Queue ID ${queueItem.id} already processed by another worker. Skipping.`);
        continue;
      }

      // 3. Parse and validate raw data
      const rawData = queueItem.data;

      if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
        throw new Error('Invalid JSON format in `data` field');
      }

      this.logger.warn(`Raw Queue Data [ID ${queueItem.id}]: ${JSON.stringify(queueItem.data, null, 2)}`);

      const data = rawData as any;
      const campaignData = data.campaign_data;
      const fromPhoneNumberId = campaignData?.fromPhoneNumberId;

      if (!fromPhoneNumberId) {
        this.logger.warn(`Missing fromPhoneNumberId in queue ID ${queueItem.id}. Skipping.`);
        continue;
      }

      const templateProforma = campaignData?.whatsAppTemplateName;
      const whatsAppTemplateLanguage = campaignData?.whatsAppTemplateLanguage;
      const messageComponents = campaignData?.messageComponents || [];

      // 4. Send message
      const sendMessageResult = await this.WhatsAppService.sendTemplateMessage(
        queueItem.vendorId,
        queueItem.phoneWithCountryCode,
        templateProforma,
        whatsAppTemplateLanguage,
        messageComponents,
        fromPhoneNumberId,
        
      );


      const messageResponseStatus = sendMessageResult?.messages?.[0]?.id ? 'accepted' : null;



    const logPayload = {
        uid: uuidv4(),
        vendorId: queueItem.vendorId,
        status: messageResponseStatus,
        contactId: queueItem.contactId,
        campaignId: queueItem.campaignId,
        wabPhoneNumberId: Number(fromPhoneNumberId),
        isIncomingMessage: 0,
        contactWaId: sendMessageResult?.contacts?.[0]?.wa_id,
        wamid: sendMessageResult?.messages?.[0]?.id,
        data: JSON.stringify({
          initial_response: sendMessageResult,
          template_proforma: templateProforma,
          template_components: messageComponents,
          
        }),
      };

      const logMessage = await this.MessageLogRepository.create(logPayload);

   


      // 5. Delete on success
      await this.prisma.whatsAppMessageQueue.delete({
        where: { id: queueItem.id },
      });

      this.logger.log(`Sent and deleted queue ID ${queueItem.id}`);

    } catch (error) {
      this.logger.error(` Error in queue ID ${queueItem.id}: ${error.message}`);

      // 6. On failure: mark as failed and increment retry count
      await this.prisma.whatsAppMessageQueue.update({
        where: { id: queueItem.id },
        data: {
          status: 3,
          retries: (queueItem.retries ?? 0) + 1,
          updatedAt: new Date(),
        },
      });
    }
  }
}


  }
