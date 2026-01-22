import { Controller, Post, Get, Param, ParseIntPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AudioService } from './audio.service';
import { ApiTags, ApiOperation, ApiProduces, ApiResponse } from '@nestjs/swagger';

@ApiTags('Audio')
@Controller('audio')
// @UseGuards(JwtAuthGuard)
// @ApiBearerAuth()
export class AudioController {
    constructor(private readonly audioService: AudioService) { }

    @Post('generate/:chapterId')
    @ApiOperation({ summary: 'Request audio generation for a chapter (saves to DB)' })
    async generateAudio(@Param('chapterId', ParseIntPipe) chapterId: number) {
        return this.audioService.generateAudio(chapterId);
    }

    @Get('chapter/:chapterId')
    @ApiOperation({
        summary: 'Get audio for a chapter',
        description: 'Redirects to S3 URL if cached, otherwise streams audio directly from Azure TTS'
    })
    @ApiProduces('audio/mpeg')
    @ApiResponse({ status: 302, description: 'Redirect to cached audio URL' })
    @ApiResponse({ status: 200, description: 'Audio stream (audio/mpeg)' })
    async getChapterAudio(
        @Param('chapterId', ParseIntPipe) chapterId: number,
        @Res() res: Response,
    ) {
        const result = await this.audioService.getChapterAudio(chapterId);

        if (result.type === 'redirect') {
            // Redirect tới S3 URL
            res.setHeader('Cache-Control', 'no-cache');
            return res.redirect(result.url);
        } else {
            // Stream audio trực tiếp từ Azure TTS
            res.setHeader('Content-Type', result.contentType);
            res.setHeader('Transfer-Encoding', 'chunked');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('X-Audio-Source', 'tts-stream');

            // Pipe stream to response
            result.stream.pipe(res);
        }
    }
}
