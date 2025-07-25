import { NotFoundException,BadRequestException,} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AutomationDto,GetFlowDto } from './dto/automation.dto';
import { v4 as uuidv4 } from 'uuid';
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { differenceInMilliseconds, addMinutes,isBefore} from 'date-fns';
import { Prisma } from '@prisma/client';
import { automation_flow_steps } from '@prisma/client';
import { DateTime } from 'luxon';
import { MyLogger } from '../logger.service';
import { EncryptionService } from 'src/common/encryption/encryption.service';


@Injectable()
export class AutomationService {
  // private readonly logger = new Logger(AutomationService.name);
  
  
  constructor(private prisma: PrismaService, @InjectQueue('abandonedQueue') private readonly abandonedQueue: Queue,private readonly logger: MyLogger,private readonly EncryptionService: EncryptionService) {}
 
   async getCheckoutWithLogs(checkout_id: number) {
            const checkouts = await this.prisma.abandonedCheckouts.findFirst({
              where: { id: checkout_id },
            });

            if (!checkouts) return null;

            const logs = await this.prisma.whatsAppMessageLog.findMany({
              where: { abandoned_checkout_id: checkouts.id },
              orderBy: { createdAt: 'desc' },
            });

            if (logs.length === 0) {
              return {
                checkouts,
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
              checkouts,
              logs: formattedLogs,
              total_contacts: total,
              delivered_percent,
              read_percent,
              failed_percent,
            };
          }

             async getCODWithLogs(checkout_id: number) {
            const checkouts = await this.prisma.abandonedCheckouts.findFirst({
              where: { id: checkout_id },
            });

            if (!checkouts) return null;

            const logs = await this.prisma.whatsAppMessageLog.findMany({
              where: { cod_id: checkouts.id },
              orderBy: { createdAt: 'desc' },
            });

            if (logs.length === 0) {
              return {
                checkouts,
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
              checkouts,
              logs: formattedLogs,
              total_contacts: total,
              delivered_percent,
              read_percent,
              failed_percent,
            };
          }



 async create(dto: AutomationDto) {
  const { vendors__id, flow_name, flow_json } = dto;

  // Check for existing flow
  const existingFlow = await this.prisma.automationFlows.findFirst({
    where: {
      vendorsId: vendors__id,
      title: flow_name,
    },
  });

  const payload = {
    data: JSON.stringify(flow_json),
    updatedAt: new Date(),
    startTrigger: flow_name,
  };

  let flow;

  if (existingFlow) {
    // Update existing
    flow = await this.prisma.automationFlows.update({
      where: { id: existingFlow.id },
      data: payload,
    });

    // Optional cleanup of previous steps
    await this.prisma.automation_flow_steps.deleteMany({
      where: { automation_flow_id: flow.id },
    });

    this.logger.log(`Updated existing flow: ${flow_name} (ID: ${flow.id})`);
  } else {
    // Create new flow
    flow = await this.prisma.automationFlows.create({
      data: {
        ...payload,
        title: flow_name,
        vendorsId: vendors__id,
        uid: uuidv4(),
        status: 1,
        createdAt: new Date(),
      },
    });

    this.logger.log(`Created new flow: ${flow_name} (ID: ${flow.id})`);
  }

  const parsedJson = flow_json;

  for (const [i, node] of parsedJson.nodes.entries()) {
    if (node.type !== 'timenode') continue;

    const waitTime = Number(node.data?.waitTime ?? 0);
    const waitUnit = String(node.data?.waitUnit ?? 'Minutes').toLowerCase();

    // Convert time to minutes
    let delayInMinutes = 0;
    if (waitUnit === 'hours') delayInMinutes = waitTime * 60;
    else if (waitUnit === 'days') delayInMinutes = waitTime * 1440;
    else delayInMinutes = waitTime;

    // Get edge from this timenode to target
    const edge = parsedJson.edges.find(e => e.source === node.id);
    if (!edge) {
      this.logger.warn(`No edge found from timenode ${node.id}`);
      continue;
    }

    const targetNode = parsedJson.nodes.find(n => n.id === edge.target);
    if (!targetNode) {
      this.logger.warn(`Target node ${edge.target} not found for timenode ${node.id}`);
      continue;
    }

    const templateId = targetNode.data?.templateId;
    if (!templateId || isNaN(Number(templateId))) {
      this.logger.warn(`Template ID missing or invalid in node ${targetNode.id}`);
      continue;
    }

    const templateParams = targetNode.data?.templateParams;
    const safeParams =
      templateParams && typeof templateParams === 'object'
        ? templateParams
        : {};

    this.logger.log(
      `Saving step: Flow ID ${flow.id}, Order ${i + 1}, Template ID ${templateId}, Delay ${delayInMinutes} mins, Params: ${JSON.stringify(
        safeParams,
      )}`,
    );

    await this.prisma.automation_flow_steps.create({
      data: {
        uid: uuidv4(),
        automation_flow_id: flow.id,
        flow_step_order: i + 1,
        delay_minutes: delayInMinutes,
        template_id: Number(templateId),
        type: 1, // timenode
        created_at: new Date(),
        updated_at: new Date(),
        variable_data: safeParams,
      },
    });
  }

  return flow;
}
  // async create(dto: AutomationDto) {
  //   const { vendors__id, flow_name, flow_json } = dto;
  
  //   // Find existing flow
  //   const existingFlow = await this.prisma.automationFlows.findFirst({
  //     where: {
  //       vendorsId: vendors__id,
  //       title: flow_name,
  //     },
  //   });
  
  //   const payload = {
  //     data: JSON.stringify(flow_json),
  //     updatedAt: new Date(),
  //     startTrigger: flow_name,
  //   };
  
  //   let flow;
  
  //   if (existingFlow) {
  //     // Update existing flow
  //     flow = await this.prisma.automationFlows.update({
  //       where: { id: existingFlow.id },
  //       data: payload,
  //     });
  //     // Delete old steps (optional, depends on your use case)
  //     await this.prisma.automation_flow_steps.deleteMany({
  //       where: { automation_flow_id: flow.id },
  //     });
  //   } else {
  //     // Create new flow
  //     flow = await this.prisma.automationFlows.create({
  //       data: {
  //         ...payload,
  //         title: flow_name,
  //         vendorsId: vendors__id,
  //         uid: uuidv4(),
  //         status: 1,
  //         createdAt: new Date(),
  //       },
  //     });
  //   }
  
  //   const parsedJson = flow_json; 
  
    
  //   function getTemplateIdForNode(node: any): number {
  //     console.log(node?.data?.templateId);
  //     return Number(node?.data?.templateId); 
  //   }
    
  //     for (const [i, node] of parsedJson.nodes.entries()) {
  //       if (node.type !== 'timenode') continue;

  //       const waitTime = Number(node.data?.waitTime ?? 0);
  //       const waitUnit = String(node.data?.waitUnit ?? 'Minutes').toLowerCase();

  //       // Convert waitTime and waitUnit to delayInMinutes
  //       let delayInMinutes = 0;
  //       if (waitUnit === 'hours') delayInMinutes = waitTime * 60;
  //       else if (waitUnit === 'days') delayInMinutes = waitTime * 1440;
  //       else delayInMinutes = waitTime;

  //       // Find edge from this timenode to the next node
  //       const edge = parsedJson.edges.find(e => e.source === node.id);
  //       if (!edge) {
  //         console.warn(`No edge found from timenode ${node.id}`);
  //         continue;
  //       }

  //       // Get the target node connected to this timenode
  //       const targetNode = parsedJson.nodes.find(n => n.id === edge.target);
  //       if (!targetNode) {
  //         console.warn(`Target node ${edge.target} not found for timenode ${node.id}`);
  //         continue;
  //       }

  //       const templateId = targetNode.data?.templateId;
  //       if (typeof templateId !== 'number') {
  //         console.warn(`Skipping timenode ${node.id}: Linked node ${targetNode.id} missing templateId`);
  //         continue;
  //       }

  //     await this.prisma.automation_flow_steps.create({
  //       data: {
  //         uid: uuidv4(),
  //         automation_flow_id: flow.id,
  //         flow_step_order: i + 1,
  //         delay_minutes: delayInMinutes,
  //         template_id: templateId,
  //         type: 1, // TimeNode type
  //         created_at: new Date(),
  //         updated_at: new Date(),
  //         variable_data: targetNode.data?.templateParams && targetNode.data.templateParams.length > 0
  //           ? targetNode.data.templateParams  // pass object/array directly here
  //           : null,
  //       },
  //     });


  //     }
  //   return flow;
  // }
  
  // async create(dto: AutomationDto) {
  //   const existingFlow = await this.prisma.automationFlows.findFirst({
  //     where: {
  //       vendorsId: dto.vendors__id,
  //       title: dto.flow_name,
  //     },
  //   });

    
  
  //   if (existingFlow) {
  //     // Update the existing flow
  //     return await this.prisma.automationFlows.update({
  //       where: { id: existingFlow.id },
  //       data: {
  //         data: JSON.stringify(dto.flow_json),
  //         updatedAt: new Date(),
  //         startTrigger: dto.flow_name,
  //       },
  //     });
  //   } else {
  //     // Create new flow
  //     return await this.prisma.automationFlows.create({
  //       data: {
  //         title: dto.flow_name,
  //         vendorsId: dto.vendors__id,
  //         data: JSON.stringify(dto.flow_json),
  //         uid: uuidv4(),
  //         startTrigger: dto.flow_name,
  //         status: 1,
  //         createdAt: new Date(),
  //         updatedAt: new Date(),
  //       },
  //     });
  //   }


    
  // }
        async getFlowJson(dto: GetFlowDto) {
          if (!dto.vendorId || !dto.flowId) {
            throw new BadRequestException('vendorId and flowId are required');
          }
        
          console.log('Fetching flow with:', {
            vendorId: dto.vendorId,
            flowId: dto.flowId,
          });
        
          const flow = await this.prisma.automationFlows.findFirst({
            where: {
              vendorsId: Number(dto.vendorId),
              id: Number(dto.flowId),
            },
            select: {
              data: true,
              title: true,
              vendorsId: true,
            },
          });
        
          console.log('Flow found:', flow);
        
          if (!flow) {
            throw new NotFoundException('Flow not found');
          }
        
          return {
            status_code: 200,
            message: 'Flow JSON fetched successfully',
            data: typeof flow.data === 'string' ? JSON.parse(flow.data) : flow.data,
          };
        }

       async listFlowsByVendorId(vendorId: number) {
        if (!vendorId) {
          throw new BadRequestException('Vendor ID is required');
        }

        const requiredTitles = ['cod_order', 'abandoned_cart'];

        // 1️⃣ Fetch vendor-specific flows
        const vendorFlows = await this.prisma.automationFlows.findMany({
          where: {
            vendorsId: vendorId,
            title: { in: requiredTitles },
          },
          select: {
            id: true,
            title: true,
            data: true,
          },
        });

        // 2️⃣ Find which required titles are missing
        const foundTitles = vendorFlows.map(flow => flow.title);
        const missingTitles = requiredTitles.filter(title => !foundTitles.includes(title));

        // 3️⃣ Fetch missing ones from vendorId = 0
        let defaultFlows: any[] = [];
        if (missingTitles.length > 0) {
          defaultFlows = await this.prisma.automationFlows.findMany({
            where: {
              vendorsId: 0,
              title: { in: missingTitles },
            },
            select: {
              id: true,
              title: true,
              data: true,
            },
          });
        }

        // 4️⃣ Combine all
        const allFlows = [...vendorFlows, ...defaultFlows];

        return {
          status_code: 200,
          message: 'Flow list fetched successfully',
          data: allFlows.map(f => ({
            id: f.id,
            title: f.title,
            json: this.safeJsonParse(f.data),
          })),
        };
      }


  // Optional utility method for safe JSON parsing
  private safeJsonParse(data: string | null): any {
    try {
      return data ? JSON.parse(data) : {};
    } catch (err) {
      return {}; // fallback in case of malformed JSON
    }
  }


     async processCodOrders() {
          this.logger.log('Fetching cod orders...');

          const abandonedItems = await this.prisma.abandonedCheckouts.findMany({
            where:{
        checkout_status: 'completed',
         payment_method: 'COD',
      },
          });

          if (abandonedItems.length === 0) {
            this.logger.log('No pending COD found');
            return;
          }

          for (const item of abandonedItems) {
            if (!item.phone) {
              this.logger.warn(`Skipping ${item.id} - missing phone number`);
              continue;
            }

            try {
              const flow = await this.prisma.automationFlows.findFirst({
                where: {
                  title: 'cod_order',
                  status: 1,
                  vendorsId: item.shopify_vendor ? Number(item.shopify_vendor) : undefined,
                },
                orderBy: { id: 'desc' },
              });

              if (!flow) {
                this.logger.warn(`No active flow found for vendor ${item.shopify_vendor}`);
                continue;
              }

              const steps = await this.prisma.automation_flow_steps.findMany({
                where: { automation_flow_id: flow.id },
                orderBy: { flow_step_order: 'asc' },
              });

            let firstPendingStep: automation_flow_steps | null = null;

              for (const step of steps) {
                const existingLog = await this.prisma.abandonedCheckoutLogs.findFirst({
                  where: {
                    abandonedId: item.id,
                    step: step.flow_step_order,
                    status: { in: ['queued', 'sent'] },
                  },
                });
                

                if (!existingLog) {
                  firstPendingStep = step;
                  break;
                }
              }

              if (!firstPendingStep) {
                this.logger.log(`All steps already processed for COD ID ${item.id}`);
                continue;
              }

              if (!item.updated_at) {
                this.logger.warn(`No updated_at for COD ${item.id}, skipping`);
                continue;
              }

              const scheduledTime = addMinutes(item.updated_at, firstPendingStep.delay_minutes);
              const now = new Date();

             if (isBefore(now, scheduledTime)) {
                this.logger.log(
                  ` Step ${firstPendingStep.flow_step_order} not ready for ${item.id}. Scheduled at ${scheduledTime.toISOString()}`
                );

                this.logger.log(
                  `ID: ${item.id} | updated_at: ${item.updated_at?.toISOString()} | step_delay: ${firstPendingStep?.delay_minutes} | scheduledTime: ${scheduledTime.toISOString()} | now: ${now.toISOString()}`
                );

                continue;
              }

              const payload: Record<string, string> = {};
              const vars = firstPendingStep.variable_data;

              if (vars) {
                try {
                  const parsed = typeof vars === 'string' ? JSON.parse(vars) : vars;
                  const entries = Array.isArray(parsed)
                    ? parsed.flatMap((item: any) => Object.entries(item))
                    : Object.entries(parsed);

                  for (const [key, value] of entries) {
                    payload[key] = String(value ?? '');
                  }
                } catch (error) {
                  this.logger.error(`Failed to parse variable_data for step ${firstPendingStep.id}`);
                }
              }

              payload['template_id'] = String(firstPendingStep.template_id);

              const vendorSettings = await this.prisma.vendorSettings.findMany({
                where: {
                  vendors__id: item.shopify_vendor,
                  name: { in: ['current_phone_number_id'] },
                },
              });

              const phoneNumberSetting = vendorSettings.find((v) => v.name === 'current_phone_number_id');

              if (!phoneNumberSetting?.value) {
                this.logger.error(`Phone number ID missing for vendor ${item.shopify_vendor}`);
                continue;
              }

              payload['from_phone_number_id'] = this.EncryptionService.decrypt(phoneNumberSetting.value);

              const contact = {
                vendorId: item.shopify_vendor,
                wa_id: item.phone,
                id: item.id,
                first_name: item.name?.split(' ')[0] || 'Customer',
                last_name: item.name?.split(' ')[0] || 'Customer',
                uid: `abandoned_${item.id}`,
                checkout_id: item.checkout_id,
                name: item.name,
                phone: item.phone,
                abandoned_url: item.abandoned_url,
                total_price: item.total_price,
                created_at: item.created_at,
                checkout_status: item.checkout_status,
                shipping_charge: item.shipping_charge,
                total_tax: item.total_tax,
                shopify_currency: item.shopify_currency,
                shopify_address: item.shopify_address,
                shopify_street: item.shopify_street,
                shopify_city: item.shopify_city,
                shopify_zip: item.shopify_zip,
              };

              const jobData = {
                request: payload,
                contact,
                vendorId: item.shopify_vendor,
                flow_step_order: firstPendingStep.flow_step_order,
                abandonedId: item.id,
              };
            try {
              const addedJob = await this.abandonedQueue.add('handleSendCodWhatsapp', jobData, {
                      attempts: 1,
                      backoff: { type: 'exponential', delay: 5000 },
                    });


              this.logger.log(`Queued job ID: ${addedJob.id}`);
            } catch (err) {
              this.logger.error(`Failed to queue job: ${err.message}`);
            }



              await this.prisma.abandonedCheckoutLogs.create({
                data: {
                  abandonedId: item.id,
                  status: 'queued',
                  step: firstPendingStep.flow_step_order,
                },
              });

              this.logger.log(`Queued WhatsApp for ${item.id} step ${firstPendingStep.flow_step_order}`);
            } catch (error) {
              this.logger.error(`Failed to process COd ID ${item.id}: ${error.message}`);
            }
          }
        }
  
        async processAbandonedCheckouts() {
          this.logger.log('Fetching abandoned checkouts...');

          const abandonedItems = await this.prisma.abandonedCheckouts.findMany({
            where: { checkout_status: 'pending' },
          });

          if (abandonedItems.length === 0) {
            this.logger.log('No pending checkouts found');
            return;
          }

          for (const item of abandonedItems) {
            if (!item.phone) {
              this.logger.warn(`Skipping ${item.id} - missing phone number`);
              continue;
            }

            try {
              const flow = await this.prisma.automationFlows.findFirst({
                where: {
                  title: 'abandoned_cart',
                  status: 1,
                  vendorsId: item.shopify_vendor ? Number(item.shopify_vendor) : undefined,
                },
                orderBy: { id: 'desc' },
              });

              if (!flow) {
                this.logger.warn(`No active flow found for vendor ${item.shopify_vendor}`);
                continue;
              }

              const steps = await this.prisma.automation_flow_steps.findMany({
                where: { automation_flow_id: flow.id },
                orderBy: { flow_step_order: 'asc' },
              });

            let firstPendingStep: automation_flow_steps | null = null;

              for (const step of steps) {
                const existingLog = await this.prisma.abandonedCheckoutLogs.findFirst({
                  where: {
                    abandonedId: item.id,
                    step: step.flow_step_order,
                    status: { in: ['queued', 'sent'] },
                  },
                });
                

                if (!existingLog) {
                  firstPendingStep = step;
                  break;
                }
              }

              if (!firstPendingStep) {
                this.logger.log(`All steps already processed for abandoned ID ${item.id}`);
                continue;
              }

              if (!item.updated_at) {
                this.logger.warn(`No updated_at for abandoned checkout ${item.id}, skipping`);
                continue;
              }

              const scheduledTime = addMinutes(item.updated_at, firstPendingStep.delay_minutes);
              const now = new Date();

             if (isBefore(now, scheduledTime)) {
                this.logger.log(
                  ` Step ${firstPendingStep.flow_step_order} not ready for ${item.id}. Scheduled at ${scheduledTime.toISOString()}`
                );

                this.logger.log(
                  `ID: ${item.id} | updated_at: ${item.updated_at?.toISOString()} | step_delay: ${firstPendingStep?.delay_minutes} | scheduledTime: ${scheduledTime.toISOString()} | now: ${now.toISOString()}`
                );

                continue;
              }

              const payload: Record<string, string> = {};
              const vars = firstPendingStep.variable_data;

              if (vars) {
                try {
                  const parsed = typeof vars === 'string' ? JSON.parse(vars) : vars;
                  const entries = Array.isArray(parsed)
                    ? parsed.flatMap((item: any) => Object.entries(item))
                    : Object.entries(parsed);

                  for (const [key, value] of entries) {
                    payload[key] = String(value ?? '');
                  }
                } catch (error) {
                  this.logger.error(`Failed to parse variable_data for step ${firstPendingStep.id}`);
                }
              }

              payload['template_id'] = String(firstPendingStep.template_id);

              const vendorSettings = await this.prisma.vendorSettings.findMany({
                where: {
                  vendors__id: item.shopify_vendor,
                  name: { in: ['current_phone_number_id'] },
                },
              });

              const phoneNumberSetting = vendorSettings.find((v) => v.name === 'current_phone_number_id');

              if (!phoneNumberSetting?.value) {
                this.logger.error(`Phone number ID missing for vendor ${item.shopify_vendor}`);
                continue;
              }

              payload['from_phone_number_id'] = this.EncryptionService.decrypt(phoneNumberSetting.value);

              const contact = {
                vendorId: item.shopify_vendor,
                wa_id: item.phone,
                id: item.id,
                first_name: item.name?.split(' ')[0] || 'Customer',
                last_name: item.name?.split(' ')[0] || 'Customer',
                uid: `abandoned_${item.id}`,
                checkout_id: item.checkout_id,
                name: item.name,
                phone: item.phone,
                abandoned_url: item.abandoned_url,
                total_price: item.total_price,
                created_at: item.created_at,
                checkout_status: item.checkout_status,
                shipping_charge: item.shipping_charge,
                total_tax: item.total_tax,
                shopify_currency: item.shopify_currency,
                shopify_address: item.shopify_address,
                shopify_street: item.shopify_street,
                shopify_city: item.shopify_city,
                shopify_zip: item.shopify_zip,
              };

              const jobData = {
                request: payload,
                contact,
                vendorId: item.shopify_vendor,
                flow_step_order: firstPendingStep.flow_step_order,
                abandonedId: item.id,
              };
            try {
              const addedJob = await this.abandonedQueue.add('handleSendAbandonedWhatsapp', jobData, {
                      attempts: 1,
                      backoff: { type: 'exponential', delay: 5000 },
                    });


              this.logger.log(`Queued job ID: ${addedJob.id}`);
            } catch (err) {
              this.logger.error(`Failed to queue job: ${err.message}`);
            }



              await this.prisma.abandonedCheckoutLogs.create({
                data: {
                  abandonedId: item.id,
                  status: 'queued',
                  step: firstPendingStep.flow_step_order,
                },
              });

              this.logger.log(`Queued WhatsApp for ${item.id} step ${firstPendingStep.flow_step_order}`);
            } catch (error) {
              this.logger.error(`Failed to process abandoned ID ${item.id}: ${error.message}`);
            }
          }
        }

        // async processAbandonedCheckouts() {
        //   this.logger.log('Fetching abandoned checkouts...');

        //   // 1. Get pending checkouts
        //   const abandonedItems = await this.prisma.abandonedCheckouts.findMany({
        //     where: { checkout_status: 'pending' },
        //   });

        //   if (abandonedItems.length === 0) {
        //     this.logger.log('No pending checkouts found');
        //     return;
        //   }

        //   // 2. Process each item
        //   for (const item of abandonedItems) {
        //     if (!item.phone) {
        //       this.logger.warn(`Skipping ${item.id} - missing phone number`);
        //       continue;
        //     }

        //     try {
        //       // 3. Get automation flow
        //       const flow = await this.prisma.automationFlows.findFirst({
        //         where: {
        //           title: 'abandoned_cart',
        //           status: 1,
        //           vendorsId: item.shopify_vendor ? Number(item.shopify_vendor) : undefined,
        //         },
        //         orderBy: { id: 'desc' },
        //       });

        //       if (!flow) {
        //         this.logger.warn(`No active flow found for vendor ${item.shopify_vendor}`);
        //         continue;
        //       }

        //       // 4. Get flow steps
        //       const steps = await this.prisma.automation_flow_steps.findMany({
        //         where: { automation_flow_id: flow.id },
        //         orderBy: { flow_step_order: 'asc' },
        //       });

        //       // 5. Process each step
        //       for (const step of steps) {
        //         // Check if already processed
        //         const existingLog = await this.prisma.abandonedCheckoutLogs.findFirst({
        //           where: {
        //             abandonedId: item.id,
        //             step: step.flow_step_order,
        //             status: { in: ['queued', 'sent'] }
        //           }
        //         });

        //         if (existingLog) {
        //           this.logger.log(`Step ${step.flow_step_order} already processed for ${item.id}`);
        //           continue;
        //         }

        //         // 6. Create the EXACT WhatsApp request format
        //          const payload: Record<string, string> = {};

        //           if (step.variable_data) {
        //             let parsed: any;

        //             if (typeof step.variable_data === 'string') {
        //               try {
        //                 parsed = JSON.parse(step.variable_data);
        //               } catch (error) {
        //                 console.error('Failed to parse variable_data string:', error);
        //                 parsed = {};
        //               }
        //             } else {
        //               parsed = step.variable_data;
        //             }

        //             if (Array.isArray(parsed)) {
        //               // If it's an array, flatten or handle as needed
        //               parsed.forEach((item, index) => {
        //                 if (typeof item === 'object') {
        //                   Object.entries(item).forEach(([key, value]) => {
        //                     payload[`${key}`] = value !== null && value !== undefined ? String(value) : '';
        //                   });
        //                 }
        //               });
        //             } else if (typeof parsed === 'object' && parsed !== null) {
        //               // Handle object
        //               Object.entries(parsed).forEach(([key, value]) => {
        //                 payload[key] = value !== null && value !== undefined ? String(value) : '';
        //               });
        //             }
        //           }

        //           // Add template_id if exists
        //           if (step.template_id !== undefined && step.template_id !== null) {
        //             payload['template_id'] = String(step.template_id);

        //             const vendorSettingsRecord = await this.prisma.vendorSettings.findMany({
        //               where: {
        //                 vendors__id: item.shopify_vendor,
        //                 name: {
        //                   in: [
        //                     'whatsapp_access_token',
        //                     'whatsapp_business_account_id',
        //                     'current_phone_number_id',
        //                     'webhook_verified_at',
        //                     'whatsapp_phone_numbers',
        //                     'whatsapp_health_status_data',
        //                   ],
        //                 },
        //               },
        //             });

        //             if (!vendorSettingsRecord || vendorSettingsRecord.length < 5) {
        //               this.logger.error(`Whatsapp Facebook Setup Not Implemented for vendor: ${item.shopify_vendor}`);
        //               continue;  // Skip to next abandoned checkout
        //             }

        //             const phonenumberidRecord = vendorSettingsRecord.find(item => item.name === 'current_phone_number_id');
        //             if (!phonenumberidRecord || !phonenumberidRecord.value) {
        //               this.logger.error(`Phone number ID not found for vendor: ${item.shopify_vendor}`);
        //               continue;
        //             }

        //             const phone_number_id = this.EncryptionService.decrypt(phonenumberidRecord.value);
        //             payload['from_phone_number_id'] = String(phone_number_id);
        //           }

        //           console.log(payload);
                                    
        //         // 7. Prepare contact info
        //         const contact = {
        //           vendorId: item.shopify_vendor,
        //           wa_id: item.phone,
        //           id: item.id,
        //           first_name: item.name?.split(' ')[0] || 'Customer',
        //           last_name: item.name?.split(' ')[0] || 'Customer',
        //           uid: `abandoned_${item.id}`,
        //           checkout_id:item.checkout_id,
        //           name:item.name,
        //           phone:item.phone,
        //           abandoned_url:item.abandoned_url,
        //           total_price:item.total_price,
        //           created_at:item.created_at,
        //           checkout_status:item.checkout_status,
        //           shipping_charge:item.shipping_charge,
        //           total_tax:item.total_tax,
        //           shopify_currency:item.shopify_currency,
        //           shopify_address:item.shopify_address,
        //           shopify_street:item.shopify_street,
        //           shopify_city:item.shopify_city,
        //           shopify_zip:item.shopify_zip,
        //         };

        //         // 8. Create job data
        //         const jobData = {
        //           request: payload,
        //           contact,
        //           vendorId: item.shopify_vendor,
        //           flow_step_order: step.flow_step_order,
        //           abandonedId: item.id
        //         };

        //       // const baseDate = item.updated_at ?? new Date(); // handle null
        //       // const scheduledTime = addMinutes(baseDate, step.delay_minutes);
        //       // const now = new Date();
        //       // const nowUtc = new Date(now.toISOString()); 
        //       // console.log(nowUtc);
        //       // console.log(scheduledTime);
        //         if (!item.updated_at) {
        //           this.logger.warn(`No updated_at for abandoned checkout ${item.id}, skipping`);
        //           continue;
        //         }

        //         const baseDate = item.updated_at;  // safe now
        //         const scheduledTime = addMinutes(baseDate, step.delay_minutes);
        //         const now: Date = new Date();

        //     console.log('Now:', now);
        //     console.log('Scheduled:', scheduledTime);


        //       if (scheduledTime > now) {

        //         // 9. Add to queue
        //         await this.abandonedQueue.add('handleSendAbandonedWhatsapp', jobData, {
        //           attempts: 1,
        //           backoff: { type: 'exponential', delay: 5000 }
        //         });

                

        //         // 10. Create log
        //         await this.prisma.abandonedCheckoutLogs.create({
        //           data: {
        //             abandonedId: item.id,
        //             status: 'queued',
        //             step: step.flow_step_order
        //           }
        //         });

        //         this.logger.log(`Queued WhatsApp for ${item.id} step ${step.flow_step_order}`);

        //         } else {
        //           this.logger.log(
        //             `Step ${step.flow_step_order} not ready for abandoned ID ${item.id}. Scheduled at ${scheduledTime.toISOString()}`
        //           );
        //         }
        //       }
        //     } catch (error) {
        //       this.logger.error(`Failed to process ${item.id}: ${error.message}`);
        //     }
        //   }
        // }
        async listAbandonedCart(vendor_uid: string, page: number, limit: number, search: string) {
          if (!vendor_uid) throw new BadRequestException('Vendor UID is required');

          const vendor = await this.prisma.vendors.findFirst({
            where: { uid: vendor_uid },
            select: { id: true },
          });

          if (!vendor) {
            // Vendor not found — return empty list with meta
            return {
              status_code: 200,
              message: 'Abandoned checkout list fetched successfully',
              data: [],
              meta: {
                page,
                limit,
                total: 0,
                totalPages: 0,
              },
            };
          }

          const skip = (page - 1) * limit;

          const where: any = {
            shopify_vendor: vendor.id,
            checkout_status: 'pending',
          };

          if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } },
            ];
          }

          const [items, total] = await this.prisma.$transaction([
            this.prisma.abandonedCheckouts.findMany({
              where,
              skip,
              take: limit,
              orderBy: { id: 'desc' },
            }),
            this.prisma.abandonedCheckouts.count({ where }),
          ]);

          return {
            status_code: 200,
            message: 'Abandoned checkout list fetched successfully',
            data: items,
            meta: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          };
        }


      async listCodOrders(vendor_uid: string, page: number, limit: number, search: string) {
        if (!vendor_uid) throw new BadRequestException('Vendor UID is required');

        const vendor = await this.prisma.vendors.findFirst({
          where: { uid: vendor_uid },
          select: { id: true },
        });

         if (!vendor) {
          // Vendor not found — return empty list with meta
          return {
            status_code: 200,
            message: 'Abandoned checkout list fetched successfully',
            data: [],
            meta: {
              page,
              limit,
              total: 0,
              totalPages: 0,
            },
          };
        }

        const skip = (page - 1) * limit;

        const where: any = {
          shopify_vendor: vendor.id,
          checkout_status: 'completed',
          payment_method: 'COD',
        };

        if (search) {
          where.OR = [
               { name: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } },
          ];
        }

        const [items, total] = await this.prisma.$transaction([
          this.prisma.abandonedCheckouts.findMany({
            where,
            skip,
            take: limit,
            orderBy: { id: 'desc' },
          }),
          this.prisma.abandonedCheckouts.count({ where }),
        ]);

        return {
          status_code: 200,
          message: 'COD List fetched successfully',
          data: items,
          meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      }




}



  // async processAbandonedCheckouts() {
  //   this.logger.log('Fetching abandoned checkouts with status pending...');
    
  //   const abandonedItems = await this.prisma.abandonedCheckouts.findMany({
  //     where: {
  //       checkout_status: 'pending',
  //     },
  //   });
  
  //   if (abandonedItems.length === 0) {
  //     this.logger.log('No pending abandoned checkouts found.');
  //     return;
  //   }
  
  //   for (const item of abandonedItems) {
  //     if (!item.email) {
  //       this.logger.warn(`Skipping abandoned checkout ${item.id} - no email`);
  //       continue;
  //     }
  
  //     try {
  //       // 1. Get automation flow
  //       const flow = await this.prisma.automationFlows.findFirst({
  //         where: {
  //           title: "abandoned_cart", 
  //           status: 1,
  //         },
  //         orderBy: {
  //           id: 'desc',
  //         },
  //       });
  
  //       if (!flow) {
  //         this.logger.warn(`No active flow found for vendor abandoned_cart`);
  //         continue;
  //       }
  
  //       // 2. Get steps
  //       const steps = await this.prisma.automation_flow_steps.findMany({
  //         where: {
  //           automation_flow_id: flow.id,
  //         },
  //         orderBy: {
  //           flow_step_order: 'asc',
  //         },
  //       });
  
  //       if (steps.length === 0) {
  //         this.logger.warn(`No steps found for flow ${flow.id}`);
  //         continue;
  //       }
  
  //       const now = new Date();
  
  //       for (const step of steps) {

         
  //         const baseDate = item.updated_at ?? new Date();
  //         const targetTime = addMinutes(baseDate, step.delay_minutes);
  //         const delayMs = Math.max(differenceInMilliseconds(targetTime, now), 0);
  
  //         await this.abandonedQueue.add(
  //           'sendAbandonedEmail',
  //           {
  //             email: item.email,
  //             name: item.name || 'Customer',
  //             abandoned_url: item.abandoned_url,
  //             template_id: step.template_id,
  //             flow_id: flow.id,
  //             flow_step_order: step.flow_step_order,
  //           },
  //           {
  //             delay: delayMs,
  //             jobId: `abandoned-${item.id}-step-${step.flow_step_order}`,
  //           },
  //         );
  //       }
  
   
  //       await this.prisma.abandonedCheckoutLogs.create({
  //         data: {
  //           abandonedId: item.id,
  //           email: item.email,
  //           name: item.name,
  //           abandoned_url: item.abandoned_url,
  //           status: 'queued',
  //         },
  //       });
  
  //       this.logger.log(`Queued ${steps.length} messages for abandoned checkout ${item.id}`);
  //     } catch (error) {
  //       this.logger.error(`Error processing abandoned checkout ${item.id}: ${error.message}`);
  
  //       await this.prisma.abandonedCheckoutLogs.create({
  //         data: {
  //           abandonedId: item.id,
  //           email: item.email,
  //           name: item.name,
  //           abandoned_url: item.abandoned_url,
  //           status: 'failed',
  //         },
  //       });
  //     }
  //   }
  // }

  // src/automation/automation.service.ts

