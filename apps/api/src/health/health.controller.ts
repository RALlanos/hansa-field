import { Controller, Get, Inject } from "@nestjs/common";

import { HealthService, type LiveStatus } from "./health.service.js";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(HealthService) private readonly healthService: HealthService,
  ) {}

  @Get("live")
  getLiveStatus(): LiveStatus {
    return this.healthService.getLiveStatus();
  }
}
