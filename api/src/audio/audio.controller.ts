import { Controller, Post, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AudioService } from './audio.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Audio')
@Controller('audio')
// @UseGuards(JwtAuthGuard)
// @ApiBearerAuth()
export class AudioController {
    constructor(private readonly audioService: AudioService) { }

    @Post('generate/:chapterId')
    @ApiOperation({ summary: 'Request audio generation for a chapter' })
    async generateAudio(@Param('chapterId', ParseIntPipe) chapterId: number) {
        return this.audioService.generateAudio(chapterId);
    }

    @Get('chapter/:chapterId')
    @ApiOperation({ summary: 'Get audio for a chapter' })
    async getChapterAudio(@Param('chapterId', ParseIntPipe) chapterId: number) {
        return this.audioService.getChapterAudio(chapterId);
    }
}