// async processAbandonedCheckouts() {
//   this.logger.log('Fetching abandoned checkouts with status pending...');

//   const abandonedItems = await this.prisma.abandonedCheckouts.findMany({
//     where: { checkout_status: 'pending' },
//   });

//   if (abandonedItems.length === 0) {
//     this.logger.log('No pending abandoned checkouts found.');
//     return;
//   }

//   for (const item of abandonedItems) {
//     if (!item.email || !item.shopify_vendor) {
//       this.logger.warn(`Skipping checkout ${item.id} - missing email or vendor_id`);
//       continue;
//     }

//     try {
//       const flow = await this.prisma.automationFlows.findFirst({
//         where: {
//           title: 'abandoned_cart',
//           status: 1,
//           vendorsId: item.shopify_vendor,
//         },
//         orderBy: { id: 'desc' },
//       });

//       if (!flow) {
//         this.logger.warn(`No active flow found for abandoned_cart (vendor: ${item.shopify_vendor})`);
//         continue;
//       }

//       const steps = await this.prisma.automation_flow_steps.findMany({
//         where: { automation_flow_id: flow.id },
//         orderBy: { flow_step_order: 'asc' },
//       });

//       if (steps.length === 0) {
//         this.logger.warn(`No steps found for flow ${flow.id}`);
//         continue;
//       }

