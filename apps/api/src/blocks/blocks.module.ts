import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { BlocksController } from "./blocks.controller.js";
import { BlocksService } from "./blocks.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [BlocksController],
  providers: [BlocksService],
})
export class BlocksModule {}
