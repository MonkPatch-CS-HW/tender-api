import {
  Body,
  Controller,
  ForbiddenException,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { BidsService } from './bids.service';
import { IsEnum, IsNotEmpty, IsUUID, Length } from 'class-validator';
import { bidAuthorType } from '@prisma/client';
import { TendersService } from 'src/tenders/tenders.service';
import { EmployeesService } from 'src/employees/employees.service';

class BidCreateBody {
  @IsNotEmpty()
  @Length(0, 100)
  name: string;

  @Length(0, 500)
  description: string;

  @IsUUID()
  tenderId: string;

  @IsEnum(bidAuthorType)
  authorType: bidAuthorType;

  @IsUUID()
  authorId: string;
}

@Controller('bids')
export class BidsController {
  constructor(
    private bidsService: BidsService,
    private tendersService: TendersService,
    private employeesService: EmployeesService,
  ) {}

  @Post('new')
  async create(@Body() data: BidCreateBody) {
    const tender = await this.tendersService.getById(data.tenderId);
    if (tender === null) throw new NotFoundException('Tender is not found');

    switch (data.authorType) {
      case 'Organization':
        if (tender.organizationId !== data.authorId)
          throw new ForbiddenException(
            'Organization is not the owner of the tender',
          );
        break;
      case 'User':
        const employee = await this.employeesService.getById(
          data.authorId,
          true,
        );
        if (employee === null) throw new NotFoundException('User is not found');

        if (!employee.organizationIds.includes(tender.organizationId))
          throw new ForbiddenException(
            'User is not responsible for the organization',
          );
    }
    return await this.bidsService.create(data);
  }
}
