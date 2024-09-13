import {
  Body,
  Controller,
  DefaultValuePipe,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  ParseIntPipe,
  Post,
  Query,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { tender, tenderServiceType, tenderStatus } from '@prisma/client';
import { Expose, plainToInstance, Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  Length,
  Min,
} from 'class-validator';
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
          select: {
            organizationId: true,
          },
        },
      },
    });

    if (creator === null) throw new UnauthorizedException('User is not found');

    const orgIds = creator.organizationResponsible.map((x) => x.organizationId);
    if (!orgIds.includes(tender.organizationId))
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
}
