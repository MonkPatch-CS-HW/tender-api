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
import { TendersService } from 'src/tenders/tenders.service';
import { EmployeesService } from 'src/employees/employees.service';

class QueryReviews {
  @Min(0)
  offset: number = 0;

  @Min(0)
  limit: number = 5;

  @IsNotEmpty()
  authorUsername: string;

  @IsNotEmpty()
  requesterUsername: string;

  @IsUUID()
  tenderId: string;
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

  @IsUUID()
  bidId: string;

  @IsNotEmpty()
  username: string;
}

@Controller('bids')
export class BidsController {
  constructor(
    private bidsService: BidsService,
    private tendersService: TendersService,
    private employeesService: EmployeesService,
  ) {}

  @Post('new')
  async create(@Body() data: BidCreateBody) {
    const tender = await this.tendersService.getById(data.tenderId);
    if (tender === null) throw new NotFoundException('Tender is not found');

    switch (data.authorType) {
      case 'Organization':
        if (tender.organizationId !== data.authorId)
          throw new ForbiddenException(
            'Organization is not the owner of the tender',
          );
        break;
      case 'User':
        const employee = await this.employeesService.getById(
          data.authorId,
          true,
        );
        if (employee === null) throw new NotFoundException('User is not found');

        if (!employee.organizationIds.includes(tender.organizationId))
          throw new ForbiddenException(
            'User is not responsible for the organization',
          );
    }

    const creator = await this.employeesService.getByUsername(
      data.creatorUsername,
    );

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
    if (employee === null) throw new NotFoundException('Employee is not found');

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

    return bid.status;
  }

  @Put(':bidId/status')
  async setStatus(
    @Param('bidId', ParseUUIDPipe) bidId: string,
    @Query('username') username: string,
    @Query('status', new ParseEnumPipe(bidStatus)) status: bidStatus,
  ): Promise<BidData> {
    const bid = await this.bidsService.getById(bidId, true);
    if (bid === null) throw new NotFoundException('Bid is not found');

    const tender = await this.tendersService.getById(bid.tenderId);
    if (tender === null) throw new NotFoundException('Tender is not found');

    const employee = await this.employeesService.getByUsername(username, true);

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

    return await this.bidsService.updateStatus(bidId, status);
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

    return await this.bidsService.rollback(bidId, version);
  }

  @Put(':bidId/feedback')
  async feedback(@Body() data: BidFeedbackBody) {
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

    return await this.bidsService.feedback({
      bidId: data.bidId,
      message: data.bidFeedback,
      creatorId: employee.id,
    });
  }

  @Get(':tenderId/reviews')
  async reviews(@Query() query: QueryReviews): Promise<FeedbackData[]> {
    const tender = await this.tendersService.getById(query.tenderId);
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
    if (!author)
      throw new UnauthorizedException('Employee-author is not found');

    if (!employee.organizationIds.includes(tender.organizationId))
      throw new ForbiddenException(
        'Employee is not responsible for organization',
      );

    return await this.bidsService.reviews({
      authorId: author.id,
      tenderId: query.tenderId,
    });
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
