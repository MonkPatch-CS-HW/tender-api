import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UsePipes,
} from '@nestjs/common';
import { tender, tenderServiceType, tenderStatus } from '@prisma/client';
import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, Length, Min } from 'class-validator';
import { PrismaService } from 'src/prisma.service';

class RequestTenderNew {
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

class RequestTenderEdit {
  @IsNotEmpty()
  @Length(0, 100)
  name: string;

  @Length(0, 500)
  description: string;

  @IsEnum(tenderServiceType)
  serviceType: tenderServiceType;
}

class ResponseTender {
  id: string;
  name: string;
  description: string;
  status: tenderStatus;
  serviceType: tenderServiceType;
  version: number;
  createdAt: string;
}

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

  @Transform(({ value }) => [].concat(value))
  @IsEnum(tenderServiceType, { each: true })
  @Expose({ name: 'service_type' })
  serviceTypes: tenderServiceType[];
}

function mapPrismaToTender(tender: tender) {
  return {
    id: tender.id,
    name: tender.name,
    description: tender.description,
    status: tender.status,
    serviceType: tender.serviceType,
    version: tender.version,
    createdAt: tender.createdAt.toISOString(),
  };
}

@Controller('tenders')
export class TendersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async tenders(@Query() query: QueryTenders): Promise<ResponseTender[]> {
    const tenders = await this.prisma.tender.findMany({
      where: { serviceType: { in: query.serviceTypes }, originalId: null },
      skip: query.offset,
      take: query.limit,
    });

    return tenders.map<ResponseTender>(mapPrismaToTender);
  }

  @Post('new')
  async new(@Body() tender: RequestTenderNew): Promise<ResponseTender> {
    const creator = await this.prisma.employee.findFirst({
      where: {
        username: tender.creatorUsername,
      },
      select: {
        id: true,
        organizationResponsible: {
          where: {
            organizationId: tender.organizationId,
          },
          select: {
            organizationId: true,
          },
        },
      },
    });

    if (creator === null) throw new UnauthorizedException('User is not found');

    if (creator.organizationResponsible.length === 0)
      throw new ForbiddenException(
        'Organization is not found or user is not responsible',
      );

    const result = await this.prisma.tender.create({
      data: {
        name: tender.name,
        description: tender.description,
        serviceType: tender.serviceType,
        organizationId: tender.organizationId,
        creatorId: creator.id,
      },
    });

    return mapPrismaToTender(result);
  }

  @Get('my')
  async my(@Query() query: QueryTendersMy): Promise<ResponseTender[]> {
    const creator = await this.prisma.employee.findFirst({
      where: { username: query.username },
      select: { id: true },
    });

    if (creator === null) throw new UnauthorizedException('User is not found');

    const tenders = await this.prisma.tender.findMany({
      where: { creatorId: creator.id, originalId: null },
      skip: query.offset,
      take: query.limit,
    });

    return tenders.map<ResponseTender>(mapPrismaToTender);
  }

  @Get(':tenderId/status')
  async status(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Query('username') username: string,
  ): Promise<tenderStatus> {
    const user = await this.prisma.employee.findFirst({
      where: { username: username },
      select: {
        id: true,
      },
    });

    if (user === null) throw new UnauthorizedException('User is not found');

    const tender = await this.prisma.tender.findFirst({
      where: { id: tenderId },
      select: {
        creatorId: true,
        status: true,
      },
    });

    if (tender === null) throw new NotFoundException('Tender is not found');

    if (tender.creatorId !== user.id)
      throw new ForbiddenException('The user is not the creator of the tender');

    return tender.status;
  }

  @Patch(':tenderId/edit')
  async edit(
    @Body() data: RequestTenderEdit,
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Query('username') username: string,
  ): Promise<ResponseTender> {
    const tender = await this.prisma.tender.findFirst({
      where: { id: tenderId },
    });

    if (tender === null) throw new NotFoundException('Tender is not found');

    const user = await this.prisma.employee.findFirst({
      where: { username: username },
      select: {
        id: true,
        organizationResponsible: {
          select: { id: true },
          where: { id: tender.organizationId },
        },
      },
    });

    if (user === null) throw new UnauthorizedException('User is not found');

    if (user.organizationResponsible.length === 0)
      throw new ForbiddenException('User is not responsible for organization');

    const trans = await this.prisma.$transaction([
      this.prisma.tender.create({
        data: { ...tender, originalId: tender.id, id: void 0 },
      }),
      this.prisma.tender.update({
        where: { id: tender.id },
        data: {
          ...tender,
          name: data.name,
          description: data.description,
          serviceType: data.serviceType,
          version: tender.version + 1,
        },
      }),
    ]);

    return mapPrismaToTender(trans[1]);
  }
}
