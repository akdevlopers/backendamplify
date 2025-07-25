// src/modules/whatsapp/services/whatsapp.service.ts

import { Injectable,NotFoundException,BadRequestException,HttpException,HttpStatus} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SendTemplateMessageDto } from './dto/whatsappservice.dto';
import { ContactRepository } from './contact.repository';
import { MediaService } from 'src/media/media.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { MessageLogRepository } from './message-log.repository';
import { ParameterHelper } from 'src/helper/parameter.helper';
import { MyLogger } from 'src/logger.service';



@Injectable()
export class WhatsAppService {
   private readonly baseApiEndpoint = process.env.BASE_API_ENDPOINT;
  constructor(private readonly prisma: PrismaService, private contactRepository: ContactRepository,private readonly encryptionService: EncryptionService,
    private readonly MediaService: MediaService,
    private readonly MessageLogRepository:MessageLogRepository,
    private readonly ParameterHelper:ParameterHelper,
     private readonly logger:MyLogger
  ) {}

            async processSendMessageForContact(request: any) {
            const contact = await this.contactRepository.getVendorContact(request.contact_uid);


             console.log(1); 


            if (!contact) {
                return {
                failed: true,
                message: 'Requested contact not found',
                data: {},
                };
            }

            console.log(contact);

            const vendorPlanDetails = await this.getVendorCurrentActiveSubscription(contact.vendorId);

            if (!vendorPlanDetails.hasActivePlan) {
                return {
                failed: true,
                message: vendorPlanDetails.message,
                data: {},
                };
            }

            return await this.sendTemplateMessageProcess(request, contact);
            }

            



            async getVendorCurrentActiveSubscription(vendorId: number | null) {

                if (!vendorId) {
                    return {
                    hasActivePlan: false,
                    isExpired: null,
                    endsAt: null,
                    message: 'Invalid vendor ID.',
                    };
                }

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

            if (!manualSubscription) {
                return {
                hasActivePlan: false,
                isExpired: null,
                endsAt: null,
                message: 'No active plan found.',
                };
            }

            const now = new Date();
            const endsAt = manualSubscription.ends_at;
            const isExpired = endsAt ? new Date(endsAt) < now : false;

            const currentplan = await this.prisma.configurations.findFirst({
                where: {
                    name: 'subscription_plans',
                },
                });

                // Parse the JSON string to an object
                const subscriptionPlans = JSON.parse(currentplan?.value || '{}');

                // Example: manualSubscription.plan_id = 'plan_1'
                const planId = manualSubscription.plan_id;

                // Access the plan features under `paid`
                const paidPlans = subscriptionPlans.paid || {};
               const selectedPlan = paidPlans[planId ?? "plan_2"]; // Use a default value if planId is null/undefined

                if (!selectedPlan) {
                throw new Error(`Plan with ID ${planId} not found`);
                }

                // Get the features of the selected plan
                const planFeatures = selectedPlan.features;

                // Now you can access features like this:
                const contactsLimit = planFeatures.contacts.limit;
                const botRepliesLimit = planFeatures.bot_replies.limit;

                console.log('Contacts limit:', contactsLimit);
                console.log('Bot replies limit:', botRepliesLimit);

            

            return {
                hasActivePlan: !isExpired,
                isExpired,
                endsAt,
                subscriptionType: 'manual',
                planId: manualSubscription.plan_id,
                message: isExpired
                ? 'Your subscription plan has expired. Please renew your subscription.'
                : 'Active subscription found.',
            };
            }



