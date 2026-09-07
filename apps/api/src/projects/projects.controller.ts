import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UnprocessableEntityException,
} from "@nestjs/common";
import { z } from "zod";

import { ProjectsService } from "./projects.service.js";

const projectSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Z][A-Z0-9_]{1,63}$/),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).default(""),
    blockIds: z.array(z.string().uuid()).max(100).default([]),
  })
  .strict();

@Controller("projects")
export class ProjectsController {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}

  @Get()
  async list() {
    return { data: await this.projects.list() };
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown) {
    const result = projectSchema.safeParse(body);
    if (!result.success)
      throw new UnprocessableEntityException({
        code: "VALIDATION_ERROR",
        message: "Proyecto inválido.",
        details: result.error.flatten(),
      });
    return this.projects.create(result.data);
  }
}
