import { Injectable } from "@nestjs/common";

export type LiveStatus = Readonly<{
  service: "hansa-field-api";
  status: "ok";
}>;

@Injectable()
export class HealthService {
  getLiveStatus(): LiveStatus {
    return {
      service: "hansa-field-api",
      status: "ok",
    };
  }
}
