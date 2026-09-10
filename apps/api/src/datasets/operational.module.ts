import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { DatabaseService } from "../database/database.service.js";
import { DatasetsService } from "./datasets.service.js";
import { DatasetRecordsService } from "./dataset-records.service.js";
import { MapRecordsService } from "./map-records.service.js";
import { WorkspaceChangesService } from "./workspace-changes.service.js";
import { OperationalController } from "./operational.controller.js";
import { OperationalImportsController } from "./operational-imports.controller.js";
import { TemplatesController } from "./templates.controller.js";

@Module({
  imports: [DatabaseModule],
  controllers: [
    OperationalController,
    OperationalImportsController,
    TemplatesController,
  ],
  providers: [
    {
      provide: DatasetsService,
      inject: [DatabaseService],
      useFactory: (db: DatabaseService) => new DatasetsService(db),
    },
    {
      provide: DatasetRecordsService,
      inject: [DatabaseService],
      useFactory: (db: DatabaseService) => new DatasetRecordsService(db),
    },
    {
      provide: MapRecordsService,
      inject: [DatabaseService],
      useFactory: (db: DatabaseService) => new MapRecordsService(db),
    },
    {
      provide: WorkspaceChangesService,
      inject: [DatabaseService],
      useFactory: (db: DatabaseService) => new WorkspaceChangesService(db),
    },
  ],
})
export class OperationalModule {}
