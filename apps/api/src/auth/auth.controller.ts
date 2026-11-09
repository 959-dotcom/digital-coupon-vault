import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { Public } from './decorators.js';
import { LoginDto } from './dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    return this.auth.login(dto, ip);
  }
}
