import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { BidData, BidsService, FeedbackData } from './bids.service';
import { IsEnum, IsNotEmpty, IsUUID, Length, Min } from 'class-validator';
import { bidAuthorType, bidStatus } from '@prisma/client';
import { TendersService } from '../tenders/tenders.service';
import { EmployeesService } from '../employees/employees.service';
import { OrganizationsService } from '../organizations/organizations.service';

class QueryReviews {
  @Min(0)
  offset: number = 0;

  @Min(0)
  limit: number = 5;

  @IsNotEmpty()
  authorUsername: string;

  @IsNotEmpty()
  requesterUsername: string;
}

class QueryBidsMy {
  @Min(0)
  offset: number = 0;

  @Min(0)
  limit: number = 5;

  @IsNotEmpty()
  username: string;
}

class QueryBidsList {
  @Min(0)
  offset: number = 0;

  @Min(0)
  limit: number = 5;

  @IsNotEmpty()
  username: string;
}

class BidCreateBody {
  @IsNotEmpty()
  @Length(0, 100)
  name: string;

  @Length(0, 500)
  description: string;

  @IsUUID()
  tenderId: string;

  @IsEnum(bidAuthorType)
  authorType: bidAuthorType;

  @IsUUID()
  authorId: string;

  @IsNotEmpty()
  creatorUsername: string;
}

enum bidDecision {
  Approved,
  Rejected,
}

class SubmitBody {
  @IsEnum(bidDecision)
  decision: bidDecision;

  @IsUUID()
  bidId: string;

  @IsNotEmpty()
  username: string;
}

class BidEditBody {
  @IsNotEmpty()
  @Length(0, 100)
  name: string;

  @Length(0, 500)
  description: string;
}

class BidFeedbackBody {
  @IsNotEmpty()
  bidFeedback: string;

  @IsNotEmpty()
  username: string;
}

export class BidPutStatusBody {
  @IsEnum(bidStatus)
  status: bidStatus;

  @IsNotEmpty()
  username: string;
}

@Controller('bids')
export class BidsController {
  constructor(
    private bidsService: BidsService,
    private tendersService: TendersService,
    private employeesService: EmployeesService,
    private organizationsService: OrganizationsService,
  ) {}

  @Post('new')
  async create(@Body() data: BidCreateBody) {
    const tender = await this.tendersService.getById(data.tenderId);
    if (tender === null) throw new NotFoundException('Tender is not found');

    const creator = await this.employeesService.getByUsername(
      data.creatorUsername,
      true,
    );

    if (creator === null)
      throw new UnauthorizedException('Creator is not found by username');

    switch (data.authorType) {
      case 'Organization':
        const organization = await this.organizationsService.getById(
          data.authorId,
        );
        if (organization === null)
          throw new UnauthorizedException('Organization author was not found');

        if (!creator.organizationIds.includes(data.authorId))
          throw new ForbiddenException(
            'Creator is not responsible for organization',
          );

        break;
      case 'User':
        const employee = await this.employeesService.getById(data.authorId);
        if (employee === null)
          throw new UnauthorizedException('User author was not found');

        if (creator.id !== data.authorId)
          throw new ForbiddenException(
            'User author is not the same as creator',
          );
        break;
    }

    return await this.bidsService.create({
      creatorId: creator.id,
      authorType: data.authorType,
      authorId: data.authorId,
      description: data.description,
      name: data.name,
      tenderId: data.tenderId,
    });
  }

  @Get('my')
  async my(@Query() query: QueryBidsMy): Promise<BidData[]> {
    const creator = await this.employeesService.getByUsername(query.username);
    if (creator === null)
      throw new UnauthorizedException('Employee is not found');

    return await this.bidsService.getByCreator(
      creator.id,
      query.limit,
      query.offset,
    );
  }

  @Get(':tenderId/list')
  async list(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Query() query: QueryBidsList,
  ): Promise<BidData[]> {
    const employee = await this.employeesService.getByUsername(
      query.username,
      true,
    );
    if (employee === null)
      throw new UnauthorizedException('Employee is not found');

    const tender = await this.tendersService.getById(tenderId);
    if (tender === null) throw new NotFoundException('Tender is not found');

    if (!employee.organizationIds.includes(tender.organizationId))
      throw new ForbiddenException(
        'Employee is not responsible for organization',
      );

    return await this.bidsService.getByTender(
      tenderId,
      query.limit,
      query.offset,
    );
  }

  @Get(':bidId/status')
  async status(
    @Param('bidId', ParseUUIDPipe) bidId: string,
    @Query('username') username: string,
  ): Promise<bidStatus> {
    const bid = await this.bidsService.getById(bidId, true);
    if (bid === null) throw new NotFoundException('Bid is not found');

    const tender = await this.tendersService.getById(bid.tenderId);
    if (tender === null) throw new NotFoundException('Tender is not found');

    const employee = await this.employeesService.getByUsername(username, true);
    if (employee === null)
      throw new UnauthorizedException('Username not correct');

    switch (bid.authorType) {
      case 'Organization':
        if (!employee.organizationIds.includes(bid.authorId))
          throw new ForbiddenException(
            'User is not responsible for the organization',
          );
        break;
      case 'User':
        if (bid.authorId !== employee.id)
          throw new ForbiddenException('Incorrect user');
        break;
    }

    return bid.status;
  }

