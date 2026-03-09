import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { StorageService } from './storage.service';
import { GetPresignedUrlDto, UploadType } from './dto/presigned-url.dto';
import { JwtAuthGuard } from 'src/auth/guards';

const UPLOAD_FOLDERS: Record<UploadType, string> = {
  book: 'uploads/books',
  cover: 'uploads/covers',
  avatar: 'uploads/avatars',
};

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @UseGuards(JwtAuthGuard)
  @Post('presigned-url')
  async getPresignedUrl(
    @Body() dto: GetPresignedUrlDto,
  ): Promise<{ key: string; uploadUrl: string }> {
    const folder = UPLOAD_FOLDERS[dto.type];
    return this.storageService.getPresignedUploadUrl(folder, dto.filename);
  }
}
