import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from './auth-user.js';
import { AuthService } from './auth.service.js';
import { CurrentUser, Public } from './decorators.js';
import { ChangePasswordDto, ChangePinDto, LoginDto, RegisterDto } from './dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    return this.auth.login(dto, ip);
  }

  @Patch('password')
  changePassword(@CurrentUser() actor: AuthUser, @Body() dto: ChangePasswordDto, @Req() request: Request) {
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    return this.auth.changePassword(actor, dto.currentPassword, dto.newPassword, ip);
  }

  @Get('me/profile')
  profile(@CurrentUser() actor: AuthUser) {
    return this.auth.profile(actor);
  }

  @Patch('me/pin')
  changePin(@CurrentUser() actor: AuthUser, @Body() dto: ChangePinDto, @Req() request: Request) {
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    return this.auth.changePin(actor, dto.currentPin, dto.pin, dto.pinConfirm, ip);
  }
}
