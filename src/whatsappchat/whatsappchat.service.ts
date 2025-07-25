import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { EncryptionService } from '../common/encryption/encryption.service';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';
import { fileTypeFromBuffer } from 'file-type';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { PusherService } from 'src/pusher/pusher.service';

@Injectable()
export class WhatsappchatService {
  private readonly baseApiEndpoint = process.env.BASE_API_ENDPOINT;

  constructor(
    private prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly pusherService: PusherService,
    private readonly httpService: HttpService, // ✅ properly injected
  ) {}

  async getLogsByContactId(contactId: number) {
    return this.prisma.whatsAppMessageLog.findMany({
      where: { contactId: contactId },
    });
  }
      async sendMessageToContact(contactId: number, messageData: any): Promise<{
        success: boolean;
        statusCode: number;
        message: string;
        data?: any;
      }> {
        try {
          // ✅ Step 1: Get contact details
          const contact = await this.prisma.contacts.findUnique({
            where: { id: contactId },
            select: { vendorId: true, wa_id: true },
          });

          if (!contact) {
            return {
              success: false,
              statusCode: 404,
              message: `Contact with ID ${contactId} not found`,
            };
          }

          if (!contact.wa_id) {
            return {
              success: false,
              statusCode: 400,
              message: `Contact's WhatsApp ID not found`,
            };
          }

          if (!contact.vendorId) {
            return {
              success: false,
              statusCode: 400,
              message: `Vendor ID is missing for this contact`,
            };
          }

          // ✅ Step 2: Insert WhatsApp log
          const message = await this.prisma.whatsAppMessageLog.create({
            data: {
              uid: uuidv4(),
              contactId,
              vendorId: contact.vendorId,
              message: messageData.message || null,
              isIncomingMessage: 0,
              messagedAt: new Date(),
              data: messageData ? JSON.stringify(messageData) : null,
            },
          });

          // ✅ Step 3: Get vendor settings
          const vendorSettingsRecord = await this.prisma.vendorSettings.findMany({
            where: {
              vendors__id: contact.vendorId,
              name: {
                in: [
                  'whatsapp_access_token',
                  'whatsapp_business_account_id',
                  'current_phone_number_id',
                ],
              },
            },
          });

          if (vendorSettingsRecord.length < 3) {
            return {
              success: false,
              statusCode: 400,
              message: 'Required WhatsApp settings not found',
            };
          }

          const accessTokenRecord = vendorSettingsRecord.find(
            (item) => item.name === 'whatsapp_access_token',
          );
          const wabaidRecord = vendorSettingsRecord.find(
            (item) => item.name === 'whatsapp_business_account_id',
          );
          const phonenumberidRecord = vendorSettingsRecord.find(
            (item) => item.name === 'current_phone_number_id',
          );

          if (!accessTokenRecord || !wabaidRecord || !phonenumberidRecord) {
            return {
              success: false,
              statusCode: 400,
              message: 'Missing one or more WhatsApp configuration settings',
            };
          }

          const accessToken = this.encryptionService.decrypt(accessTokenRecord.value);
          const phoneNumberId = this.encryptionService.decrypt(phonenumberidRecord.value);
          const toNumber = await this.encryptionService.decryptUniversal(contact.wa_id);

          // ✅ Step 4: Send to WhatsApp API
          const sendResult = await this.sendToWhatsApp(
            toNumber,
            // "916380768369",
            messageData,
            accessToken,
            phoneNumberId,
          );

          if (!sendResult.success) {
            return {
              success: false,
              statusCode: sendResult.statusCode || 500,
              message: sendResult.message || 'Failed to send WhatsApp message',
            };
          }

          // ✅ Step 5: Trigger real-time update
          await this.pusherService.trigger(
            `chat-${contactId}`,
            'new-message',
            message,
          );
          
          // ✅ Final success response
          return {
            success: true,
            statusCode: 200,
            message: 'Message sent successfully',
            data: message,
          };
        } catch (error) {
          console.error('Error in sendMessageToContact:', error);

          return {
            success: false,
            statusCode: 500,
            message: 'Internal server error: ' + error.message,
          };
        }
      }

  // async sendMessageToContact(contactId: number, messageData: any) {
  //   try {
  //     const contact = await this.prisma.contacts.findUnique({
  //       where: { id: contactId },
  //       select: { vendorId: true, wa_id: true },
  //     });

