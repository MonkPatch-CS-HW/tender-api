import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/misc/AllExceptionsFilter';
import { HttpAdapterHost } from '@nestjs/core';
import {
  bidAuthorType,
  bidStatus,
  organizationType,
  tenderServiceType,
  tenderStatus,
} from '@prisma/client';
import { PrismaService } from '../src/prisma.service';
import { TenderData } from '../src/tenders/tenders.service';
import { BidData, FeedbackData } from '../src/bids/bids.service';
import { bidDecision } from '../src/bids/bids.controller';

interface TestConfig {
  avitoEmpId: string;
  yandexEmpId: string;

  avitoOrgId: string;
  yandexOrgId: string;

  avitoEmpUser: string;
  yandexEmpUser: string;
}

interface TenderConfig {
  avitoTenderId: string;
  avitoTenderIdV1: string;

  yandexTenderId: string;
}

interface BidConfig {
  avitoBidId: string;
  yandexBidId: string;

  yandexBidIdV1: string;
}

async function initTenders(prisma: PrismaService, config: TestConfig) {
  await prisma.tender.deleteMany();

  const [{ id: avitoTenderId }, { id: yandexTenderId }] =
    await prisma.tender.createManyAndReturn({
      data: [
        {
          name: 'Avito Tender',
          description: 'v2',
          creatorId: config.avitoEmpId,
          organizationId: config.avitoOrgId,
          serviceType: tenderServiceType.Delivery,
          status: tenderStatus.Published,
          version: 2,
        },
        {
          name: 'Yandex Tender',
          creatorId: config.yandexEmpId,
          organizationId: config.yandexOrgId,
          serviceType: tenderServiceType.Manufacture,
        },
      ],
    });

  const { id: avitoTenderIdV1 } = await prisma.tender.create({
    data: {
      name: 'Avito Tender',
      description: 'v1',
      creatorId: config.avitoEmpId,
      organizationId: config.avitoOrgId,
      serviceType: tenderServiceType.Delivery,
      status: tenderStatus.Published,
      version: 1,
      originalId: avitoTenderId,
    },
  });

  return { avitoTenderId, yandexTenderId, avitoTenderIdV1 };
}

async function initBids(
  prisma: PrismaService,
  config: TestConfig,
  tenderConfig: TenderConfig,
): Promise<BidConfig> {
  const [{ id: avitoBidId }, { id: yandexBidId }] =
    await prisma.bid.createManyAndReturn({
      data: [
        {
          tenderId: tenderConfig.avitoTenderId,
          name: 'Yandex Bid for Avito Tender',
          description: 'v2',
          version: 2,
          authorType: bidAuthorType.Organization,
          authorId: config.yandexOrgId,
          creatorId: config.yandexEmpId,
          status: bidStatus.Published,
        },
        {
          tenderId: tenderConfig.yandexTenderId,
          name: 'Avito Bid for Yandex Tender',
          authorType: bidAuthorType.User,
          authorId: config.avitoEmpId,
          creatorId: config.avitoEmpId,
        },
      ],
    });

  const { id: yandexBidIdV1 } = await prisma.bid.create({
    data: {
      tenderId: tenderConfig.avitoTenderId,
      name: 'Yandex Bid for Avito Tender',
      description: 'v1',
      version: 1,
      authorType: bidAuthorType.Organization,
      authorId: config.yandexOrgId,
      creatorId: config.yandexEmpId,
      status: bidStatus.Published,
      originalId: avitoBidId,
    },
  });

  return { avitoBidId, yandexBidId, yandexBidIdV1 };
}

