import { Module } from '@nestjs/common';
import { TendersController } from './tenders.controller';
import { PrismaService } from 'src/prisma.service';
import { TendersService } from './tenders.service';
import { EmployeesService } from 'src/employees/employees.service';

@Module({
  controllers: [TendersController],
  providers: [PrismaService, EmployeesService, TendersService],
})
export class TendersModule {}
