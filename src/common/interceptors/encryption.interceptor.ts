import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
  } from '@nestjs/common';
  import { Observable, map } from 'rxjs';
  import * as CryptoJS from 'crypto-js';
  
  const SECRET_KEY = process.env.SECRET_KEY || '48962874218962874213689687';
  
  @Injectable()
  export class EncryptionInterceptor implements NestInterceptor {
    // encryptData(data: any): string {
    //   return CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
    // }
    // encryptData(data: any): string {
    //   return CryptoJS.AES.encrypt(
    //     JSON.stringify(data, (_key, value) =>
    //       typeof value === 'bigint' ? value.toString() : value
    //     ),
    //     SECRET_KEY
    //   ).toString();
    // }
    encryptData(data: any): string {
      const seen = new WeakSet();
    
      const replacer = (_key: string, value: any) => {
        // Handle BigInt
        if (typeof value === 'bigint') {
          return value.toString();
        }
    
        // Handle circular references
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
    
        return value;
      };
    
      try {
        const json = JSON.stringify(data, replacer);
        return CryptoJS.AES.encrypt(json, SECRET_KEY).toString();
      } catch (err) {
        console.error('Encryption failed:', err);
        return '';
      }
    }
    
    
  
    decryptData(encryptedData: string): any {
      try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
        return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
      } catch (error) {
        return encryptedData; // Return original data if decryption fails
      }
    }
  
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      const request = context.switchToHttp().getRequest();
  
      // 🔹 Decrypt incoming request body
      if (request.body && typeof request.body === 'string') {
        request.body = this.decryptData(request.body);
      }
  
      return next.handle().pipe(
        map((data) => {
          // 🔹 Encrypt response before sending it back
          return this.encryptData(data);
        }),
      );
    }
  }
  