              async sendTemplateMessageProcess(
                request: any,
                contact: any,
                isForCampaign = false,
                campaignId: string | null = null,
                vendorId?: number,
                whatsAppTemplate?: any,
                inputFields?: Record<string, any>,
            ): Promise<any> {
                vendorId = vendorId;
    
    // Check if vendor has active plan
    const vendorPlanDetails = await this.getVendorCurrentActiveSubscription(contact.vendorId);
    if (!vendorPlanDetails.hasActivePlan) {
      // throw new BadRequestException(vendorPlanDetails.message);
    }

    request = request|| inputFields;

     console.log(request);

    // Get WhatsApp template
  
    if (request.template_id) {
      console.log('Looking up template by ID:', request.template_id);
      whatsAppTemplate = await this.prisma.whatsappTemplate.findFirst({
        where: { id: Number(request.template_id) },
      });
    } else if (request.template_uid) {
      console.log('Looking up template by UID:', request.template_uid);
      whatsAppTemplate = await this.prisma.whatsappTemplate.findFirst({
        where: { uid: request.template_uid },
      });
    }


  if (!whatsAppTemplate) {
    this.logger.error(
      `WhatsApp template not found for ID: ${request.template_id || request.template_uid}`,
    );
    throw new NotFoundException('WhatsApp template not found');
  }

  // ✅ Parse template data safely
  let templateData: any = {};
  try {
    if (typeof whatsAppTemplate.data === 'string') {
      templateData = JSON.parse(whatsAppTemplate.data);
    } else if (typeof whatsAppTemplate.data === 'object') {
      templateData = whatsAppTemplate.data;
    } else {
      this.logger.error(`Invalid template data format: ${typeof whatsAppTemplate.data}`);
      throw new Error('Invalid template data');
    }
  } catch (err) {
    this.logger.error(
      `JSON parse failed for template_id ${whatsAppTemplate?.id || 'unknown'}: ${err.message}`,
    );
    throw new BadRequestException('WhatsApp template data is not in valid JSON format.');
  }
      console.log('level2');
      // console.log(whatsAppTemplate);

      const contactWhatsappNumber = contact.wa_id;
      // First parse the JSON string in the data property
    //  let templateData: any = {};
    //   try {
    //     if (whatsAppTemplate.data && typeof whatsAppTemplate.data === 'string') {
    //       templateData = JSON.parse(whatsAppTemplate.data);
    //     } else {
    //       this.logger.error(`Invalid template data format: ${typeof whatsAppTemplate.data}`);
    //       throw new BadRequestException('Invalid template data');
    //     }
    //   } catch (err) {
    //     this.logger.error(`JSON parse failed for template_id ${whatsAppTemplate.id}: ${err.message}`);
    //     throw new BadRequestException('WhatsApp template data is not in valid JSON format.');
    //   }

      // console.log('level4');
      // return templateData;
      const templateProforma = templateData.template ?? templateData;
      
      const templateComponents = templateProforma.components || [];

    // Prepare validations
    const componentValidations: Record<string, any[]> = {};
    let bodyComponentText = '';
    let headerComponentText = '';
    const pattern = /{{\d+}}/g;

    for (const component of templateComponents) {
      if (component.type === 'HEADER') {
        const headerFormat = component.format;
        if (headerFormat === 'TEXT') {
          headerComponentText = component.text;
          const headerMatches = headerComponentText.match(pattern) || [];
          headerMatches.forEach(match => {
            const item = `header_field_${match.replace(/[{}]/g, '')}`;
            componentValidations[item] = ['required'];
          });
        } else if (headerFormat === 'LOCATION') {
          componentValidations['location_latitude'] = ['required', 'latitude'];
          componentValidations['location_longitude'] = ['required', 'longitude'];
          componentValidations['location_name'] = ['required', 'string'];
          componentValidations['location_address'] = ['required', 'string'];
        } else if (headerFormat === 'IMAGE') {
          componentValidations['header_image'] = ['required'];
        } else if (headerFormat === 'VIDEO') {
          componentValidations['header_video'] = ['required'];
        } else if (headerFormat === 'DOCUMENT') {
          componentValidations['header_document'] = ['required'];
          componentValidations['header_document_name'] = ['required'];
        }
      } else if (component.type === 'BODY') {
        bodyComponentText = component.text;
        const matches = bodyComponentText.match(pattern) || [];
        matches.forEach(match => {
          const item = `field_${match.replace(/[{}]/g, '')}`;
          componentValidations[item] = ['required'];
        });
      } else if (component.type === 'BUTTONS') {
        let btnIndex = 0;
        for (const btn of component.buttons) {
          if (btn.type === 'URL' && btn.url.includes('{{1}}')) {
            componentValidations[`button_${btnIndex}`] = ['required'];
          } else if (btn.type === 'COPY_CODE') {
            componentValidations['copy_code'] = ['required', 'alpha_dash'];
          }
          btnIndex++;
        }
      }
    }

    // Validate inputs if not for campaign
    if (!isForCampaign) {
       await this.validateInputs(request ?? {}, componentValidations);
    }

    // Process the data
    const componentBody: any[] = [];
    let mainIndex = 0;

    // Body component
    componentBody[mainIndex] = {
      type: 'body',
      parameters: {},
    };

    // for (const [key, value] of Object.entries(request)) {
    //   if (key.startsWith('field_')) {
    //     const valueKeyName = key.replace('field_', '');
    //     componentBody[mainIndex].parameters[`{{${valueKeyName}}}`] = {
    //       type: 'text',
    //       text: this.ParameterHelper.setParameterValue(contact, request ?? {}, key),
    //     };
    //   }
    // }

          componentBody[mainIndex] = {
          type: 'body',
          parameters: [],
        };

        for (const [key, value] of Object.entries(request)) {
          if (key.startsWith('field_')) {
            const paramValue = await this.ParameterHelper.setParameterValue(contact, request, key);

            // Push in correct order
            componentBody[mainIndex].parameters.push({
              type: 'text',
              text: paramValue,
            });
          }
        }




console.log(JSON.stringify(componentBody, null, 2));

 const componentButtons: any[] = [];
const parametersComponentsCreations = ['COPY_CODE'];

for (const component of templateComponents) {
  if (component.type === 'HEADER') {
    mainIndex++;

    if (component.format === 'VIDEO') {
      const inputHeaderVideo = request.header_video;
      if (inputHeaderVideo && typeof inputHeaderVideo === 'string' && inputHeaderVideo.startsWith('http')) {
        request.whatsapp_video = inputHeaderVideo;
      } else if (inputHeaderVideo) {
        const isProcessed = await this.MediaService.uploadTempMedia(
          inputHeaderVideo,
          'whatsapp_video',
          contact.vendorId
        );
        if (!isProcessed.success) {
          throw new BadRequestException('Media upload failed');
        }
        request.whatsapp_video = isProcessed.file_path;
      } else {
        throw new BadRequestException('Header video missing');
      }

      componentBody[mainIndex] = {
        type: 'header',
        parameters: [
          {
            type: 'video',
            video: {
              link: request.whatsapp_video,
            },
          },
        ],
      };
    }

    else if (component.format === 'IMAGE') {
      const inputHeaderImage = request.header_image;
      if (inputHeaderImage && typeof inputHeaderImage === 'string' && inputHeaderImage.startsWith('http')) {
        request.whatsapp_image = inputHeaderImage;
      } else if (inputHeaderImage) {
        const isProcessed = await this.MediaService.uploadTempMedia(
          inputHeaderImage,
          'whatsapp_image',
          contact.vendorId
        );
        if (!isProcessed.success) {
          throw new BadRequestException('Media upload failed');
        }
        request.whatsapp_image = isProcessed.file_path;
      } else {
        throw new BadRequestException('Header image missing');
      }

      componentBody[mainIndex] = {
        type: 'header',
        parameters: [
          {
            type: 'image',
            image: {
              link: request.whatsapp_image,
            },
          },
        ],
      };
    }

    else if (component.format === 'DOCUMENT') {
      const inputHeaderDocument = request.header_document;
      if (inputHeaderDocument && typeof inputHeaderDocument === 'string' && inputHeaderDocument.startsWith('http')) {
        request.whatsapp_document = inputHeaderDocument;
      } else if (inputHeaderDocument) {
        const isProcessed = await this.MediaService.uploadTempMedia(
          inputHeaderDocument,
          'whatsapp_document',
          contact.vendorId
        );
        if (!isProcessed.success) {
          throw new BadRequestException('Media upload failed');
        }
        request.whatsapp_document = isProcessed.file_path;
      } else {
        throw new BadRequestException('Header document missing');
      }

      componentBody[mainIndex] = {
        type: 'header',
        parameters: [
          {
            type: 'document',
            document: {
              filename: await this.ParameterHelper.setParameterValue(
                contact,
                request ?? {},
                'header_document_name',
              ),
              link: request.whatsapp_document,
            },
          },
        ],
      };
    }

    else if (component.format === 'LOCATION') {
      componentBody[mainIndex] = {
        type: 'header',
        parameters: [
          {
            type: 'location',
            location: {
              latitude: await this.ParameterHelper.setParameterValue(contact, request ?? {}, 'location_latitude'),
              longitude: await this.ParameterHelper.setParameterValue(contact, request ?? {}, 'location_longitude'),
              name: await this.ParameterHelper.setParameterValue(contact, request ?? {}, 'location_name'),
              address: await this.ParameterHelper.setParameterValue(contact, request ?? {}, 'location_address'),
            },
          },
        ],
      };
    }

    else if (component.format === 'TEXT' && component.text.includes('{{1}}')) {
      componentBody[mainIndex] = {
        type: 'header',
        parameters: [
          {
            type: 'text',
            text: await this.ParameterHelper.setParameterValue(contact, request ?? {}, 'header_field_1'),
          },
        ],
      };
    }
  }

  else if (component.type === 'BUTTONS') {
    let componentButtonIndex = 0;
    const skipComponentsCreations = ['PHONE_NUMBER'];

    for (const button of component.buttons) {
      if (!skipComponentsCreations.includes(button.type)) {
        componentButtons[mainIndex] = {
          type: 'button',
          sub_type: button.type,
          index: componentButtonIndex,
          parameters: [],
        };

        if (parametersComponentsCreations.includes(button.type)) {
          // const couponValue = await this.ParameterHelper.setParameterValue(contact, request ?? {}, 'copy_code')|| "OFFER23";
          const couponValue = request.copy_code || "OFFER23";
          componentButtons[mainIndex].parameters.push({
            type: 'COUPON_CODE',
            coupon_code: couponValue,
          });

        } else if (button.type === 'URL' && button.url.includes('{{1}}')) {
          // const urlTextValue = await this.ParameterHelper.setParameterValue(
          //   contact, request ?? {}, `button_${componentButtonIndex}`)|| "career";
           const urlTextValue = request[`button_${componentButtonIndex}`] || "25";
          componentButtons[mainIndex].parameters.push({
            type: 'text',
            text: urlTextValue,
          });

        } else if (button.type === 'FLOW') {
          componentButtons[mainIndex].parameters.push({
            type: 'action',
            action: {},
          });
        }
      }
      componentButtonIndex++;
      mainIndex++;
    }
  }
}


    // Remove buttons with empty parameters
    const filteredComponentButtons = componentButtons.filter(
      (button) => button.parameters.length > 0,
    );

    const messageComponents = [...componentBody, ...filteredComponentButtons];
  
   console.log(JSON.stringify(messageComponents, null, 2));

    console.log(isForCampaign);

    if (isForCampaign) {
       console.log("12315");
      return {
        status: 'success',
        message: 'Message prepared for WhatsApp campaign',
        data: {
          whatsAppTemplateName: whatsAppTemplate.templateName,
          whatsAppTemplateLanguage: whatsAppTemplate.language,
          templateProforma,
          templateComponents,
          messageComponents,
          inputFields,
          fromPhoneNumberId: request.from_phone_number_id,
        },
      };
    }

    const contactsData = {
      _id: contact._id,
      _uid: contact._uid,
      first_name: contact.first_name,
      last_name: contact.last_name,
      countries__id: contact.countries__id,
      is_template_test_contact: request.is_template_test_contact,
    };

      let fromPhoneNumberId = request.from_phone_number_id;

  
console.log(fromPhoneNumberId);

    const result = await this.sendMessage({
      vendorId: contact.vendorId,
      contactId: contact.id,
      whatsappNumber: contactWhatsappNumber,
      contactUid: contact.uid,
      templateName: whatsAppTemplate.templateName,
      language: whatsAppTemplate.language,
      templateProforma,
      templateComponents,
      components: messageComponents,
      campaignId,
      contactMeta: contactsData,
      fromPhoneNumberId: fromPhoneNumberId,
    });

    return {
      ...result,
      inputFields,
    };
  }