async function initDB(prisma: PrismaService): Promise<TestConfig> {
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
    let tenderConfig: TenderConfig;

    beforeEach(async () => {
      tenderConfig = await initTenders(prisma, config);
    });

    describe('/new', () => {
      it('incorrect request', () => {
        return request(app.getHttpServer()).post('/tenders/new').expect(400);
      });

      it('invalid user', () => {
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

      it('invalid organization', () => {
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

      it('insufficient rights', () => {
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

      it('actually creates', async () => {
        const response = await request(app.getHttpServer())
          .post('/tenders/new')
          .send({
            name: 'string',
            description: 'string',
            serviceType: 'Construction',
            organizationId: config.avitoOrgId,
            creatorUsername: config.avitoEmpUser,
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        const id = response.body.id;
        const tender = await prisma.tender.findFirst({ where: { id } });
        expect(tender).not.toBeNull();
      });
    });

    describe('/', () => {
      it('invalid query', () => {
        return request(app.getHttpServer())
          .get('/tenders?usernama=INVALID&limit=-1')
          .expect(400);
      });

      it('shows and only shows published', () => {
        return request(app.getHttpServer())
          .get('/tenders')
          .expect(200)
          .expect((response: Response & { body: TenderData[] }) => {
            expect(response.body).toHaveLength(1);
            expect(response.body[0].organizationId).toBe(config.avitoOrgId);
            expect(response.body[0].serviceType).toBe(
              tenderServiceType.Delivery,
            );
          });
      });

      it('filter by serviceType incorrect ', () => {
        return request(app.getHttpServer())
          .get(`/tenders?service_type=INVALID`)
          .expect(400);
      });

      it('filter by serviceType includes matching', () => {
        return request(app.getHttpServer())
          .get(`/tenders?service_type=${tenderServiceType.Delivery}`)
          .expect(200)
          .expect((response: Response & { body: TenderData[] }) => {
            expect(response.body).toHaveLength(1);
            expect(response.body[0].organizationId).toBe(config.avitoOrgId);
            expect(response.body[0].serviceType).toBe(
              tenderServiceType.Delivery,
            );
          });
      });

      it('filter by serviceType does not include not matching', () => {
        return request(app.getHttpServer())
          .get(
            `/tenders?service_type=${tenderServiceType.Construction}&service_type=${tenderServiceType.Manufacture}`,
          )
          .expect(200)
          .expect((response: Response & { body: TenderData[] }) => {
            expect(response.body).toHaveLength(0);
          });
      });

      it('limit works', () => {
        return request(app.getHttpServer())
          .get('/tenders?limit=0')
          .expect(200)
          .expect((response: Response & { body: TenderData[] }) => {
            expect(response.body).toHaveLength(0);
          });
      });

      it('offset works', () => {
        return request(app.getHttpServer())
          .get('/tenders?offset=1')
          .expect(200)
          .expect((response: Response & { body: TenderData[] }) => {
            expect(response.body).toHaveLength(0);
          });
      });
    });

    describe('/my', () => {
      it('invalid username', () => {
        return request(app.getHttpServer())
          .get('/tenders/my?username=INVALID')
          .expect(401);
      });

      it('invalid query', () => {
        return request(app.getHttpServer())
          .get('/tenders/my?usernama=INVALID&limit=-1')
          .expect(400);
      });

      it('shows published', () => {
        return request(app.getHttpServer())
          .get(`/tenders/my?username=${config.avitoEmpUser}`)
          .expect(200)
          .expect((response: Response & { body: TenderData[] }) => {
            expect(response.body).toHaveLength(1);
            expect(response.body[0].organizationId).toBe(config.avitoOrgId);
          });
      });

      it('shows closed', () => {
        return request(app.getHttpServer())
          .get(`/tenders/my?username=${config.yandexEmpUser}`)
          .expect(200)
          .expect((response: Response & { body: TenderData[] }) => {
            expect(response.body).toHaveLength(1);
            expect(response.body[0].organizationId).toBe(config.yandexOrgId);
          });
      });

      it('limit works', () => {
        return request(app.getHttpServer())
          .get(`/tenders/my?username=${config.yandexEmpUser}&limit=0`)
          .expect(200)
          .expect((response: Response & { body: TenderData[] }) => {
            expect(response.body).toHaveLength(0);
          });
      });

      it('offset works', () => {
        return request(app.getHttpServer())
          .get(`/tenders/my?username=${config.yandexEmpUser}&offset=1`)
          .expect(200)
          .expect((response: Response & { body: TenderData[] }) => {
            expect(response.body).toHaveLength(0);
          });
      });

      it('offset works', () => {
        return request(app.getHttpServer())
          .get(`/tenders/my?username=${config.yandexEmpUser}&offset=1`)
          .expect(200)
          .expect((response: Response & { body: TenderData[] }) => {
            expect(response.body).toHaveLength(0);
          });
      });
    });

    describe('/:tenderId/status', () => {
      it('invalid request', () => {
        return request(app.getHttpServer())
          .get(`/tenders/INVALID/status?username=${config.avitoEmpUser}`)
          .expect(400);
      });

      it('invalid tender', () => {
        return request(app.getHttpServer())
          .get(
            `/tenders/${config.yandexEmpId}/status?username=${config.avitoEmpUser}`,
          )
          .expect(404);
      });

      it('invalid user', () => {
        return request(app.getHttpServer())
          .get(`/tenders/${tenderConfig.avitoTenderId}/status?username=INVALID`)
          .expect(401);
      });

      it('insufficient rights', () => {
        return request(app.getHttpServer())
          .get(
            `/tenders/${tenderConfig.avitoTenderId}/status?username=${config.yandexEmpUser}`,
          )
          .expect(403);
      });

      it('correct get published', () => {
        return request(app.getHttpServer())
          .get(
            `/tenders/${tenderConfig.avitoTenderId}/status?username=${config.avitoEmpUser}`,
          )
          .expect(200)
          .expect(tenderStatus.Published);
      });

      it('correct get created', () => {
        return request(app.getHttpServer())
          .get(
            `/tenders/${tenderConfig.yandexTenderId}/status?username=${config.yandexEmpUser}`,
          )
          .expect(200)
          .expect(tenderStatus.Created);
      });

      it('invalid put request', () => {
        return request(app.getHttpServer())
          .put(`/tenders/${tenderConfig.yandexTenderId}/status`)
          .send({})
          .expect(400);
      });

      it('valid put', async () => {
        const response = await request(app.getHttpServer())
          .put(`/tenders/${tenderConfig.yandexTenderId}/status`)
          .send({
            username: config.yandexEmpUser,
            status: tenderStatus.Canceled,
          })
          .expect(200);

        expect(response.body).not.toBeNull();
        expect(response.body.status).toBe(tenderStatus.Canceled);

        const tender = await prisma.tender.findFirst({
          where: { id: tenderConfig.yandexTenderId },
        });
        expect(tender).not.toBeNull();
        expect(tender.status).toBe(tenderStatus.Canceled);
      });
    });

    describe('/:tenderId/edit', () => {
      it('invalid request', () => {
        return request(app.getHttpServer())
          .patch(`/tenders/INVALID/edit?username=${config.avitoEmpUser}`)
          .send({})
          .expect(400);
      });

      it('invalid tender', () => {
        return request(app.getHttpServer())
          .patch(
            `/tenders/${config.yandexEmpId}/edit?username=${config.avitoEmpUser}`,
          )
          .send({
            name: 'Avito Tender',
            description: 'v3',
            serviceType: tenderServiceType.Delivery,
          })
          .expect(404);
      });

      it('invalid user', () => {
        return request(app.getHttpServer())
          .patch(`/tenders/${tenderConfig.avitoTenderId}/edit?username=INVALID`)
          .send({
            name: 'Avito Tender',
            description: 'v3',
            serviceType: tenderServiceType.Delivery,
          })
          .expect(401);
      });

      it('insufficient rights', () => {
        return request(app.getHttpServer())
          .patch(
            `/tenders/${tenderConfig.avitoTenderId}/edit?username=${config.yandexEmpUser}`,
          )
          .send({
            name: 'Avito Tender',
            description: 'v3',
            serviceType: tenderServiceType.Delivery,
          })
          .expect(403);
      });

      it('edits correctly', async () => {
        const response = await request(app.getHttpServer())
          .patch(
            `/tenders/${tenderConfig.avitoTenderId}/edit?username=${config.avitoEmpUser}`,
          )
          .send({
            name: 'Avito Tender',
            description: 'v3',
            serviceType: tenderServiceType.Delivery,
          })
          .expect(200);

        expect(response.body.version).toBe(3);
        expect(response.body.description).toBe('v3');

        const previousVersionsCount = await prisma.tender.count({
          where: { originalId: tenderConfig.avitoTenderId },
        });
        expect(previousVersionsCount).toBe(2);

        const currentTender = await prisma.tender.findFirst({
          where: {
            id: tenderConfig.avitoTenderId,
          },
        });

        expect(currentTender).not.toBeNull();
        expect(currentTender.description).toBe('v3');

        const savedTender = await prisma.tender.findFirst({
          where: {
            originalId: tenderConfig.avitoTenderId,
            version: 2,
          },
        });

        expect(savedTender).not.toBeNull();
        expect(savedTender.description).toBe('v2');
      });
    });

    describe('/:tenderId/rollback', () => {
      it('invalid request', () => {
        return request(app.getHttpServer())
          .put(`/tenders/INVALID/rollback/1?username=${config.avitoEmpUser}`)
          .expect(400);
      });

      it('invalid tender', () => {
        return request(app.getHttpServer())
          .put(
            `/tenders/${config.yandexEmpId}/rollback/1?username=${config.avitoEmpUser}`,
          )
          .expect(404);
      });

      it('invalid user', () => {
        return request(app.getHttpServer())
          .put(
            `/tenders/${tenderConfig.avitoTenderId}/rollback/1?username=INVALID`,
          )
          .expect(401);
      });

      it('insufficient rights', () => {
        return request(app.getHttpServer())
          .put(
            `/tenders/${tenderConfig.avitoTenderId}/rollback/1?username=${config.yandexEmpUser}`,
          )
          .expect(403);
      });

      it('rollbacks correctly', async () => {
        const response = await request(app.getHttpServer())
          .put(
            `/tenders/${tenderConfig.avitoTenderId}/rollback/1?username=${config.avitoEmpUser}`,
          )
          .expect(200);

        expect(response.body.version).toBe(3);
        expect(response.body.description).toBe('v1');

        const previousVersionsCount = await prisma.tender.count({
          where: { originalId: tenderConfig.avitoTenderId },
        });
        expect(previousVersionsCount).toBe(2);

        const currentTender = await prisma.tender.findFirst({
          where: {
            id: tenderConfig.avitoTenderId,
          },
        });

        expect(currentTender).not.toBeNull();
        expect(currentTender.description).toBe('v1');

        const savedTender = await prisma.tender.findFirst({
          where: {
            originalId: tenderConfig.avitoTenderId,
            version: 2,
          },
        });

        expect(savedTender).not.toBeNull();
        expect(savedTender.description).toBe('v2');
      });
    });
  });

  /*
   *
   *
   *
   *
   * BIDS
   *
   *
   *
   *
   */

  describe('/bids', () => {
    let bidConfig: BidConfig;
    let tenderConfig: TenderConfig;

    beforeEach(async () => {
      tenderConfig = await initTenders(prisma, config);
      bidConfig = await initBids(prisma, config, tenderConfig);
    });

    describe('/new', () => {
      it('incorrect request', () => {
        return request(app.getHttpServer()).post('/bids/new').expect(400);
      });

      it('not existing user author', () => {
        return request(app.getHttpServer())
          .post('/bids/new')
          .send({
            name: 'name',
            description: 'description',
            tenderId: tenderConfig.avitoTenderId,
            authorType: bidAuthorType.User,
            authorId: tenderConfig.avitoTenderId,
            creatorUsername: config.avitoEmpUser,
          })
          .expect(401);
      });

      it('not existing org author', () => {
        return request(app.getHttpServer())
          .post('/bids/new')
          .send({
            name: 'name',
            description: 'description',
            tenderId: tenderConfig.avitoTenderId,
            authorType: bidAuthorType.Organization,
            authorId: tenderConfig.avitoTenderId,
            creatorUsername: config.avitoEmpUser,
          })
          .expect(401);
      });

      it('invalid user author', () => {
        return request(app.getHttpServer())
          .post('/bids/new')
          .send({
            name: 'name',
            description: 'description',
            tenderId: tenderConfig.avitoTenderId,
            authorType: bidAuthorType.User,
            authorId: config.yandexOrgId,
            creatorUsername: config.avitoEmpUser,
          })
          .expect(401);
      });

      it('invalid org author', () => {
        return request(app.getHttpServer())
          .post('/bids/new')
          .send({
            name: 'name',
            description: 'description',
            tenderId: tenderConfig.avitoTenderId,
            authorType: bidAuthorType.Organization,
            authorId: config.yandexEmpId,
            creatorUsername: config.avitoEmpUser,
          })
          .expect(401);
      });

      it('insufficient user author', () => {
        return request(app.getHttpServer())
          .post('/bids/new')
          .send({
            name: 'name',
            description: 'description',
            tenderId: tenderConfig.avitoTenderId,
            authorType: bidAuthorType.User,
            authorId: config.yandexEmpId,
            creatorUsername: config.avitoEmpUser,
          })
          .expect(403);
      });

      it('insufficient org author', () => {
        return request(app.getHttpServer())
          .post('/bids/new')
          .send({
            name: 'name',
            description: 'description',
            tenderId: tenderConfig.avitoTenderId,
            authorType: bidAuthorType.Organization,
            authorId: config.yandexOrgId,
            creatorUsername: config.avitoEmpUser,
          })
          .expect(403);
      });

      it('invalid creator', () => {
        return request(app.getHttpServer())
          .post('/bids/new')
          .send({
            name: 'name',
            description: 'description',
            tenderId: tenderConfig.avitoTenderId,
            authorType: bidAuthorType.Organization,
            authorId: config.avitoOrgId,
            creatorUsername: 'INVALID',
          })
          .expect(401);
      });

      it('creator not responsible for organization', () => {
        return request(app.getHttpServer())
          .post('/bids/new')
          .send({
            name: 'name',
            description: 'description',
            tenderId: tenderConfig.avitoTenderId,
            authorType: bidAuthorType.Organization,
            authorId: config.avitoOrgId,
            creatorUsername: config.yandexEmpUser,
          })
          .expect(403);
      });
    });

    describe('/my', () => {
      it('invalid username', () => {
        return request(app.getHttpServer())
          .get('/bids/my?username=INVALID')
          .expect(401);
      });

      it('invalid query', () => {
        return request(app.getHttpServer())
          .get('/bids/my?usernama=INVALID&limit=-1')
          .expect(400);
      });

      it('shows bids', () => {
        return request(app.getHttpServer())
          .get(`/bids/my?username=${config.yandexEmpUser}`)
          .expect(200)
          .expect((response: Response & { body: BidData[] }) => {
            expect(response.body).toHaveLength(1);
          });
      });

      it('only shows real bids (not "saved")', () => {
        return request(app.getHttpServer())
          .get(`/bids/my?username=${config.avitoEmpUser}`)
          .expect(200)
          .expect((response: Response & { body: BidData[] }) => {
            expect(response.body).toHaveLength(1);
          });
      });

      it('limit works', () => {
        return request(app.getHttpServer())
          .get(`/bids/my?username=${config.yandexEmpUser}&limit=0`)
          .expect(200)
          .expect((response: Response & { body: BidData[] }) => {
            expect(response.body).toHaveLength(0);
          });
      });

      it('offset works', () => {
        return request(app.getHttpServer())
          .get(`/bids/my?username=${config.yandexEmpUser}&offset=1`)
          .expect(200)
          .expect((response: Response & { body: BidData[] }) => {
            expect(response.body).toHaveLength(0);
          });
      });
    });

    describe('/:tenderId/list', () => {
      it('invalid username', () => {
        return request(app.getHttpServer())
          .get(`/bids/${tenderConfig.avitoTenderId}/list?username=INVALID`)
          .expect(401);
      });

      it('invalid query', () => {
        return request(app.getHttpServer())
          .get(
            `/bids/${tenderConfig.avitoTenderId}/list?usernama=INVALID&offset=-1`,
          )
          .expect(400);
      });

      it('user not responsible', () => {
        return request(app.getHttpServer())
          .get(
            `/bids/${tenderConfig.avitoTenderId}/list?username=${config.yandexEmpUser}`,
          )
          .expect(403);
      });

      it('shows published bids', () => {
        return request(app.getHttpServer())
          .get(
            `/bids/${tenderConfig.avitoTenderId}/list?username=${config.avitoEmpUser}`,
          )
          .expect(200)
          .expect((response: Response & { body: BidData[] }) => {
            expect(response.body).toHaveLength(1);
          });
      });

      it('does not show unpublished bids', () => {
        return request(app.getHttpServer())
          .get(
            `/bids/${tenderConfig.yandexTenderId}/list?username=${config.yandexEmpUser}`,
          )
          .expect(200)
          .expect((response: Response & { body: BidData[] }) => {
            expect(response.body).toHaveLength(0);
          });
      });

      it('limit works', () => {
        return request(app.getHttpServer())
          .get(
            `/bids/${tenderConfig.avitoTenderId}/list?username=${config.avitoEmpUser}&limit=0`,
          )
          .expect(200)
          .expect((response: Response & { body: BidData[] }) => {
            expect(response.body).toHaveLength(0);
          });
      });

      it('offset works', () => {
        return request(app.getHttpServer())
          .get(
            `/bids/${tenderConfig.avitoTenderId}/list?username=${config.avitoEmpUser}&offset=1`,
          )
          .expect(200)
          .expect((response: Response & { body: BidData[] }) => {
            expect(response.body).toHaveLength(0);
          });
      });
    });

    describe('/:bidId/status', () => {
      it('invalid request', () => {
        return request(app.getHttpServer())
          .get(`/bids/INVALID/status?usernama=${config.avitoEmpUser}`)
          .expect(400);
      });

      it('invalid bid', () => {
        return request(app.getHttpServer())
          .get(
            `/bids/${config.yandexEmpId}/status?username=${config.avitoEmpUser}`,
          )
          .expect(404);
      });

      it('invalid user', () => {
        return request(app.getHttpServer())
          .get(`/bids/${bidConfig.avitoBidId}/status?username=INVALID`)
          .expect(401);
      });

      it('insufficient rights for author organization', () => {
        return request(app.getHttpServer())
          .get(
            `/bids/${bidConfig.avitoBidId}/status?username=${config.avitoEmpUser}`,
          )
          .expect(403);
      });

      it('insufficient rights for author organization', () => {
        return request(app.getHttpServer())
          .get(
            `/bids/${bidConfig.yandexBidId}/status?username=${config.yandexEmpUser}`,
          )
          .expect(403);
      });

      it('correct get published', () => {
        return request(app.getHttpServer())
          .get(
            `/bids/${bidConfig.avitoBidId}/status?username=${config.yandexEmpUser}`,
          )
          .expect(200)
          .expect(bidStatus.Published);
      });

      it('correct get created', () => {
        return request(app.getHttpServer())
          .get(
            `/bids/${bidConfig.yandexBidId}/status?username=${config.avitoEmpUser}`,
          )
          .expect(200)
          .expect(bidStatus.Created);
      });

      it('invalid put request', () => {
        return request(app.getHttpServer())
          .put(`/bids/${bidConfig.yandexBidId}/status`)
          .send({})
          .expect(400);
      });

      it('invalid put user', () => {
        return request(app.getHttpServer())
          .put(`/bids/${bidConfig.avitoBidId}/status`)
          .send({
            username: 'INVALID',
            status: bidStatus.Canceled,
          })
          .expect(401);
      });

      it('incorrect put bid', () => {
        return request(app.getHttpServer())
          .put(`/bids/${config.yandexEmpId}/status`)
          .send({
            username: config.yandexEmpUser,
            status: bidStatus.Canceled,
          })
          .expect(404);
      });

      it('insufficient put rights', () => {
        return request(app.getHttpServer())
          .put(`/bids/${bidConfig.avitoBidId}/status`)
          .send({
            username: config.avitoEmpUser,
            status: bidStatus.Canceled,
          })
          .expect(403);
      });

      it('insufficient put rights', () => {
        return request(app.getHttpServer())
          .put(`/bids/${bidConfig.yandexBidId}/status`)
          .send({
            username: config.yandexEmpUser,
            status: bidStatus.Canceled,
          })
          .expect(403);
      });

      it('valid put', async () => {
        const response = await request(app.getHttpServer())
          .put(`/bids/${bidConfig.yandexBidId}/status`)
          .send({
            username: config.avitoEmpUser,
            status: bidStatus.Canceled,
          })
          .expect(200);

        expect(response.body).not.toBeNull();
        expect(response.body.status).toBe(bidStatus.Canceled);

        const bid = await prisma.bid.findFirst({
          where: { id: bidConfig.yandexBidId },
        });
        expect(bid).not.toBeNull();
        expect(bid.status).toBe(bidStatus.Canceled);
      });
    });

    describe('/:bidId/edit', () => {
      it('invalid request', () => {
        return request(app.getHttpServer())
          .patch(`/bids/INVALID/edit?username=${config.avitoEmpUser}`)
          .send({})
          .expect(400);
      });

      it('invalid bid', () => {
        return request(app.getHttpServer())
          .patch(
            `/bids/${config.yandexEmpId}/edit?username=${config.avitoEmpUser}`,
          )
          .send({
            name: 'Avito Bid',
            description: 'v3',
          })
          .expect(404);
      });

      it('invalid user', () => {
        return request(app.getHttpServer())
          .patch(`/bids/${bidConfig.avitoBidId}/edit?username=INVALID`)
          .send({
            name: 'Avito Bid',
            description: 'v3',
          })
          .expect(401);
      });

      it('insufficient rights author organization', () => {
        return request(app.getHttpServer())
          .patch(
            `/bids/${bidConfig.avitoBidId}/edit?username=${config.avitoEmpUser}`,
          )
          .send({
            name: 'Avito Bid',
            description: 'v3',
          })
          .expect(403);
      });

      it('insufficient rights author user', () => {
        return request(app.getHttpServer())
          .patch(
            `/bids/${bidConfig.yandexBidId}/edit?username=${config.yandexEmpUser}`,
          )
          .send({
            name: 'Avito Bid',
            description: 'v3',
          })
          .expect(403);
      });

      it('edits correctly', async () => {
        const response = await request(app.getHttpServer())
          .patch(
            `/bids/${bidConfig.avitoBidId}/edit?username=${config.yandexEmpUser}`,
          )
          .send({
            name: 'Yandex Bid for Avito Tender',
            description: 'v3',
          })
          .expect(200);

        expect(response.body.version).toBe(3);
        expect(response.body.description).toBe('v3');

        const previousVersionsCount = await prisma.bid.count({
          where: { originalId: bidConfig.avitoBidId },
        });
        expect(previousVersionsCount).toBe(2);

        const currentBid = await prisma.bid.findFirst({
          where: {
            id: bidConfig.avitoBidId,
          },
        });

        expect(currentBid).not.toBeNull();
        expect(currentBid.description).toBe('v3');

        const savedBid = await prisma.bid.findFirst({
          where: {
            originalId: bidConfig.avitoBidId,
            version: 2,
          },
        });

        expect(savedBid).not.toBeNull();
        expect(savedBid.description).toBe('v2');
      });
    });

    describe('/:bidId/rollback', () => {
      it('invalid request', () => {
        return request(app.getHttpServer())
          .put(`/bids/INVALID/rollback/1?username=${config.avitoEmpUser}`)
          .expect(400);
      });

      it('invalid bid', () => {
        return request(app.getHttpServer())
          .put(
            `/bids/${config.yandexEmpId}/rollback/1?username=${config.avitoEmpUser}`,
          )
          .expect(404);
      });

      it('invalid user', () => {
        return request(app.getHttpServer())
          .put(`/bids/${bidConfig.avitoBidId}/rollback/1?username=INVALID`)
          .expect(401);
      });

      it('insufficient rights author organization', () => {
        return request(app.getHttpServer())
          .put(
            `/bids/${bidConfig.avitoBidId}/rollback/1?username=${config.avitoEmpUser}`,
          )
          .expect(403);
      });

      it('insufficient rights author user', () => {
        return request(app.getHttpServer())
          .put(
            `/bids/${bidConfig.yandexBidId}/rollback/1?username=${config.yandexEmpUser}`,
          )
          .expect(403);
      });

      it('rollbacks correctly', async () => {
        const response = await request(app.getHttpServer())
          .put(
            `/bids/${bidConfig.avitoBidId}/rollback/1?username=${config.yandexEmpUser}`,
          )
          .expect(200);

        expect(response.body.version).toBe(3);
        expect(response.body.description).toBe('v1');

        const previousVersionsCount = await prisma.bid.count({
          where: { originalId: bidConfig.avitoBidId },
        });
        expect(previousVersionsCount).toBe(2);

        const currentBid = await prisma.bid.findFirst({
          where: {
            id: bidConfig.avitoBidId,
          },
        });

        expect(currentBid).not.toBeNull();
        expect(currentBid.description).toBe('v1');

        const savedBid = await prisma.bid.findFirst({
          where: {
            originalId: bidConfig.avitoBidId,
            version: 2,
          },
        });

        expect(savedBid).not.toBeNull();
        expect(savedBid.description).toBe('v2');
      });
    });

    describe('/:bidId/feedback', () => {
      it('invalid request', () => {
        return request(app.getHttpServer())
          .put(`/bids/INVALID/feedback`)
          .send({})
          .expect(400);
      });

      it('invalid bid', () => {
        return request(app.getHttpServer())
          .put(`/bids/${config.yandexEmpId}/feedback`)
          .send({
            username: config.avitoEmpUser,
            bidFeedback: 'lalala',
          })
          .expect(404);
      });

      it('invalid user', () => {
        return request(app.getHttpServer())
          .put(`/bids/${bidConfig.avitoBidId}/feedback`)
          .send({
            username: 'INVALID',
            bidFeedback: 'lalala',
          })
          .expect(401);
      });

      it('insufficient rights author organization', () => {
        return request(app.getHttpServer())
          .put(`/bids/${bidConfig.avitoBidId}/feedback`)
          .send({
            username: config.avitoEmpUser,
            bidFeedback: 'lalala',
          })
          .expect(403);
      });

      it('insufficient rights author user', () => {
        return request(app.getHttpServer())
          .put(`/bids/${bidConfig.yandexBidId}/feedback`)
          .send({
            username: config.yandexEmpUser,
            bidFeedback: 'lalala',
          })
          .expect(403);
      });

      it('success', async () => {
        await request(app.getHttpServer())
          .put(`/bids/${bidConfig.avitoBidId}/feedback`)
          .send({
            username: config.yandexEmpUser,
            bidFeedback: 'lalalalu',
          })
          .expect(200);

        const feedback = await prisma.feedback.findFirst({
          where: {
            bidId: bidConfig.avitoBidId,
          },
        });
        expect(feedback).not.toBeNull();
        expect(feedback.message).toBe('lalalalu');
      });
    });

    describe('/:tenderId/reviews', () => {
      beforeEach(async () => {
        await prisma.feedback.deleteMany();
        await prisma.feedback.create({
          data: {
            bidId: bidConfig.avitoBidId,
            message: 'lalalalu',
            creatorId: config.yandexEmpId,
          },
        });
      });

      it('invalid request', () => {
        return request(app.getHttpServer())
          .get(`/bids/INVALID/reviews`)
          .send({})
          .expect(400);
      });

      it('invalid bid', () => {
        return request(app.getHttpServer())
          .get(
            `/bids/${config.yandexEmpId}/reviews?requesterUsername=${config.avitoEmpUser}&authorUsername=${config.yandexEmpUser}`,
          )
          .expect(404);
      });

      it('invalid user', () => {
        return request(app.getHttpServer())
          .get(
            `/bids/${tenderConfig.avitoTenderId}/reviews?requesterUsername=INVALID&authorUsername=${config.yandexEmpUser}`,
          )
          .expect(401);
      });

      it('insufficient rights', () => {
        return request(app.getHttpServer())
          .get(
            `/bids/${tenderConfig.avitoTenderId}/reviews?requesterUsername=${config.yandexEmpUser}&authorUsername=${config.yandexEmpUser}`,
          )
          .expect(403);
      });

      it('success', async () => {
        return request(app.getHttpServer())
          .get(
            `/bids/${tenderConfig.avitoTenderId}/reviews?requesterUsername=${config.avitoEmpUser}&authorUsername=${config.yandexEmpUser}`,
          )
          .expect(200)
          .expect((response: Response & { body: FeedbackData[] }) => {
            expect(response.body).toHaveLength(1);
            expect(response.body[0].message).toBe('lalalalu');
          });
      });

      it('authorUsername filter works', async () => {
        return request(app.getHttpServer())
          .get(
            `/bids/${tenderConfig.avitoTenderId}/reviews?requesterUsername=${config.avitoEmpUser}&authorUsername=${config.avitoEmpUser}`,
          )
          .expect(200)
          .expect((response: Response & { body: FeedbackData[] }) => {
            expect(response.body).toHaveLength(0);
          });
      });

      it('limit works', async () => {
        return request(app.getHttpServer())
          .get(
            `/bids/${tenderConfig.avitoTenderId}/reviews?requesterUsername=${config.avitoEmpUser}&authorUsername=${config.yandexEmpUser}&limit=0`,
          )
          .expect(200)
          .expect((response: Response & { body: FeedbackData[] }) => {
            expect(response.body).toHaveLength(0);
          });
      });

      it('offset works', async () => {
        return request(app.getHttpServer())
          .get(
            `/bids/${tenderConfig.avitoTenderId}/reviews?requesterUsername=${config.avitoEmpUser}&authorUsername=${config.yandexEmpUser}&offset=1`,
          )
          .expect(200)
          .expect((response: Response & { body: FeedbackData[] }) => {
            expect(response.body).toHaveLength(0);
          });
      });
    });

    describe('/:bidId/submit_decision', () => {
      it('invalid request', () => {
        return request(app.getHttpServer())
          .put(`/bids/INVALID/submit_decision?usernama=${config.avitoEmpUser}`)
          .expect(400);
      });

      it('invalid bid', () => {
        return request(app.getHttpServer())
          .put(`/bids/${config.yandexEmpId}/submit_decision`)
          .send({
            username: config.avitoEmpUser,
            decision: bidDecision.Approved,
          })
          .expect(404);
      });

      it('invalid user', () => {
        return request(app.getHttpServer())
          .put(`/bids/${bidConfig.avitoBidId}/submit_decision`)
          .send({
            username: 'INVALID',
            decision: bidDecision.Approved,
          })
          .expect(401);
      });

      it('insufficient rights', () => {
        return request(app.getHttpServer())
          .put(`/bids/${bidConfig.yandexBidId}/submit_decision`)
          .send({
            username: config.avitoEmpUser,
            decision: bidDecision.Approved,
          })
          .expect(403);
      });

      it('insufficient rights', () => {
        return request(app.getHttpServer())
          .put(`/bids/${bidConfig.avitoBidId}/submit_decision`)
          .send({
            username: config.avitoEmpUser,
            decision: bidDecision.Approved,
          })
          .expect(200);
      });
    });
  });
});
