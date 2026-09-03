import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { inspectShapefileArchive } from "./shapefile-inspector.js";

const archivePath = process.argv[2];
if (!archivePath) {
  throw new Error(
    "Uso: tsx src/transfers/inspect-shapefile.cli.ts <archivo.zip>",
  );
}

const inspection = await inspectShapefileArchive(
  basename(archivePath),
  await readFile(archivePath),
);

process.stdout.write(
  `${JSON.stringify(
    {
      featureCount: inspection.featureCount,
      geometryType: inspection.geometryType,
      bbox: inspection.bbox,
      crs: inspection.crs,
      routing: inspection.routing,
      sourceStatuses: inspection.sourceStatuses,
      fieldCount: inspection.fields.length,
      typedFields: inspection.fields.filter(
        (field) => field.suggestedType !== "text",
      ),
    },
    null,
    2,
  )}\n`,
);
