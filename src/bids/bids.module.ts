import { Module } from '@nestjs/common';
import { BidsController } from './bids.controller';
import { BidsService } from './bids.service';
import { PrismaService } from 'src/prisma.service';
import { TendersService } from 'src/tenders/tenders.service';
import { EmployeesService } from 'src/employees/employees.service';
import { OrganizationsService } from 'src/organizations/organizations.service';

@Module({
  controllers: [BidsController],
  providers: [
    PrismaService,
    BidsService,
    TendersService,
    EmployeesService,
    OrganizationsService,
  ],
})
export class BidsModule {}
