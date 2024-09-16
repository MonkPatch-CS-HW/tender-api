import { Module } from '@nestjs/common';
import { BidsController } from './bids.controller';
import { BidsService } from './bids.service';
import { PrismaService } from '../prisma.service';
import { TendersService } from '../tenders/tenders.service';
import { EmployeesService } from '../employees/employees.service';
import { OrganizationsService } from '../organizations/organizations.service';

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
