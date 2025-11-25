import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards';
import { type AuthenticatedUser } from 'src/common';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CurrentUser } from 'src/common/decorators';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('signup')
    async signup(@Body() signupDto: SignupDto) {
        return {
            message: "Signup successful",
            data: await this.authService.register(signupDto)
        }
    }

    @Post('login')
    async login(@Body() loginDto: LoginDto) {
        return {
            message: "Login successful",
            data: await this.authService.login(loginDto)
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
}
