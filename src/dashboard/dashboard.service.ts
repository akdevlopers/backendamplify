// src/dashboard/dashboard.service.ts
import { Injectable,NotFoundException,BadRequestException} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import * as CryptoJS from 'crypto-js';
import { NewFieldDto} from './dto/dashboard.dto';
import { v4 as uuidv4 } from 'uuid';

const SECRET_KEY = process.env.SECRET_KEY || '48962874218962874213689687';

export function encryptField(value: any): string | undefined {
  if (value === null || value === undefined) return undefined;
  const stringValue = String(value);
  return CryptoJS.AES.encrypt(stringValue, SECRET_KEY).toString();
}

export function decryptField(encryptedValue: string): string | undefined {
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
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('abandonedQueue') private readonly abandonedQueue: Queue
  ) {}

async getDashboardStats(vendorId: string) {
  if (!vendorId || vendorId.trim() === '') {
    throw new BadRequestException('Vendor ID is missing');
  }

  // ✅ Correct Prisma query (use model field name `uid`)
  const vendor = await this.prisma.vendors.findUnique({
    where: { uid: vendorId },
  });

  if (!vendor) {
    throw new NotFoundException('Vendor not found');
  }

  // ✅ Get vendor name from users table
  const user = await this.prisma.users.findFirst({
    where: { vendors__id: vendor.id },
    select: { first_name: true, last_name: true },
  });

  const vendorName = user
    ? `${user.first_name} ${user.last_name}`.trim()
    : 'N/A';

  const [contacts, groups, campaigns, templates, vendorSettings, messagesInQueue, processedMessages] = await Promise.all([
    this.prisma.contacts.count({ where: { vendorId: vendor.id } }),
    this.prisma.contact_groups.count({ where: { vendors__id: vendor.id } }),
    this.prisma.campaigns.count({ where: { vendorId: vendor.id } }),
    this.prisma.whatsappTemplate.count({ where: { vendorId: vendor.id } }),
    this.prisma.vendorSettings.findMany({
      where: {
        vendors__id: vendor.id,
        name: {
          in: [
            'whatsapp_access_token',
            'whatsapp_business_account_id',
            'current_phone_number_id',
          ],
        },
      },
    }),
    this.prisma.whatsAppMessageQueue.count({ where: { vendorId: vendor.id } }),
    this.prisma.whatsAppMessageLog.count({ where: { vendorId: vendor.id } }),
  ]);

  const requiredSettings = ['whatsapp_access_token', 'whatsapp_business_account_id', 'current_phone_number_id'];
  const settingsMap = new Map(vendorSettings.map(setting => [setting.name, setting.value]));

  const whatsappConfigured = requiredSettings.every(key => {
    const val = settingsMap.get(key);
    return val !== undefined && val !== null && val !== '';
  });

  return {
    vendorName,
    contacts,
    groups,
    campaigns,
    templates,
    messagesInQueue,
    processedMessages,
    whatsappConfigured,
  };
}


