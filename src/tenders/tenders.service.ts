import { Injectable } from '@nestjs/common';
import { tender, tenderServiceType, tenderStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';

export type TenderEditData = {
  name: string;
  description: string;
  serviceType: tenderServiceType;
};

export type TenderCreateData = {
  name: string;
  description: string;
  serviceType: tenderServiceType;
  organizationId: string;
  creatorId: string;
};

export type TenderData<IC extends boolean = false> = TenderEditData & {
  id: string;
  status: tenderStatus;
  version: number;
  createdAt: string;
  organizationId: string;
} & (IC extends true ? { creatorId: string } : {});

function mapPrismaToTenderData(
  tender: tender,
  includeCreator?: false,
): TenderData<false>;
function mapPrismaToTenderData(
  tender: tender,
  includeCreator: true,
): TenderData<true>;
function mapPrismaToTenderData(
  tender: tender,
  includeCreator: boolean = false,
): TenderData<boolean> {
  return {
    id: tender.id,
    name: tender.name,
    description: tender.description,
    status: tender.status,
    serviceType: tender.serviceType,
    version: tender.version,
    organizationId: tender.organizationId,
    createdAt: tender.createdAt.toISOString(),
    ...(includeCreator ? { creatorId: tender.creatorId } : {}),
  };
}

@Injectable()
export class TendersService {
  constructor(private prisma: PrismaService) {}

  async getPublished(
    serviceTypes: tenderServiceType[],
    limit: number,
    offset: number,
  ): Promise<TenderData[]> {
    const tenders = await this.prisma.tender.findMany({
      where: {
        ...(serviceTypes.length ? { serviceType: { in: serviceTypes } } : {}),
        originalId: null,
        status: tenderStatus.Published,
      },
      skip: offset,
      take: limit,
    });

    return tenders.map<TenderData>((p) => mapPrismaToTenderData(p));
  }

  async getByCreator(
    creatorId: string,
    limit: number,
    offset: number,
  ): Promise<TenderData[]> {
    const tenders = await this.prisma.tender.findMany({
      where: { creatorId, originalId: null },
      skip: offset,
      take: limit,
    });

    return tenders.map<TenderData>((p) => mapPrismaToTenderData(p));
  }

  async create(data: TenderCreateData): Promise<TenderData> {
    const tender = await this.prisma.tender.create({
      data: {
        name: data.name,
        description: data.description,
        serviceType: data.serviceType,
        organizationId: data.organizationId,
        creatorId: data.creatorId,
      },
    });

    return mapPrismaToTenderData(tender);
  }

  async getById(
    tenderId: string,
    includeCreator?: false,
  ): Promise<TenderData<false> | null>;
  async getById(
    tenderId: string,
    includeCreator?: true,
  ): Promise<TenderData<true> | null>;
  async getById(
    tenderId: string,
    includeCreator: boolean = false,
  ): Promise<TenderData<boolean> | null> {
    const tender = await this.prisma.tender.findFirst({
      where: { id: tenderId },
    });

    if (!tender) return null;

    // needed for fancy typings to work
    if (includeCreator) return mapPrismaToTenderData(tender, true);
    return mapPrismaToTenderData(tender);
  }

  async getVersionById(
    tenderId: string,
    version: number,
  ): Promise<TenderData | null> {
    const tender = await this.prisma.tender.findFirst({
      where: { originalId: tenderId, version: version },
    });

    if (!tender) return null;

    return { ...mapPrismaToTenderData(tender), id: tender.originalId };
  }

  async updateStatus(
    tenderId: string,
    status: tenderStatus,
  ): Promise<TenderData | null> {
    const result = await this.prisma.tender.update({
      where: { id: tenderId },
      data: {
        status: status,
      },
    });

    return mapPrismaToTenderData(result);
  }

  async edit(tenderId: string, data: TenderEditData) {
    const tender = await this.prisma.$transaction(async () => {
      const tender = await this.prisma.tender.findFirst({
        where: { id: tenderId },
      });

      if (!tender) return null;

      await this.prisma.tender.create({
        data: { ...tender, originalId: tender.id, id: void 0 },
      });

      return await this.prisma.tender.update({
        where: { id: tender.id },
        data: {
          ...tender,
          name: data.name,
          description: data.description,
          serviceType: data.serviceType,
          version: tender.version + 1,
        },
      });
    });

    return mapPrismaToTenderData(tender);
  }

  async rollback(
    tenderId: string,
    version: number,
  ): Promise<TenderData | null> {
    const tender = await this.getVersionById(tenderId, version);
    if (!tender) return null;

    return await this.edit(tenderId, tender);
  }
}
