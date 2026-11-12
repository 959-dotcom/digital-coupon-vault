import { Module } from '@nestjs/common';
import { HierarchyController } from './hierarchy.controller.js';
import { HierarchyService } from './hierarchy.service.js';

@Module({
  controllers: [HierarchyController],
  providers: [HierarchyService],
  exports: [HierarchyService],
})
export class HierarchyModule {}
