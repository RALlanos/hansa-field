import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { z } from "zod";
import { LOCAL_ORGANIZATION } from "../datasets/operational.controller.js";
import { SegmentationService } from "./segmentation.service.js";
import { SegmentationImportService } from "./segmentation-import.service.js";
import { SegmentMembershipsService } from "./segment-memberships.service.js";
import {
  uuid,
  schemeInput,
  schemePatch,
  levelInput,
  levelPatch,
  segmentInput,
  segmentPatch,
  membershipInput,
  accessInput,
  hierarchyInput,
} from "./segmentation.contracts.js";
const pagination = z.object({
  cursor: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
const flag = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");
/** Uses the same server-owned local development organization as the current workspace. */
@Controller("segmentation")
export class SegmentationController {
  constructor(
    @Inject(SegmentationService) private readonly service: SegmentationService,
    @Inject(SegmentationImportService)
    private readonly importer: SegmentationImportService,
    @Inject(SegmentMembershipsService)
    private readonly memberships: SegmentMembershipsService,
  ) {}
  @Get("schemes") schemes(@Query() raw: unknown) {
    const query = z
      .object({ appId: uuid.optional(), projectId: uuid.optional() })
      .strict()
      .refine((q) => !(q.appId && q.projectId), "Usa un solo contexto.")
      .parse(raw);
    return this.service.list(LOCAL_ORGANIZATION, query);
  }
  @Post("schemes") create(@Body() raw: unknown) {
    return this.service.create(LOCAL_ORGANIZATION, schemeInput.parse(raw));
  }
  @Get("schemes/:id") scheme(@Param("id") id: string) {
    return this.service.get(LOCAL_ORGANIZATION, uuid.parse(id));
  }
  @Patch("schemes/:id") edit(@Param("id") id: string, @Body() raw: unknown) {
    return this.service.edit(
      LOCAL_ORGANIZATION,
      uuid.parse(id),
      schemePatch.parse(raw),
    );
  }
  @Delete("schemes/:id") archive(@Param("id") id: string) {
    return this.service.edit(LOCAL_ORGANIZATION, uuid.parse(id), {
      status: "archived",
    });
  }
  @Post("schemes/:id/levels") createLevel(
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    return this.service.createLevel(
      LOCAL_ORGANIZATION,
      uuid.parse(id),
      levelInput.parse(raw),
    );
  }
  @Patch("schemes/:id/levels/:levelId") editLevel(
    @Param("id") id: string,
    @Param("levelId") levelId: string,
    @Body() raw: unknown,
  ) {
    return this.service.editLevel(
      LOCAL_ORGANIZATION,
      uuid.parse(id),
      uuid.parse(levelId),
      levelPatch.parse(raw),
    );
  }
  @Post("schemes/:id/levels/order") order(
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    return this.service.orderLevels(
      LOCAL_ORGANIZATION,
      uuid.parse(id),
      z
        .object({ levelIds: z.array(uuid) })
        .strict()
        .parse(raw).levelIds,
    );
  }
  @Post("schemes/:id/segments") createSegment(
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    return this.service.createSegment(
      LOCAL_ORGANIZATION,
      uuid.parse(id),
      segmentInput.parse(raw),
    );
  }
  @Get("schemes/:id/children") children(
    @Param("id") id: string,
    @Query() raw: unknown,
  ) {
    const q = pagination
      .extend({ parentId: uuid.optional() })
      .strict()
      .parse(raw);
    return this.service.children(
      LOCAL_ORGANIZATION,
      uuid.parse(id),
      q.parentId ?? null,
      q.cursor ?? null,
      q.limit,
    );
  }
  @Get("segments/:id") segment(@Param("id") id: string) {
    return this.service.repository.segment(
      this.service.repository.database,
      LOCAL_ORGANIZATION,
      uuid.parse(id),
    );
  }
  @Patch("segments/:id") editSegment(
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    return this.service.editSegment(
      LOCAL_ORGANIZATION,
      uuid.parse(id),
      segmentPatch.parse(raw),
    );
  }
  @Post("segments/:id/move") move(
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    const data = z
      .object({ parentSegmentId: uuid.nullable() })
      .strict()
      .parse(raw);
    return this.service.editSegment(LOCAL_ORGANIZATION, uuid.parse(id), data);
  }
  @Get("segments/:id/ancestors") ancestors(@Param("id") id: string) {
    return this.service.ancestors(LOCAL_ORGANIZATION, uuid.parse(id));
  }
  @Post("schemes/:id/import/preview") preview(
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    return this.importer.execute(
      LOCAL_ORGANIZATION,
      uuid.parse(id),
      hierarchyInput.parse(raw),
      false,
    );
  }
  @Post("schemes/:id/import/confirm") confirm(
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    return this.importer.execute(
      LOCAL_ORGANIZATION,
      uuid.parse(id),
      hierarchyInput.parse(raw),
      true,
    );
  }
  @Post("segments/:id/memberships") assign(
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    return this.memberships.assign(
      LOCAL_ORGANIZATION,
      uuid.parse(id),
      membershipInput.parse(raw),
    );
  }
  @Get("segments/:id/memberships") members(
    @Param("id") id: string,
    @Query() raw: unknown,
  ) {
    const q = pagination
      .extend({ includeDescendants: flag })
      .strict()
      .parse(raw);
    return this.memberships.members(
      LOCAL_ORGANIZATION,
      uuid.parse(id),
      q.includeDescendants,
      q.cursor ?? null,
      q.limit,
    );
  }
  @Delete("segments/:id/memberships/:membershipId") removeMembership(
    @Param("id") id: string,
    @Param("membershipId") membershipId: string,
  ) {
    return this.memberships.remove(
      LOCAL_ORGANIZATION,
      uuid.parse(id),
      uuid.parse(membershipId),
    );
  }
  @Get("memberships") entity(@Query() raw: unknown) {
    return this.memberships.forEntity(
      LOCAL_ORGANIZATION,
      membershipInput.parse(raw),
    );
  }
  @Get("segments/:id/access") access(@Param("id") id: string) {
    return this.memberships.access(LOCAL_ORGANIZATION, uuid.parse(id));
  }
  @Post("segments/:id/access") grant(
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    return this.memberships.grant(
      LOCAL_ORGANIZATION,
      uuid.parse(id),
      accessInput.parse(raw),
    );
  }
  @Delete("segments/:id/access/:accessId") revoke(
    @Param("id") id: string,
    @Param("accessId") accessId: string,
  ) {
    return this.memberships.revoke(
      LOCAL_ORGANIZATION,
      uuid.parse(id),
      uuid.parse(accessId),
    );
  }
  @Get("segments/:id/effective-access") effective(
    @Param("id") id: string,
    @Query() raw: unknown,
  ) {
    const q = accessInput
      .pick({ principalType: true, principalId: true })
      .strict()
      .parse(raw);
    return this.memberships.effectiveAccess(
      LOCAL_ORGANIZATION,
      uuid.parse(id),
      q.principalType,
      q.principalId,
    );
  }
}
