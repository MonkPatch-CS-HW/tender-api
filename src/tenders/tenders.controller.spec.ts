import { Test, TestingModule } from '@nestjs/testing';
import { TendersController } from './tenders.controller';

describe('TendersController', () => {
  let controller: TendersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TendersController],
    }).compile();

    controller = module.get<TendersController>(TendersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
