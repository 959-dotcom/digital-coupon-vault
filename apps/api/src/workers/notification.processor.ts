import { Processor, WorkerHost } from '@nestjs/bullmq';
import { NotificationService } from '../notifications/notification.service.js';

@Processor('batch-notifications')
export class NotificationProcessor extends WorkerHost {
  constructor(private readonly notifications: NotificationService) {
    super();
  }

  async process(): Promise<void> {
    await this.notifications.remindUpcoming(new Date());
  }
}
