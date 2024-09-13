import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { BidData, BidsService } from './bids.service';
import { IsEnum, IsNotEmpty, IsUUID, Length, Min } from 'class-validator';
import { bidAuthorType } from '@prisma/client';
import { TendersService } from 'src/tenders/tenders.service';
import { EmployeesService } from 'src/employees/employees.service';

class QueryBidsMy {
  @Min(0)
  offset: number = 0;

  @Min(0)
  limit: number = 5;

  @IsNotEmpty()
  username: string;
}

class QueryBidsList {
  @Min(0)
  offset: number = 0;

  @Min(0)
  limit: number = 5;

  @IsNotEmpty()
  username: string;
}

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

  @IsNotEmpty()
  creatorUsername: string;
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

    const creator = await this.employeesService.getByUsername(
      data.creatorUsername,
    );

    return await this.bidsService.create({
      creatorId: creator.id,
      authorType: data.authorType,
      authorId: data.authorId,
      description: data.description,
      name: data.name,
      tenderId: data.tenderId,
    });
  }

  @Get('my')
  async my(@Query() query: QueryBidsMy): Promise<BidData[]> {
    const creator = await this.employeesService.getByUsername(query.username);
    if (creator === null)
      throw new UnauthorizedException('Employee is not found');

    return await this.bidsService.getByCreator(
      creator.id,
      query.limit,
      query.offset,
    );
  }

  @Get(':tenderId/list')
  async list(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Query() query: QueryBidsList,
  ): Promise<BidData[]> {
    const employee = await this.employeesService.getByUsername(
      query.username,
      true,
    );
    if (employee === null) throw new NotFoundException('Employee is not found');

    const tender = await this.tendersService.getById(tenderId);
    if (tender === null) throw new NotFoundException('Tender is not found');

    if (!employee.organizationIds.includes(tender.organizationId))
      throw new ForbiddenException(
        'Employee is not responsible for organization',
      );

    return await this.bidsService.getByTender(
      tenderId,
      query.limit,
      query.offset,
    );
  }
}
