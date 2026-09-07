import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  UnprocessableEntityException,
} from "@nestjs/common";
import { z } from "zod";

import { BlocksService } from "./blocks.service.js";

const uuid = z.string().uuid();
const createBlockSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Z][A-Z0-9_]{1,63}$/),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).default(""),
    members: z
      .array(z.object({ appId: uuid, appVersionId: uuid }).strict())
      .min(1)
      .max(100),
  })
  .strict();
const updateBlockSchema = createBlockSchema;

@Controller("blocks")
export class BlocksController {
  constructor(@Inject(BlocksService) private readonly blocks: BlocksService) {}

  @Get()
  async list() {
    return { data: await this.blocks.list() };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown) {
    const parsed = createBlockSchema.safeParse(body);
    if (!parsed.success) {
      throw new UnprocessableEntityException({
        code: "BLOCK_VALIDATION_ERROR",
        message: "Bloque inválido.",
        details: parsed.error.flatten(),
      });
    }
    return this.blocks.create(parsed.data);
  }

  @Patch(":blockId")
  async update(@Param("blockId") blockId: string, @Body() body: unknown) {
    const parsed = updateBlockSchema.safeParse(body);
    if (!parsed.success) {
      throw new UnprocessableEntityException({
        code: "BLOCK_VALIDATION_ERROR",
        message: "Bloque inválido.",
        details: parsed.error.flatten(),
      });
    }
    return this.blocks.update(blockId, parsed.data);
  }
}