  @Put(':bidId/status')
  async setStatus(
    @Param('bidId', ParseUUIDPipe) bidId: string,
    @Body() body: BidPutStatusBody,
  ): Promise<BidData> {
    const bid = await this.bidsService.getById(bidId, true);
    if (bid === null) throw new NotFoundException('Bid is not found');

    const tender = await this.tendersService.getById(bid.tenderId);
    if (tender === null) throw new NotFoundException('Tender is not found');

    const employee = await this.employeesService.getByUsername(
      body.username,
      true,
    );
    if (employee === null)
      throw new UnauthorizedException('Username not correct');

    switch (bid.authorType) {
      case 'Organization':
        if (!employee.organizationIds.includes(bid.authorId))
          throw new ForbiddenException(
            'User is not responsible for the organization',
          );
        break;
      case 'User':
        if (bid.authorId !== employee.id)
          throw new ForbiddenException('Incorrect user');
        break;
    }

    return await this.bidsService.updateStatus(bidId, body.status);
  }

  @Patch(':bidId/edit')
  async edit(
    @Body() data: BidEditBody,
    @Param('bidId', ParseUUIDPipe) bidId: string,
    @Query('username') username: string,
  ): Promise<BidData> {
    const bid = await this.bidsService.getById(bidId, true);
    if (bid === null) throw new NotFoundException('Bid is not found');

    const tender = await this.tendersService.getById(bid.tenderId);
    if (tender === null) throw new NotFoundException('Tender is not found');

    const employee = await this.employeesService.getByUsername(username, true);
    if (employee === null)
      throw new UnauthorizedException('Username not correct');

    switch (bid.authorType) {
      case 'Organization':
        if (!employee.organizationIds.includes(bid.authorId))
          throw new ForbiddenException(
            'User is not responsible for the organization',
          );
        break;
      case 'User':
        if (bid.authorId !== employee.id)
          throw new ForbiddenException('Incorrect user');
        break;
    }

    return await this.bidsService.edit(bidId, data);
  }

  @Put(':bidId/rollback/:version')
  async rollback(
    @Param('bidId', ParseUUIDPipe) bidId: string,
    @Param('version', ParseIntPipe) version: number,
    @Query('username') username: string,
  ): Promise<BidData> {
    const bid = await this.bidsService.getById(bidId, true);
    if (bid === null) throw new NotFoundException('Bid is not found');

    const tender = await this.tendersService.getById(bid.tenderId);
    if (tender === null) throw new NotFoundException('Tender is not found');

    const employee = await this.employeesService.getByUsername(username, true);
    if (employee === null)
      throw new UnauthorizedException('Username not correct');

    switch (bid.authorType) {
      case 'Organization':
        if (!employee.organizationIds.includes(bid.authorId))
          throw new ForbiddenException(
            'User is not responsible for the organization',
          );
        break;
      case 'User':
        if (bid.authorId !== employee.id)
          throw new ForbiddenException('Incorrect user');
        break;
    }

    return await this.bidsService.rollback(bidId, version);
  }

  @Put(':bidId/feedback')
  async feedback(
    @Param('bidId', ParseUUIDPipe) bidId: string,
    @Body() data: BidFeedbackBody,
  ) {
    const bid = await this.bidsService.getById(bidId, true);
    if (bid === null) throw new NotFoundException('Bid is not found');

    const tender = await this.tendersService.getById(bid.tenderId);
    if (tender === null) throw new NotFoundException('Tender is not found');

    const employee = await this.employeesService.getByUsername(
      data.username,
      true,
    );
    if (employee === null)
      throw new UnauthorizedException('Username not correct');

    switch (bid.authorType) {
      case 'Organization':
        if (!employee.organizationIds.includes(bid.authorId))
          throw new ForbiddenException(
            'User is not responsible for the organization',
          );
        break;
      case 'User':
        if (bid.authorId !== employee.id)
          throw new ForbiddenException('Incorrect user');
        break;
    }

    return await this.bidsService.feedback({
      bidId: bidId,
      message: data.bidFeedback,
      creatorId: employee.id,
    });
  }

  @Get(':tenderId/reviews')
  async reviews(
    @Param('tenderId', ParseUUIDPipe) tenderId: string,
    @Query() query: QueryReviews,
  ): Promise<FeedbackData[]> {
    const tender = await this.tendersService.getById(tenderId);
    if (tender === null) throw new NotFoundException('Tender is not found');

    const employee = await this.employeesService.getByUsername(
      query.requesterUsername,
      true,
    );
    if (employee === null)
      throw new UnauthorizedException('Employee is not found');

    const author = await this.employeesService.getByUsername(
      query.authorUsername,
    );
    if (!author) throw new NotFoundException('Employee-author is not found');

    if (!employee.organizationIds.includes(tender.organizationId))
      throw new ForbiddenException(
        'Employee is not responsible for organization',
      );

    return await this.bidsService.reviews(
      {
        authorId: author.id,
        tenderId: tenderId,
      },
      query.limit,
      query.offset,
    );
  }

  @Put(':bidId/submit_decision')
  async submit(@Body() data: SubmitBody): Promise<BidData> {
    const bid = await this.bidsService.getById(data.bidId, true);
    if (bid === null) throw new NotFoundException('Bid is not found');

    const tender = await this.tendersService.getById(bid.tenderId);
    if (tender === null) throw new NotFoundException('Tender is not found');

    const employee = await this.employeesService.getByUsername(
      data.username,
      true,
    );

    switch (bid.authorType) {
      case 'Organization':
        if (!employee.organizationIds.includes(bid.authorId))
          throw new ForbiddenException(
            'User is not responsible for the organization',
          );

        if (tender.organizationId) break;
      case 'User':
        if (bid.authorId !== employee.id)
          throw new ForbiddenException('Incorrect user');
    }

    return bid;
  }
}