      async sendMessage({
      vendorId,
      contactId,
      whatsappNumber,
      contactUid,
      templateName,
      language,
      templateProforma,
      templateComponents,
      components,
      campaignId = null,
      contactMeta = null,
      fromPhoneNumberId = null,
    }: {
      vendorId: number;
      contactId: number;
      whatsappNumber: string;
      contactUid: string;
      templateName: string;
      language: string;
      templateProforma: any[];
      templateComponents: any[];
      components: any[];
      campaignId?: string | null;
      contactMeta?: any;
      fromPhoneNumberId?: any | null;
    }) {
      // const currentPhoneNumberId =
        // fromPhoneNumberId || (await this.settingsService.get('current_phone_number_id', vendorId));

        const vendorID=vendorId;


      // const vendorSettingsRecord = await this.prisma.vendorSettings.findMany({
      //   where: {
      //     vendors__id: vendorID,
      //     name: {
      //       in: ['whatsapp_access_token', 'whatsapp_business_account_id','current_phone_number_id'],
      //     },
      //   },
      // });

      // if (!vendorSettingsRecord || vendorSettingsRecord.length < 3) {
      //   throw new HttpException('WhatsApp Access Token or WABA ID not found', HttpStatus.BAD_REQUEST);
      // }
       
      

  
      const currentPhoneNumberId = fromPhoneNumberId;

     const sendMessageResult = await this.sendTemplateMessage(
        vendorId,
        whatsappNumber,
        templateName,
        language,
        components,
        currentPhoneNumberId,
      );


      const messageResponseStatus = sendMessageResult?.messages?.[0]?.id ? 'accepted' : null;

    //  await this.prisma.whatsAppMessageLog.create({
    //   data: {
    //     uid: uuidv4(),
    //     vendorId: vendorId,
    //     status: messageResponseStatus,
    //     contactId: contactId,
    //     campaignId: campaignId,
    //     wabPhoneNumberId: currentPhoneNumberId,
    //     isIncomingMessage: 0,
    //     contactWaId: sendMessageResult?.contacts?.[0]?.wa_id,
    //     wamid: sendMessageResult?.messages?.[0]?.id,
    //     data: {
    //       contact_data: contactMeta,
    //       initial_response: sendMessageResult,
    //       template_proforma: templateProforma,
    //       template_components: templateComponents,
    //       template_component_values: components,
    //     },
    //   }
    // });

    const logPayload = {
        uid: uuidv4(),
        vendorId: vendorId,
        status: messageResponseStatus,
        contactId: contactId,
        campaignId: campaignId,
        wabPhoneNumberId: Number(currentPhoneNumberId),
        isIncomingMessage: 0,
        contactWaId: sendMessageResult?.contacts?.[0]?.wa_id,
        wamid: sendMessageResult?.messages?.[0]?.id,
        data: JSON.stringify({
          contact_data: contactMeta,
          initial_response: sendMessageResult,
          template_proforma: templateProforma,
          template_components: templateComponents,
          template_component_values: components,
        }),
      };



      const logMessage = await this.MessageLogRepository.create(logPayload);

      if (messageResponseStatus === 'accepted') {
        const contact = await this.contactRepository.findByUid(contactUid);

        return {
          success: true,
          messageUid: logMessage.uid,
          contactUid,
          log_message: logMessage,
          contact,
          message: 'Message processed for WhatsApp contact',
        };
      }

      return {
        success: false,
        message: `Failed to process Message for WhatsApp contact. Status: ${messageResponseStatus}`,
      };
    }

