import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { z } from "zod";

import { AppModule } from "./app.module.js";

const environmentSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3100),
  WEB_ORIGIN: z.url().default("http://localhost:3200"),
});

async function bootstrap(): Promise<void> {
  const environment = environmentSchema.parse(process.env);
  const application = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  application.enableCors({
    origin: environment.WEB_ORIGIN,
    methods: ["GET", "POST"],
  });
  application.setGlobalPrefix("api");
  await application.listen(environment.API_PORT, "127.0.0.1");
}

await bootstrap();
