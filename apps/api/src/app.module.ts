import { Module } from "@nestjs/common";

import { HealthModule } from "./health/health.module.js";
import { AppsModule } from "./apps/apps.module.js";
import { RecordsModule } from "./records/records.module.js";
import { TransfersModule } from "./transfers/transfers.module.js";
import { ProjectsModule } from "./projects/projects.module.js";

@Module({
  imports: [
    HealthModule,
    AppsModule,
    RecordsModule,
    TransfersModule,
    ProjectsModule,
  ],
})
export class AppModule {}
