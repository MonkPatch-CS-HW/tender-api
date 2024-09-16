import { Module } from '@nestjs/common';
import { TendersController } from './tenders.controller';
import { PrismaService } from '../prisma.service';
import { TendersService } from './tenders.service';
import { EmployeesService } from '../employees/employees.service';

@Module({
  controllers: [TendersController],
  providers: [PrismaService, EmployeesService, TendersService],
})
export class TendersModule {}
