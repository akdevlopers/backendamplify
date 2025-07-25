import { Controller, Post, Body,BadRequestException } from '@nestjs/common';
import { PusherService } from './pusher.service';
import {PusherTriggerDto} from './dto/pusher.dto'

@Controller('pusher')
export class PusherController {
  constructor(private readonly pusherService: PusherService) {}

  @Post('trigger')
 async testPusher(@Body() body: PusherTriggerDto) {
  if (!body) {
    console.error('Body is undefined');
    throw new BadRequestException('Request body is missing or invalid');
  }
  const { channel, event, message } = body;
  await this.pusherService.trigger(channel, event, { message });
  return { success: true };
}
}