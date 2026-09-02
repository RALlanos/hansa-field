import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { AppsController } from "./apps.controller.js";
import { AppsService } from "./apps.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [AppsController],
  providers: [AppsService],
})
export class AppsModule {}
