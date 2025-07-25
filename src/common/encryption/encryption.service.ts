import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, scryptSync } from 'crypto';
import * as CryptoJS from 'crypto-js';
import * as crypto from 'crypto';

const SECRET_KEY = process.env.SECRET_KEY || '48962874218962874213689687';


@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly key: Buffer;
  private readonly iv: Buffer;

  constructor() {
    const password = 'Salegrowy$ecureP@ssw0rd!';
    const salt = 'hghtfjklhtkjlptt';
    this.key = scryptSync(password, salt, 32); // 32-byte key
    this.iv = Buffer.from('1234567890abcdef0987654321efdcba', 'hex'); // Must be 16 bytes
  }

  encrypt(text: string | number | null): string {
    const data=String(text);
    const cipher = createCipheriv(this.algorithm, this.key, this.iv);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    return encrypted.toString('hex');
  }

  decrypt(encryptedText: string | number | null): string {
    const data=String(encryptedText);
    const encrypted = Buffer.from(data, 'hex');
    const decipher = createDecipheriv(this.algorithm, this.key, this.iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

    encryptpayload(payload: any): string {
    const key = Buffer.from(process.env.ENCRYPT_KEY!, 'hex'); // 32 bytes
    const iv = Buffer.from(process.env.ENCRYPT_IV!, 'hex');   // 16 bytes

    const plainText = typeof payload === 'string' ? payload : JSON.stringify(payload);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return encrypted;
  }

  // //   encryptText(value: any): string {
  // // return CryptoJS.AES.encrypt(String(value), SECRET_KEY).toString();
  // //   }

  // //     decryptText(encryptedValue: string): string {
  // //     const bytes = CryptoJS.AES.decrypt(encryptedValue, SECRET_KEY);
  // //     return bytes.toString(CryptoJS.enc.Utf8);
  // //   }

  // // Utility functions inside your EncryptionService or Helper

  //     encryptWithUtf8Support(originalText: string): string {
  //       const base64Text = Buffer.from(originalText, 'utf-8').toString('base64');
  //       return this.encrypt(base64Text);  // your existing encryption function
  //     }

  //     decryptWithUtf8Support(encryptedText: string): string {
  //       const base64Text = this.decrypt(encryptedText);
  //       return Buffer.from(base64Text, 'base64').toString('utf-8');
  //     }
        
    // ✅ Single encrypt function which supports both normal & special characters
      encryptUniversal(input: string | number | null): string {
        if (input === null || input === undefined) return '';

        const text = String(input);
        // Always encode to Base64 before encryption to handle emojis/special chars
        const base64Encoded = Buffer.from(text, 'utf8').toString('base64');

        const cipher = createCipheriv(this.algorithm, this.key, this.iv);
        const encrypted = Buffer.concat([cipher.update(base64Encoded, 'utf8'), cipher.final()]);
        return encrypted.toString('hex');
      }

      decryptUniversal(encryptedText: string | number | null): string {
        if (encryptedText === null || encryptedText === undefined) return '';

        const encryptedBuffer = Buffer.from(String(encryptedText), 'hex');
        const decipher = createDecipheriv(this.algorithm, this.key, this.iv);
        const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);

        // Decode back from Base64 to UTF-8 original string
        return Buffer.from(decrypted.toString('utf8'), 'base64').toString('utf8');
      }

      
      



}
