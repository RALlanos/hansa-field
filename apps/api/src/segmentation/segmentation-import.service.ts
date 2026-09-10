import {
  Inject,
  Injectable,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { SegmentationService } from "./segmentation.service.js";
import type { HierarchyInput } from "./segmentation.contracts.js";

@Injectable()
export class SegmentationImportService {
  constructor(
    @Inject(SegmentationService)
    private readonly segmentation: SegmentationService,
  ) {}
  execute(
    org: string,
    schemeId: string,
    input: HierarchyInput,
    confirm: boolean,
  ) {
    const repo = this.segmentation.repository;
    return repo.database.withTransaction(async (tx) => {
      const scheme = await this.segmentation.activeScheme(tx, org, schemeId);
      if (scheme.revision !== input.expectedRevision)
        throw new ConflictException(
          "La estructura cambió; genera una nueva vista previa.",
        );
      const levels = await repo.levels(tx, schemeId);
      let position = 0;
      for (const column of input.columns) {
        const level = levels.find(
          (l) => l.id === column.levelId && l.status === "active",
        );
        if (!level || level.position <= position)
          throw new BadRequestException(
            "Mapea niveles activos en orden, sin repetirlos.",
          );
        position = level.position;
      }
      const cache = new Map<string, string>();
      const planned: {
        id: string;
        name: string;
        levelId: string;
        parentId: string | null;
      }[] = [];
      const newIds = new Set<string>();
      const issues: string[] = [];
      let matched = 0;
      for (const [rowIndex, row] of input.rows.entries()) {
        let parent: string | null = null,
          ended = false;
        for (const column of input.columns) {
          const name = String(row[column.sourceColumn] ?? "").trim();
          if (!name) {
            ended = true;
            continue;
          }
          if (ended) {
            issues.push(
              `Fila ${rowIndex + 1}: hay un nivel vacío antes de ${column.sourceColumn}.`,
            );
            break;
          }
          if (name.length > 200) {
            issues.push(`Fila ${rowIndex + 1}: nombre demasiado largo.`);
            break;
          }
          const key = JSON.stringify([
            column.levelId,
            parent,
            name.toLocaleLowerCase(),
          ]);
          const cached = cache.get(key);
          if (cached) {
            parent = cached;
            continue;
          }
          const existing: { id: string; status: string }[] =
            parent && newIds.has(parent)
              ? []
              : (
                  await tx.query<{ id: string; status: string }>(
                    "SELECT id,status FROM segments WHERE scheme_id=$1 AND level_id=$2 AND parent_segment_id IS NOT DISTINCT FROM $3::uuid AND lower(name)=lower($4)",
                    [schemeId, column.levelId, parent, name],
                  )
                ).rows;
          if (existing[0]) {
            if (existing[0].status !== "active") {
              issues.push(`Fila ${rowIndex + 1}: ${name} está archivado.`);
              break;
            }
            parent = existing[0].id;
            cache.set(key, parent);
            matched++;
            continue;
          }
          try {
            this.segmentation.validateMetadata(
              levels.find((l) => l.id === column.levelId)!,
              {},
            );
          } catch (error) {
            issues.push(
              `Fila ${rowIndex + 1}: ${error instanceof Error ? error.message : "Metadata inválida"}`,
            );
            break;
          }
          const id = randomUUID();
          planned.push({ id, name, levelId: column.levelId, parentId: parent });
          newIds.add(id);
          cache.set(key, id);
          parent = id;
        }
      }
      if (confirm && issues.length)
        throw new BadRequestException(issues.slice(0, 100));
      if (confirm) {
        const assigned = new Map<string, string>();
        for (const item of planned) {
          const created = await this.segmentation.insertSegment(
            tx,
            org,
            schemeId,
            {
              levelId: item.levelId,
              parentSegmentId: item.parentId
                ? (assigned.get(item.parentId) ?? item.parentId)
                : null,
              name: item.name,
              code: null,
              externalId: null,
              description: "",
              status: "active",
              metadata: {},
              geometry: null,
            },
          );
          assigned.set(item.id, created.id);
        }
        await repo.touch(tx, schemeId);
      }
      return {
        confirmed: confirm,
        created: planned.length,
        matched,
        rows: input.rows.length,
        issues: issues.slice(0, 100),
        issueCount: issues.length,
        preview: planned.slice(0, 100),
        revision: scheme.revision + (confirm ? 1 : 0),
      };
    });
  }
}
