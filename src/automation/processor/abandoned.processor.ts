// abandoned.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { PrismaService } from 'src/prisma/prisma.service';
import { addMinutes, differenceInMilliseconds } from 'date-fns';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { WhatsAppService } from 'src/whatsappservice/whatsappservice.service';

@Processor('abandonedQueue')
@Injectable()
export class AbandonedProcessor {
  private readonly logger = new Logger(AbandonedProcessor.name);

  constructor(
    private readonly mailerService: MailerService,
     private readonly WhatsAppService: WhatsAppService,
    private readonly prisma: PrismaService,
    @InjectQueue('abandonedQueue') private readonly abandonedQueue: Queue,
    
  ){
  console.log("📦 AbandonedProcessor initialized");
}

  // @Process('sendAbandonedEmail')
  // async handleSendAbandonedEmail(job: Job) {
  //   this.logger.warn(`Received job with no named process: ${job.name}`);
  //   console.log("entered");
  //   const {
  //   email,
  //   name,
  //   abandoned_url,
  //   template_id,
  //   flow_id,
  //   flow_step_order,
  //   abandonedId,
  // } = job.data;

  // // 🛡️ Basic Validation
  // if (!email || !name || !abandoned_url || !template_id || !flow_id || typeof flow_step_order !== 'number' || !abandonedId) {
  //   const errorMessage = `Missing or invalid job data fields: ${JSON.stringify(job.data)}`;
  //   this.logger.error(errorMessage);
  //   throw new Error(errorMessage);
  // }
  //   this.logger.log(`Sending abandoned cart email to ${email}`);

  //   try {
  //     await this.mailerService.sendMail({
  //       to: email,
  //       subject: 'You left items in your cart!',
  //       template: './abandoned-cart',
  //       context: {
  //         name,
  //         abandoned_url,
  //       },
  //     });

  //     this.logger.log(`Email sent to ${email}`);

  //     // Fetch next step
  //     const nextStep = await this.prisma.automation_flow_steps.findFirst({
  //       where: {
  //         automation_flow_id: flow_id,
  //         flow_step_order: flow_step_order + 2,
  //       },
  //     });

  //     if (nextStep) {
  //       const now = new Date();
  //       const targetTime = addMinutes(now, nextStep.delay_minutes);
  //       const delayMs = Math.max(differenceInMilliseconds(targetTime, now), 0);

  //       await this.abandonedQueue.add(
  //         'sendAbandonedEmail',
  //         {
  //           email,
  //           name,
  //           abandoned_url,
  //           flow_id,
  //           flow_step_order: nextStep.flow_step_order,
  //           template_id: nextStep.template_id,
  //           abandonedId,
  //         },
  //         {
  //           delay: delayMs,
  //           jobId: `abandoned-${abandonedId}-step-${nextStep.flow_step_order}`,
  //         },
  //       );

  //       this.logger.log(`Queued next step ${nextStep.flow_step_order} for ${email}`);
  //     } else {
  //       this.logger.log(`No more steps. Flow completed for ${email}`);
  //     }
  //   } catch (error) {
  //     this.logger.error(`Failed to send email to ${email}: ${error.message}`, error.stack);
  //     throw error;
  //   }
  // }

   @Process('handleSendAbandonedWhatsapp')
        async handleSendAbandonedWhatsapp(job: Job) {
          const { request, contact, flow_step_order, abandonedId } = job.data;

          this.logger.log('sending messages...');

          try {
            // ✅ Guard: avoid duplicate send
            const alreadySent = await this.prisma.abandonedCheckoutLogs.findFirst({
              where: {
                abandonedId,
                step: flow_step_order,
                status: 'sent',
              },
            });

            if (alreadySent) {
              this.logger.warn(`Step ${flow_step_order} already sent for abandoned ID ${abandonedId}. Skipping.`);
              return;
            }

            const result = await this.WhatsAppService.sendTemplateMessageProcess(
              request,
              contact,
              false,
              null,
              contact.vendorId,
              request.template_id, 
              request,
            );

             // ✅ Update log to sent
            await this.prisma.abandonedCheckoutLogs.updateMany({
              where: { abandonedId, step: flow_step_order },
              data: { status: 'sent' },
            });

            this.logger.log(`Whatsapp Response: ${JSON.stringify(result, null, 2)}`);
            
            

            if (!result.success) {
              this.logger.warn(`WhatsApp send failed: ${result.message}`);
            }

               const { log_message } = result;

                if (log_message?.wamid && abandonedId) {
                  await this.prisma.whatsAppMessageLog.updateMany({
                    where: {
                      wamid: log_message.wamid,
                    },
                    data: {
                      abandoned_checkout_id: abandonedId,
                    },
                  });

                  this.logger.log(`Updated message log for wamid: ${log_message.wamid} with abandonedId: ${abandonedId}`);
                }


               await this.prisma.abandonedCheckouts.updateMany({
                  where: {
                    id: abandonedId, 
                  },
                  data: {
                    is_message_sent: 1,
                  },
                });



           

            this.logger.log(`Sent WhatsApp to ${contact.wa_id} for ${abandonedId}`);

          } catch (error) {
            this.logger.error(`Failed WhatsApp for ${abandonedId}: ${error.message}`);

            await this.prisma.abandonedCheckoutLogs.updateMany({
              where: { abandonedId, step: flow_step_order },
              data: { status: 'failed' },
            });

            throw error;
          }
        }