  //     // if (!contact) throw new Error(`Contact with ID ${contactId} not found`);
  //     // if (!contact.wa_id) throw new Error(`Contact's WhatsApp ID not found`);
  //     if (!contact) {
  //         return {
  //           success: false,
  //           statusCode: 200,
  //           message: `Contact with ID ${contactId} not found`,
  //         };
  //       }

  //       if (!contact.wa_id) {
  //         return {
  //           success: false,
  //           statusCode: 200,
  //           message: `Contact's WhatsApp ID not found`,
  //         };
  //     }

  //     const message = await this.prisma.whatsAppMessageLog.create({
  //       data: {
  //         uid: uuidv4(),
  //         contactId: contactId,
  //         vendorId: contact.vendorId ,
  //         message: messageData.message || null, // For media, this can be null
  //         isIncomingMessage: 0,
  //         messagedAt: new Date(),
  //          data: messageData ? JSON.stringify(messageData) : null,
  //       },
  //     });

  //      if (!contact.vendorId) {
  //           return {
  //             success: false,
  //             statusCode: 200,
  //             message: `Vendor ID is missing for this contact`,
  //           };
  //         }



  //     const vendorSettingsRecord = await this.prisma.vendorSettings.findMany({
  //       where: {
  //         vendors__id: contact.vendorId,
  //         name: {
  //           in: ['whatsapp_access_token', 'whatsapp_business_account_id','current_phone_number_id'],
  //         },
  //       },
  //     });

  //     if (!vendorSettingsRecord || vendorSettingsRecord.length < 3) {
  //         return {
  //           success: false,
  //           statusCode: 200,
  //           message: 'Required WhatsApp settings not found',
  //         };
  //       }
       
  //     const accessTokenRecord = vendorSettingsRecord.find(item => item.name === 'whatsapp_access_token');
  //     const wabaidRecord = vendorSettingsRecord.find(item => item.name === 'whatsapp_business_account_id') ?? "";
  //     const phonenumberidRecord = vendorSettingsRecord.find(item => item.name === 'current_phone_number_id') ?? "";

  //     if (!accessTokenRecord || !wabaidRecord || !phonenumberidRecord) {
  //           return {
  //             success: false,
  //             statusCode: 200,
  //             message: 'Missing one or more required WhatsApp configuration settings',
  //           };
  //         }
  //     const accessToken = this.encryptionService.decrypt(accessTokenRecord.value);
  //     const waba_id = this.encryptionService.decrypt(wabaidRecord.value);
  //     const phoneNumberId = this.encryptionService.decrypt(phonenumberidRecord.value);
  //     // const accessToken =
  //     //   'EAAEld8IVVLwBO0Dqtw1P2J53Pnbstjd9cNSvjvwjDj2IiwelQUtwQBuFYxA3YViVjVg3mgPEKpNOANuw3RmmH3PKpMul4YbFEtKEah1LZCTFv17Q1yZB1oCWcfLoG4xcfi0vX4EEwob14EHjWfnZBT6dFHCQorDEAGsAfj4TcctPd5WMzUMnpQWHsfMtB5KZChhdO6orXrdc9OZBe6rI8zC7v051bqhCKPOS6nDkCOH0lBQoGAnsRVKO9JzM4';
  //     // const phoneNumberId = '486627354535571';

  //     await this.pusherService.trigger(
  //       `chat-${contactId}`,
  //       'new-message',
  //       message,
  //     );
  //     const tonumber=await this.encryptionService.decryptUniversal(contact.wa_id);

  //     await this.sendToWhatsApp(
  //       // tonumber, 
  //       '91', // or contact.wa_id
  //       // '916380768369', // or contact.wa_id
  //       messageData,
  //       accessToken,
  //       phoneNumberId,
  //     );

  //      return {
  //         success: true,
  //         statusCode: 200,
  //         message: 'Message sent successfully',
  //         data: message,
  //       };
  //   } catch (error) {
  //     console.error('Error sending message:', error);
  //      return {
  //         success: false,
  //         statusCode: 500,
  //         message: 'Internal Server Error: ' + error.message,
  //       };
  //   }
  // }

  // private async sendToWhatsApp(
  //   to: string,
  //   messageData: any,
  //   token: string,
  //   phoneNumberId: string,
  // ) {
  //   if (!this.baseApiEndpoint) {
  //     throw new Error('WhatsApp API endpoint not configured.');
  //   }

  //   const url = `${this.baseApiEndpoint}/${phoneNumberId}/messages`;

  //   let payload: any = {
  //     messaging_product: 'whatsapp',
  //     to,
  //   };