//       for (const step of steps) {
//         const alreadyQueued = await this.prisma.abandonedCheckoutLogs.findFirst({
//           where: {
//             abandonedId: item.id,
//             step: step.flow_step_order,
//             status: {
//           in: ['queued', 'sent'],
//         },
//           },
//         });

//         if (alreadyQueued) {
//           this.logger.log(`Step ${step.flow_step_order} already queued for abandoned ID ${item.id}`);
//           continue;
//         }
//           const templateParams: {
//             name: string;
//             value: string;
//             isStatic: number;
//           }[] = [];

//           const rawParams = step.variable_data as unknown;

//           if (Array.isArray(rawParams)) {
//             for (const param of rawParams) {
//               if (
//                 param &&
//                 typeof param === 'object' &&
//                 'name' in param &&
//                 'value' in param &&
//                 'isStatic' in param
//               ) {
//                 const { name, value, isStatic } = param as {
//                   name: string;
//                   value: string;
//                   isStatic: number;
//                 };

//                 const resolvedValue = isStatic ? value : item[value] ?? '';

//                 templateParams.push({
//                   name,
//                   value: resolvedValue,
//                   isStatic,
//                 });
//               }
//             }
//           }



//         const baseDate = item.updated_at ?? new Date(); // handle null
//         const scheduledTime = addMinutes(baseDate, step.delay_minutes);
//         const now = new Date();
//         const nowUtc = new Date(now.toISOString()); 
//         console.log(nowUtc);
//         console.log(scheduledTime);


