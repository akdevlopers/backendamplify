import { Injectable, NestMiddleware, BadRequestException, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import * as getRawBody from 'raw-body';

@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string;
      if (!hmacHeader) throw new BadRequestException('Missing HMAC');

      const rawBody = await getRawBody(req); // returns a Buffer

      if (!rawBody || rawBody.length === 0) {
        throw new NotFoundException('No payload found');
      }

      const secret = process.env.SHOPIFY_API_SECRET || '';

      const generatedHmac = crypto
        .createHmac('sha256', secret)
        .update(rawBody) // Buffer, no encoding needed
        .digest('base64');

      if (generatedHmac !== hmacHeader) {
        throw new BadRequestException('Invalid HMAC');
      }

      (req as any).rawBody = rawBody;
      next();
    } catch (error) {
      console.error('HMAC Verification Failed:', error.message);
      return res.status(401).json({ error: error.message || 'Unauthorized – Invalid HMAC' });
    }
  }
}
