import { createHash } from "node:crypto";

import type { Feature, Point } from "geojson";
import { open as openShapefile } from "shapefile";
import { fromBufferPromise, type Entry } from "yauzl";

import {
  TIGO_HFC_FTTH_V1,
  classifySourceStatus,
  summarizeRouting,
} from "./routing-profile.js";

const MAX_ARCHIVE_ENTRIES = 16;
const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 200;
const MAX_PREVIEW_FEATURES = 500;
const REQUIRED_EXTENSIONS = [".shp", ".shx", ".dbf", ".prj"] as const;

type SourceValue = string | number | boolean | Date | null;
type SourceProperties = Record<string, SourceValue>;
type SuggestedFieldType = "text" | "integer" | "decimal" | "boolean" | "date";

export type ShapefileInspection = Readonly<{
  checksumSha256: string;
  sourceFileName: string;
  layerName: string;
  featureCount: number;
  geometryType: "Point";
  bbox: readonly [number, number, number, number];
  crs: Readonly<{
    name: string;
    epsg: 4326;
    wkt: string;
    status: "detected";
  }>;
  profile: Readonly<{ code: string; version: number; classifierField: string }>;
  routing: ReturnType<typeof summarizeRouting>;
  sourceStatuses: ReadonlyArray<Readonly<{ value: string; count: number }>>;
  fields: ReadonlyArray<
    Readonly<{
      sourceName: string;
      suggestedKey: string;
      suggestedType: SuggestedFieldType;
      presentCount: number;
      appCodes: readonly string[];
    }>
  >;
  preview: Readonly<{
    type: "FeatureCollection";
    features: ReadonlyArray<Feature<Point, SourceProperties>>;
  }>;
}>;

export type ShapefileSourceRecord = Readonly<{
  geometry: Point;
  properties: SourceProperties;
}>;

export class InvalidShapefileArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidShapefileArchiveError";
  }
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot < 0 ? "" : fileName.slice(dot).toLowerCase();
}

function baseNameOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot < 0 ? fileName : fileName.slice(0, dot);
}

async function readEntry(
  zip: Awaited<ReturnType<typeof fromBufferPromise>>,
  entry: Entry,
) {
  const stream = await zip.openReadStreamPromise(entry);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function readShapefileParts(archive: Buffer) {
  const zip = await fromBufferPromise(archive, {
    decodeStrings: true,
    strictFileNames: true,
    validateEntrySizes: true,
  });
  try {
    if (zip.entryCount > MAX_ARCHIVE_ENTRIES) {
      throw new InvalidShapefileArchiveError(
        `El ZIP contiene más de ${MAX_ARCHIVE_ENTRIES} entradas.`,
      );
    }

    const entries = new Map<string, Entry>();
    let layerName = "";
    let uncompressedBytes = 0;
    for await (const entry of zip.eachEntry()) {
      if (entry.fileName.includes("/") || entry.fileName.includes("\\")) {
        throw new InvalidShapefileArchiveError(
          "El ZIP debe contener una sola capa en su nivel principal.",
        );
      }
      if (entry.isEncrypted() || !entry.canDecodeFileData()) {
        throw new InvalidShapefileArchiveError(
          "El ZIP contiene una entrada cifrada o no compatible.",
        );
      }
      uncompressedBytes += entry.uncompressedSize;
      if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
        throw new InvalidShapefileArchiveError(
          "El contenido descomprimido excede el límite de 100 MB.",
        );
      }
      if (
        entry.compressedSize > 0 &&
        entry.uncompressedSize / entry.compressedSize > MAX_COMPRESSION_RATIO
      ) {
        throw new InvalidShapefileArchiveError(
          "El ZIP tiene una relación de compresión insegura.",
        );
      }

      const extension = extensionOf(entry.fileName);
      if (!REQUIRED_EXTENSIONS.includes(extension as never)) continue;
      if (entries.has(extension)) {
        throw new InvalidShapefileArchiveError(
          `El ZIP contiene más de un archivo ${extension}.`,
        );
      }
      const candidateLayerName = baseNameOf(entry.fileName);
      if (
        layerName &&
        candidateLayerName.toLowerCase() !== layerName.toLowerCase()
      ) {
        throw new InvalidShapefileArchiveError(
          "Los componentes SHP, SHX, DBF y PRJ no pertenecen a la misma capa.",
        );
      }
      layerName = candidateLayerName;
      entries.set(extension, entry);
    }

    for (const extension of REQUIRED_EXTENSIONS) {
      if (!entries.has(extension)) {
        throw new InvalidShapefileArchiveError(
          `Falta el componente obligatorio ${extension}.`,
        );
      }
    }

    const shpEntry = entries.get(".shp");
    const dbfEntry = entries.get(".dbf");
    const prjEntry = entries.get(".prj");
    if (!shpEntry || !dbfEntry || !prjEntry) {
      throw new InvalidShapefileArchiveError("El Shapefile está incompleto.");
    }
    return {
      layerName,
      shp: await readEntry(zip, shpEntry),
      dbf: await readEntry(zip, dbfEntry),
      prj: await readEntry(zip, prjEntry),
    };
  } finally {
    zip.close();
  }
}

function detectWgs84(prj: Buffer) {
  const wkt = prj.toString("utf8").trim();
  if (!/GCS_WGS_1984|WGS[_ ]?1984/i.test(wkt)) {
    throw new InvalidShapefileArchiveError(
      "El CRS del archivo no se pudo identificar sin ambigüedad. Corrígelo antes de importar.",
    );
  }
  return {
    name: "WGS 84",
    epsg: 4326 as const,
    wkt,
    status: "detected" as const,
  };
}