//         if (nowUtc >= scheduledTime) {
//           await this.abandonedQueue.add(
//             'sendAbandonedEmail',
//             {
//               email: item.email,
//               name: item.name || 'Customer',
//               abandoned_url: item.abandoned_url,
//               template_id: step.template_id,
//               flow_id: flow.id,
//               flow_step_order: step.flow_step_order,
//               abandonedId: item.id,
//               templateParams,
//             },
//             // {
//             //   jobId: `abandoned-${item.id}-step-${step.flow_step_order}`,
//             // }
//           );

//           await this.prisma.abandonedCheckoutLogs.create({
//             data: {
//               abandonedId: item.id,
//               email: item.email,
//               name: item.name,
//               abandoned_url: item.abandoned_url,
//               status: 'queued',
//               step: step.flow_step_order,
//             },
//           });

//           this.logger.log(`Queued step ${step.flow_step_order} for abandoned checkout ${item.id}`);
//         } else {
//           this.logger.log(
//             `Step ${step.flow_step_order} not ready for abandoned ID ${item.id}. Scheduled at ${scheduledTime.toISOString()}`
//           );
//         }
//       }
//     } catch (error) {
//       this.logger.error(`Error processing abandoned checkout ${item.id}: ${error.message}`);
//     }
//   }
// }

