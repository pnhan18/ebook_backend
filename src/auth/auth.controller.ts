import { Body, Controller, Post, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards';
import { type AuthenticatedUser } from 'src/common';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CurrentUser } from 'src/common/decorators';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) {}

    private getCookieMaxAge(): number {
        const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
        
        const match = expiresIn.match(/^(\d+)([smhd])$/);
        if (!match) {
            return 15 * 60 * 1000;
        }

        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: return 15 * 60 * 1000;
        }
    }

    @Post('signup')
    async signup(@Body() signupDto: SignupDto, @Res({ passthrough: true }) res: Response) {
        const result = await this.authService.register(signupDto);
        
        res.cookie('accessToken', result.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: this.getCookieMaxAge(),
        });

        return {
            message: "Signup successful",
            data: result
        }
    }

    @Post('login')
    async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
        const result = await this.authService.login(loginDto);
        
        res.cookie('accessToken', result.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: this.getCookieMaxAge(),
        });

        return {
            message: "Login successful",
            data: result
        }
    }

    @Post('change-password')
    @UseGuards(JwtAuthGuard)
    async changePassword(
        @CurrentUser() user: AuthenticatedUser,
        @Body() changePasswordDto: ChangePasswordDto,
    ) {
        return await this.authService.changePassword(user.id, changePasswordDto);
    }

    @Post('forgot-password')
    async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
        return await this.authService.forgotPassword(forgotPasswordDto);
    }

    @Post('reset-password')
    async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
        return await this.authService.resetPassword(resetPasswordDto);
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    async logout(@Res({ passthrough: true }) res: Response) {
        res.clearCookie('accessToken');
        return { message: 'Logout successful' };
    }
}
