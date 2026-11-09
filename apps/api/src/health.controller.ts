import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators.js';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health() {
    return { ok: true };
  }
}
