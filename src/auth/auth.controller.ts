import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

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
}
