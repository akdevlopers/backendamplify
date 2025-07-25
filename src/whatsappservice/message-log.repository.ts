import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MessageLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(payload: any) {
    return this.prisma.whatsAppMessageLog.create({
      data: {
        ...payload,
        uid: payload.uid ??  uuidv4(),
        createdAt: new Date(),
      },
    });
  }
}

