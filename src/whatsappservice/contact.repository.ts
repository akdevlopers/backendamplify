import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as CryptoJS from 'crypto-js';
import { EncryptionService } from 'src/common/encryption/encryption.service';

const SECRET_KEY = process.env.SECRET_KEY || '48962874218962874213689687';

function decryptField(encryptedValue: string): string | undefined {
  if (!encryptedValue) return undefined;

  try {
    const bytes = CryptoJS.AES.decrypt(encryptedValue, SECRET_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || encryptedValue;
  } catch (err) {
    console.error('Decryption error:', err);
    return encryptedValue;
  }
}

@Injectable()
export class ContactRepository {
  constructor(private readonly prisma: PrismaService,private  EncryptionService: EncryptionService) {}

  
async getVendorContact(contactUid: string) {
  const contact = await this.prisma.contacts.findFirst({
    where: { uid: contactUid },
  });

  console.log(contactUid);

  if (!contact) return null;

  const decryptIfNotEmpty = async (value: string | null) => {
    if (!value || value.trim() === '') {
      return value;
    }
    return await this.EncryptionService.decryptUniversal(value);
  };

  return {
    ...contact,
    first_name: await decryptIfNotEmpty(contact.first_name),
    last_name: await decryptIfNotEmpty(contact.last_name),
    wa_id: await decryptIfNotEmpty(contact.wa_id),
    email: await decryptIfNotEmpty(contact.email),
  };
}


  // contact.repository.ts
  async findByUid(uid: string) {
    return this.prisma.contacts.findFirst({
      where: { uid },
    });
  }

}