     async sendTemplateMessage(
        vendorId: number,
        toNumber: string,
        templateName: string,
        language: string,
        components: any[],
        fromPhoneNumberId?: string, // optional override
        campaignId?: string | null,
      ): Promise<any> {
        // 1. Get vendor settings from DB
        const vendorSettings = await this.prisma.vendorSettings.findMany({
            where: {
              vendors__id: vendorId,
              name: {
                in: [
                  'whatsapp_access_token',
                  'whatsapp_business_account_id',
                  'current_phone_number_id',
                ],
              },
            },
          });

          // Validate vendor settings exist
          if (!vendorSettings || vendorSettings.length === 0) {
            throw new HttpException('WhatsApp configuration incomplete', HttpStatus.BAD_REQUEST);
          }

          // Extract encrypted access token
          const encryptedAccessToken = vendorSettings.find(
            (s) => s.name === 'whatsapp_access_token',
          )?.value;

          if (!encryptedAccessToken) {
            throw new HttpException('WhatsApp access token missing', HttpStatus.BAD_REQUEST);
          }

          // Decrypt safely
          let accessToken: string;
          try {
            accessToken = this.encryptionService.decrypt(encryptedAccessToken);
          } catch (err) {
            console.error('Decryption failed:', err);
            throw new HttpException('Failed to decrypt WhatsApp access token', HttpStatus.INTERNAL_SERVER_ERROR);
          }

          // Validate decrypted token
          if (!accessToken) {
            throw new HttpException('Decrypted WhatsApp access token is empty', HttpStatus.BAD_REQUEST);
          }

          console.log('Decrypted access token:', accessToken);
          console.log('Components:', components);

          if(campaignId){
            
          }

           if (!fromPhoneNumberId) {
                const encryptedPhoneNumberId = vendorSettings.find(s => s.name === 'current_phone_number_id')?.value;

                if (!encryptedPhoneNumberId) {
                  throw new HttpException('Phone number ID missing in vendor settings', HttpStatus.BAD_REQUEST);
                }

                try {
                  fromPhoneNumberId = this.encryptionService.decrypt(encryptedPhoneNumberId);
                } catch (err) {
                  console.error('Phone number decryption failed:', err);
                  throw new HttpException('Failed to decrypt phone number ID', HttpStatus.INTERNAL_SERVER_ERROR);
                }

                if (!fromPhoneNumberId) {
                  throw new HttpException('Decrypted phone number ID is empty', HttpStatus.BAD_REQUEST);
                }
              }


        // 2. Prepare payload
        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toNumber,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: language,
            },
            components: components || [],
          },
        };

            this.logger.log(`Preparing to send WhatsApp message`);
            this.logger.log(`To: ${toNumber}`);
            this.logger.log(`Vendor ID: ${vendorId}`);
            this.logger.log(`Template: ${templateName}`);
            this.logger.log(`Language: ${language}`);
            this.logger.log(`From Phone Number ID: ${fromPhoneNumberId}`);
            this.logger.log(`Message Components:\n${JSON.stringify(components, null, 2)}`);
            this.logger.log(`Payload:\n${JSON.stringify(payload, null, 2)}`);


        // 3. Send API request
        const url = `${this.baseApiEndpoint}/${fromPhoneNumberId}/messages`;
        try {
          const response = await axios.post(url, payload, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          });

          return response.data;
        } catch (error) {
          const err = error.response?.data?.error || {};
          const userMessage = [
            err.error_user_title,
            err.message,
            err.error_user_msg,
            err.error_data?.details,
          ].filter(Boolean).join(' ');

          throw new HttpException(
            userMessage || 'WhatsApp message sending failed',
            error.response?.status || 500,
          );
        }
      }




    async validateInputs(inputs: Record<string, any>, validations: Record<string, any>) {
    const errors: string[] = [];

    for (const [key, rules] of Object.entries(validations)) {
      const value = inputs[key];

      for (const rule of rules) {
        if (rule.type === 'required' && (value === undefined || value === null || value === '')) {
          errors.push(`${key} is required.`);
        }

        if (rule.type === 'minLength' && typeof value === 'string' && value.length < rule.value) {
          errors.push(`${key} must be at least ${rule.value} characters long.`);
        }

        if (rule.type === 'maxLength' && typeof value === 'string' && value.length > rule.value) {
          errors.push(`${key} must be at most ${rule.value} characters long.`);
        }

        if (rule.type === 'regex' && typeof value === 'string' && !new RegExp(rule.pattern).test(value)) {
          errors.push(`${key} format is invalid.`);
        }

        if (rule.type === 'number' && typeof value !== 'number') {
          errors.push(`${key} must be a number.`);
        }

        if (rule.type === 'in' && !rule.values.includes(value)) {
          errors.push(`${key} must be one of: ${rule.values.join(', ')}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Validation failed', errors });
    }
  }
}
