import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PlansService } from './plans.service';
import { CreatePlanDto, UpdatePlanDto, QueryPlanDto, PlanResponseDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import {
  Roles,
  ApiSuccessResponse,
  ApiSuccessArrayResponse,
  ApiPaginatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '../common/decorators';

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @ApiOperation({ summary: 'Get active plans (public)' })
  @ApiSuccessArrayResponse(PlanResponseDto)
  findActive() {
    return this.plansService.findActive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get plan by ID' })
  @ApiSuccessResponse(PlanResponseDto)
  @ApiNotFoundResponse('Plan not found')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.findOne(id);
  }
}

@ApiTags('Admin Plans')
@Controller('admin/plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth('JWT-auth')
export class AdminPlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new plan' })
  @ApiSuccessResponse(PlanResponseDto, 201, 'Plan created')
  @ApiBadRequestResponse('Validation failed')
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiConflictResponse('Plan already exists')
  create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all plans with pagination' })
  @ApiPaginatedResponse(PlanResponseDto)
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  findAll(@Query() query: QueryPlanDto) {
    return this.plansService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get plan by ID' })
  @ApiSuccessResponse(PlanResponseDto)
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse('Plan not found')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update plan' })
  @ApiSuccessResponse(PlanResponseDto)
  @ApiBadRequestResponse('Validation failed')
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse('Plan not found')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plansService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete plan' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse('Plan not found')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.remove(id);
  }
}
