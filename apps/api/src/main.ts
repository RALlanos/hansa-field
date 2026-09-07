import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { z } from "zod";
import multipart from "@fastify/multipart";

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

  await application.register(multipart, {
    limits: { files: 1, fileSize: 50 * 1024 * 1024, fields: 0, parts: 1 },
  });

  application.enableCors({
    origin: ["http://localhost:3200", "http://192.168.100.34:3200"],
    credentials: true,
  });
  application.setGlobalPrefix("api");

  await application.listen(environment.API_PORT, "0.0.0.0");
}

await bootstrap();
