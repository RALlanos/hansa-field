import { Module } from "@nestjs/common";

import { HealthModule } from "./health/health.module.js";
import { AppsModule } from "./apps/apps.module.js";
import { RecordsModule } from "./records/records.module.js";

@Module({
  imports: [HealthModule, AppsModule, RecordsModule],
})
export class AppModule {}
