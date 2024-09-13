import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

export type EmployeeData<FO extends boolean = false> = {
  id: string;
  username: string;
} & (FO extends true ? { organizationIds: string[] } : {});

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async getById(
    id: string,
    fetchOrganizationResponsible?: false,
  ): Promise<EmployeeData<false> | null>;
  async getById(
    id: string,
    fetchOrganizationResponsible: true,
  ): Promise<EmployeeData<true> | null>;
  async getById(
    id: string,
    fetchOrganizationResponsible: boolean = false,
  ): Promise<EmployeeData<boolean> | null> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: id },
      select: {
        id: true,
        username: true,
        organizationResponsible: fetchOrganizationResponsible,
      },
    });

    const orgs = employee.organizationResponsible ?? [];

    return {
      id: employee.id,
      username: employee.username,
      organizationIds: orgs.map((r) => r.organizationId),
    };
  }

  async getByUsername(
    username: string,
    fetchOrganizationResponsible?: false,
  ): Promise<EmployeeData<false> | null>;
  async getByUsername(
    username: string,
    fetchOrganizationResponsible: true,
  ): Promise<EmployeeData<true> | null>;
  async getByUsername(
    username: string,
    fetchOrganizationResponsible: boolean = false,
  ): Promise<EmployeeData<boolean> | null> {
    const employee = await this.prisma.employee.findFirst({
      where: { username: username },
      select: {
        id: true,
        username: true,
        organizationResponsible: fetchOrganizationResponsible,
      },
    });

    const orgs = employee.organizationResponsible ?? [];

    return {
      id: employee.id,
      username: employee.username,
      organizationIds: orgs.map((r) => r.organizationId),
    };
  }
}
