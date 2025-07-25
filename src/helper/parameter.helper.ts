import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ParameterHelper {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,  // Inject PrismaService
  ) {}

  // async setParameterValue(contact: any, inputs: Record<string, any>, item: string, flowId?: number): Promise<string> {
  //   const inputValue = inputs[item];

  //   console.log(inputValue);
  //   console.log('SetParameterValue received:', { item, inputValue });


  //   // if (this.isExternalApiRequest()) {
  //   //   return this.dynamicValuesReplacement(inputValue, contact, flowId);
  //   // }

  //   if (inputValue.startsWith('dynamic_contact_')) {
  //     let mappedKey = inputValue;
  //     if (inputValue === 'dynamic_contact_phone_number') {
  //       mappedKey = 'dynamic_contact_wa_id';
  //     }

  //      if (inputValue === 'full_name') {
  //     return `${contact?.first_name ?? ''} ${contact?.last_name ?? ''}`.trim() || 'User';
  //   }

  //      if (inputValue === 'first_name') {
  //     return `${contact?.first_name ?? ''}`.trim() || 'User';
  //   }

  //    if (inputValue === 'last_name') {
  //     return `${contact?.last_name ?? ''}`.trim() || 'User';
  //   }

  //     const contactDataMapping = this.configItem('contact_data_mapping');
  //     if (!contactDataMapping || !contactDataMapping[mappedKey]) return 'User';  // Return 'User' instead of null

  //     const fieldName = mappedKey.replace('dynamic_contact_', '');
  //     if (fieldName === 'country') {
  //       return contact?.country?.name ?? 'User';
  //     }

  //     return contact?.[fieldName] ?? 'User';
  //   } else if (inputValue.startsWith('contact_custom_field_')) {
  //     const fieldName = inputValue.replace('contact_custom_field_', '');

  //     const match = this.isExternalApiRequest()
  //       ? contact.valueWithField?.find((v) => v.customField?.input_name === fieldName)
  //       : contact.customFieldValues?.find((v) => v.contact_custom_fields__id === fieldName);

  //     return match?.field_value ?? 'User';
  //   }else if (inputValue === 'checkout_id') {
  //     return `${contact?.checkout_id ?? ''}`|| 'User';
  //   }
  //   else if (inputValue === 'name') {
  //     return `${contact?.name ?? ''}`|| 'User';
  //   }
  //    else if (inputValue === 'phone') {
  //     return `${contact?.phone ?? ''}`|| 'User';
  //   }
  //    else if (inputValue === 'abandoned_url') {
  //     return `${contact?.abandoned_url ?? ''}`|| 'User';
  //   }
  //    else if (inputValue === 'total_price') {
  //     return `${contact?.total_price ?? ''}`|| 'User';
  //   }
  //    else if (inputValue === 'created_at') {
  //     return `${contact?.created_at ?? ''}`|| 'User';
  //   }
  //    else if (inputValue === 'checkout_status') {
  //     return `${contact?.checkout_status ?? ''}`|| 'User';
  //   }
  //    else if (inputValue === 'shipping_charge') {
  //     return `${contact?.shipping_charge ?? ''}`|| 'User';
  //   }
  //    else if (inputValue === 'total_tax') {
  //     return `${contact?.total_tax ?? ''}`|| 'User';
  //   }
  //    else if (inputValue === 'shipping_charge') {
  //     return `${contact?.shipping_charge ?? ''}`|| 'User';
  //   }
  //    else if (inputValue === 'shopify_currency') {
  //     return `${contact?.shopify_currency ?? ''}`|| 'User';
  //   }
  //    else if (inputValue === 'shopify_address') {
  //     return `${contact?.shopify_address ?? ''}`|| 'User';
  //   }
  //    else if (inputValue === 'shipping_charge') {
  //     return `${contact?.shipping_charge ?? ''}`|| 'User';
  //   }
  //    else if (inputValue === 'shopify_street') {
  //     return `${contact?.shopify_street ?? ''}`|| 'User';
  //   }
  //    else if (inputValue === 'shopify_city') {
  //     return `${contact?.shopify_city ?? ''}`|| 'User';
  //   }
  //    else if (inputValue === 'shopify_state') {
  //     return `${contact?.shopify_state ?? ''}`|| 'User';
  //   }
  //    else if (inputValue === 'shopify_zip') {
  //     return `${contact?.shopify_zip ?? ''}`|| 'User';
  //   }

  //   return inputValue ?? 'User';
  // }

        async setParameterValue(contact: any, inputs: Record<string, any>, item: string, flowId?: number): Promise<string> {
        const inputValue = inputs[item];
        console.log('SetParameterValue received:', { item, inputValue });

        if (!inputValue) return 'User';

        // Normalize dynamic_contact_ prefix
        let normalizedKey = inputValue;
        if (inputValue.startsWith('dynamic_contact_')) {
          normalizedKey = inputValue.replace('dynamic_contact_', '');
          if (normalizedKey === 'phone_number') normalizedKey = 'wa_id';
        }

        // Special case for full_name
        if (normalizedKey === 'full_name') {
          return `${contact?.first_name ?? ''} ${contact?.last_name ?? ''}`.trim() || 'User';
        }

         if (normalizedKey === 'last_name') {
          return `${contact?.last_name ?? ''}`.trim() || 'User';
        }

         if (normalizedKey === 'first_name') {
          return `${contact?.first_name ?? ''}`.trim() || 'User';
        }

         if (normalizedKey === 'wa_id') {
          return `${contact?.wa_id ?? ''}`.trim() || 'User';
        }

        if (normalizedKey === 'language_code') {
          return `${contact?.language_code ?? ''}`.trim() || 'User';
        }

        if (normalizedKey === 'email') {
          return `${contact?.email ?? ''}`.trim() || 'User';
        }


        // Direct field mappings (both dynamic_contact and raw)
        const directFields = {
          'full_name': contact?.first_name ?? 'User',
          'first_name': contact?.first_name ?? 'User',
          'last_name': contact?.last_name ?? 'User',
          'wa_id': contact?.wa_id ?? 'User',
          'checkout_id': contact?.checkout_id ?? 'User',
          'name': contact?.name ?? 'User',
          'phone': contact?.phone ?? 'User',
          'email': contact?.email ?? 'User',
          'abandoned_url': contact?.abandoned_url ?? 'User',
          'total_price': contact?.total_price ?? 'User',
          'created_at': contact?.created_at ?? 'User',
          'checkout_status': contact?.checkout_status ??'User',
          'shipping_charge': contact?.shipping_charge ?? 'User',
          'total_tax': contact?.total_tax ?? 'User',
          'shopify_currency': contact?.shopify_currency ?? 'User',
          'shopify_address': contact?.shopify_address ?? 'User',
          'shopify_street': contact?.shopify_street ?? 'User',
          'shopify_city': contact?.shopify_city ?? 'User',
          'shopify_state': contact?.shopify_state ?? 'User',
          'shopify_zip': contact?.shopify_zip ?? 'User',
          'country': contact?.country?.name ?? 'User',  // For country special case
          'countries__id': contact?.country?.name ?? 'User',  // For country special case
        };

        if (directFields.hasOwnProperty(normalizedKey)) {
          return directFields[normalizedKey];
        }

        // Handle contact_data_mapping for dynamic_contact_ fields
        if (inputValue.startsWith('dynamic_contact_')) {
          const contactDataMapping = this.configItem('contact_data_mapping');
          if (!contactDataMapping || !contactDataMapping[inputValue]) return 'User';
          return contact?.[normalizedKey] ?? 'User';
        }

        // Handle custom fields
        if (inputValue.startsWith('contact_custom_field_')) {
          const fieldName = inputValue.replace('contact_custom_field_', '');

          const match = this.isExternalApiRequest()
            ? contact.valueWithField?.find((v) => v.customField?.input_name === fieldName)
            : contact.customFieldValues?.find((v) => v.contact_custom_fields__id === fieldName);

          return match?.field_value ?? 'User';
        }

        // Default fallback
        return inputValue ?? 'User';
      }


  async dynamicValuesReplacement(inputValue: string, contact: any, flowId?: number): Promise<string> {
    const baseFields = {
      '{first_name}': contact.first_name,
      '{last_name}': contact.last_name,
      '{full_name}': `${contact.first_name} ${contact.last_name}`,
      '{phone_number}': contact.wa_id,
      '{email}': contact.email,
      '{country}': contact?.country?.name,
      '{language_code}': contact.language_code,
    };

    contact.valueWithField?.forEach((val) => {
      if (val?.customField?.input_name) {
        baseFields[`{${val.customField.input_name}}`] = val.field_value;
      }
    });

    const variableMatches = [...inputValue.matchAll(/\{(.*?)\}/g)].map((m) => m[1]);

    const excluded = ['first_name', 'last_name', 'full_name', 'phone_number', 'email', 'country', 'language_code'];
    const additionalFields: Record<string, any> = {};

    if (flowId && variableMatches.length > 0) {
      for (const variable of variableMatches) {
        if (excluded.includes(variable)) continue;

        const reply = await this.prisma.botReply.findFirst({
          where: {
            vendorId: contact.vendors__id,
            replyVariable: variable,
            botFlowId: flowId,
          },
        });

        if (reply) {
          const outMsg = await this.prisma.whatsAppMessageLog.findFirst({
                where: {
                    isIncomingMessage: 0, // The message is outgoing
                    vendorId: contact.vendorId, // Correct reference to vendor
                    contactId: contact.id, // Correct reference to contact
                    botReplyId: reply.id, // Bot reply ID
                },
                orderBy: { id: 'desc' }, // Sorting by the primary key id in descending order
                });

                if (outMsg) {
                const inMsg = await this.prisma.whatsAppMessageLog.findFirst({
                    where: {
                    isIncomingMessage: 1, // The message is incoming
                    vendorId: contact.vendors__id, // Correct reference to vendor
                    contactId: contact._id, // Correct reference to contact
                    id: { gt: outMsg.id }, // Filtering for messages after the outgoing message
                    },
                    orderBy: { id: 'asc' }, // Sorting by the primary key id in ascending order
                });

            if (inMsg?.message) {
              additionalFields[`{${variable}}`] = inMsg.message;
            }
          }
        }
      }
    }

    return this.replacePlaceholders(inputValue, { ...baseFields, ...additionalFields });
  }

  private replacePlaceholders(text: string, values: Record<string, any>): string {
    return Object.entries(values).reduce(
      (acc, [placeholder, val]) => acc.replaceAll(placeholder, val ?? 'User'),
      text,
    );
  }

  private isExternalApiRequest(): boolean {
    return false;  // Example for when it's not an external request
  }

  private configItem<T = any>(key: string, subKey?: string): T | null {
    const config = this.configService.get<Record<string, any>>('__tech');
    if (!config) return null;
    return subKey ? config[key]?.[subKey] : config[key];
  }
}
