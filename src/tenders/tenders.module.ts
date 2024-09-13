import { Module } from '@nestjs/common';
import { TendersController } from './tenders.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [TendersController],
  providers: [PrismaService],
})
export class TendersModule {}
