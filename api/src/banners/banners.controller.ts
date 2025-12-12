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
import { BannersService } from './banners.service';
import { CreateBannerDto, UpdateBannerDto, AdminQueryBannerDto, PublicQueryBannerDto, BannerResponseDto } from './dto';
import { JwtAuthGuard, RolesGuard } from 'src/auth/guards';
import {
  Roles,
  ApiSuccessResponse,
  ApiPaginatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from 'src/common/decorators';

@ApiTags('Banners')
@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active banners' })
  @ApiPaginatedResponse(BannerResponseDto)
  findAllPublic(@Query() query: PublicQueryBannerDto) {
    return this.bannersService.findAllPublic(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get banner by ID' })
  @ApiSuccessResponse(BannerResponseDto)
  @ApiNotFoundResponse('Banner not found')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.bannersService.findOne(id);
  }
}

@ApiTags('Admin Banners')
@Controller('admin/banners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth('JWT-auth')
export class AdminBannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new banner' })
  @ApiSuccessResponse(BannerResponseDto, 201, 'Banner created')
  @ApiBadRequestResponse('Validation failed')
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  create(@Body() createBannerDto: CreateBannerDto) {
    return this.bannersService.create(createBannerDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all banners (admin)' })
  @ApiPaginatedResponse(BannerResponseDto)
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  findAll(@Query() query: AdminQueryBannerDto) {
    return this.bannersService.findAllAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get banner by ID (admin)' })
  @ApiSuccessResponse(BannerResponseDto)
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse('Banner not found')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.bannersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update banner' })
  @ApiSuccessResponse(BannerResponseDto)
  @ApiBadRequestResponse('Validation failed')
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse('Banner not found')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBannerDto: UpdateBannerDto,
  ) {
    return this.bannersService.update(id, updateBannerDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete banner' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse('Banner not found')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.bannersService.remove(id);
  }
}
