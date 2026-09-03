import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { TransfersController } from "./transfers.controller.js";
import { TransfersService } from "./transfers.service.js";
import { ShapefileImportsController } from "./shapefile-imports.controller.js";
import { ShapefileImportsService } from "./shapefile-imports.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [TransfersController, ShapefileImportsController],
  providers: [TransfersService, ShapefileImportsService],
})
export class TransfersModule {}