  //   if (['image', 'video', 'audio', 'document'].includes(messageData.type)) {
  //     const mediaLink = messageData.media.url;
  //     // const mediaLink = "https://file-examples.com/storage/feac45e876684fd51a206f4/2017/04/file_example_MP4_480_1_5MG.mp4";

  //     payload.type = messageData.type;
  //     payload[messageData.type] = {
  //       link: mediaLink,
  //     };

  //     if (messageData.media.caption) {
  //       payload[messageData.type].caption = messageData.media.caption;
  //     }
  //   } else {
  //     payload.type = 'text';
  //     payload.text = { body: messageData.message };
  //   }

  //   const headers = {
  //     Authorization: `Bearer ${token}`,
  //     'Content-Type': 'application/json',
  //   };

  //   try {
  //     const response = await firstValueFrom(
  //       this.httpService.post(url, payload, { headers }),
  //     );
  //     console.log('✅ WhatsApp message sent:', response.data);
  //     console.log('✅ Payload message sent:', payload);
  //   } catch (error) {
  //     console.error(
  //       'WhatsApp API Error:',
  //       error.response?.data || error.message,
  //     );
  //     console.log('Error Payload message sent:', payload);
  //     throw new HttpException(
  //       error.response?.data || 'Failed to send WhatsApp message',
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }
          private async sendToWhatsApp(
          to: string,
          messageData: any,
          token: string,
          phoneNumberId: string,
        ): Promise<{ success: boolean; message?: string; statusCode?: number }> {
          if (!this.baseApiEndpoint) {
            return {
              success: false,
              message: 'WhatsApp API endpoint not configured.',
              statusCode: 500,
            };
          }

          const url = `${this.baseApiEndpoint}/${phoneNumberId}/messages`;

          let payload: any = {
            messaging_product: 'whatsapp',
            to,
          };

          if (['image', 'video', 'audio', 'document'].includes(messageData.type)) {
            const mediaLink = messageData.media.url;

            payload.type = messageData.type;
            payload[messageData.type] = {
              link: mediaLink,
            };

            if (messageData.media.caption) {
              payload[messageData.type].caption = messageData.media.caption;
            }
          } else {
            payload.type = 'text';
            payload.text = { body: messageData.message };
          }

          const headers = {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          };

          try {
            const response = await firstValueFrom(
              this.httpService.post(url, payload, { headers }),
            );
            console.log('✅ WhatsApp message sent:', response.data);
            console.log('✅ Payload message sent:', payload);

            return { success: true }; // ✅ success
          } catch (error) {
            console.error(
              'WhatsApp API Error:',
              error.response?.data || error.message,
            );
            console.log('Payload that caused error:', payload);

            return {
              success: false,
              message: error.response?.data?.error?.message || 'Failed to send WhatsApp message',
              statusCode: 500,
            };
          }
        }


    async getChatContacts(page: number, limit: number, vendorUid) {
        
        const skip = (page - 1) * limit;
        if (!vendorUid) {
            throw new BadRequestException('Invalid vendorId');
        }
        try{
            const vendorRecord = await this.prisma.vendors.findFirst({
                where: {
                uid: vendorUid,
                },
            });

            if (!vendorRecord) {
                return 'Invalid Vendor UID';
            }

            const vendorID=vendorRecord.id;

        //  const latestContacts = await this.prisma.$queryRaw`
        //     SELECT m.contacts__id
        //     FROM whatsapp_message_logs m
        //     INNER JOIN (
        //         SELECT contacts__id, MAX(_id) AS max_id
        //         FROM whatsapp_message_logs
        //         WHERE vendors__id = ${vendorID}
        //         GROUP BY contacts__id
        //     ) sub ON m.contacts__id = sub.contacts__id AND m._id = sub.max_id
        //     ORDER BY m._id DESC
        //     LIMIT ${limit} OFFSET ${skip};
        //     `;
        const latestContacts = await this.prisma.$queryRaw<
  Array<{
    contacts__id: number;
    contact_id: number;
    contactfirstName: string;
    contactLastName: string;
    phoneNumber: string;
  }>
>`
            SELECT m.contacts__id, c._id AS contact_id, c.first_name as contactfirstName,c.last_name as contactLastName,c.wa_id as phoneNumber
            FROM whatsapp_message_logs m
            INNER JOIN (
                SELECT contacts__id, MAX(_id) AS max_id
                FROM whatsapp_message_logs
                WHERE vendors__id = ${vendorID}
                GROUP BY contacts__id
            ) sub ON m.contacts__id = sub.contacts__id AND m._id = sub.max_id
            JOIN contacts c ON m.contacts__id = c._id
            ORDER BY m._id DESC
            LIMIT ${limit} OFFSET ${skip};
            `;

            const latestContactsCount = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) AS count
            FROM whatsapp_message_logs m
            INNER JOIN (
                SELECT contacts__id, MAX(_id) AS max_id
                FROM whatsapp_message_logs
                WHERE vendors__id = ${vendorID}
                GROUP BY contacts__id
            ) sub ON m.contacts__id = sub.contacts__id AND m._id = sub.max_id
            JOIN contacts c ON m.contacts__id = c._id
            ORDER BY m._id DESC
            `;

            type MsgInfo = {
                contact_id: number;
                contactfirstName: string;
                contactLastName: string;
                phoneNumber: string;
                lastMessageTime: string;
                unreadCount: number;
            };
            const messagesByContact: MsgInfo[] = [];
            for (const contact of latestContacts) {
                const contactId = contact.contacts__id;
                // messagesByContact['contact_id'] = contact.contacts__id;
                // messagesByContact['contactfirstName'] = contact.contactfirstName;
                // messagesByContact['contactLastName'] = contact.contactLastName;
                // messagesByContact['phoneNumber'] = normalizePhoneNumber(contact.phoneNumber);
                const [messageMeta] = await this.prisma.$queryRaw<
                    Array<{
                    lastMessageTime: Date;
                    unreadCount: number;
                    }>
                >`
                    SELECT
                    MAX(messaged_at) AS lastMessageTime,
                    SUM(CASE WHEN status != 0 and is_incoming_message =1 THEN 1 ELSE 0 END) AS unreadCount
                    FROM whatsapp_message_logs
                    WHERE contacts__id = ${contactId} AND vendors__id = ${vendorID};
                `;
                // messagesByContact['lastMessageTime'] = getTimeAgo(messageMeta?.lastMessageTime || null);
                // messagesByContact['unreadCount'] = Number(messageMeta?.unreadCount || 0);

                //   const info: MsgInfo = {
                //     contact_id: contact.contacts__id,
                //     contactfirstName: await this.encryptionService.decryptUniversal(contact.contactfirstName),
                //     contactLastName: await this.encryptionService.decryptUniversal(contact.contactLastName),
                //     phoneNumber:await this.encryptionService.decryptUniversal(contact.phoneNumber),
                //     lastMessageTime: getTimeAgo(messageMeta?.lastMessageTime || null),
                //     unreadCount: Number(messageMeta?.unreadCount || 0),
                // };

                const info: MsgInfo = {
                    contact_id: contact.contacts__id,
                    contactfirstName: contact.contactfirstName
                      ? await this.encryptionService.decryptUniversal(contact.contactfirstName)
                      : '',
                    contactLastName: contact.contactLastName
                      ? await this.encryptionService.decryptUniversal(contact.contactLastName)
                      : '',
                    phoneNumber: contact.phoneNumber
                      ? await this.encryptionService.decryptUniversal(contact.phoneNumber)
                      : '',
                    lastMessageTime: getTimeAgo(messageMeta?.lastMessageTime || null),
                    unreadCount: Number(messageMeta?.unreadCount || 0),
                  };


                messagesByContact.push(info);
            };
                

        const total = Number(latestContactsCount[0].count);

        return {
            messagesByContact,
            meta: {
            total,
            page,
            lastPage: Math.ceil(total / limit),
            },
        };
        } catch (error) {
            console.error('Error fetching templates:', error.message);
            console.error('Stack Trace:', error.stack);
            throw new InternalServerErrorException({
                message: 'Unable to fetch templates',
                reason: error.message,
                stack: error.stack, // optional
            });
        }
    }
}
export function normalizePhoneNumber(phone: string): string {
  if (phone.startsWith('91')) {
    return phone.slice(2);
  }
  return phone;
}
function getTimeAgo(dateString){
     const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  const weeks = Math.floor(diffInSeconds / (7 * 24 * 60 * 60));
  const days = Math.floor((diffInSeconds % (7 * 24 * 60 * 60)) / (24 * 60 * 60));
  const hours = Math.floor((diffInSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((diffInSeconds % (60 * 60)) / 60);
  const seconds = diffInSeconds % 60;

  const parts: string[] = []; // Make sure parts is typed as string[]

  if (weeks > 0) parts.push(`${weeks} week${weeks > 1 ? 's' : ''}`);
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} min${minutes > 1 ? 's' : ''}`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} second${seconds > 1 ? 's' : ''}`);

  return parts.join(' ') + ' ago';
}
