import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { tenderServiceType, tenderStatus } from '@prisma/client';
import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, Length, Min } from 'class-validator';
import { TenderData, TendersService } from './tenders.service';
import { EmployeesService } from 'src/employees/employees.service';

class QueryTendersMy {
  @Min(0)
  offset: number = 0;

  @Min(0)
  limit: number = 5;

  @IsNotEmpty()
  username: string;
}

class QueryTenders {
  @Min(0)
  offset: number = 0;

  @Min(0)
  limit: number = 5;

  @Transform(({ value }) => (value ? [].concat(value) : []))
  @IsEnum(tenderServiceType, { each: true })
  @Expose({ name: 'service_type' })
  serviceTypes: tenderServiceType[];
}

export class TenderCreateBody {
  @IsNotEmpty()
  @Length(0, 100)
  name: string;

  @Length(0, 500)
  description: string;

  @IsEnum(tenderServiceType)
  serviceType: tenderServiceType;

  @IsNotEmpty()
  organizationId: string;

  @IsNotEmpty()
  creatorUsername: string;
}

export class TenderEditBody {
  @IsNotEmpty()
  @Length(0, 100)
  name: string;

  @Length(0, 500)
  description: string;

  @IsEnum(tenderServiceType)
  serviceType: tenderServiceType;
}

@Controller('tenders')
export class TendersController {
  constructor(
    private employeesService: EmployeesService,
    private tendersService: TendersService,
  ) {}

  @Get()
  async tenders(@Query() query: QueryTenders): Promise<TenderData[]> {
    return await this.tendersService.get(
      query.serviceTypes,
      query.limit,
      query.offset,
    );
  }

  @Post('new')
  async new(@Body() tender: TenderCreateBody): Promise<TenderData> {
    const creator = await this.employeesService.getByUsername(
      tender.creatorUsername,
      true,
    );
    if (creator === null)
      throw new UnauthorizedException('Employee is not found');

    if (!creator.organizationIds.includes(tender.organizationId))
      throw new ForbiddenException(
        'Organization is not found or employee is not responsible',
      );

    return await this.tendersService.create({
      name: tender.name,
      description: tender.description,
      serviceType: tender.serviceType,
      organizationId: tender.organizationId,
      creatorId: creator.id,
    });
  }

  @Get('my')
  async my(@Query() query: QueryTendersMy): Promise<TenderData[]> {
    const creator = await this.employeesService.getByUsername(query.username);
    if (creator === null)
      throw new UnauthorizedException('Employee is not found');

    return await this.tendersService.getByCreator(
      creator.id,
      query.limit,
      query.offset,
    );
  }

  @Get(':tenderId/status')
  async status(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Query('username') username: string,
  ): Promise<tenderStatus> {
    const employee = await this.employeesService.getByUsername(username);
    if (employee === null)
      throw new UnauthorizedException('Employee is not found');

    const tender = await this.tendersService.getById(tenderId, true);
    if (tender === null) throw new NotFoundException('Tender is not found');

    if (tender.creatorId !== employee.id)
      throw new ForbiddenException(
        'The employee is not the creator of the tender',
      );

    return tender.status;
  }

  @Put(':tenderId/status')
  async setStatus(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Query('username') username: string,
    @Query('status', new ParseEnumPipe(tenderStatus)) status: tenderStatus,
  ): Promise<TenderData> {
    const employee = await this.employeesService.getByUsername(username);
    if (employee === null)
      throw new UnauthorizedException('Employee is not found');

    const tender = await this.tendersService.getById(tenderId, true);
    if (tender === null) throw new NotFoundException('Tender is not found');

    if (tender.creatorId !== employee.id)
      throw new ForbiddenException('Employee is not the creator of the tender');

    return await this.tendersService.updateStatus(tenderId, status);
  }

  @Patch(':tenderId/edit')
  async edit(
    @Body() data: TenderEditBody,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Query('username') username: string,
  ): Promise<TenderData> {
    const tender = await this.tendersService.getById(tenderId);
    if (tender === null) throw new NotFoundException('Tender is not found');

    const employee = await this.employeesService.getByUsername(username, true);
    if (employee === null)
      throw new UnauthorizedException('Employee is not found');

    if (!employee.organizationIds.includes(tender.organizationId))
      throw new ForbiddenException(
        'Employee is not responsible for organization',
      );

    return await this.tendersService.edit(tenderId, data);
  }

  @Put(':tenderId/rollback/:version')
  async rollback(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Param('version', ParseIntPipe) version: number,
    @Query('username') username: string,
  ): Promise<TenderData> {
    const tender = await this.tendersService.getById(tenderId);
    if (tender === null)
      throw new NotFoundException('Tender or its version is not found');

    const employee = await this.employeesService.getByUsername(username, true);
    if (employee === null)
      throw new UnauthorizedException('Employee is not found');

    if (!employee.organizationIds.includes(tender.organizationId))
      throw new ForbiddenException(
        'Employee is not responsible for organization',
      );

    return await this.tendersService.rollback(tenderId, version);
  }
}
