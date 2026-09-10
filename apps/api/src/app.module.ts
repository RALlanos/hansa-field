import { Module } from "@nestjs/common";

import { HealthModule } from "./health/health.module.js";
import { OperationalModule } from "./datasets/operational.module.js";
import {SegmentationModule} from "./segmentation/segmentation.module.js";

@Module({
  imports: [HealthModule, OperationalModule,SegmentationModule],
})
export class AppModule {}
