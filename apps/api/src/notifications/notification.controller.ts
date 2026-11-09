import { Controller, Get, Param, Post } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators.js';
import { NotificationService } from './notification.service.js';

class NotificationParamsDto {
  @IsUUID()
  id!: string;
}

@Controller('me/notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  list(@CurrentUser() actor: AuthUser) {
    return this.notifications.list(actor);
  }

  @Post('read-all')
  readAll(@CurrentUser() actor: AuthUser) {
    return this.notifications.markAllRead(actor);
  }

  @Post(':id/read')
  read(@CurrentUser() actor: AuthUser, @Param() params: NotificationParamsDto) {
    return this.notifications.markRead(actor, params.id);
  }
}
