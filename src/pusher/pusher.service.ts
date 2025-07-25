import { Injectable } from '@nestjs/common';
import * as Pusher from 'pusher';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PusherService {
  private pusher: Pusher;

  constructor(private configService: ConfigService) {
   this.pusher = new Pusher({
        appId: this.configService.getOrThrow<string>('PUSHER_APP_ID'),
        key: this.configService.getOrThrow<string>('PUSHER_KEY'),
        secret: this.configService.getOrThrow<string>('PUSHER_SECRET'),
        cluster: this.configService.getOrThrow<string>('PUSHER_CLUSTER'),
        useTLS: true,
        });

  }

  async trigger(channel: string, event: string, data: any) {
    return this.pusher.trigger(channel, event, data);
  }
}
