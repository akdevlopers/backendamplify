import { Injectable, HttpException, HttpStatus,BadRequestException } from '@nestjs/common';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { WhatsappSettingDto } from './dto/whatsappsetup.dto';
import { v4 as uuidv4 } from 'uuid';
import { EncryptionService } from '../common/encryption/encryption.service';
import { PusherService } from 'src/pusher/pusher.service';
import * as fs from 'fs';
import * as path from 'path';
import { MyLogger } from '../logger.service';
import { ShopifyService } from 'src/shopify/shopify.service';
dotenv.config();

@Injectable()

export class WhatsappSetupService {
  private readonly baseApiEndpoint = process.env.BASE_API_ENDPOINT;
  private readonly appId = process.env.EMBEDDED_SIGNUP_APP_ID ?? '';
  private readonly appSecret = process.env.EMBEDDED_SIGNUP_APP_SECRET ?? '';
   private readonly BASE_URL = 'https://back.salegrowy.com/public/uploads';
  

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly PusherService: PusherService,
    private readonly logger: MyLogger,
    private readonly ShopifyService: ShopifyService,
  ) {}

    async saveDefaultNumber(vendorUid: string, phoneNumberId: number) {
      try {
        if (!vendorUid || !phoneNumberId) {
          return { success: false, message: 'VendorUid and phoneNumberId are required' };
        }

        // Get vendor by UID
        const vendorRecord = await this.prisma.vendors.findFirst({
          where: { uid: vendorUid }
        });

        if (!vendorRecord) {
          return { success: false, message: 'Invalid Vendor UID' };
        }

        const vendorID = vendorRecord.id;

        // Get whatsapp_phone_numbers
        const phoneNumbersSetting = await this.prisma.vendorSettings.findFirst({
          where: {
            vendors__id: vendorID,
            name: 'whatsapp_phone_numbers',
          },
        });

        if (!phoneNumbersSetting || !phoneNumbersSetting.value) {
          return { success: false, message: 'Whatsapp phone numbers not found' };
        }

        let whatsappPhoneNumbers: any[] = [];
        try {
          whatsappPhoneNumbers = JSON.parse(phoneNumbersSetting.value);
        } catch (err) {
          return { success: false, message: 'Invalid whatsapp_phone_numbers data' };
        }

        // Find the selected verified number
        const selectedNumber = whatsappPhoneNumbers.find(
          p => p.id == phoneNumberId && p.code_verification_status === 'VERIFIED'
        );

        if (!selectedNumber) {
          return { success: false, message: 'Selected verified phone number not found' };
        }

        // Encrypt values
        const encryptedPhoneId = this.encryptionService.encrypt(selectedNumber.id);
        const encryptedPhoneNumber = this.encryptionService.encrypt(
          selectedNumber.display_phone_number.replace(/\D/g, '')
        );

        // Save encrypted values into vendorSettings
        await this.prisma.vendorSettings.upsert({
          where: {
            vendors__id_name: {
              vendors__id: vendorID,
              name: 'current_phone_number_id',
            },
          },
          update: { value: encryptedPhoneId },
          create: {
            vendors__id: vendorID,
            name: 'current_phone_number_id',
            value: encryptedPhoneId,
          },
        });

        await this.prisma.vendorSettings.upsert({
          where: {
            vendors__id_name: {
              vendors__id: vendorID,
              name: 'current_phone_number_number',
            },
          },
          update: { value: encryptedPhoneNumber },
          create: {
            vendors__id: vendorID,
            name: 'current_phone_number_number',
            value: encryptedPhoneNumber,
          },
        });

        return {
          success: true,
          message: 'Default WhatsApp number saved successfully',
        };
      } catch (err) {
        console.error('Error saving default number:', err);
        return { success: false, message: 'Something went wrong while saving default number' };
      }
    }



   async processEmbeddedSignUp(request_code,waba_id,phone_number_id,vendorUid){
    try {
       if (!request_code || !waba_id || !phone_number_id || !vendorUid) {
          throw new HttpException('All parameters are required and must not be empty',HttpStatus.BAD_REQUEST);
        }
        
      const vendorRecord = await this.prisma.vendors.findFirst({
        where: {
          uid: vendorUid,
        },
      });

      if (vendorRecord) {
        
      } else {

        return 'Invalid Vendor UID';
      }

      const vendorID=vendorRecord.id;
    

      // Step 1: Generate Access Token
      const tokenResponse = await axios.post(
        `${this.baseApiEndpoint}oauth/access_token`,
        null,
        {
          params: {
            client_id: this.appId,
            client_secret: this.appSecret,
            code: request_code,
          },
        },
      );
      
      const accessToken = tokenResponse.data.access_token;
      if (!accessToken) {
        throw new HttpException('Failed to get Access token', HttpStatus.BAD_REQUEST);
      }
      const encryptedAccessToken=this.encryptionService.encrypt(accessToken);
      const encryptedwaba_id=this.encryptionService.encrypt(waba_id);
      const encryptedphone_number_id=this.encryptionService.encrypt(phone_number_id);
      const encryptedfacebook_app_id=this.encryptionService.encrypt(this.appId);
      const encryptedfacebook_app_secret=this.encryptionService.encrypt(this.appSecret);

      await this.prisma.vendorSettings.upsert({
        where: {
          vendors__id_name: {
            vendors__id: vendorID,
            name: 'whatsapp_access_token',
          },
        },
        update: {
          value: encryptedAccessToken,
          status: null,
          data_type: 1,
        },
        create: {
          uid: uuidv4(),
          vendors__id: vendorID,
          name: 'whatsapp_access_token',
          value: encryptedAccessToken,
          status: null,
          data_type: 1,
        },
      });

      await this.prisma.vendorSettings.upsert({
        where: {
          vendors__id_name: {
            vendors__id: vendorID,
            name: 'whatsapp_business_account_id',
          },
        },
        update: {
          value: encryptedwaba_id,
          status: null,
          data_type: 1,
        },
        create: {
          uid: uuidv4(),
          vendors__id: vendorID,
          name: 'whatsapp_business_account_id',
          value: encryptedwaba_id,
          status: null,
          data_type: 1,
        },
      });

      await this.prisma.vendorSettings.upsert({
        where: {
          vendors__id_name: {
            vendors__id: vendorID,
            name: 'current_phone_number_id',
          },
        },
        update: {
          value: encryptedphone_number_id,
          status: null,
          data_type: 1,
        },
        create: {
          uid: uuidv4(),
          vendors__id: vendorID,
          name: 'current_phone_number_id',
          value: encryptedphone_number_id,
          status: null,
          data_type: 1,
        },
      });


      await this.prisma.vendorSettings.upsert({
        where: {
          vendors__id_name: {
            vendors__id: vendorID,
            name: 'facebook_app_id',
          },
        },
        update: {
          value: encryptedfacebook_app_id,
          status: null,
          data_type: 1,
        },
        create: {
          uid: uuidv4(),
          vendors__id: vendorID,
          name: 'facebook_app_id',
          value: encryptedfacebook_app_id,
          status: null,
          data_type: 1,
        },
      });

      await this.prisma.vendorSettings.upsert({
        where: {
          vendors__id_name: {
            vendors__id: vendorID,
            name: 'facebook_app_secret',
          },
        },
        update: {
          value: encryptedfacebook_app_secret,
          status: null,
          data_type: 1,
        },
        create: {
          uid: uuidv4(),
          vendors__id: vendorID,
          name: 'facebook_app_secret',
          value: encryptedfacebook_app_secret,
          status: null,
          data_type: 1,
        },
      });

      // const accessToken = this.encryptionService.decrypt('5ef645ef4fb86dee34311fb538cac1d2a2086249013e47f47595633e14aa0410b307a94aca03140a9969f219680e1f4f595546a1af6685cf1acce944e0ec99a71654e66f4d7ea89fe8c20bfc4778d64c2e2845c3d8e43e6de386bd8200ce307925919440e9c1c7a28b4f9b21df531a9b64fb734afca0e637301291824824f2b8d051b7d2645c51d78a3eb6d4ed51d6e3af2c2473cfb6f4b322adceac1f8a49510d2998585bea2830c5ecca6e49b40b5649aec3dac4e439f6545ee6556e224037866111ef743d348ec5c8af786bab061b62cbf4012a975a249cb2804087438af42770d54d1dcba8fcec711307a0999b59c69e6a29dc43c2ed93debdb37b3a03e2');

      // Step 2: Verify Phone Number Records
      const phoneNumbersResponse = await axios.get(
        `${this.baseApiEndpoint}${waba_id}/phone_numbers`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const phoneNumberRecord = phoneNumbersResponse.data.data.find(
        (number) => number.id === phone_number_id,
      );

      const displayPhoneNumber = phoneNumberRecord?.display_phone_number;
      if (!displayPhoneNumber) {
        throw new Error(`Phone number with id ${phone_number_id} not found.`);
      }
      // Step 3: Register Phone Number if Not Registered
      if (!phoneNumberRecord || phoneNumberRecord.platform_type !== 'CLOUD_API') {
        const phoneRegistration = await axios.post(
          `${this.baseApiEndpoint}${phone_number_id}/register`,
          {
            messaging_product: 'whatsapp',
            pin: '123456',
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
        const phoneRegistrationStatus=phoneRegistration.data.success;

        if (!phoneRegistrationStatus) {
          throw new HttpException('Failed Phone number registration', HttpStatus.BAD_REQUEST);
        }else if(phoneRegistrationStatus != true)
        {
          throw new HttpException('Failed Phone number registration', HttpStatus.BAD_REQUEST);
        }
      }

      await this.prisma.vendorSettings.upsert({
        where: {
          vendors__id_name: {
            vendors__id: vendorID,
            name: 'whatsapp_phone_numbers',
          },
        },
        update: {
          value: JSON.stringify(phoneNumbersResponse.data.data),
          status: null,
          data_type: 1,
        },
        create: {
          uid: uuidv4(),
          vendors__id: vendorID,
          name: 'whatsapp_phone_numbers',
          value: JSON.stringify(phoneNumbersResponse.data.data),
          status: null,
          data_type: 1,
        },
      });

      const encryptedcurrent_phone_number_number=this.encryptionService.encrypt(displayPhoneNumber);

      await this.prisma.vendorSettings.upsert({
        where: {
          vendors__id_name: {
            vendors__id: vendorID,
            name: 'current_phone_number_number',
          },
        },
        update: {
          value: encryptedcurrent_phone_number_number,
          status: null,
          data_type: 1,
        },
        create: {
          uid: uuidv4(),
          vendors__id: vendorID,
          name: 'current_phone_number_number',
          value: encryptedcurrent_phone_number_number,
          status: null,
          data_type: 1,
        },
      });

      const encryptedvendor_api_access_token=this.encryptionService.encrypt(generateSha1Hash(vendorUid));

      await this.prisma.vendorSettings.upsert({
        where: {
          vendors__id_name: {
            vendors__id: vendorID,
            name: 'vendor_api_access_token',
          },
        },
        update: {
          value: encryptedvendor_api_access_token,
          status: null,
          data_type: 1,
        },
        create: {
          uid: uuidv4(),
          vendors__id: vendorID,
          name: 'vendor_api_access_token',
          value: encryptedvendor_api_access_token,
          status: null,
          data_type: 1,
        },
      });


      // Step 4: Subscribe to Webhook

      // Delete the existing override callback webhook URL 
      await axios.post(
        `${this.baseApiEndpoint}${waba_id}/subscribed_apps`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

    // Create or Update New override callback webhook URL 
      const webhookUrl =  `https://back.salegrowy.com/whatsappsetup/whatsappwebhook/${vendorUid}`;
      await axios.post(
        `${this.baseApiEndpoint}${waba_id}/subscribed_apps`,
        {
          override_callback_uri: webhookUrl,
          verify_token: generateSha1Hash(vendorUid),
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      await this.prisma.vendorSettings.upsert({
        where: {
          vendors__id_name: {
            vendors__id: vendorID,
            name: 'webhook_verified_at',
          },
        },
        update: {
          value: new Date().toISOString(),
          status: null,
          data_type: 1,
        },
        create: {
          uid: uuidv4(),
          vendors__id: vendorID,
          name: 'webhook_verified_at',
          value: new Date().toISOString(),
          status: null,
          data_type: 1,
        },
      });

      // Get Details
      const webhookOverrides = axios.get(`${this.baseApiEndpoint}${waba_id}/subscribed_apps`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          // Add your query parameters here
          // For example: key1: 'value1', key2: 'value2'
        },
      });

      await this.refreshHealthStatus(vendorUid);
      
     // Step 5: Finalize Setup
      // Save necessary data to your database or perform additional setup as needed

      return 'You are now connected to WhatsApp Cloud API' ;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }


  async refreshHealthStatus(vendorUid){
    try {
       if (!vendorUid) {
          throw new HttpException('All parameters are required and must not be empty',HttpStatus.BAD_REQUEST);
        }
        
      const vendorRecord = await this.prisma.vendors.findFirst({
        where: {
          uid: vendorUid,
        },
      });

      if (vendorRecord) {
        
      } else {

        return 'Invalid Vendor UID';
      }

      const vendorID=vendorRecord.id;


      const vendorSettingsRecord = await this.prisma.vendorSettings.findMany({
        where: {
          vendors__id: vendorID,
          name: {
            in: ['whatsapp_access_token', 'whatsapp_business_account_id','current_phone_number_id'],
          },
        },
      });

      if (!vendorSettingsRecord || vendorSettingsRecord.length < 3) {
        throw new HttpException('WhatsApp Access Token or WABA ID not found', HttpStatus.BAD_REQUEST);
      }
       
      const accessTokenRecord = vendorSettingsRecord.find(item => item.name === 'whatsapp_access_token');
      const wabaidRecord = vendorSettingsRecord.find(item => item.name === 'whatsapp_business_account_id') ?? "";
      const phonenumberidRecord = vendorSettingsRecord.find(item => item.name === 'current_phone_number_id') ?? "";

      if (!accessTokenRecord || !wabaidRecord || !phonenumberidRecord) {
        throw new HttpException('Required settings not found', HttpStatus.BAD_REQUEST);
      }

      const accessToken = this.encryptionService.decrypt(accessTokenRecord.value);
      const waba_id = this.encryptionService.decrypt(wabaidRecord.value);
      const phone_number_id = this.encryptionService.decrypt(phonenumberidRecord.value);
      // Health Status
      const healthStatus = await axios.get(
        `${this.baseApiEndpoint}${waba_id}/phone_numbers?fields=health_status`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );


      const filteredData = healthStatus.data.data.find(item => item.id === phone_number_id);
      const responseData = healthStatus.data;

      const healthData = {
        [waba_id]: {
          whatsapp_business_account_id: waba_id,
          health_status_updated_at: new Date(),
          health_status_updated_at_formatted:  new Date().toString(),
          health_data: filteredData,
        }
      };
      
      await this.prisma.vendorSettings.upsert({
        where: {
          vendors__id_name: {
            vendors__id: vendorID,
            name: 'whatsapp_health_status_data',
          },
        },
        update: {
          value:JSON.stringify(healthData),
          status: null,
          data_type: 1,
        },
        create: {
          uid: uuidv4(),
          vendors__id: vendorID,
          name: 'whatsapp_health_status_data',
          value: JSON.stringify(healthData),
          status: null,
          data_type: 1,
        },
      });

      return responseData;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  async syncPhoneNumbers(vendorUid){
    try {
       if (!vendorUid) {
          throw new HttpException('All parameters are required and must not be empty',HttpStatus.BAD_REQUEST);
        }
        
      const vendorRecord = await this.prisma.vendors.findFirst({
        where: {
          uid: vendorUid,
        },
      });

      if (vendorRecord) {
        
      } else {

        return 'Invalid Vendor UID';
      }

      const vendorID=vendorRecord.id;


      const vendorSettingsRecord = await this.prisma.vendorSettings.findMany({
        where: {
          vendors__id: vendorID,
          name: {
            in: ['whatsapp_access_token', 'whatsapp_business_account_id','current_phone_number_id'],
          },
        },
      });

      if (!vendorSettingsRecord || vendorSettingsRecord.length < 3) {
        throw new HttpException('WhatsApp Access Token or WABA ID not found', HttpStatus.BAD_REQUEST);
      }
       
      const accessTokenRecord = vendorSettingsRecord.find(item => item.name === 'whatsapp_access_token');
      const wabaidRecord = vendorSettingsRecord.find(item => item.name === 'whatsapp_business_account_id') ?? "";
      const phonenumberidRecord = vendorSettingsRecord.find(item => item.name === 'current_phone_number_id') ?? "";

      if (!accessTokenRecord || !wabaidRecord || !phonenumberidRecord) {
        throw new HttpException('Required settings not found', HttpStatus.BAD_REQUEST);
      }

      const accessToken = this.encryptionService.decrypt(accessTokenRecord.value);
      const waba_id = this.encryptionService.decrypt(wabaidRecord.value);
      const phone_number_id = this.encryptionService.decrypt(phonenumberidRecord.value);

      // Verify Phone Number Records
      const phoneNumbersResponse = await axios.get(
        `${this.baseApiEndpoint}${waba_id}/phone_numbers`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const phoneNumberRecord = phoneNumbersResponse.data.data.find(
        (number) => number.id === phone_number_id,
      );

      const returnphoneNumberRecord = phoneNumbersResponse.data;

      const displayPhoneNumber = phoneNumberRecord?.display_phone_number;
      if (!displayPhoneNumber) {

        const  displayPhoneNumbers = phoneNumbersResponse.data.data[0];
        const displayPhoneNumber=displayPhoneNumbers?.display_phone_number;
        const phone_number_id=displayPhoneNumbers?.id;
        
      }
      // Step 3: Register Phone Number if Not Registered
      if (!phoneNumberRecord || phoneNumberRecord.platform_type !== 'CLOUD_API') {
        const phoneRegistration = await axios.post(
          `${this.baseApiEndpoint}${phone_number_id}/register`,
          {
            messaging_product: 'whatsapp',
            pin: '123456',
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
        const phoneRegistrationStatus=phoneRegistration.data.success;

        if (!phoneRegistrationStatus) {
          throw new HttpException('Failed Phone number registration', HttpStatus.BAD_REQUEST);
        }else if(phoneRegistrationStatus != true)
        {
          throw new HttpException('Failed Phone number registration', HttpStatus.BAD_REQUEST);
        }
      }

      await this.prisma.vendorSettings.upsert({
        where: {
          vendors__id_name: {
            vendors__id: vendorID,
            name: 'whatsapp_phone_numbers',
          },
        },
        update: {
          value: JSON.stringify(phoneNumbersResponse.data.data),
          status: null,
          data_type: 1,
        },
        create: {
          uid: uuidv4(),
          vendors__id: vendorID,
          name: 'whatsapp_phone_numbers',
          value: JSON.stringify(phoneNumbersResponse.data.data),
          status: null,
          data_type: 1,
        },
      });

      const encryptedcurrent_phone_number_number=this.encryptionService.encrypt(displayPhoneNumber);

      await this.prisma.vendorSettings.upsert({
        where: {
          vendors__id_name: {
            vendors__id: vendorID,
            name: 'current_phone_number_number',
          },
        },
        update: {
          value: encryptedcurrent_phone_number_number,
          status: null,
          data_type: 1,
        },
        create: {
          uid: uuidv4(),
          vendors__id: vendorID,
          name: 'current_phone_number_number',
          value: encryptedcurrent_phone_number_number,
          status: null,
          data_type: 1,
        },
      });
      
      const encryptedphone_number_id=this.encryptionService.encrypt(phone_number_id);

      await this.prisma.vendorSettings.upsert({
        where: {
          vendors__id_name: {
            vendors__id: vendorID,
            name: 'current_phone_number_id',
          },
        },
        update: {
          value: encryptedphone_number_id,
          status: null,
          data_type: 1,
        },
        create: {
          uid: uuidv4(),
          vendors__id: vendorID,
          name: 'current_phone_number_id',
          value: encryptedphone_number_id,
          status: null,
          data_type: 1,
        },
      });

      return returnphoneNumberRecord;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  async createTestContact(phoneNumber,vendorUid){
    try {
       if (!phoneNumber || !vendorUid ) {
          throw new HttpException('All parameters are required and must not be empty',HttpStatus.BAD_REQUEST);
        }
        
      const vendorRecord = await this.prisma.vendors.findFirst({
        where: {
          uid: vendorUid,
        },
      });

      if (vendorRecord) {
        
      } else {

        return 'Invalid Vendor UID';
      }

      const vendorID=vendorRecord.id;


      

      return "Success";
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async whatsappCloudApiSetup(vendorUid){
    try {
       if (!vendorUid ) {
          throw new HttpException('All parameters are required and must not be empty',HttpStatus.BAD_REQUEST);
        }
        
      const vendorRecord = await this.prisma.vendors.findFirst({
        where: {
          uid: vendorUid,
        },
      });

      if (vendorRecord) {
        
      } else {

        return 'Invalid Vendor UID';
      }

      
      const data1 ={};
      
    const vendorID=vendorRecord.id;
    const vendorSettingsRecord = await this.prisma.vendorSettings.findMany({
            where: {
              vendors__id: vendorID,
              name: {
                in: ['whatsapp_access_token', 'whatsapp_business_account_id','current_phone_number_id','webhook_verified_at','whatsapp_phone_numbers','whatsapp_health_status_data'],
              },
            },
          });

    if (!vendorSettingsRecord || vendorSettingsRecord.length < 5) {
        return {
        message: 'Whatsapp Facebook Setup Not Implemented',
        status: false,
        data1
      };
    }

    const accessTokenRecord = vendorSettingsRecord.find(item => item.name === 'whatsapp_access_token');
    const wabaidRecord = vendorSettingsRecord.find(item => item.name === 'whatsapp_business_account_id') ?? "";
    const phonenumberidRecord = vendorSettingsRecord.find(item => item.name === 'current_phone_number_id') ?? "";
    const webhook_verified_at = vendorSettingsRecord.find(item => item.name === 'webhook_verified_at') ?? null;
    const whatsapp_phone_numbers = vendorSettingsRecord.find(item => item.name === 'whatsapp_phone_numbers') ;
    const whatsapp_health_status_data = vendorSettingsRecord.find(item => item.name === 'whatsapp_health_status_data') ;
    
    if (!accessTokenRecord || !wabaidRecord || !phonenumberidRecord || !webhook_verified_at || !whatsapp_health_status_data) {
        throw new HttpException('Required settings not found', HttpStatus.BAD_REQUEST);
      }
     const whatsappApiConnectedTime =  `WhatsApp API connected using Embedded SignUp on ${webhook_verified_at.value} `;

    let whatsappPhoneNumbers = [];
    let whatsapp_health_status_data_parse = [];
    
    if (whatsapp_phone_numbers && whatsapp_phone_numbers.value ) {
      try {
        whatsappPhoneNumbers = JSON.parse(whatsapp_phone_numbers.value);
      } catch (error) {
        console.error('Failed to parse whatsapp_phone_numbers:', error);
      }
    }

    if (whatsapp_health_status_data && whatsapp_health_status_data.value ) {
      try {
        whatsapp_health_status_data_parse = JSON.parse(whatsapp_health_status_data.value);
      } catch (error) {
        console.error('Failed to parse whatsapp_phone_numbers:', error);
      }
    }

    const phoneDetails = whatsappPhoneNumbers.map(({display_phone_number,id }) => ({
      display_phone_number,
      id,
      primary: id == this.encryptionService.decrypt(phonenumberidRecord.value)
    }));

    const phoneDetailsAll = whatsappPhoneNumbers.map(({ id, verified_name,display_phone_number,quality_rating }) => ({
      id,verified_name,display_phone_number,quality_rating
    }));

    const verifiedPhoneNumbers = whatsappPhoneNumbers.filter(
  (p: any) => p.code_verification_status === 'VERIFIED'
);

// Build phoneDetails (for primary flag logic)
const verifiedPhoneNumbersDetails = verifiedPhoneNumbers.map(({ display_phone_number, id }) => ({
  display_phone_number,
  id,
  primary: id == this.encryptionService.decrypt(phonenumberidRecord.value)
}));

// Build phoneDetailsAll (full details of VERIFIED numbers)
const verifiedPhoneNumbersDetailsAll = verifiedPhoneNumbers.map(
  ({ id, verified_name, display_phone_number, quality_rating }) => ({
    id,
    verified_name,
    display_phone_number,
    quality_rating
  })
);

    
      const data ={
        whatsappApiConnectedTime:whatsappApiConnectedTime,
        defaultPhoneNumbers:verifiedPhoneNumbersDetails,
        phoneNumbers:phoneDetailsAll,
        healthStatus:whatsapp_health_status_data_parse,
      };
      

      return {
      message: 'Details Retrived',
      status: true,
      data
    };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  






  async whatsappwebhook(vendorUid,mode,token,challenge,res)
  {

    try {
       if (!vendorUid ||!mode || !token || !challenge ) {
          throw new HttpException('All parameters are required and must not be empty',HttpStatus.BAD_REQUEST);
        }

        const verifyToken = generateSha1Hash(vendorUid);
        if (mode === 'subscribe' && verifyToken === token) {

          if (vendorUid === 'service-whatsapp') {
            return res.status(200).send(challenge);
          }

          const vendorRecord = await this.prisma.vendors.findFirst({
            where: {
              uid: vendorUid,
            },
          });

          if (vendorRecord) {

          }else{
            return res.status(403).send('Invalid vendor');
          }
          return res.status(200).send(challenge);
        }

    return res.status(403).send('Invalid request');
  
    } catch (error) {
        throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
      }
  }






  
    //  async handleWebhookEvents(vendorUid: string, payload: any) {
    //   console.log(payload);
    //   const entry = payload.entry?.[0];
    //    console.log("er4322");
    //   const changes = entry?.changes?.[0];
    //   const value = changes?.value;

    //    await this.prisma.razorpayresponse.create({
    //         data: {
    //           razorpayresponse_value: JSON.stringify(payload),
    //         },
    //       });

    //   const vendor = await this.prisma.vendors.findFirst({
    //     where: { uid: vendorUid }
    //   });
    //   if (!vendor) throw new BadRequestException('Invalid Vendor UID');

    //   // 1️⃣ Handle messages field verification
    //   await this.checkMessagesFieldVerification(vendor.id, changes);

    //   // 2️⃣ Process status updates
    //   if (value?.statuses) {
    //     return this.processStatusUpdate(vendor.id, value.statuses[0], entry);
    //   }

    //   // 3️⃣ Process incoming messages
    //   if (value?.messages) {
    //     return this.processIncomingMessage(vendor, payload);
    //   }

    //   return 'done';
    // }

    async handleWebhookEvents(vendorUid: string, payload: any) {
    this.logger.log('Incoming Webhook Payload:', 'WhatsappWebhook');
    this.logger.debug(JSON.stringify(payload, null, 2), 'WhatsappWebhook');

    const entry = payload.entry?.[0];
    this.logger.debug(`Entry: ${JSON.stringify(entry)}`, 'WhatsappWebhook');

    const changes = entry?.changes?.[0];
    this.logger.debug(`Changes: ${JSON.stringify(changes)}`, 'WhatsappWebhook');

    const value = changes?.value;
    this.logger.debug(`Value: ${JSON.stringify(value)}`, 'WhatsappWebhook');

    // Save full payload to DB
    await this.prisma.razorpayresponse.create({
      data: {
        razorpayresponse_value: JSON.stringify(payload),
      },
    });
    this.logger.log('Webhook payload stored successfully', 'WhatsappWebhook');

    // Get vendor by UID
    const vendor = await this.prisma.vendors.findFirst({
      where: { uid: vendorUid },
    });

    if (!vendor) {
      this.logger.error(`Invalid vendor UID: ${vendorUid}`, 'WhatsappWebhook');
      throw new BadRequestException('Invalid Vendor UID');
    }

    this.logger.log(`Vendor found: ID=${vendor.id}, Name=${vendor.title}`, 'WhatsappWebhook');

    // 1️⃣ Check messages field verification
    // this.logger.log('Running checkMessagesFieldVerification...', 'WhatsappWebhook');
    // await this.checkMessagesFieldVerification(vendor.id, changes);
    // this.logger.log('checkMessagesFieldVerification completed', 'WhatsappWebhook');

    // 2️⃣ Handle status updates
    if (value?.statuses) {
      this.logger.log(`Processing status update: ${JSON.stringify(value.statuses[0])}`, 'WhatsappWebhook');
      return this.processStatusUpdate(vendor.id, value.statuses[0], entry);
    }

    // 3️⃣ Handle incoming messages
    if (value?.messages) {
      this.logger.log('Processing incoming message...', 'WhatsappWebhook');
      return this.processIncomingMessage(vendor, payload);
    }

    this.logger.warn('No actionable fields found. Returning done.', 'WhatsappWebhook');
    return 'done';
  }

     private async checkMessagesFieldVerification(vendorId: number, changes: any) {
          this.logger.log('Checking messages field verification...', 'CheckMessagesField');

          if (changes?.field === 'messages' && !(await this.isMessagesFieldVerified(vendorId))) {
            this.logger.log('Messages field is not yet verified. Proceeding to update...', 'CheckMessagesField');

            const setting = await this.prisma.vendorSettings.findFirst({
              where: {
                vendors__id: vendorId,
                name: 'whatsapp_cloud_api_setup'
              }
            });

            let valueObj: any = {};
            if (setting?.value) {
              try {
                valueObj = JSON.parse(setting.value);
              } catch (error) {
                this.logger.warn(`Failed to parse existing setting value: ${setting.value}`, 'CheckMessagesField');
              }
            }

            valueObj.webhook_messages_field_verified_at = new Date().toISOString();

            await this.prisma.vendorSettings.upsert({
              where: {
                vendors__id_name: {
                  vendors__id: vendorId,
                  name: 'whatsapp_cloud_api_setup',
                }
              },
              update: { value: JSON.stringify(valueObj) },
              create: {
                uid: uuidv4(),
                vendors__id: vendorId,
                name: 'whatsapp_cloud_api_setup',
                value: JSON.stringify(valueObj),
              },
            });

            this.logger.log('Webhook message field verified timestamp updated.', 'CheckMessagesField');

            if (changes.value?.messages?.[0]?.text?.body === 'this is a text message') {
              this.logger.warn('Test message received. Ignoring.', 'CheckMessagesField');
              return 'test_message_ignored';
            }
          } else {
            this.logger.log('Messages field already verified or not applicable.', 'CheckMessagesField');
          }
        }




    private async isMessagesFieldVerified(vendorId: number): Promise<boolean> {
      const setting = await this.prisma.vendorSettings.findFirst({
        where: {
          vendors__id: vendorId,
          name: 'whatsapp_cloud_api_setup'
        }
      });

      if (!setting?.value) return false;

      try {
        const valueObj = JSON.parse(setting.value);
        return !!valueObj?.webhook_messages_field_verified_at;
      } catch {
        return false;
      }
    }
private async processStatusUpdate(vendorId: number, status: any, rawData: any) {
    this.logger.log(
      `Processing status update for vendorId=${vendorId}, wamid=${status.id}, new status=${status.status}`,
      'ProcessStatusUpdate'
    );

    const updateResult = await this.prisma.whatsAppMessageLog.updateMany({
      where: {
        wamid: status.id,
        vendorId: vendorId,
      },
      data: {
        status: status.status,
        data: JSON.stringify(rawData),
        updatedAt: new Date(parseInt(status.timestamp) * 1000),
      },
    });

    if (updateResult.count > 0) {
      this.logger.log(
        `Successfully updated ${updateResult.count} message log(s) for wamid=${status.id}`,
        'ProcessStatusUpdate'
      );
    } else {
      this.logger.warn(
        `No message logs found to update for wamid=${status.id} and vendorId=${vendorId}`,
        'ProcessStatusUpdate'
      );
    }

    return 'status_updated';
  }
  
private async processIncomingMessage(vendor: any, webhookData: any) {
    this.logger.log(`Incoming webhook payload received`, 'IncomingMessage');
  // ✅ Store full webhook data for inspection/debugging
  await this.prisma.razorpayresponse.create({
    data: {
      razorpayresponse_value: JSON.stringify(webhookData),
    },
  });

     this.logger.log(JSON.stringify(webhookData, null, 2), 'WhatsappWebhook');
  
    
    const entry = webhookData.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];
    const contactData = value?.contacts?.[0];

    const vendorId = vendor.id;
    const contactWaId = message.from;

    this.logger.log(`Processing incoming message for vendorId=${vendorId}, wa_id=${contactWaId}`, 'IncomingMessage');

    const encryptedName = this.encryptionService.encryptUniversal(contactData?.profile?.name);
    const encryptedWaId = this.encryptionService.encryptUniversal(contactWaId);

    let contact = await this.prisma.contacts.findFirst({
      where: { vendorId, wa_id: encryptedWaId },
    });

    if (!contact) {
      contact = await this.prisma.contacts.create({
        data: {
          uid: uuidv4(),
          vendorId,
          wa_id: encryptedWaId,
          first_name: encryptedName,
          countries__id: 99,
        },
      });
      this.logger.log(`New contact created with ID ${contact.id}`, 'IncomingMessage');
    } else {
      this.logger.log(`Existing contact found with ID ${contact.id}`, 'IncomingMessage');
    }

    const exists = await this.prisma.whatsAppMessageLog.findFirst({
      where: { wamid: message.id, vendorId },
    });

    if (exists) {
      this.logger.warn(`Duplicate message detected. WAMID: ${message.id}`, 'IncomingMessage');
      return 'duplicate_message_ignored';
    }

    const vendorSettings = await this.prisma.vendorSettings.findMany({
      where: { vendors__id: vendorId },
    });

    const encryptedAccessToken = vendorSettings.find(s => s.name === 'whatsapp_access_token')?.value;
    if (!encryptedAccessToken) {
      this.logger.error('WhatsApp access token missing', 'IncomingMessage');
      throw new Error('WhatsApp access token missing');
    }

    const decryptedAccessToken = this.encryptionService.decrypt(encryptedAccessToken).trim();
    if (!decryptedAccessToken) {
      this.logger.error('Failed to decrypt access token', 'IncomingMessage');
      throw new Error('Failed to decrypt access token');
    }

    let mainmessage=message.text?.body ?? null

    let storedMessageData: any = {};

    if (['image', 'video', 'document', 'audio', 'sticker'].includes(message.type)) {
      const mediaId = message[message.type].id;
      const mediaType = message.type;
      const mediaUrl = await this.downloadAndStoreMedia(vendor.uid, mediaId, decryptedAccessToken, mediaType);

      storedMessageData = {
        type: message.type,
        media: {
          url: mediaUrl,
          caption: message[message.type]?.caption ?? null,
        }
      };
      this.logger.log(`Media message processed: ${mediaType} stored`, 'IncomingMessage');
    } else if (message.type === 'text') {
      storedMessageData = {
        type: message.type,
        text: message.text?.body,
      };
      this.logger.log(`Text message received: "${message.text?.body}"`, 'IncomingMessage');
    }  else if (message.type === 'button') {
        const buttonText = message.button?.text || '[No text]';
        const buttonPayload = message.button?.payload || '[No payload]';
        mainmessage = buttonText;

        storedMessageData = {
          type: 'button',
          button_text: buttonText,
          button_payload: buttonPayload,
        };

        this.logger.log(`Button message received. Text: "${buttonText}", Payload: "${buttonPayload}"`, 'IncomingMessage');
      } else {
      storedMessageData = {
        type: message.type,
        text: `[Unsupported ${message.type}]`,
      };
      this.logger.warn(`Unsupported message type: ${message.type}`, 'IncomingMessage');
    }

        if (message.type === 'interactive') {
      const interactiveType = message.interactive.type;
      let buttonText = '';
      let buttonId = '';

      if (interactiveType === 'button_reply') {
        buttonText = message.interactive.button_reply?.title || '';
        buttonId = message.interactive.button_reply?.id || '';
      } else if (interactiveType === 'list_reply') {
        buttonText = message.interactive.list_reply?.title || '';
        buttonId = message.interactive.list_reply?.id || '';
      } else if (interactiveType === 'nfm_reply') {
        // Handle custom NFM type if applicable
        buttonText = '[NFM Response]';
        buttonId = 'nfm_response';
      }

    
       mainmessage = buttonText || '[No title]';

      // ✅ Store metadata in `data` column
      storedMessageData = {
        type: message.type,
        interactive_type: interactiveType,
        button_text: buttonText,
        button_id: buttonId,
        raw: message.interactive, // Optional: to store full object
      };

      this.logger.log(`Interactive message received. Button: "${buttonText}", ID: ${buttonId}`, 'IncomingMessage');
    }


    let repliedToMessageLogUid: string | null = null;
    let repliedToWamid: string | null = null;
    let isForwarded = false;

    // 1️⃣ Check for reaction message
    const reactionEmoji = message?.reaction?.emoji;
    if (reactionEmoji) {
      repliedToWamid = message?.reaction?.message_id;
      storedMessageData.reaction = reactionEmoji;
      message.text = { body: reactionEmoji }; // treat emoji as the message
      this.logger.log(`Received a reaction: ${reactionEmoji}`, 'IncomingMessage');
    } else {
      //  Else, check for context reply
      repliedToWamid = message?.context?.id;
    }

    // Lookup the replied-to message in DB
  
      let repliedCodId: number | null = null;
      if (repliedToWamid) {
        const repliedToMessage = await this.prisma.whatsAppMessageLog.findFirst({
          where: { wamid: repliedToWamid, vendorId },
          select: { uid: true, cod_id: true },
        });
        if (repliedToMessage) {
          repliedToMessageLogUid = repliedToMessage.uid;
          repliedCodId = repliedToMessage.cod_id;
          this.logger.log(`This message is a reply to UID: ${repliedToMessageLogUid}`, 'IncomingMessage');
        } else {
          this.logger.warn(`Replied-to message not found for wamid: ${repliedToWamid}`, 'IncomingMessage');
        }
      }
    //  Check if the message was forwarded
    isForwarded = message?.context?.forwarded === true;
    if (isForwarded) {
      storedMessageData.isForwarded = true;
      this.logger.log('Message is marked as forwarded', 'IncomingMessage');
    }
    

    const messages=await this.prisma.whatsAppMessageLog.create({
      data: {
        uid: uuidv4(),
        wamid: message.id,
        contactId: contact.id,
        message: mainmessage,
        contactWaId,
        vendorId,
        status: 'received',
        isIncomingMessage: 1,
        messagedAt: new Date(parseInt(message.timestamp) * 1000),
        data: JSON.stringify(storedMessageData),
        repliedToMessageLogUid,
        isForwarded: isForwarded ? 1 : null,
      },
    });

      // ✅ Handle COD replies
   if (repliedCodId && ['interactive', 'button'].includes(message.type)) {
        const normalizedText = mainmessage.trim().toLowerCase();
        this.logger.log(`COD Reply Detected for ID ${repliedCodId} with message: "${normalizedText}"`, 'IncomingMessage');

        if (['confirm', 'confirm order', 'yes'].includes(normalizedText)) {
          await this.prisma.abandonedCheckouts.updateMany({
            where: { id: repliedCodId },
            data: { is_confirmed: 1 },
          });
          this.logger.log(`COD marked as confirmed for ID ${repliedCodId}`, 'IncomingMessage');

          const tag = 'Order Confirmed';
          await this.ShopifyService.addShopifyTagToOrder(repliedCodId, tag);
          this.logger.log(`Shopify tag "${tag}" added for ID ${repliedCodId}`, 'IncomingMessage');

        } else if (['cancel', 'cancel order', 'no'].includes(normalizedText)) {
          await this.prisma.abandonedCheckouts.updateMany({
            where: { id: repliedCodId },
            data: { is_confirmed: 2 },
          });
          this.logger.log(`COD marked as cancelled for ID ${repliedCodId}`, 'IncomingMessage');

          const tag = 'Order Cancelled';
          await this.ShopifyService.addShopifyTagToOrder(repliedCodId, tag);
          this.logger.log(`Shopify tag "${tag}" added for ID ${repliedCodId}`, 'IncomingMessage');
        } else {
          this.logger.warn(`Received COD reply for ID ${repliedCodId} with unknown action: "${normalizedText}"`, 'IncomingMessage');
        }
      }


    this.logger.log(`Message logged and broadcasting to Pusher: chat-${contact.id}`, 'IncomingMessage');

    await this.PusherService.trigger(`chat-${contact.id}`, 'new-message', messages);


    return 'message_processed';
  }



private async downloadAndStoreMedia(
  vendorUid: string,
  mediaId: string,
  accessToken: string,
  mediaType: string
): Promise<string> {
  try {
    // 1️⃣ Get media URL from Facebook Graph API
    const mediaUrlResp = await axios.get(`https://graph.facebook.com/v22.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const mediaUrl = mediaUrlResp.data?.url;
    if (!mediaUrl) {
      throw new Error(`Media URL not found for mediaId: ${mediaId}`);
    }

    // 2️⃣ Download actual media file
    const mediaFileResp = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    // 3️⃣ Create directory if not exists
    const folderPath = path.join('public/uploads/vendors', vendorUid, 'whatsapp_media', mediaType);
    try {
      fs.mkdirSync(folderPath, { recursive: true });
    } catch (mkdirErr) {
      throw new Error(`Failed to create folder ${folderPath}: ${mkdirErr.message}`);
    }

    // 4️⃣ Generate file name & path
   const fileExtension = this.getFileExtension(mediaType);
    if (!fileExtension) {
      throw new Error(`Unable to resolve file extension for media type: ${mediaType}`);
    }

    const safeName = `${uuidv4()}.${fileExtension}`;
    const fullPath = path.join(folderPath, safeName);

    // 5️⃣ Write file to disk
    try {
      fs.writeFileSync(fullPath, mediaFileResp.data);
    } catch (writeErr) {
      throw new Error(`Failed to write file ${fullPath}: ${writeErr.message}`);
    }

    // 6️⃣ Return URL for DB
    return `${this.BASE_URL}/vendors/${vendorUid}/whatsapp_media/${mediaType}/${safeName}`;
  } catch (err) {
    // 🐞 Exact Error Logging
    console.error('Media Download/Store Error:', err);
    throw new Error(`download And StoreMedia failed: ${err.message}`);
  }
}


private getFileExtension(mediaType: string): string {
  switch (mediaType) {
    case 'image':
      return 'jpg';
    case 'video':
      return 'mp4';
    case 'audio':
      return 'mp3';
    case 'document':
      return 'pdf';
    case 'sticker':
      return 'webp';
    default:
      throw new Error(`Unsupported media type: ${mediaType}`);
  }
}

  }






    
    


function generateSha1Hash(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex');
}


    // private async checkMessagesFieldVerification(vendorId: number, changes: any) {
    //     if (changes?.field === 'messages' && !(await this.isMessagesFieldVerified(vendorId))) {
    //       const setting = await this.prisma.vendorSettings.findFirst({
    //         where: {
    //           vendors__id: vendorId,
    //           name: 'whatsapp_cloud_api_setup'
    //         }
    //       });

    //       let valueObj: any = {};
    //       if (setting?.value) {
    //         try {
    //           valueObj = JSON.parse(setting.value);
    //         } catch {}
    //       }

    //       valueObj.webhook_messages_field_verified_at = new Date().toISOString();

    //       await this.prisma.vendorSettings.upsert({
    //         where: {
    //           vendors__id_name: {
    //             vendors__id: vendorId,
    //             name: 'whatsapp_cloud_api_setup',
    //           }
    //         },
    //         update: { value: JSON.stringify(valueObj) },
    //         create: {
    //           uid:uuidv4(),
    //           vendors__id: vendorId,
    //           name: 'whatsapp_cloud_api_setup',
    //           value: JSON.stringify(valueObj),
    //         },
    //       });

    //       if (changes.value?.messages?.[0]?.text?.body === 'this is a text message') {
    //         return 'test_message_ignored';
    //       }
    //     }
    //   }

        // private async processStatusUpdate(vendorId: number, status: any, rawData: any) {
    //   await this.prisma.whatsAppMessageLog.updateMany({
    //     where: {
    //       wamid: status.id,
    //       vendorId: vendorId,
    //     },
    //     data: {
    //       status: status.status,
    //       data: JSON.stringify(rawData),
    //       updatedAt: new Date(parseInt(status.timestamp) * 1000),
    //     },
    //   });
    //   return 'status_updated';
    // }
// private async processIncomingMessage(vendor: any, webhookData: any) {
//   console.log(webhookData);
//     const entry = webhookData.entry?.[0];
//     console.log(entry);
//     const changes = entry?.changes?.[0];
//     const value = changes?.value;
//     const message = value?.messages?.[0];
//     const contactData = value?.contacts?.[0];

//     const vendorId = vendor.id;
//     const contactWaId = message.from;

//     // Check if contact exists

//      const encryptedName = this.encryptionService.encryptUniversal(contactData?.profile?.name);
//       const encryptedWaId = this.encryptionService.encryptUniversal(contactWaId);

//     let contact = await this.prisma.contacts.findFirst({
//       where: { vendorId: vendorId, wa_id: encryptedWaId },
//     });

//     if (!contact) {
//      contact = await this.prisma.contacts.create({
//         data: {
//           uid: uuidv4(),
//           vendorId: vendorId,
//           wa_id: encryptedWaId,
//           first_name: encryptedName,
//           countries__id: 99,
//         },
//       });
//     }

//     // Avoid duplicates
//     const exists = await this.prisma.whatsAppMessageLog.findFirst({
//       where: { wamid: message.id, vendorId: vendorId },
//     });
//     if (exists) return 'duplicate_message_ignored';

//     // Get vendor whatsapp access token
//     const vendorSettings = await this.prisma.vendorSettings.findMany({
//       where: { vendors__id: vendorId },
//     });

//     const encryptedAccessToken = vendorSettings.find((s) => s.name === 'whatsapp_access_token')?.value;
//     if (!encryptedAccessToken) throw new Error('WhatsApp access token missing');
//    const decryptedAccessToken = this.encryptionService.decrypt(encryptedAccessToken).trim();

//     if (!decryptedAccessToken) throw new Error('Failed to decrypt access token');

//     let storedMessageData: any = {};

//     if (['image', 'video', 'document', 'audio', 'sticker'].includes(message.type)) {
//       const mediaId = message[message.type].id;
//       const mediaType = message.type;
//       const mediaUrl = await this.downloadAndStoreMedia(vendor.uid, mediaId, decryptedAccessToken, mediaType);

//       storedMessageData = {
//         type: message.type,
//         media: {
//           url: mediaUrl,
//           caption: message[message.type]?.caption ?? null,
//         }
//       };
//     } else if (message.type === 'text') {
//       storedMessageData = {
//         type: message.type,
//         text: message.text?.body
//       };
//     } else {
//       storedMessageData = {
//         type: message.type,
//         text: `[Unsupported ${message.type}]`
//       };
//     }

//     await this.prisma.whatsAppMessageLog.create({
//       data: {
//         uid: uuidv4(),
//         wamid: message.id,
//         contactId: contact.id,
//         message: message.text?.body ?? null,
//         contactWaId: contactWaId,
//         vendorId: vendorId,
//         status: 'received',
//         isIncomingMessage: 1,
//         messagedAt: new Date(parseInt(message.timestamp) * 1000),
//         data: JSON.stringify(storedMessageData),
//       },
//     });

//     await this.PusherService.trigger(`chat-${contact.id}`, 'new-message', storedMessageData);
//     return 'message_processed';
// }





   


