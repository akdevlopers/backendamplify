import { Injectable,InternalServerErrorException,BadRequestException,HttpException,HttpStatus} from '@nestjs/common';
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

@Injectable()
export class TemplateService {
  private readonly baseApiEndpoint = process.env.BASE_API_ENDPOINT;
  constructor(private prisma: PrismaService,private readonly encryptionService: EncryptionService,) {}
  private readonly httpService: HttpService;
  // async getAllTemplate(page: number, limit: number, vendorId: number) {
  //   const skip = (page - 1) * limit;
  
  //   if (!vendorId || isNaN(vendorId)) {
  //     throw new BadRequestException('Invalid vendorId');
  //   }
  
  //   try {
  //     const [data, total] = await Promise.all([
  //       this.prisma.whatsappTemplate.findMany({
  //         where: { vendorId },
  //         skip,
  //         take: limit,
  //       }),
  //       this.prisma.whatsappTemplate.count({
  //         where: { vendorId },
  //       }),
  //     ]);
  
  //     return {
  //       data,
  //       meta: {
  //         total,
  //         page,
  //         lastPage: Math.ceil(total / limit),
  //       },
  //     };
  //   } catch (error) {
  //     console.error('Error fetching templates:', error.message);
  //     console.error('Stack Trace:', error.stack);
  //     throw new InternalServerErrorException({
  //       message: 'Unable to fetch templates',
  //       reason: error.message,
  //       stack: error.stack, // optional
  //     });
  //   }
  // }
        async getAllTemplate(page: number, limit: number, vendorId: number, search: string | null) {
        const skip = (page - 1) * limit;

        if (!vendorId || isNaN(vendorId)) {
          throw new BadRequestException('Invalid vendorId');
        }

        try {
          const searchCondition = search
          ? {
              OR: [
                { templateName: { contains: search } },
                { category: { contains: search } },
                { language: { contains: search } },
              ],
            }
          : {};


          const [data, total] = await Promise.all([
            this.prisma.whatsappTemplate.findMany({
              where: {
                vendorId,
                ...searchCondition,
              },
              skip,
              take: limit,
            }),
            this.prisma.whatsappTemplate.count({
              where: {
                vendorId,
                ...searchCondition,
              },
            }),
          ]);

          return {
            data,
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
          });
        }
      }

  async getTableColumns(): Promise<{ [key: string]: string }> {
    const columns = await this.prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'abandoned_checkouts'
    `;
  
    const allowedWithLabels: { [key: string]: string } = {
      checkout_id: 'Checkout ID',
      name: 'Customer Name',
      phone: 'Phone Number',
      abandoned_url: 'Abandoned Checkout URL',
      total_price: 'Total Price',
      created_at: 'Checkout Created At',
      checkout_status: 'Checkout Status',
      shipping_charge: 'Shipping Charge',
      total_tax: 'Total Tax',
      shopify_currency: 'Currency',
      shopify_address: 'Address',
      shopify_street: 'Street',
      shopify_city: 'City',
      shopify_state: 'State',
      shopify_zip: 'ZIP Code'
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
   async getcontactColumns(): Promise<{ [key: string]: string }> {
    const columns = await this.prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'contacts'
    `;
  
    const allowedWithLabels: { [key: string]: string } = {
        first_name: 'Contact First Name',
    last_name: 'Contact Last Name',
    countries__id: 'Country Name',
    wa_id: 'Contact Mobile Number',
    email: 'Contact Email',
    language_code:'Language Code'

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
  async uploadTemplateFiles(files: Express.Multer.File[],vendorUid,req,body){
    try {
       if (!files || !body.vendorUid) {
          throw new HttpException('All parameters are required and must not be empty',HttpStatus.BAD_REQUEST);
        }
         const protocol = req.protocol;
          const host = req.get('host');
          const baseUrl = `${protocol}://${host}`;
      const vendorRecord = await this.prisma.vendors.findFirst({
        where: {
          uid: body.vendorUid,
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

      if (!accessTokenRecord ) {
        throw new HttpException('Required settings not found', HttpStatus.BAD_REQUEST);
      }

      const accessToken = this.encryptionService.decrypt(accessTokenRecord.value);

      const filePaths = files.map((file) => ({
        originalName: file.originalname,
        url: `${baseUrl}/uploads/${file.filename}`,
      }));
      
      const data ={
        filePath:filePaths,
      };

       const fileName = files[0].filename; // Stored filename on the server
        const originalName = files[0].originalname; // Original filename from the client
        const mimeType = files[0].mimetype; // MIME type of the file
        const fileSize = files[0].size; // Size of the file in bytes
      // Step 1: Create an upload session

     const uploadSessionResponse = await axios.post(
      `${this.baseApiEndpoint}/${process.env.EMBEDDED_SIGNUP_APP_ID}/uploads`,
      {}, // No body needed unless specified by API
      {
        params: {
          file_length: fileSize,
          file_type: mimeType,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

      const uploadSessionId = uploadSessionResponse.data.id;
      const uploadUrl = this.baseApiEndpoint+uploadSessionId;
      // return uploadUrl;

      // Step 2: Upload the file
      const correctPath = path.join(__dirname, '..', '..', 'uploads', fileName);
       const fileContent = fs.readFileSync(correctPath);
      const headers: Record<string, any> = {
        Authorization: `OAuth ${accessToken}`,
        'file_offset': '0',
         'Content-Type': 'application/octet-stream', // or text/plain, or image/png depending on file
    'Content-Disposition': `attachment; filename= ${fileName}`,
      };

      let response;

      // if (binary) {
        // Binary upload
        try {
        response = await axios.post(uploadUrl, fileContent, {
          headers: {
            ...headers,
            // 'Content-Type': mimeType,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          },
        });
        } catch (error) {
          console.error('API error data:', error.response?.data);
          throw new Error(`API call failed: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
        }
      // } else {
        // Multipart/form-data upload
        // const FormData = require('form-data');
        // const form = new FormData();
        // form.append('file', fileStream, {
        //   filename: fileName,
        //   contentType: mimeType,
        // });
        // form.append('type', mimeType);

        // response = await axios.post(uploadUrl, form, {
        //   headers: {
        //     ...headers,
        //     ...form.getHeaders(),
        //   },
        // });
      // }

      // Step 3: Handle the response
      const result = response.data;
      const datas=result.h || null;
      if (result && !result.error) {

         return {
          message: 'Success',
          status: true,
          datas
          };
      } else {
        throw new HttpException(result.error.message, result.error.code || HttpStatus.INTERNAL_SERVER_ERROR);
      }
      
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  async createTemplate(name,category,language,components,vendorUid,body){
    try {
      if (!name || !category || !language || !components || !vendorUid ) {
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
      const templateDetails = await this.prisma.whatsappTemplate.findFirst({
        where: {
          vendorId: vendorID,
          templateName:name

        },
      });

      if (templateDetails) {
          return {
            message: 'Template Name Already Exists',
            status: false
          };
      } else {

      }

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

     const createdTemplate = await this.prisma.whatsappTemplate.create({
      data: {
        uid: uuidv4(),
        templateName: name,
        category: category,
        language: language,
        data:  JSON.stringify(body),
        vendorId: vendorID,
        createdAt: new Date(),
      },
    });

    const newId = createdTemplate.id;
    const objnew = { ...body };
    delete objnew.vendorUid;
     
    try {
    const messageTemplates = await axios.post(
      `${this.baseApiEndpoint}${waba_id}/message_templates`,
      objnew,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if(messageTemplates.data.id && messageTemplates.data.status && messageTemplates.data.category)
    {
      const updatedTemplate = await this.prisma.whatsappTemplate.update({
      where: {
        id: newId, 
      },
      data: {
        status: messageTemplates.data.status,
        category: messageTemplates.data.category,
        templateId: messageTemplates.data.id,
        updatedAt: new Date(),
      },
    });
      await this.syncSingleTemplate(vendorUid,messageTemplates.data.id,newId);
      return {message: 'Success',status: true,};
    }else{
      return {message: messageTemplates.data,status: false};
    }
    
    } catch (error) {
    console.error('API error data:', error.response?.data);
    throw new Error(`API call failed: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
  }
  } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }

  }
  async syncTemplate(vendorUid) {
    
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
    
    const vendorID=vendorRecord.id;
    if(vendorID<=0)
    {
      return 'Invalid Vendor UID';
    }
    const vendorSettingsRecord = await this.prisma.vendorSettings.findMany({
      where: {
        vendors__id: vendorID,
        name: {
          in: ['whatsapp_access_token', 'whatsapp_business_account_id','current_phone_number_id','webhook_verified_at','whatsapp_phone_numbers'],
        },
      },
    });
    
    if (!vendorSettingsRecord || vendorSettingsRecord.length < 4) {
        return {
        message: 'Whatsapp Facebook Setup Not Implemented',
        status: false,
      };
    }

    const accessTokenRecord = vendorSettingsRecord.find(item => item.name === 'whatsapp_access_token');
    const wabaidRecord = vendorSettingsRecord.find(item => item.name === 'whatsapp_business_account_id') ?? "";
    
    if (!accessTokenRecord || !wabaidRecord) {
      throw new HttpException('Required settings not found', HttpStatus.BAD_REQUEST);
    }

    const accessToken = this.encryptionService.decrypt(accessTokenRecord.value);
    const waba_id = this.encryptionService.decrypt(wabaidRecord.value);

    const templateList = await axios.get(
      `${this.baseApiEndpoint}${waba_id}/message_templates?limit=500`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

     const templates = templateList.data.data;
     const incomingUIDs = templates.map(t => t.id);
      for (const template of templates) {
        const existingTemplate = await this.prisma.whatsappTemplate.findFirst({
          where: {
            templateId: template.id,
            vendorId: vendorID, // optional, to make it more specific
          },
        });
        if(existingTemplate)
        {
          await this.prisma.whatsappTemplate.update({
            where: { id: existingTemplate.id },
            data: {
              templateName: template.name,
              status: template.status,
              vendorId: vendorID,
              category: template.category,
              language: template.language,
              data: JSON.stringify(template),
              updatedAt: new Date(),
            },
          });
        }else{
          await this.prisma.whatsappTemplate.create({
            data: {
              uid: uuidv4(),
              templateId: template.id,
              templateName: template.name,
              status: template.status,
              category: template.category,
              language: template.language,
              data: JSON.stringify(template),
              vendorId: vendorID,
              createdAt: new Date(),
            },
          });
        }
      }

      await this.prisma.whatsappTemplate.deleteMany({
        where: {
          vendorId: vendorID,
          templateId: {
            notIn: incomingUIDs,
          },
        },
      });

      return {message: 'Template Synced Successfully',status: true,};

  }
  async updateTemplate(name,category,language,components,vendorUid,templateId,body,parameter_format){
    try {
      if (!name || !category || !language || !components || !vendorUid || !templateId ) {
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
      const templateDetails = await this.prisma.whatsappTemplate.findFirst({
        where: {
          vendorId: vendorID,
          templateName:name

        },
      });

      if (templateDetails) {
          
      } else {

        return {
            message: 'New Template Name Not Allowed For Update',
            status: false
          };
      }

      const templateGivenDetails = await this.prisma.whatsappTemplate.findFirst({
        where: {
          vendorId: vendorID,
          templateName:name,
          id:templateId,
          category:category,
          language:language,

        },
      });

      if (templateGivenDetails) {

          
      } else {

        return {
            message: 'Datas Mismatch Kindly Check All Datas.',
            status: false
          };
      }

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

      const objnew = { ...body };
      const dataToSend = { category, components, parameter_format };
     
    try {
    const messageTemplates = await axios.post(
      `${this.baseApiEndpoint}${templateGivenDetails.templateId}`,
      dataToSend,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if(messageTemplates.data.id &&  messageTemplates.data.category && messageTemplates.data.success)
    {
      await this.syncSingleTemplate(vendorUid,templateGivenDetails.templateId,templateId);

      return {message: 'Success',status: true,};
    }else{
      return {message: messageTemplates.data,status: false};
    }
    
    } catch (error) {
    console.error('API error data:', error.response?.data);
    throw new Error(`API call failed: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
  }
  } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }

  }

  async syncSingleTemplate(vendorUid,templateId,primaryId) {
    
    if (!vendorUid || !templateId ) {
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
    if(vendorID<=0)
    {
      return 'Invalid Vendor UID';
    }
    const vendorSettingsRecord = await this.prisma.vendorSettings.findMany({
      where: {
        vendors__id: vendorID,
        name: {
          in: ['whatsapp_access_token', 'whatsapp_business_account_id','current_phone_number_id','webhook_verified_at','whatsapp_phone_numbers'],
        },
      },
    });
    
    if (!vendorSettingsRecord || vendorSettingsRecord.length < 4) {
        return {
        message: 'Whatsapp Facebook Setup Not Implemented',
        status: false,
      };
    }

    const accessTokenRecord = vendorSettingsRecord.find(item => item.name === 'whatsapp_access_token');
    const wabaidRecord = vendorSettingsRecord.find(item => item.name === 'whatsapp_business_account_id') ?? "";
    
    if (!accessTokenRecord || !wabaidRecord) {
      throw new HttpException('Required settings not found', HttpStatus.BAD_REQUEST);
    }

    const accessToken = this.encryptionService.decrypt(accessTokenRecord.value);
    const waba_id = this.encryptionService.decrypt(wabaidRecord.value);

     const getTemplate = await axios.get(
        `${this.baseApiEndpoint}${templateId}`,  // Note: templateId is the WhatsApp template ID
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          }
        }
      );
    
     const updatedTemplate = await this.prisma.whatsappTemplate.update({
        where: {
          id: primaryId, 
        },
        data: {
          category: getTemplate.data.category,
          templateId: getTemplate.data.id,
          templateName: getTemplate.data.name,
          status: getTemplate.data.status,
          language:  getTemplate.data.language,
          data:  JSON.stringify(getTemplate.data),
          updatedAt: new Date(),
        },
      });


    return true;

  }
  async deleteTemplate(vendorUid,templateId) {
    
    if (!vendorUid || !templateId ) {
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
    if(vendorID<=0)
    {
      return 'Invalid Vendor UID';
    }

      const templateGivenDetails = await this.prisma.whatsappTemplate.findFirst({
        where: {
          vendorId: vendorID,
          id:templateId,
        },
      });

      if (templateGivenDetails) {

          
      } else {

        return {
            message: 'Datas Mismatch Kindly Check All Datas.',
            status: false
          };
      }

    const vendorSettingsRecord = await this.prisma.vendorSettings.findMany({
      where: {
        vendors__id: vendorID,
        name: {
          in: ['whatsapp_access_token', 'whatsapp_business_account_id','current_phone_number_id','webhook_verified_at','whatsapp_phone_numbers'],
        },
      },
    });
    
    if (!vendorSettingsRecord || vendorSettingsRecord.length < 4) {
        return {
        message: 'Whatsapp Facebook Setup Not Implemented',
        status: false,
      };
    }

    const accessTokenRecord = vendorSettingsRecord.find(item => item.name === 'whatsapp_access_token');
    const wabaidRecord = vendorSettingsRecord.find(item => item.name === 'whatsapp_business_account_id') ?? "";
    
    if (!accessTokenRecord || !wabaidRecord) {
      throw new HttpException('Required settings not found', HttpStatus.BAD_REQUEST);
    }

    const accessToken = this.encryptionService.decrypt(accessTokenRecord.value);
    const waba_id = this.encryptionService.decrypt(wabaidRecord.value);

    try{
      const deleteTemplate = await axios.delete(
        `${this.baseApiEndpoint}${waba_id}/message_templates`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          params: {
            name: templateGivenDetails.templateName,
          }
        }
      );

      if(deleteTemplate.data.success)
      {
        if(deleteTemplate.data.success==true)
        {
          await this.prisma.whatsappTemplate.delete({
            where: {
              id: templateId,
            },
          });
          return {
            message: 'Template Deleted Successfully',
            status: true
          };  
        }
      }
      return {
        message: 'Some thing Went Wrong',
        status: false
      };  
    } catch (error) {
        console.error('API error data:', error.response?.data);
        throw new Error(`API call failed: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
    }
  }
  
}
