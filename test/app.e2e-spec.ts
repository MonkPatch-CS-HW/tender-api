import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/misc/AllExceptionsFilter';
import { HttpAdapterHost } from '@nestjs/core';
import {
  organizationType,
  PrismaClient,
  tenderServiceType,
  tenderStatus,
} from '@prisma/client';
import { PrismaService } from '../src/prisma.service';
import { TenderData } from 'src/tenders/tenders.service';

interface TestConfig {
  avitoEmpId: string;
  yandexEmpId: string;

  avitoOrgId: string;
  yandexOrgId: string;

  avitoEmpUser: string;
  yandexEmpUser: string;
}

async function initTenders(prisma: PrismaClient, config: TestConfig) {
  await prisma.tender.deleteMany();

  await prisma.tender.createMany({
    data: [
      {
        name: 'Avito Tender',
        creatorId: config.avitoEmpId,
        organizationId: config.avitoOrgId,
        serviceType: tenderServiceType.Delivery,
        status: tenderStatus.Published,
      },
      {
        name: 'Yandex Tender',
        creatorId: config.yandexEmpId,
        organizationId: config.yandexOrgId,
        serviceType: tenderServiceType.Manufacture,
      },
    ],
  });
}

async function initDB(prisma: PrismaClient): Promise<TestConfig> {
  await prisma.employee.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.organizationResponsible.deleteMany();

  const avitoEmpUser = 'avito_emp';
  const yandexEmpUser = 'yandex_emp';

  const [{ id: avitoEmpId }, { id: yandexEmpId }] =
    await prisma.employee.createManyAndReturn({
      data: [
        {
          username: avitoEmpUser,
          firstName: 'Avito',
          lastName: 'Employee',
        },
        {
          username: yandexEmpUser,
          firstName: 'Yandex',
          lastName: 'Employee',
        },
      ],
    });

  const [{ id: avitoOrgId }, { id: yandexOrgId }] =
    await prisma.organization.createManyAndReturn({
      data: [
        {
          name: 'Avito',
          type: organizationType.LLC,
        },
        {
          name: 'Avito',
          type: organizationType.LLC,
        },
      ],
    });

  await prisma.organizationResponsible.createMany({
    data: [
      {
        userId: avitoEmpId,
        organizationId: avitoOrgId,
      },
      {
        userId: yandexEmpId,
        organizationId: yandexOrgId,
      },
    ],
  });

  return {
    avitoEmpId,
    yandexEmpId,

    avitoOrgId,
    yandexOrgId,

    avitoEmpUser,
    yandexEmpUser,
  };
}

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let config: TestConfig;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    const httpAdapter = app.get(HttpAdapterHost);
    prisma = app.get(PrismaService);
    config = await initDB(prisma);

    app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
  });

  describe('/ping', () => {
    it('/ping', () => {
      return request(app.getHttpServer()).get('/ping').expect(200).expect('ok');
    });
  });

  describe('/tenders', () => {
    beforeEach(async () => {
      await initTenders(prisma, config);
    });

    it('/tenders/new - incorrect request', () => {
      return request(app.getHttpServer()).post('/tenders/new').expect(400);
    });

    it('/tenders/new - invalid user', () => {
      return request(app.getHttpServer())
        .post('/tenders/new')
        .send({
          name: 'string',
          description: 'string',
          serviceType: 'Construction',
          organizationId: config.avitoOrgId,
          creatorUsername: 'INVALID',
        })
        .expect(401);
    });

    it('/tenders/new - invalid organization', () => {
      return request(app.getHttpServer())
        .post('/tenders/new')
        .send({
          name: 'string',
          description: 'string',
          serviceType: 'Construction',
          organizationId: 'INVALID',
          creatorUsername: config.avitoOrgId,
        })
        .expect(401);
    });

    it('/tenders/new - insiffucient rights', () => {
      return request(app.getHttpServer())
        .post('/tenders/new')
        .send({
          name: 'string',
          description: 'string',
          serviceType: 'Construction',
          organizationId: config.avitoOrgId,
          creatorUsername: config.yandexEmpUser,
        })
        .expect(403);
    });

    it('/tenders/new - valid', () => {
      return request(app.getHttpServer())
        .post('/tenders/new')
        .send({
          name: 'string',
          description: 'string',
          serviceType: 'Construction',
          organizationId: config.avitoOrgId,
          creatorUsername: config.avitoEmpUser,
        })
        .expect(201);
    });

    it('/tenders - shows and only shows open', () => {
      return request(app.getHttpServer())
        .get('/tenders')
        .expect(200)
        .expect((response: Response & { body: TenderData[] }) => {
          return (
            response.body.length === 1 &&
            response.body[0].organizationId === config.avitoOrgId &&
            response.body[0].serviceType === tenderServiceType.Delivery
          );
        });
    });

    it('/tenders - filter by serviceType incorrect ', () => {
      return request(app.getHttpServer())
        .get(`/tenders?service_type=INVALID`)
        .expect(400);
    });

    it('/tenders - filter by serviceType includes matching', () => {
      return request(app.getHttpServer())
        .get(`/tenders?service_type=${tenderServiceType.Delivery}`)
        .expect(200)
        .expect((response: Response & { body: TenderData[] }) => {
          expect(response.body).toHaveLength(1);
          expect(response.body[0].organizationId).toBe(config.avitoOrgId);
          expect(response.body[0].serviceType).toBe(tenderServiceType.Delivery);
        });
    });

    it('/tenders - filter by serviceType does not include not matching', () => {
      return request(app.getHttpServer())
        .get(
          `/tenders?service_type=${tenderServiceType.Construction}&service_type=${tenderServiceType.Manufacture}`,
        )
        .expect(200)
        .expect((response: Response & { body: TenderData[] }) => {
          expect(response.body).toHaveLength(0);
        });
    });

    it('/tenders - limit works', () => {
      return request(app.getHttpServer())
        .get('/tenders?limit=0')
        .expect(200)
        .expect((response: Response & { body: TenderData[] }) => {
          expect(response.body).toHaveLength(0);
        });
    });

    it('/tenders - offset works', () => {
      return request(app.getHttpServer())
        .get('/tenders?offset=1')
        .expect(200)
        .expect((response: Response & { body: TenderData[] }) => {
          expect(response.body).toHaveLength(0);
        });
    });

    it('/tenders/my - invalid username', () => {
      return request(app.getHttpServer())
        .get('/tenders/my?username=INVALID')
        .expect(401);
    });

    it('/tenders/my - shows open', () => {
      return request(app.getHttpServer())
        .get(`/tenders/my?username=${config.avitoEmpUser}`)
        .expect(200)
        .expect((response: Response & { body: TenderData[] }) => {
          expect(response.body).toHaveLength(1);
          expect(response.body[0].organizationId).toBe(config.avitoOrgId);
        });
    });

    it('/tenders/my - shows closed', () => {
      return request(app.getHttpServer())
        .get(`/tenders/my?username=${config.yandexEmpUser}`)
        .expect(200)
        .expect((response: Response & { body: TenderData[] }) => {
          expect(response.body).toHaveLength(1);
          expect(response.body[0].organizationId).toBe(config.yandexOrgId);
        });
    });
  });
});