// async processAbandonedCheckouts() {
//   this.logger.log('Fetching abandoned checkouts with status pending...');

//   const abandonedItems = await this.prisma.abandonedCheckouts.findMany({
//     where: { checkout_status: 'pending' },
//   });

//   if (abandonedItems.length === 0) {
//     this.logger.log('No pending abandoned checkouts found.');
//     return;
//   }

//   for (const item of abandonedItems) {
//     if (!item.email || !item.shopify_vendor) {
//       this.logger.warn(`Skipping checkout ${item.id} - missing email or vendor_id`);
//       continue;
//     }

//     try {
//       const flow = await this.prisma.automationFlows.findFirst({
//         where: {
//           title: 'abandoned_cart',
//           status: 1,
//           vendorsId: item.shopify_vendor,
//         },
//         orderBy: { id: 'desc' },
//       });

//       if (!flow) {
//         this.logger.warn(`No active flow found for abandoned_cart (vendor: ${item.shopify_vendor})`);
//         continue;
//       }

//       const steps = await this.prisma.automation_flow_steps.findMany({
//         where: { automation_flow_id: flow.id },
//         orderBy: { flow_step_order: 'asc' },
//       });

//       if (steps.length === 0) {
//         this.logger.warn(`No steps found for flow ${flow.id}`);
//         continue;
//       }

