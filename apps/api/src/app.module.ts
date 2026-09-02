import { Module } from "@nestjs/common";

import { HealthModule } from "./health/health.module.js";
import { AppsModule } from "./apps/apps.module.js";

@Module({
  imports: [HealthModule, AppsModule],
})
export class AppModule {}
