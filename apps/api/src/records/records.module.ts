import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { RecordsController } from "./records.controller.js";
import { RecordsMapController } from "./records-map.controller.js";
import { ProjectRecordsController } from "./project-records.controller.js";
import { ProjectAppRecordsController } from "./project-app-records.controller.js";
import { ProjectRecordsCoreService } from "./project-records-core.service.js";
import { RecordsService } from "./records.service.js";
import { ConsolidatedRecordsService } from "./consolidated-records.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [
    RecordsController,
    RecordsMapController,
    ProjectRecordsController,
    ProjectAppRecordsController,
  ],
  providers: [
    RecordsService,
    ProjectRecordsCoreService,
    ConsolidatedRecordsService,
  ],
})
export class RecordsModule {}
