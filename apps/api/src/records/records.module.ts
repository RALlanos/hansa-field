import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { RecordsController } from "./records.controller.js";
import { RecordsService } from "./records.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [RecordsController],
  providers: [RecordsService],
})
export class RecordsModule {}