//       for (const step of steps) {
//         const alreadyQueued = await this.prisma.abandonedCheckoutLogs.findFirst({
//           where: {
//             abandonedId: item.id,
//             step: step.flow_step_order,
//             status: { in: ['queued', 'sent'] },
//           },
//         });

//         if (alreadyQueued) {
//           this.logger.log(`Step ${step.flow_step_order} already queued for abandoned ID ${item.id}`);
//           continue;
//         }

//         // --- Parse variable_data JSON string to array ---
//         let rawParams: any[] = [];
//         try {
//           if (typeof step.variable_data === 'string' && step.variable_data.trim() !== '') {
//             rawParams = JSON.parse(step.variable_data);
//           }
//         } catch (err) {
//           this.logger.error(`Failed to parse variable_data JSON for step ${step.id}: ${err.message}`);
//           continue;  // skip this step
//         }

//         const templateParams: {
//           name: string;
//           value: string;
//           isStatic: number;
//         }[] = [];

//         if (Array.isArray(rawParams)) {
//           for (const param of rawParams) {
//             if (
//               param &&
//               typeof param === 'object' &&
//               'name' in param &&
//               'value' in param &&
//               'isStatic' in param
//             ) {
//               const { name, value, isStatic } = param;

//               // If isStatic=1 use value as-is, else fetch from item[key]
//               const resolvedValue = isStatic ? value : (item[value] ?? '');