      @Process('handleSendCodWhatsapp')
      async handleSendCodWhatsapp(job: Job) {
        const { request, contact, flow_step_order, abandonedId } = job.data;

        try {
          // ✅ Guard: skip if already sent
          const existingLog = await this.prisma.abandonedCheckoutLogs.findFirst({
            where: {
              abandonedId,
              step: flow_step_order,
              status: 'sent',
            },
          });

          if (existingLog) {
            this.logger.warn(`COD Step ${flow_step_order} already sent for abandoned ID ${abandonedId}. Skipping.`);
            return;
          }

          // ✅ Send WhatsApp message
          const result = await this.WhatsAppService.sendTemplateMessageProcess(
            request,
            contact,
            false,
            null,
            contact.vendorId,
            request.template_id,  // fixed usage
            request
          );

         
           // ✅ Update log to sent
            await this.prisma.abandonedCheckoutLogs.updateMany({
              where: { abandonedId, step: flow_step_order },
              data: { status: 'sent' },
            });

            this.logger.log(`Whatsapp Response: ${JSON.stringify(result, null, 2)}`);
            
             if (!result.success) {
            this.logger.warn(`COD WhatsApp send failed: ${result.message}`);
          }


          

               const { log_message } = result;

                if (log_message?.wamid && abandonedId) {
                  await this.prisma.whatsAppMessageLog.updateMany({
                    where: {
                      wamid: log_message.wamid,
                    },
                    data: {
                      cod_id: abandonedId,
                    },
                  });

                  this.logger.log(`Updated message log for wamid: ${log_message.wamid} with abandonedId: ${abandonedId}`);
                }



                  await this.prisma.abandonedCheckouts.updateMany({
                      where: {
                        id: abandonedId, 
                      },
                      data: {
                        is_message_sent: 1,
                      },
                    });

          this.logger.log(`COD WhatsApp sent to ${contact.wa_id} for ID ${abandonedId}`);

          
        } catch (error) {
          this.logger.error(`COD WhatsApp failed for ID ${abandonedId}: ${error.message}`);

          await this.prisma.abandonedCheckoutLogs.updateMany({
            where: {
              abandonedId: abandonedId,
              step: flow_step_order,
            },
            data: {
              status: 'failed',
            }
          });

          throw error;
        }
      }



        @Process('sendAbandonedEmail')
      async handleSendAbandonedEmail(job: Job) {
        const {
          email,
          name,
          abandoned_url,
          template_id,
          flow_id,
          flow_step_order,
          abandonedId,
          templateParams
        } = job.data;

        // 🛡️ Validation
        if (!email || !template_id || !flow_id || typeof flow_step_order !== 'number' || !abandonedId) {
          const errorMessage = `Invalid job data: ${JSON.stringify(job.data)}`;
          this.logger.error(errorMessage);
          throw new Error(errorMessage);
        }

        try {
          // Send email
          await this.mailerService.sendMail({
            to: email,
            subject: 'You left items in your cart!',
            template: './abandoned-cart',
            context: {
              name,
              abandoned_url,
            },
          });

          this.logger.log(`Email sent to ${email} for abandonedId ${abandonedId} [step ${flow_step_order}]`);

          //  Update log status to "sent"
          await this.prisma.abandonedCheckoutLogs.updateMany({
            where: {
              abandonedId: abandonedId,
              step: flow_step_order,
            },
            data: {
              status: 'sent',
            },
          });
        } catch (error) {
          this.logger.error(
            `Failed to send email to ${email} for abandonedId ${abandonedId}: ${error.message}`,
            error.stack
          );

          //  Update log status to "failed"
          await this.prisma.abandonedCheckoutLogs.updateMany({
            where: {
              abandonedId: abandonedId,
              step: flow_step_order,
            },
            data: {
              status: 'failed',
            },
          });

          throw error;
        }
      }

      
      @Process('sendCodEmail')
      async handleSendCodEmail(job: Job) {
        const {
          email,
          name,
          abandoned_url,
          template_id,
          flow_id,
          flow_step_order,
          abandonedId,
          templateParams
        } = job.data;

        if (!email || !template_id || !flow_id || typeof flow_step_order !== 'number' || !abandonedId) {
          const errorMessage = `Invalid COD job data: ${JSON.stringify(job.data)}`;
          this.logger.error(errorMessage);
          throw new Error(errorMessage);
        }

        try {
          // Send COD email
          await this.mailerService.sendMail({
            to: email,
            subject: 'Your COD Order is Confirmed!',
            template: './cod-order', // ✅ This should be a separate template
            context: {
              name,
              abandoned_url,
              ...(templateParams.reduce((acc, curr) => {
                acc[curr.name] = curr.value;
                return acc;
              }, {})),
            },
          });

          this.logger.log(`COD Email sent to ${email} for abandonedId ${abandonedId} [step ${flow_step_order}]`);

          await this.prisma.abandonedCheckoutLogs.updateMany({
            where: {
              abandonedId,
              step: flow_step_order,
            },
            data: {
              status: 'sent',
            },
          });
        } catch (error) {
          this.logger.error(
            `Failed to send COD email to ${email} for abandonedId ${abandonedId}: ${error.message}`,
            error.stack
          );

          await this.prisma.abandonedCheckoutLogs.updateMany({
            where: {
              abandonedId,
              step: flow_step_order,
            },
            data: {
              status: 'failed',
            },
          });

          throw error;
        }
      }


}
