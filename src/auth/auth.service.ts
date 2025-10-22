import {
  Injectable,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { SignupDto } from './dto/signup.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService, private readonly jwtService: JwtService) {}

  async register(signupDto: SignupDto): Promise<AuthResponseDto> {
    const { email, username, password } = signupDto;

    const user = await this.usersService.create({
      email,
      username,
      password,
    });

    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      roles: user.roles.map(r => r.name),
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        roles: user.roles.map(r => r.name),
        subscriptionPlan: user.subscriptionPlan,
        status: user.status,
      },
    }
  }
}
