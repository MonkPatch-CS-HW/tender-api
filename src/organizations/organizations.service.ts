import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export type OrganizationData = {
  id: string;
};

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async getById(id: string): Promise<OrganizationData | null> {
    const organization = await this.prisma.organization.findFirst({
      where: { id: id },
    });

    if (organization === null) return null;

    return { id: organization.id };
  }
}
