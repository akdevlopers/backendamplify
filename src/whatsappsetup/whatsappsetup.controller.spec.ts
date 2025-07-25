import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappsetupController } from './whatsappsetup.controller';

describe('WhatsappsetupController', () => {
  let controller: WhatsappsetupController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsappsetupController],
    }).compile();

    controller = module.get<WhatsappsetupController>(WhatsappsetupController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
