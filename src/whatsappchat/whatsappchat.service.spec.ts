import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappchatService } from './whatsappchat.service';

describe('WhatsappchatService', () => {
  let service: WhatsappchatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WhatsappchatService],
    }).compile();

    service = module.get<WhatsappchatService>(WhatsappchatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