//               templateParams.push({ name, value: resolvedValue, isStatic });
//             }
//           }
//         }

//         const baseDate = item.updated_at ?? new Date();
//         const scheduledTime = addMinutes(baseDate, step.delay_minutes);
//         const nowUtc = DateTime.utc();
//         console.log(nowUtc);
//              console.log(scheduledTime);

//         // if (nowUtc >= scheduledTime) {
//           await this.abandonedQueue.add('sendAbandonedEmail', {
//             email: item.email,
//             name: item.name || 'Customer',
//             abandoned_url: item.abandoned_url,
//             template_id: step.template_id,
//             flow_id: flow.id,
//             flow_step_order: step.flow_step_order,
//             abandonedId: item.id,
//             templateParams,
//           });

//           await this.prisma.abandonedCheckoutLogs.create({
//             data: {
//               abandonedId: item.id,
//               email: item.email,
//               name: item.name,
//               abandoned_url: item.abandoned_url,
//               status: 'queued',
//               step: step.flow_step_order,
//             },
//           });

          

//           this.logger.log(`Queued step ${step.flow_step_order} for abandoned checkout ${item.id}`);
//         // } else {
//         //   this.logger.log(
//         //     `Step ${step.flow_step_order} not ready for abandoned ID ${item.id}. Scheduled at ${scheduledTime.toISOString()}`
//         //   );
//         // }
        