async CheckWhatsappOnboardSetup(vendorId: string) {
  if (!vendorId || vendorId.trim() === '') {
    throw new BadRequestException('Vendor ID is missing');
  }

  // ✅ Correct Prisma query (use model field name `uid`)
  const vendor = await this.prisma.vendors.findUnique({
    where: { uid: vendorId },
  });

  if (!vendor) {
    throw new NotFoundException('Vendor not found');
  }

  // ✅ Get vendor name from users table
  const user = await this.prisma.users.findFirst({
    where: { vendors__id: vendor.id },
    select: { first_name: true, last_name: true },
  });


  const [contacts, groups, campaigns, templates, vendorSettings, messagesInQueue, processedMessages] = await Promise.all([
    this.prisma.contacts.count({ where: { vendorId: vendor.id } }),
    this.prisma.contact_groups.count({ where: { vendors__id: vendor.id } }),
    this.prisma.campaigns.count({ where: { vendorId: vendor.id } }),
    this.prisma.whatsappTemplate.count({ where: { vendorId: vendor.id } }),
    this.prisma.vendorSettings.findMany({
      where: {
        vendors__id: vendor.id,
        name: {
          in: [
            'whatsapp_access_token',
            'whatsapp_business_account_id',
            'current_phone_number_id',
          ],
        },
      },
    }),
    this.prisma.whatsAppMessageQueue.count({ where: { vendorId: vendor.id } }),
    this.prisma.whatsAppMessageLog.count({ where: { vendorId: vendor.id } }),
  ]);

  const requiredSettings = ['whatsapp_access_token', 'whatsapp_business_account_id', 'current_phone_number_id'];
  const settingsMap = new Map(vendorSettings.map(setting => [setting.name, setting.value]));

  const whatsappConfigured = requiredSettings.every(key => {
    const val = settingsMap.get(key);
    return val !== undefined && val !== null && val !== '';
  });

  return {
    whatsappConfigured,
  };
}



    // async getDashboardStats(vendorId: string) {
    //   // Verify the vendor exists first
    //   const vendor = await this.prisma.vendors.findUnique({
    //     where: { uid: vendorId },
    //   });

    //   if (!vendor) {
    //     throw new Error('Invalid vendor ID');
    //   }
    //    // Get vendor name from users table using vendor.id
    //     const user = await this.prisma.users.findFirst({
    //       where: { vendors__id: vendor.id },
    //       select: { first_name: true, last_name: true },
    //     });

    //     const vendorName = user
    //       ? `${user.first_name} ${user.last_name}`.trim()
    //       : 'N/A';


    //   // Fetch counts from different tables
    //   const [contacts, groups, campaigns, templates] = await Promise.all([
    //     this.prisma.contacts.count({ where: { vendorId: vendor.id } }),
    //     this.prisma.contact_groups.count({ where: { vendors__id: vendor.id } }),
    //     this.prisma.campaigns.count({ where: { vendorId: vendor.id } }),
    //     this.prisma.whatsappTemplate.count({ where: { vendorId: vendor.id } }),
    //   ]);

    //   // Get queue stats
    //   const jobCounts = await this.abandonedQueue.getJobCounts();
    //   const messagesInQueue = jobCounts.waiting + jobCounts.delayed;
    //   const processedMessages = jobCounts.completed;

    //   return {
    //     vendorName,
    //     contacts,
    //     groups,
    //     campaigns,
    //     templates,
    //     messagesInQueue,
    //     processedMessages,
    //   };
    // }

    async saveVendorSettings(dto: NewFieldDto) {

      const vendorId = await this.prisma.vendors.findUnique({
        where: { uid: dto.vendor_uid },
      });

      if (!vendorId) {
       return 'Invalid Vendor UID';
      }
        

        const settings = [
          { name: 'contact_email', value: dto.contact_email },
          { name: 'contact_phone', value: dto.contact_phone },
          { name: 'address', value: dto.address },
          { name: 'postal_code', value: dto.postal_code },
          { name: 'city', value: dto.city },
          { name: 'state', value: dto.state },
          { name: 'country', value: dto.country },
          { name: 'default_language', value: dto.default_language },
          { name: 'timezone', value: dto.timezone },
        ];

        const filtered = settings
          .filter(s => s.value !== undefined && s.value !== null)
          .map(s => ({
            uid: uuidv4(),
            vendors__id: vendorId.id,
            name: s.name,
            value: String(s.value),  
            data_type: 1,
          }));

        for (const setting of filtered) {
          await this.prisma.vendorSettings.upsert({
            where: {
              vendors__id_name: {
                vendors__id: vendorId.id,
                name: setting.name,
              },
            },
            update: {
              value: setting.value,
              updated_at: new Date(),
            },
            create: {
              ...setting,
              created_at: new Date(),
            },
          });
        }

        return { message: 'Vendor settings saved successfully' };
      }

          // async getVendorSettings(vendorUid: string) {
          //   if (!vendorUid) {
          //     throw new Error('Vendor UID is missing.');
          //   }

          //   const vendor = await this.prisma.vendors.findUnique({
          //     where: { uid: vendorUid },
          //   });

          //   if (!vendor) {
          //     throw new Error('Invalid Vendor UID');
          //   }

          //   // Define all required keys
          //   const requiredKeys = [
          //     'contact_email',
          //     'contact_phone',
          //     'address',
          //     'postal_code',
          //     'city',
          //     'state',
          //     'country',
          //     'default_language',
          //     'timezone',
          //   ];

          //   // Fetch available settings from DB
          //   const settings = await this.prisma.vendorSettings.findMany({
          //     where: {
          //       vendors__id: vendor.id,
          //       name: { in: requiredKeys },
          //     },
          //     select: { name: true, value: true },
          //   });

          //   // Convert found settings to object
          //   const foundSettingsMap = settings.reduce((acc, setting) => {
          //     if (setting.name) {
          //       acc[setting.name] = setting.value ?? '';
          //     }
          //     return acc;
          //   }, {} as Record<string, string>);

          //   // Build full map ensuring all keys exist
          //   const fullSettings = requiredKeys.reduce((acc, key) => {
          //     acc[key] = foundSettingsMap[key] ?? '';
          //     return acc;
          //   }, {} as Record<string, string>);

          //   return {
          //     vendorId: vendor.id,
          //     vendorUid: vendorUid,
          //     settings: fullSettings,
          //   };
          // }

          async getVendorSettings(vendorUid: string) {
            if (!vendorUid) {
              throw new Error('Vendor UID is missing.');
            }

            const vendor = await this.prisma.vendors.findUnique({
              where: { uid: vendorUid },
              select: {
                id: true,
                uid: true,
                title: true, // vendor name
              },
            });

            if (!vendor) {
              throw new Error('Invalid Vendor UID');
            }

            const requiredKeys = [
              'contact_email',
              'contact_phone',
              'address',
              'postal_code',
              'city',
              'state',
              'country',
              'default_language',
              'timezone',
            ];

            const settings = await this.prisma.vendorSettings.findMany({
              where: {
                vendors__id: vendor.id,
                name: { in: requiredKeys },
              },
              select: { name: true, value: true },
            });

            // Convert settings to map
            const foundSettingsMap = settings.reduce((acc, setting) => {
              if (setting.name) {
                acc[setting.name] = setting.value ?? '';
              }
              return acc;
            }, {} as Record<string, string>);

            // Build full settings map, ensuring defaults for missing keys
            const fullSettings = requiredKeys.reduce((acc, key) => {
              acc[key] = foundSettingsMap[key] ?? '';
              return acc;
            }, {} as Record<string, string>);

            // Include vendor title as `name` in settings
            fullSettings['name'] = vendor.title;

            return {
              vendorId: vendor.id,
              vendorUid: vendor.uid,
              settings: fullSettings,
            };
          }


}
