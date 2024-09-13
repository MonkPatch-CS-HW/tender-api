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
};

export type BidData = BidCreateData & {
  id: string;
  version: number;
  createdAt: string;
  status: bidStatus;
};

function mapPrismaToBidData(bid: bid): BidData {
  return {
    id: bid.id,
    name: bid.name,
    description: bid.description,
    version: bid.version,
    authorId: bid.authorId,
    tenderId: bid.tenderId,
    authorType: bid.authorType,
    createdAt: bid.createdAt.toUTCString(),
    status: bid.status,
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
  async create(data: BidCreateData) {
    if (
      data.authorType === 'Organization' &&
      !(await this.organizationsService.getById(data.authorId))
    )
      throw new NotFoundException('Could not find organization');

    if (
      data.authorType === 'User' &&
      !(await this.employeesService.getById(data.authorId))
    )
      throw new NotFoundException('Could not find employee');

    const bid = await this.prisma.bid.create({
      data: {
        name: data.name,
        description: data.description,
        authorType: data.authorType,
        tenderId: data.tenderId,
        authorId: data.authorId,
      },
    });

    return mapPrismaToBidData(bid);
  }
}
