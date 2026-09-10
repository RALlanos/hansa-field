import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { SegmentationRepository } from "./segmentation.repository.js";
import { SegmentationService } from "./segmentation.service.js";
import { SegmentationImportService } from "./segmentation-import.service.js";
import { SegmentMembershipsService } from "./segment-memberships.service.js";
import { SegmentationController } from "./segmentation.controller.js";
@Module({
  imports: [DatabaseModule],
  controllers: [SegmentationController],
  providers: [
    SegmentationRepository,
    SegmentationService,
    SegmentationImportService,
    SegmentMembershipsService,
  ],
  exports: [SegmentationService, SegmentMembershipsService],
})
export class SegmentationModule {}
