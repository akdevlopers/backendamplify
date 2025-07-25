import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappchatController } from './whatsappchat.controller';

describe('WhatsappchatController', () => {
  let controller: WhatsappchatController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsappchatController],
    }).compile();

    controller = module.get<WhatsappchatController>(WhatsappchatController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
