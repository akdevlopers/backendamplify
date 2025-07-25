import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import * as crypto from 'crypto';

@Injectable()
export class DecryptInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    try {
      // Handle body decryption (POST)
      if (request.body && typeof request.body === 'object' && request.body.data) {
        const encryptedString = request.body.data;
        request.body = this.decryptPayload(encryptedString);
      }

      // Handle query decryption (GET)
      if (request.query?.encrypted && typeof request.query.encrypted === 'string') {
        const decryptedQuery = this.decryptPayload(request.query.encrypted);
        Object.assign(request.query, decryptedQuery); 
        delete request.query.encrypted;
      }

    } catch (err) {
      console.error('Decryption error:', err);
      throw new BadRequestException('Invalid encrypted payload or query');
    }

    return next.handle();
  }

  private decryptPayload(encrypted: string): any {
    const key = Buffer.from(process.env.ENCRYPT_KEY!, 'hex');
    const iv = Buffer.from(process.env.ENCRYPT_IV!, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

      Logger.log(JSON.stringify(decrypted), 'DecryptedRequest');

    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  }
}