function safeProperties(properties: Feature["properties"]): SourceProperties {
  if (!properties) return {};
  const result: SourceProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value instanceof Date
    ) {
      result[key] = value;
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

function inferFieldType(values: readonly SourceValue[]): SuggestedFieldType {
  const present = values.filter((value) => value !== null && value !== "");
  if (present.length && present.every((value) => value instanceof Date))
    return "date";
  if (present.length && present.every((value) => typeof value === "boolean"))
    return "boolean";
  if (present.length && present.every((value) => typeof value === "number")) {
    return present.every((value) => Number.isInteger(value))
      ? "integer"
      : "decimal";
  }
  return "text";
}

function suggestedKey(sourceName: string): string {
  const normalized = sourceName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^_+/, "source_")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return /^[a-z]/.test(normalized)
    ? normalized
    : `field_${normalized}`.slice(0, 64);
}

export async function readShapefileArchive(
  sourceFileName: string,
  archive: Buffer,
): Promise<
  Readonly<{
    inspection: ShapefileInspection;
    records: readonly ShapefileSourceRecord[];
  }>
> {
  let parts: Awaited<ReturnType<typeof readShapefileParts>>;
  try {
    parts = await readShapefileParts(archive);
  } catch (error: unknown) {
    if (error instanceof InvalidShapefileArchiveError) throw error;
    throw new InvalidShapefileArchiveError(
      "El ZIP está dañado o no tiene una estructura válida.",
    );
  }
  const crs = detectWgs84(parts.prj);
  const source = await openShapefile(parts.shp, parts.dbf, {
    encoding: "windows-1252",
  });
  const features: Array<Feature<Point, SourceProperties>> = [];
  const records: ShapefileSourceRecord[] = [];
  const statuses: unknown[] = [];
  const statusCounts = new Map<string, number>();
  const fieldValues = new Map<string, SourceValue[]>();
  const fieldApps = new Map<string, Set<string>>();
  let featureCount = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  while (true) {
    const item = await source.read();
    if (item.done) break;
    const feature = item.value;
    if (!feature.geometry || feature.geometry.type !== "Point") {
      throw new InvalidShapefileArchiveError(
        "La primera versión admite una capa homogénea de geometrías POINT.",
      );
    }
    const x = feature.geometry.coordinates[0];
    const y = feature.geometry.coordinates[1];
    if (x === undefined || y === undefined) {
      throw new InvalidShapefileArchiveError(
        `La geometría ${featureCount + 1} no contiene dos coordenadas.`,
      );
    }
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      x < -180 ||
      x > 180 ||
      y < -90 ||
      y > 90
    ) {
      throw new InvalidShapefileArchiveError(
        `La geometría ${featureCount + 1} no es válida para WGS 84.`,
      );
    }
    const properties = safeProperties(feature.properties);
    const sourceStatus = properties[TIGO_HFC_FTTH_V1.classifierField];
    statuses.push(sourceStatus);
    const statusLabel =
      typeof sourceStatus === "string" && sourceStatus.trim()
        ? sourceStatus.trim().toUpperCase()
        : "(VACÍO)";
    statusCounts.set(statusLabel, (statusCounts.get(statusLabel) ?? 0) + 1);
    const routing = classifySourceStatus(TIGO_HFC_FTTH_V1, sourceStatus);
    for (const [name, value] of Object.entries(properties)) {
      const values = fieldValues.get(name) ?? [];
      values.push(value);
      fieldValues.set(name, values);
      if (routing && value !== null && value !== "") {
        const appCodes = fieldApps.get(name) ?? new Set<string>();
        appCodes.add(routing.appCode);
        fieldApps.set(name, appCodes);
      }
    }
    if (features.length < MAX_PREVIEW_FEATURES) {
      features.push({
        type: "Feature",
        geometry: feature.geometry,
        properties,
      });
    }
    records.push({ geometry: feature.geometry, properties });
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    featureCount += 1;
  }

  if (!featureCount) {
    throw new InvalidShapefileArchiveError(
      "El Shapefile no contiene registros.",
    );
  }

  const inspection: ShapefileInspection = {
    checksumSha256: createHash("sha256").update(archive).digest("hex"),
    sourceFileName,
    layerName: parts.layerName,
    featureCount,
    geometryType: "Point",
    bbox: [minX, minY, maxX, maxY],
    crs,
    profile: {
      code: TIGO_HFC_FTTH_V1.code,
      version: TIGO_HFC_FTTH_V1.version,
      classifierField: TIGO_HFC_FTTH_V1.classifierField,
    },
    routing: summarizeRouting(TIGO_HFC_FTTH_V1, statuses),
    sourceStatuses: [...statusCounts].map(([value, count]) => ({
      value,
      count,
    })),
    fields: [...fieldValues].map(([sourceName, values]) => ({
      sourceName,
      suggestedKey: suggestedKey(sourceName),
      suggestedType: inferFieldType(values),
      presentCount: values.filter((value) => value !== null && value !== "")
        .length,
      appCodes: [...(fieldApps.get(sourceName) ?? [])],
    })),
    preview: { type: "FeatureCollection", features },
  };
  return { inspection, records };
}

export async function inspectShapefileArchive(
  sourceFileName: string,
  archive: Buffer,
): Promise<ShapefileInspection> {
  return (await readShapefileArchive(sourceFileName, archive)).inspection;
}
