import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappSetupService } from './whatsappsetup.service';

describe('WhatsappsetupService', () => {
  let service: WhatsappSetupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WhatsappSetupService],
    }).compile();

    service = module.get<WhatsappSetupService>(WhatsappSetupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
