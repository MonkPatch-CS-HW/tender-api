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
import { tenderServiceType, tenderStatus } from '@prisma/client';
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

@Controller('tenders')
export class TendersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async tenders(@Query() query: QueryTenders): Promise<ResponseTender[]> {
    console.log(1, query.serviceTypes);
    const tenders = await this.prisma.tender.findMany({
      where: { serviceType: { in: query.serviceTypes } },
      skip: query.offset,
      take: query.limit,
    });

    return tenders.map<ResponseTender>((tender) => ({
      id: tender.id,
      name: tender.name,
      description: tender.description,
      status: tender.status,
      serviceType: tender.serviceType,
      version: tender.version,
      createdAt: tender.createdAt.toISOString(),
    }));
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

    return {
      id: result.id,
      name: result.name,
      description: result.description,
      status: result.status,
      serviceType: result.serviceType,
      version: result.version,
      createdAt: result.createdAt.toISOString(),
    };
  }

  @Get('my')
  async my(@Query() query: QueryTendersMy): Promise<ResponseTender[]> {
    const creator = await this.prisma.employee.findFirst({
      where: { username: query.username },
      select: { id: true },
    });

    if (creator === null) throw new UnauthorizedException('User is not found');

    const tenders = await this.prisma.tender.findMany({
      where: { creatorId: creator.id },
      skip: query.offset,
      take: query.limit,
    });

    return tenders.map<ResponseTender>((tender) => ({
      id: tender.id,
      name: tender.name,
      description: tender.description,
      status: tender.status,
      serviceType: tender.serviceType,
      version: tender.version,
      createdAt: tender.createdAt.toISOString(),
    }));
  }

  @Get(':tenderId/status')
  async status(
    @Param(ParseUUIDPipe) tenderId: string,
    @Query() username: string,
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
}
