import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappserviceController } from './whatsappservice.controller';

describe('WhatsappserviceController', () => {
  let controller: WhatsappserviceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsappserviceController],
    }).compile();

    controller = module.get<WhatsappserviceController>(WhatsappserviceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

