import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { ZodError } from "zod";
@Catch()
export class OperationalErrors implements ExceptionFilter {
  private readonly logger = new Logger(OperationalErrors.name);
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    if (error instanceof HttpException) {
      void response.status(error.getStatus()).send(error.getResponse());
      return;
    }
    if (error instanceof ZodError) {
      void response
        .status(400)
        .send({
          message: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        });
      return;
    }
    if (
      error instanceof Error &&
      "code" in error &&
      ["23505", "23503", "23514"].includes(String(error.code))
    ) {
      void response
        .status(409)
        .send({
          message:
            "Conflicto de datos: relación duplicada, referencia inválida o geometría inválida.",
        });
      return;
    }
    this.logger.error(error);
    void response
      .status(500)
      .send({
        message:
          "Error interno. La operación no fue confirmada; consulta el log de API.",
      });
  }
}