//       }
//     } catch (error) {
//       this.logger.error(`Error processing abandoned checkout ${item.id}: ${error.message}`);
//     }
//   }
// }


  // async processCodOrders() {
  //   this.logger.log('Fetching cod with status pending...');
  //   const codorders = await this.prisma.abandonedCheckouts.findMany({
  //     where: {
  //       checkout_status: 'completed',
  //        payment_method: 'COD',
  //     },
  //   });
  
  //   if (codorders.length === 0) {
  //     this.logger.log('No pending COD found.');
  //     return;
  //   }
  
  //   for (const item of codorders) {
  //     if (!item.email) {
  //       this.logger.warn(`Skipping cod order ${item.id} - no email`);
  //       continue;
  //     }
  
  //       try {
  //     const flow = await this.prisma.automationFlows.findFirst({
  //       where: {
  //         title: 'cod_order',
  //         status: 1,
  //         vendorsId: item.shopify_vendor ?? undefined,
  //       },
  //       orderBy: { id: 'desc' },
  //     });

  //     if (!flow) {
  //       this.logger.warn(`No active flow found for COD (vendor: ${item.shopify_vendor})`);
  //       continue;
  //     }

  //     const steps = await this.prisma.automation_flow_steps.findMany({
  //       where: { automation_flow_id: flow.id },
  //       orderBy: { flow_step_order: 'asc' },
  //     });

  //     if (steps.length === 0) {
  //       this.logger.warn(`No steps found for flow ${flow.id}`);
  //       continue;
  //     }

  //     for (const step of steps) {
  //       const alreadyQueued = await this.prisma.abandonedCheckoutLogs.findFirst({
  //         where: {
  //           abandonedId: item.id,
  //           step: step.flow_step_order,
  //           status: { in: ['queued', 'sent'] },
  //         },
  //       });

  //       if (alreadyQueued) {
  //         this.logger.log(`Step ${step.flow_step_order} already queued for order ID ${item.id}`);
  //         continue;
  //       }

  //       // --- Parse variable_data JSON string to array ---
  //       let rawParams: any[] = [];
  //       try {
  //         if (typeof step.variable_data === 'string' && step.variable_data.trim() !== '') {
  //           rawParams = JSON.parse(step.variable_data);
  //         }
  //       } catch (err) {
  //         this.logger.error(`Failed to parse variable_data JSON for step ${step.id}: ${err.message}`);
  //         continue;  // skip this step
  //       }

  //       const templateParams: {
  //         name: string;
  //         value: string;
  //         isStatic: number;
  //       }[] = [];

  //       if (Array.isArray(rawParams)) {
  //         for (const param of rawParams) {
  //           if (
  //             param &&
  //             typeof param === 'object' &&
  //             'name' in param &&
  //             'value' in param &&
  //             'isStatic' in param
  //           ) {
  //             const { name, value, isStatic } = param;

  //             // If isStatic=1 use value as-is, else fetch from item[key]
  //             const resolvedValue = isStatic ? value : (item[value] ?? '');

  //             templateParams.push({ name, value: resolvedValue, isStatic });
  //           }
  //         }
  //       }

  //       const baseDate = item.updated_at ?? new Date();
  //       const scheduledTime = addMinutes(baseDate, step.delay_minutes);
  //       const nowUtc = DateTime.utc();
  //       console.log(nowUtc);
  //            console.log(scheduledTime);

  //       // if (nowUtc >= scheduledTime) {
  //         await this.abandonedQueue.add('sendCodEmail', {
  //           email: item.email,
  //           name: item.name || 'Customer',
  //           abandoned_url: item.abandoned_url,
  //           template_id: step.template_id,
  //           flow_id: flow.id,
  //           flow_step_order: step.flow_step_order,
  //           abandonedId: item.id,
  //           templateParams,
  //         });

  //         await this.prisma.abandonedCheckoutLogs.create({
  //           data: {
  //             abandonedId: item.id,
  //             email: item.email,
  //             name: item.name,
  //             abandoned_url: item.abandoned_url,
  //             status: 'queued',
  //             step: step.flow_step_order,
  //           },
  //         });

          

  //         this.logger.log(`Queued step ${step.flow_step_order} for abandoned checkout ${item.id}`);
  //       // } else {
  //       //   this.logger.log(
  //       //     `Step ${step.flow_step_order} not ready for abandoned ID ${item.id}. Scheduled at ${scheduledTime.toISOString()}`
  //       //   );
  //       // }
        
  //     }
  //   } catch (error) {
  //     this.logger.error(`Error processing abandoned checkout ${item.id}: ${error.message}`);
  //   }
  
  
  //     }
  //   }

