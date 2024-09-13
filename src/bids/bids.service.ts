import { Injectable, NotFoundException } from '@nestjs/common';
import { bid, bidAuthorType, bidStatus } from '@prisma/client';
import { EmployeesService } from 'src/employees/employees.service';
import { OrganizationsService } from 'src/organizations/organizations.service';
import { PrismaService } from 'src/prisma.service';
import { TendersService } from 'src/tenders/tenders.service';

export type BidEditData = {
  name: string;
  description: string;
};

export type BidCreateData = BidEditData & {
  tenderId: string;
  authorType: bidAuthorType;
  authorId: string;
  creatorId: string;
};

export type BidData<IC extends boolean = false> = BidEditData & {
  tenderId: string;
  authorType: bidAuthorType;
  authorId: string;
  id: string;
  version: number;
  createdAt: string;
  status: bidStatus;
} & (IC extends true ? { creatorId: string } : {});

function mapPrismaToBidData(bid: bid, includeCreator?: false): BidData<false>;
function mapPrismaToBidData(bid: bid, includeCreator: true): BidData<true>;
function mapPrismaToBidData(
  bid: bid,
  includeCreator: boolean = false,
): BidData<boolean> {
  return {
    id: bid.id,
    name: bid.name,
    description: bid.description,
    version: bid.version,
    authorId: bid.authorId,
    tenderId: bid.tenderId,
    authorType: bid.authorType,
    createdAt: bid.createdAt.toISOString(),
    status: bid.status,
    ...(includeCreator ? { creatorId: bid.creatorId } : {}),
  };
}

@Injectable()
export class BidsService {
  constructor(
    private prisma: PrismaService,
    private organizationsService: OrganizationsService,
    private employeesService: EmployeesService,
    private tendersService: TendersService,
  ) {}

  async create(data: BidCreateData): Promise<BidData<true>> {
    const bid = await this.prisma.bid.create({
      data: {
        name: data.name,
        description: data.description,
        authorType: data.authorType,
        tenderId: data.tenderId,
        authorId: data.authorId,
        creatorId: data.creatorId,
      },
    });

    return mapPrismaToBidData(bid, true);
  }

  async getByCreator(
    creatorId: string,
    limit: number,
    offset: number,
  ): Promise<BidData[]> {
    const bids = await this.prisma.bid.findMany({
      where: { creatorId, originalId: null },
      skip: offset,
      take: limit,
    });

    return bids.map<BidData>((p) => mapPrismaToBidData(p));
  }

  async getByTender(
    tenderId: string,
    limit: number,
    offset: number,
  ): Promise<BidData[]> {
    const bids = await this.prisma.bid.findMany({
      where: { tenderId, originalId: null },
      skip: offset,
      take: limit,
    });

    return bids.map<BidData>((p) => mapPrismaToBidData(p));
  }
}
