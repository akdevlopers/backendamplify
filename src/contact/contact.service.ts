import { HttpException, HttpStatus, Injectable,BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NewFieldDto, GroupDto, ContactDto } from './dto/contact.dto';
import { v4 as uuidv4 } from 'uuid';
import { ContactController } from './contact.controller';
import { error } from 'console';
import * as CryptoJS from 'crypto-js';
import { MyLogger } from '../logger.service';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import { EncryptionService } from 'src/common/encryption/encryption.service';
import { formatMobileNumber } from 'src/common/utils/phone.util';



const SECRET_KEY = process.env.SECRET_KEY || '48962874218962874213689687';

function encryptField(value: any): string | undefined {
  if (value === null || value === undefined) return undefined;
  // Convert to string first (for number, boolean, etc.)
  const stringValue = String(value);
  return CryptoJS.AES.encrypt(stringValue, SECRET_KEY).toString();
}
function decryptField(encryptedValue: string): string | undefined {
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
export class ContactService {
  constructor(private prisma: PrismaService,private readonly logger: MyLogger,private readonly EncryptionService: EncryptionService) {}

  // -------------------------------------------------------Contact API's--------------------------------------------------------------------------

  // async createContact(dto: ContactDto) {
  //   const {
  //     status,
  //     first_name,
  //     last_name,
  //     countries__id,
  //     whatsapp_opt_out,
  //     phone_verified_at,
  //     email,
  //     email_verified_at,
  //     vendorId,
  //     wa_id,
  //     language_code,
  //     disable_ai_bot,
  //     data,
  //     assigned_users__id,
  //     groups, 
  //   } = dto;
    

  //   let valid_wa_id: string | number | null;

  //   if (wa_id !== undefined) {
  //     valid_wa_id = wa_id;
  //   } else {
  //     valid_wa_id = null;
  //   }

  //   // Creating a new contact in the database using Prisma
  //   const newContact = await this.prisma.contacts.create({
  //     data: {
  //       uid: uuidv4(),
  //       status,
  //       first_name: this.EncryptionService.encryptUniversal(first_name),
  //       last_name: this.EncryptionService.encryptUniversal(last_name),
  //       email: this.EncryptionService.encryptUniversal(email),
  //       wa_id: this.EncryptionService.encryptUniversal(valid_wa_id),
  //       countries__id,
  //       whatsapp_opt_out,
  //       phone_verified_at,
  //       email_verified_at,
  //       vendorId,
  //       language_code,
  //       disable_ai_bot: 1,
  //       data,
  //       assigned_users__id,
  //     },
  //   });

  //   // if (Array.isArray(groups) && groups.length > 0) {
  //   //     const contactId = newContact.id;

      
  //   //     await this.prisma.group_contacts.deleteMany({
  //   //       where: {
  //   //         contactsId: contactId,
  //   //         contactGroupsId: { in: groups.map(Number) },
  //   //       },
  //   //     });

  //   //     // Prepare new group_contacts entries
  //   //     const groupContactsData = groups.map((groupId) => ({
  //   //       uid: uuidv4(),
  //   //       contactGroupsId: Number(groupId),
  //   //       contactsId: contactId,
  //   //     }));

  //   //     await this.prisma.group_contacts.createMany({
  //   //       data: groupContactsData,
  //   //     });
  //   //   }

  //     if (groups && Number.isInteger(groups)) {
  //             const contactId = newContact.id;

  //             // Delete existing mapping if exists for this contact and group
  //             await this.prisma.group_contacts.deleteMany({
  //               where: {
  //                 contactsId: contactId,
  //                 contactGroupsId: groups,
  //               },
  //             });

  //             // Create new group mapping
  //             await this.prisma.group_contacts.create({
  //               data: {
  //                 uid: uuidv4(),
  //                 contactsId: contactId,
  //                 contactGroupsId: groups,
  //               },
  //             });
  //           }

  //   return {
  //     message: 'Contact created successfully',
  //     data: newContact,
  //   };
  // }

  async createContact(dto: ContactDto) {
  const {
    status,
    first_name,
    last_name,
    countries__id,
    whatsapp_opt_out,
    phone_verified_at,
    email,
    email_verified_at,
    vendorId,
    wa_id,
    language_code,
    disable_ai_bot,
    data,
    assigned_users__id,
    groups,
  } = dto;

 this.logger.log(`Creating contact for: ${first_name} ${last_name}`, 'CreateContact');

      const encryptedEmail =this.EncryptionService.encryptUniversal(email);
      const encryptedWaId = wa_id ? this.EncryptionService.encryptUniversal(wa_id) : null;

      if (encryptedEmail) {
        const existingEmail = await this.prisma.contacts.findFirst({
          where: {
            vendorId,
            email: encryptedEmail,
          },
        });

        if (existingEmail) {
          this.logger.warn(`Duplicate email found for vendor ${vendorId}`, 'CreateContact');
          return {
            success: false,
            message: 'A contact with the same email already exists.',
          };
        }
      }

      if (encryptedWaId) {
        const existingWaId = await this.prisma.contacts.findFirst({
          where: {
            vendorId,
            wa_id: encryptedWaId,
          },
        });

        if (existingWaId) {
          this.logger.warn(`Duplicate WhatsApp ID found for vendor ${vendorId}`, 'CreateContact');
          return {
            success: false,
            message: 'A contact with the same phone number already exists.',
          };
        }
      }

      // 1. Get ISO code from DB using countries__id
      const countryRecord = await this.prisma.countries.findFirst({
        where: { id: dto.countries__id ?? 99 },
      });

      const countryCode = countryRecord?.iso_code?.toUpperCase() ?? 'IN';

      // 2. Use that ISO code to format the number
      let valid_wa_id: string | null = dto.wa_id ?? null;
      const formatted_wa_id = valid_wa_id ? formatMobileNumber(valid_wa_id, countryCode) : null;

      this.logger.log(`Formatted Number ${formatted_wa_id}`);


  const newContact = await this.prisma.contacts.create({
    data: {
      uid: uuidv4(),
      status,
      first_name: this.EncryptionService.encryptUniversal(first_name),
      last_name: this.EncryptionService.encryptUniversal(last_name),
      email: this.EncryptionService.encryptUniversal(email),
      wa_id: this.EncryptionService.encryptUniversal(formatted_wa_id),
      countries__id,
      whatsapp_opt_out,
      phone_verified_at,
      email_verified_at,
      vendorId,
      language_code,
      disable_ai_bot: 1,
      data,
      assigned_users__id,
    },
  });

  this.logger.log(`New contact created with ID: ${newContact.id}`, 'CreateContact');

//   const groupId = Number(groups);

//    this.logger.log(`group ${groupId}`);

// if (groupId && Number.isInteger(groupId)) {
//   const contactId = newContact.id;

//   this.logger.log(`Deleting existing group_contacts for contact ${contactId} and group ${groupId}`, 'CreateContact');

//   await this.prisma.group_contacts.deleteMany({
//     where: {
//       contactsId: contactId,
//       contactGroupsId: groupId,
//     },
//   });

//   this.logger.log(`Creating group_contacts entry`, 'CreateContact');

//   await this.prisma.group_contacts.create({
//     data: {
//       uid: uuidv4(),
//       contactsId: contactId,
//       contactGroupsId: groupId,
//     },
//   });

//   this.logger.log(`Group contact created successfully for group ${groupId}`, 'CreateContact');
// } else {
//   this.logger.warn(`No valid group provided or not an integer. Skipping group creation.`, 'CreateContact');
// }

    // this.logger.log(`New contact created with ID: ${newContact.id}`, 'CreateContact');

      // ✅ Handle groups if passed as an array
      if (Array.isArray(groups) && groups.length > 0) {
        const contactId = newContact.id;

        this.logger.log(`Preparing to create group_contacts for contact ${contactId}`, 'CreateContact');

        // Remove duplicates if any (for safety, even on create)
        await this.prisma.group_contacts.deleteMany({
          where: {
            contactsId: contactId,
          },
        });

        const groupContactsData = groups.map((groupId) => ({
          uid: uuidv4(),
          contactGroupsId: Number(groupId),
          contactsId: contactId,
        }));

        await this.prisma.group_contacts.createMany({
          data: groupContactsData,
        });

        this.logger.log(`Group contacts created for contact ${contactId}: ${groups.join(', ')}`, 'CreateContact');
      } else {
        this.logger.warn(`No valid groups provided or not an array. Skipping group creation.`, 'CreateContact');
      }


  return {
    success: true,
    message: 'Contact created successfully',
    data: newContact,
  };
}

      async updateContact(id: number, dto: ContactDto) {
        const {
          status,
          first_name,
          last_name,
          countries__id,
          whatsapp_opt_out,
          phone_verified_at,
          email,
          email_verified_at,
          vendorId,
          wa_id,
          language_code,
          disable_ai_bot,
          data,
          assigned_users__id,
          groups,
        } = dto;

        const encryptedEmail = email ? this.EncryptionService.encryptUniversal(email) : null;
        const encryptedWaId = wa_id ? this.EncryptionService.encryptUniversal(wa_id) : null;

        //Check for duplicate email (exclude current contact)
        if (encryptedEmail) {
          const existingEmail = await this.prisma.contacts.findFirst({
            where: {
              vendorId,
              email: encryptedEmail,
              NOT: { id },
            },
          });

          if (existingEmail) {
            return {
              success: false,
              message: 'A contact with the same email already exists.',
            };
          }
        }

        // Check for duplicate wa_id (exclude current contact)
        if (encryptedWaId) {
          const existingWaId = await this.prisma.contacts.findFirst({
            where: {
              vendorId,
              wa_id: encryptedWaId,
              NOT: { id },
            },
          });

          if (existingWaId) {
            return {
              success: false,
              message: 'A contact with the same WhatsApp number already exists.',
            };
          }
        }

          // 1. Get ISO code from DB using countries__id
          const countryRecord = await this.prisma.countries.findFirst({
            where: { id: dto.countries__id ?? 99 },
          });

          const countryCode = countryRecord?.iso_code?.toUpperCase() ?? 'IN';

          // 2. Use that ISO code to format the number
          let valid_wa_id: string | null = dto.wa_id ?? null;
          const formatted_wa_id = valid_wa_id ? formatMobileNumber(valid_wa_id, countryCode) : null;

          this.logger.warn(`Formatted Number ${formatted_wa_id}`);


        const updatedContact = await this.prisma.contacts.update({
          where: { id },
          data: {
            uid: uuidv4(),
            status,
            first_name: this.EncryptionService.encryptUniversal(first_name),
            last_name: this.EncryptionService.encryptUniversal(last_name),
            email: encryptedEmail,
            wa_id: this.EncryptionService.encryptUniversal(formatted_wa_id),
            countries__id,
            whatsapp_opt_out,
            phone_verified_at,
            email_verified_at,
            vendorId,
            language_code,
            disable_ai_bot: 1,
            data,
            assigned_users__id,
          },
        });

        const contactId = updatedContact.id;

        //  Update group_contacts if groups provided
        if (Array.isArray(groups) && groups.length > 0) {
          await this.prisma.group_contacts.deleteMany({
            where: { contactsId: contactId },
          });

          const groupContactsData = groups.map((groupId) => ({
            uid: uuidv4(),
            contactGroupsId: Number(groupId),
            contactsId: contactId,
          }));

          await this.prisma.group_contacts.createMany({
            data: groupContactsData,
          });
        }

        return {
          success: true,
          message: 'Contact updated successfully',
          data: updatedContact,
        };
      }

  // async updateContact(id: number, dto: ContactDto) {
  //    const {
  //     status,
  //     first_name,
  //     last_name,
  //     countries__id,
  //     whatsapp_opt_out,
  //     phone_verified_at,
  //     email,
  //     email_verified_at,
  //     vendorId,
  //     wa_id,
  //     language_code,
  //     disable_ai_bot,
  //     data,
  //     assigned_users__id,
  //     groups,
  //   } = dto;

  //    const encryptedEmail =this.EncryptionService.encryptUniversal(email);
  //     const encryptedWaId = wa_id ? this.EncryptionService.encryptUniversal(wa_id) : null;

  //     if (encryptedEmail) {
  //       const existingEmail = await this.prisma.contacts.findFirst({
  //         where: {
  //           vendorId,
  //           email: encryptedEmail,
  //         },
  //       });

  //       if (existingEmail) {
  //         this.logger.warn(`Duplicate email found for vendor ${vendorId}`, 'CreateContact');
  //         return {
  //           success: false,
  //           message: 'A contact with the same email already exists.',
  //         };
  //       }
  //     }


  //   let valid_wa_id: string | number | null;

  //   if (wa_id !== undefined) {
  //     valid_wa_id = wa_id;
  //   } else {
  //     valid_wa_id = null;
  //   }
  //   const updatedContact = await this.prisma.contacts.update({
  //     where: { id },
  //     data: {
  //       uid: uuidv4(),
  //       status,
  //       first_name: this.EncryptionService.encryptUniversal(first_name),
  //       last_name: this.EncryptionService.encryptUniversal(last_name),
  //       email: this.EncryptionService.encryptUniversal(email),
  //       wa_id: this.EncryptionService.encryptUniversal(valid_wa_id),
  //       countries__id,
  //       whatsapp_opt_out,
  //       phone_verified_at,
  //       email_verified_at,
  //       vendorId,
  //       language_code,
  //       disable_ai_bot: 1,
  //       data,
  //       assigned_users__id,
  //     },
  //   });


  //     const contactId = updatedContact.id;

  //     // ✅ Handle groups as array
  //     if (Array.isArray(groups) && groups.length > 0) {
  //       this.logger.log(`Updating group_contacts for contact ${contactId}`, 'UpdateContact');

  //       // ✅ Delete all existing group associations for the contact
  //       await this.prisma.group_contacts.deleteMany({
  //         where: {
  //           contactsId: contactId,
  //         },
  //       });

  //       // ✅ Create new group_contacts entries
  //       const groupContactsData = groups.map((groupId) => ({
  //         uid: uuidv4(),
  //         contactGroupsId: Number(groupId),
  //         contactsId: contactId,
  //       }));

  //       await this.prisma.group_contacts.createMany({
  //         data: groupContactsData,
  //       });

  //       this.logger.log(`Group contacts updated successfully`, 'UpdateContact');
  //     } else {
  //       this.logger.warn(`No valid groups array provided. Skipping group update.`, 'UpdateContact');
  //     }

  //   return {
  //   success: true,
  //   message: 'Contact Updated successfully',
  //   data: updatedContact,
  // };

  // }

  async deleteContact(id: number) {
    await this.prisma.contacts.delete({
      where: { id },
    });

    return {
      message: 'Contact deleted successfully',
    };
  }

  async deleteMultipleContacts(ids: number[]): Promise<any> {
    return this.prisma.contacts.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
  }
  

//  async getContact(page: number, limit: number, vendorId: number) {
//   const skip = (page - 1) * limit;

//   const [data, total] = await Promise.all([
//     this.prisma.contacts.findMany({
//       where: { vendorId: vendorId }, // filter by vendor_id
//       skip,
//       take: limit,
//     }),
//     this.prisma.contacts.count({
//       where: { vendorId: vendorId },
//     }),
//   ]);

//   const decryptedData = data.map(contact => ({
//     ...contact,
//     first_name: contact.first_name ? decryptField(contact.first_name) : undefined,
//     last_name: contact.last_name ? decryptField(contact.last_name) : undefined,
//     email: contact.email ? decryptField(contact.email) : undefined,
//     wa_id: contact.wa_id ? decryptField(contact.wa_id) : undefined,
//   }));

//   return {
//     message: 'Contact Retrieved Successfully!',
//     data: decryptedData,
//     meta: {
//       total,
//       page,
//       lastPage: Math.ceil(total / limit),
//     },
//   };
// }

      async getContact(page: number, limit: number, vendorId: number, search?: string) {
              const skip = (page - 1) * limit;

              let searchFilter = {};

              if (search) {
                const encryptedSearch = encryptField(search);

                searchFilter = {
                  OR: [
                    { first_name: encryptedSearch },
                    { last_name: encryptedSearch },
                    { email: encryptedSearch },
                    { wa_id: encryptedSearch },
                  ],
                };
              }

              const whereCondition = {
                vendorId,
                ...searchFilter,
              };

              const [data, total] = await Promise.all([
                this.prisma.contacts.findMany({
                  where: whereCondition,
                  skip,
                  take: limit,
                  include: {
                    country: true, // <-- Correct relation name here
                    group_contacts: { select: { contactGroupsId: true } },
                  },
                }),
                this.prisma.contacts.count({
                  where: whereCondition,
                }),
              ]);

              const decryptedData = data.map(contact => ({
                ...contact,
                first_name: contact.first_name ? this.EncryptionService.decryptUniversal(contact.first_name) : null,
                last_name: contact.last_name ? this.EncryptionService.decryptUniversal(contact.last_name) : null,
                email: contact.email ? this.EncryptionService.decryptUniversal(contact.email) : null,
                wa_id: contact.wa_id ? this.EncryptionService.decryptUniversal(contact.wa_id) : null,
                country_name: contact.country ? contact.country.name : null, // <-- Get country name
                groups: contact.group_contacts?.map(gc => gc.contactGroupsId) ?? [],
              }));

              return {
                message: 'Contact Retrieved Successfully!',
                data: decryptedData,
                meta: {
                  total,
                  page,
                  lastPage: Math.ceil(total / limit),
                },
              };
            }


        async getContactsByGroupId(
          page: number,
          limit: number,
          vendorId: number,
          groupIdInput: number | string,
          search?: string
        ) {
          const skip = (page - 1) * limit;

          const groupId = typeof groupIdInput === 'string' ? parseInt(groupIdInput, 10) : groupIdInput;

          if (!groupId || isNaN(groupId)) {
            throw new BadRequestException('Valid Group ID is required');
          }

          // Step 1: Get all contactsId from group_contacts table for this group
          const groupContacts = await this.prisma.group_contacts.findMany({
            where: { contactGroupsId: groupId },
            select: { contactsId: true },
          });

          if (groupContacts.length === 0) {
            return {
              message: 'No contacts found for this group',
              data: [],
              meta: { total: 0, page, lastPage: 0 }
            };
          }

          const contactIds = groupContacts.map(gc => gc.contactsId);

          // Step 2: Build search filter
          let searchFilter: Record<string, any> = {};
          if (search && search.trim() !== '') {
            const encryptedSearch = encryptField(search.trim());
            searchFilter = {
              OR: [
                { first_name: encryptedSearch },
                { last_name: encryptedSearch },
                { email: encryptedSearch },
                { wa_id: encryptedSearch },
              ],
            };
          }

          // Step 3: Query contacts with pagination
          const whereCondition = {
            id: { in: contactIds },
            vendorId,
            ...(Object.keys(searchFilter).length > 0 ? searchFilter : {})
          };

          const [contacts, total] = await Promise.all([
            this.prisma.contacts.findMany({
              where: whereCondition,
              skip,
              take: limit,
                include: {
                    country: true, // <-- Correct relation name here
                  },
            }),
            this.prisma.contacts.count({ where: whereCondition }),
          ]);

          // Step 4: Decrypt fields
            const decryptedContacts = await Promise.all(
              contacts.map(async (contact) => {
                const decryptIfNotEmpty = async (value: string | null) => {
                  if (!value || value.trim() === '') return null;
                  return await this.EncryptionService.decryptUniversal(value);
                };

                return {
                  ...contact,
                  first_name: await decryptIfNotEmpty(contact.first_name),
                  last_name: await decryptIfNotEmpty(contact.last_name),
                  email: await decryptIfNotEmpty(contact.email),
                  wa_id: await decryptIfNotEmpty(contact.wa_id),
                  country_name: contact.country?.name ?? null,
                };
              })
            );
          return {
            message: 'Contacts fetched successfully',
            data: decryptedContacts,
            meta: {
              total,
              page,
              lastPage: Math.ceil(total / limit),
            },
          };
        }




  async getCountry() {
    const getCountry = await this.prisma.countries.findMany();
    return {
      message: 'countries Retrieved Successfully!',
      data: getCountry,
    };
  }
   




  // -------------------------------------------------------Custom Field API's--------------------------------------------------------------------------

  async newField(dto: NewFieldDto) {
    const { inputName, inputType, vendors__id } = dto;

    const newField = await this.prisma.contact_custom_fields.create({
      data: {
        uid: uuidv4(),
        input_name: inputName,
        input_type: inputType,
        vendors__id: vendors__id,
      },
    });

    return {
      message: 'Custom field created successfully',
      data: newField,
    };
  }

  async updateField(id: number, dto: NewFieldDto) {
    const updated = await this.prisma.contact_custom_fields.update({
      where: { id: id },
      data: {
        input_name: dto.inputName,
        input_type: dto.inputType,
      },
    });

    return {
      message: 'Custom field updated successfully',
      data: updated,
    };
  }

  async deleteField(id: number) {
    await this.prisma.contact_custom_fields.delete({
      where: { id: id },
    });

    return { message: 'Custom field deleted successfully' };
  }

  // async getAllFields() {
  //   const fields = await this.prisma.contact_custom_fields.findMany();
  //   return { data: fields };
  // }

  async getFieldsByVendor(vendors__id: number) {
    const fields = await this.prisma.contact_custom_fields.findMany({
      where: {
        vendors__id,
      },
    });

    return { data: fields };
  }

  // -------------------------------------------------------New Group API's--------------------------------------------------------------------------

  async newGroup(dto: GroupDto) {
    try {
      const { type, description, vendors__id } = dto;

      const newGroup = await this.prisma.contact_groups.create({
        data: {
          uid: uuidv4(),
          title: type,
          description: description,
          vendors__id: vendors__id,
        },
      });

      return {
        message: 'New Group Created Successfully',
        data: newGroup,
      };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to create new group',
          error: error.message || error,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateGroup(id: number, dto: GroupDto) {
    try {
      const updated = await this.prisma.contact_groups.update({
        where: { id: id },
        data: {
          title: dto.type,
          description: dto.description,
        },
      });

      return {
        message: 'Group updated successfully',
        data: updated,
      };
    } catch (err) {
      throw new HttpException(
        {
          message: 'Failed to update group',
          error: err.message || err,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async deleteGroup(id: number) {
    try {
      await this.prisma.contact_groups.delete({
        where: { id: id },
      });

      return { message: 'Group deleted successfully' };
    } catch (err) {
      throw new HttpException(
        {
          Message: 'Failed To Delete Group',
          Error: err.message || err,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // async getAllGroups(vendors__id: number) {
  //   const fields = await this.prisma.contact_groups.findMany({
  //     where: {
  //       vendors__id,
  //     },
  //   });

  //   return { data: fields };
  // }

  async getAllGroups(vendors__id: number) {
      const groups = await this.prisma.contact_groups.findMany({
        where: {
          vendors__id,
        },
      });

      const mappedGroups = groups.map(group => ({
        ...group,
        archieved: group.status === 1 ? 'active' : 'inactive',
      }));

      return { data: mappedGroups };
    }


  async addContactsToGroup(groupId: number, contactIds: number[]) {
    if (!groupId || !Array.isArray(contactIds) || contactIds.length === 0) {
      throw new BadRequestException('Invalid groupId or contactIds');
    }

    const now = new Date();

    const entries = contactIds.map(contactId => ({
      uid: uuidv4(),
      contactGroupsId: groupId,
      contactsId: contactId,
      created_at: now,
      updated_at: now,
      status: 1,
    }));

    const result = await this.prisma.group_contacts.createMany({
      data: entries,
      skipDuplicates: true,
    });

    return {
      message: `${result.count} contact(s) added to group ${groupId}`,
    };
  }

      async exportContacts(vendorId: number): Promise<string> {
      const contacts = await this.prisma.contacts.findMany({
        where: {
          vendorId: Number(vendorId),
        },
        select: {
          first_name: true,
          last_name: true,
          wa_id: true,
          language_code: true,
          email: true,
        },
      });

      // Decryption helper
      const decryptIfNotEmpty = async (value: string | null): Promise<string> => {
        if (!value || value.trim() === '') {
          return '';
        }
        return await this.EncryptionService.decryptUniversal(value);
      };

      const rows = await Promise.all(
        contacts.map(async (c) => ({
          'First Name': await decryptIfNotEmpty(c.first_name),
          'Last Name': await decryptIfNotEmpty(c.last_name),
          'Mobile Number': await decryptIfNotEmpty(c.wa_id),
          'Language Code': c.language_code ?? '',
          'Email': await decryptIfNotEmpty(c.email),
        }))
      );

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Contacts');

      worksheet.columns = Object.keys(rows[0] || {}).map((key) => ({
        header: key,
        key: key,
        width: 20,
      }));

      rows.forEach((row) => worksheet.addRow(row));

      const filePath = path.join(__dirname, `../../../contacts-export-${vendorId}.xlsx`);
      await workbook.xlsx.writeFile(filePath);

      return filePath;
    }


    // async exportContacts(vendorId: number): Promise<string> {
    //     const contacts = await this.prisma.contacts.findMany({
    //       where: {
    //         vendorId: Number(vendorId), // Force convert to number
    //       },
    //       select: {
    //         first_name: true,
    //         last_name: true,
    //         wa_id: true,
    //         language_code: true,
    //         email: true,
    //       },
    //     });

    //   // const rows = contacts.map(c => ({
    //   //   'First Name': c.first_name || '',
    //   //   'Last Name': c.last_name || '',
    //   //   'Mobile Number': c.wa_id || '',
    //   //   'Language Code': c.language_code || '',
    //   //   'Email': c.email || '',
    //   // }));
    //     const rows = contacts.map(c => ({
    //         'First Name': decryptField(c.first_name ?? ''),
    //         'Last Name': decryptField(c.last_name ?? ''),
    //         'Mobile Number': decryptField(c.wa_id ?? ''),
    //         'Language Code': c.language_code ?? '',
    //         'Email': decryptField(c.email ?? ''),
    //       }));



      

    //   const workbook = new ExcelJS.Workbook();
    //   const worksheet = workbook.addWorksheet('Contacts');

    //   worksheet.columns = Object.keys(rows[0] || {}).map(key => ({
    //     header: key,
    //     key: key,
    //     width: 20,
    //   }));

    //   rows.forEach(row => worksheet.addRow(row));

    //   const filePath = path.join(__dirname, `../../../contacts-export-${vendorId}.xlsx`);
    //   await workbook.xlsx.writeFile(filePath);

    //   return filePath;
    // }


    //  async getContactByUid(contact_uid: string) {
    //   this.logger.log(`Fetching contact for UIDwewwqeqw: ${contact_uid}`);

    //   const contact = await this.prisma.contacts.findUnique({
    //     where: { uid: contact_uid },
    //   });

    //   if (!contact) {
    //     this.logger.warn(`No contact found for UID: ${contact_uid}`);
    //     return null;
    //   }

    //   try {
    //     contact.first_name = contact.first_name ? decryptField(contact.first_name) ?? null : null;
    //     contact.last_name  = contact.last_name  ? decryptField(contact.last_name)  ?? null : null;
    //     contact.email      = contact.email      ? decryptField(contact.email)      ?? null : null;
    //     contact.wa_id      = contact.wa_id      ? decryptField(contact.wa_id)      ?? null : null;
    //   } catch (err) {
    //     this.logger.error(`Decryption failed for contact UID: ${contact_uid}`, err);
    //     throw new BadRequestException('Failed to decrypt contact fields');
    //   }

    //   return contact;
    // }

    async getContactByUid(contact_uid: string) {
      this.logger.log(`Fetching contact for UID: ${contact_uid}`);

      const contact = await this.prisma.contacts.findUnique({
        where: { uid: contact_uid },
      });

      if (!contact) {
        this.logger.warn(`No contact found for UID: ${contact_uid}`);
        return null;
      }

      try {
        contact.first_name = contact.first_name ? decryptField(contact.first_name) ?? null : null;
        contact.last_name  = contact.last_name  ? decryptField(contact.last_name)  ?? null : null;
        contact.email      = contact.email      ? decryptField(contact.email)      ?? null : null;
        contact.wa_id      = contact.wa_id      ? decryptField(contact.wa_id)      ?? null : null;
      } catch (err) {
        this.logger.error(`Decryption failed for contact UID: ${contact_uid}`, err);
        throw new BadRequestException('Failed to decrypt contact fields');
      }

      let countryName: string | null = null;
      if (contact.countries__id) {
        const country = await this.prisma.countries.findUnique({
          where: { id: contact.countries__id },
        });
        countryName = country?.name || null;
      }

      return {
        ...contact,
        country_name: countryName,
      };
    }

    async toggleGroupStatus(vendorUid: string, groupId: number) {
      try {
        const vendor = await this.prisma.vendors.findUnique({
          where: { uid: vendorUid },
          select: { id: true },
        });

        if (!vendor) {
          return {
            success: false,
            message: 'Vendor not found',
          };
        }

        const group = await this.prisma.contact_groups.findFirst({
          where: {
            id: groupId,
            vendors__id: vendor.id,
          },
          select: { id: true, status: true },
        });

        if (!group) {
          return {
            success: false,
            message: 'Group not found or does not belong to the vendor',
          };
        }

        const newStatus = group.status === 1 ? 0 : 1;

        await this.prisma.contact_groups.update({
          where: { id: group.id },
          data: { status: newStatus },
        });

        return {
          success: true,
          message: `Group status changed to ${newStatus === 1 ? 'Achieved' : 'Unachieved'}`,
        };
      } catch (error) {
        return {
          success: false,
          message: 'Something went wrong',
          error: error.message,
        };
      }
    }



}