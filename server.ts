import express, { Request, Response } from "express";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import * as shapefile from "shapefile";
import yauzl from "yauzl";
import {
  ACTIVE_SCALE,
  setActiveScale,
  getScaleMetrics,
  queryBoliviaSpatialNodes,
  queryBoliviaPagedRecords,
  getSingleNodeRecord,
  customRecordEdits,
  customProjectIncorporate,
} from "./server-gis-engine";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const PORT = 3000;

// --- IN-MEMORY OPERATIONAL DATABASE ---

interface TemplateVersion {
  id: string;
  template_id: string;
  version: number;
  schema_definition: any;
}

interface Template {
  id: string;
  name: string;
  version_id: string;
  schema_definition: any;
}

interface AppItem {
  id: string;
  name: string;
  dataset_id: string;
  template_version_id?: string;
}

interface ProjectItem {
  id: string;
  name: string;
}

interface CollectionItem {
  id: string;
  name: string;
  app_id?: string;
  local_project_id?: string;
  project_id?: string;
  project_app_id?: string;
  schema_definition: any;
  version: number;
}

interface BlockItem {
  id: string;
  name: string;
  app_ids: string[];
}

interface RecordEvent {
  id: string;
  record_id: string;
  project_record_id?: string;
  operation: string;
  snapshot: any;
  created_at: string;
}

interface RecordItem {
  id: string;
  dataset_id: string;
  schema_version_id: string;
  attributes: Record<string, any>;
  geometry: any; // GeoJSON
  revision: number;
  visibility: "restricted" | "published";
  lifecycle: "active" | "archived";
  origin: any;
  created_at: string;
  updated_at: string;
}

interface ProjectRecordItem {
  id: string;
  project_id: string;
  dataset_id: string;
  record_id: string;
  project_app_id?: string;
  schema_definition: any;
  attributes_override: Record<string, any>;
  project_attributes: Record<string, any>;
  geometry_override?: any;
  display_geometry_override?: any;
  revision: number;
  status: "active" | "removed";
  updated_at: string;
}

// Helper to build AppSchema
function createTemplateSchema(
  title: string,
  fields: Array<{
    id: string;
    key: string;
    label: string;
    type: string;
    required: boolean;
    options?: string[];
  }>,
  settings: {
    allowedGeometries: string[];
    mapColor: string;
    mapIcon: string;
  }
) {
  return {
    sections: [
      {
        id: `sec-${crypto.randomUUID().slice(0, 8)}`,
        title,
        fields,
      },
    ],
    type: "object",
    properties: fields.reduce((acc, f) => {
      acc[f.key] = {
        type: f.type === "number" ? "number" : "string",
        title: f.label,
        ...(f.options ? { enum: f.options } : {}),
      };
      return acc;
    }, {} as Record<string, any>),
    required: fields.filter((f) => f.required).map((f) => f.key),
    settings,
  };
}

// Initial Data
const templates: Template[] = [
  {
    id: "tpl-postes-v1",
    name: "Plantilla Postes de Red",
    version_id: "tplv-postes-1",
    schema_definition: createTemplateSchema(
      "Datos de Infraestructura de Postes",
      [
        { id: "f-cod", key: "codigo", label: "Código de Poste", type: "shortText", required: true },
        {
          id: "f-tipo",
          key: "tipo_poste",
          label: "Tipo de Poste",
          type: "singleChoice",
          required: true,
          options: ["Hormigón 9m", "Hormigón 11m", "Madera", "Metálico"],
        },
        { id: "f-alt", key: "altura_m", label: "Altura (metros)", type: "number", required: true },
        {
          id: "f-mat",
          key: "material",
          label: "Material",
          type: "singleChoice",
          required: false,
          options: ["Hormigón armado", "Hormigón centrifugado", "Acero galvanizado", "Madera tratada"],
        },
        {
          id: "f-est",
          key: "estado",
          label: "Estado Operativo",
          type: "singleChoice",
          required: true,
          options: ["Excelente", "Bueno", "Requiere Mantenimiento", "Crítico"],
        },
        {
          id: "f-prop",
          key: "propietario",
          label: "Empresa Propietaria",
          type: "singleChoice",
          required: true,
          options: ["DELAPAZ", "CRE", "ELFEC", "Tigo", "Hansa"],
        },
        { id: "f-obs", key: "observaciones", label: "Observaciones de Campo", type: "longText", required: false },
      ],
      {
        allowedGeometries: ["Point"],
        mapColor: "#e53e3e",
        mapIcon: "post",
      }
    ),
  },
  {
    id: "tpl-camaras-v1",
    name: "Plantilla Cámaras Subterráneas",
    version_id: "tplv-camaras-1",
    schema_definition: createTemplateSchema(
      "Datos de Cámaras Subterráneas",
      [
        { id: "f-cam-cod", key: "codigo", label: "Código Cámara", type: "shortText", required: true },
        {
          id: "f-cam-tipo",
          key: "tipo_camara",
          label: "Tipo de Cámara",
          type: "singleChoice",
          required: true,
          options: ["Paso", "Distribución", "Empalme"],
        },
        { id: "f-cam-dim", key: "dimensiones", label: "Dimensiones (cm)", type: "shortText", required: false },
        {
          id: "f-cam-est",
          key: "estado",
          label: "Estado",
          type: "singleChoice",
          required: true,
          options: ["Operativo", "Inundada", "Dañada", "En Mantenimiento"],
        },
        { id: "f-cam-tapa", key: "tapa_tipo", label: "Tipo de Tapa", type: "shortText", required: false },
        { id: "f-cam-obs", key: "observaciones", label: "Observaciones", type: "longText", required: false },
      ],
      {
        allowedGeometries: ["Point"],
        mapColor: "#38a169",
        mapIcon: "box",
      }
    ),
  },
  {
    id: "tpl-fibra-v1",
    name: "Plantilla Trazado de Fibra",
    version_id: "tplv-fibra-1",
    schema_definition: createTemplateSchema(
      "Datos de Trazado de Fibra Óptica",
      [
        { id: "f-fo-cod", key: "codigo_tramo", label: "Código Tramo", type: "shortText", required: true },
        { id: "f-fo-hilos", key: "capacidad_hilos", label: "Hilos de Fibra", type: "number", required: true },
        {
          id: "f-fo-tipo",
          key: "tipo_tendido",
          label: "Tipo Tendido",
          type: "singleChoice",
          required: true,
          options: ["Aéreo", "Subterráneo", "Canalizado"],
        },
        { id: "f-fo-tec", key: "tecnologia", label: "Tecnología", type: "shortText", required: true },
        {
          id: "f-fo-est",
          key: "estado",
          label: "Estado del Tramo",
          type: "singleChoice",
          required: true,
          options: ["Operativo", "En Construcción", "Averiado", "Planificado"],
        },
        { id: "f-fo-long", key: "longitud_m", label: "Longitud (m)", type: "number", required: false },
      ],
      {
        allowedGeometries: ["LineString"],
        mapColor: "#3182ce",
        mapIcon: "cable",
      }
    ),
  },
  {
    id: "tpl-taps-v1",
    name: "Plantilla Cajas Terminales Ópticas (TAPs FTTH)",
    version_id: "tplv-taps-1",
    schema_definition: createTemplateSchema(
      "Datos de Cajas Terminales Ópticas (TAPs)",
      [
        { id: "f-tap-cod", key: "codigo", label: "Código TAP", type: "shortText", required: true },
        {
          id: "f-tap-cap",
          key: "capacidad_puertos",
          label: "Capacidad de Puertos",
          type: "singleChoice",
          required: true,
          options: ["8 Puertos Drop", "16 Puertos Drop"],
        },
        { id: "f-tap-ocu", key: "puertos_ocupados", label: "Puertos Conectados", type: "number", required: true },
        { id: "f-tap-lib", key: "puertos_libres", label: "Puertos Disponibles", type: "number", required: true },
        { id: "f-tap-pwr", key: "atenuacion_dbm", label: "Atenuación Óptica (dBm)", type: "number", required: true },
        {
          id: "f-tap-spl",
          key: "nivel_split",
          label: "Nivel de Splitter",
          type: "singleChoice",
          required: true,
          options: ["Segundo Nivel (1:8)", "Segundo Nivel (1:16)"],
        },
        {
          id: "f-tap-est",
          key: "estado",
          label: "Estado Operativo",
          type: "singleChoice",
          required: true,
          options: ["Operativo Comercial", "Saturado (100% Ocupado)", "En Mantenimiento", "Planificado"],
        },
        { id: "f-tap-post", key: "codigo_poste", label: "Poste de Soporte", type: "shortText", required: false },
        { id: "f-tap-zona", key: "zona", label: "Zona / Barrio", type: "shortText", required: false },
      ],
      {
        allowedGeometries: ["Point"],
        mapColor: "#0284c7",
        mapIcon: "diamond",
      }
    ),
  },
  {
    id: "tpl-splitters-v1",
    name: "Plantilla Divisores Ópticos (Splitters)",
    version_id: "tplv-splitters-1",
    schema_definition: createTemplateSchema(
      "Datos de Divisores Ópticos (Splitters)",
      [
        { id: "f-spl-cod", key: "codigo", label: "Código Splitter", type: "shortText", required: true },
        {
          id: "f-spl-rel",
          key: "relacion_division",
          label: "Relación de División",
          type: "singleChoice",
          required: true,
          options: ["1:4", "1:8", "1:16", "1:32"],
        },
        {
          id: "f-spl-tec",
          key: "tecnologia",
          label: "Tecnología",
          type: "singleChoice",
          required: true,
          options: ["PLC Balanced", "FBT Coupler"],
        },
        { id: "f-spl-loss", key: "perdida_insercion_db", label: "Pérdida Inserción (dB)", type: "number", required: true },
        { id: "f-spl-lam", key: "longitud_onda", label: "Longitud de Onda", type: "shortText", required: false },
        {
          id: "f-spl-ubi",
          key: "ubicacion",
          label: "Ubicación Física",
          type: "singleChoice",
          required: true,
          options: ["Caja Terminal TAP", "Mufa Aérea FOSC", "Armario ODF Cabecera"],
        },
        {
          id: "f-spl-est",
          key: "estado",
          label: "Estado",
          type: "singleChoice",
          required: true,
          options: ["Operativo Calibrado", "Atenuación Alta", "Reserva"],
        },
      ],
      {
        allowedGeometries: ["Point"],
        mapColor: "#7c3aed",
        mapIcon: "hexagon",
      }
    ),
  },
  {
    id: "tpl-mufas-v1",
    name: "Plantilla Mufas de Empalme FOSC",
    version_id: "tplv-mufas-1",
    schema_definition: createTemplateSchema(
      "Datos de Mufas de Empalme FOSC",
      [
        { id: "f-muf-cod", key: "codigo", label: "Código Mufa", type: "shortText", required: true },
        {
          id: "f-muf-tipo",
          key: "tipo_caja",
          label: "Tipo de Mufa",
          type: "singleChoice",
          required: true,
          options: ["Domo Vertical IP68", "Torpedo Horizontal"],
        },
        {
          id: "f-muf-cap",
          key: "capacidad_fusiones",
          label: "Capacidad Fusiones",
          type: "singleChoice",
          required: true,
          options: ["24 Fusiones", "48 Fusiones", "96 Fusiones", "144 Fusiones"],
        },
        { id: "f-muf-ban", key: "bandejas_usadas", label: "Bandejas Utilizadas", type: "shortText", required: false },
        {
          id: "f-muf-ins",
          key: "tipo_instalacion",
          label: "Tipo de Instalación",
          type: "singleChoice",
          required: true,
          options: ["Aérea en Poste", "Cámara Subterránea"],
        },
        { id: "f-muf-cab", key: "cable_troncal", label: "Cable Sangrado", type: "shortText", required: false },
        {
          id: "f-muf-est",
          key: "estado",
          label: "Estado Estanqueidad",
          type: "singleChoice",
          required: true,
          options: ["Sellado Estanco Conforme", "En Intervención Cuadrilla", "Revisión"],
        },
      ],
      {
        allowedGeometries: ["Point"],
        mapColor: "#ea580c",
        mapIcon: "splice",
      }
    ),
  },
];

const apps: AppItem[] = [
  {
    id: "app-postes",
    name: "Postes de Soporte y Distribución",
    dataset_id: "ds-postes",
    template_version_id: "tplv-postes-1",
  },
  {
    id: "app-taps",
    name: "Cajas Terminales Ópticas (TAPs FTTH)",
    dataset_id: "ds-taps",
    template_version_id: "tplv-taps-1",
  },
  {
    id: "app-splitters",
    name: "Divisores Ópticos (Splitters)",
    dataset_id: "ds-splitters",
    template_version_id: "tplv-splitters-1",
  },
  {
    id: "app-mufas",
    name: "Mufas de Empalme FOSC",
    dataset_id: "ds-mufas",
    template_version_id: "tplv-mufas-1",
  },
  {
    id: "app-camaras",
    name: "Cámaras Subterráneas",
    dataset_id: "ds-camaras",
    template_version_id: "tplv-camaras-1",
  },
  {
    id: "app-fibra",
    name: "Tramos Fibra Óptica",
    dataset_id: "ds-fibra",
    template_version_id: "tplv-fibra-1",
  },
  {
    id: "app-cobertura",
    name: "Zonas de Cobertura Tigo",
    dataset_id: "ds-cobertura",
  },
];

const projects: ProjectItem[] = [
  { id: "proj-ftth-nacional", name: "Proyecto Nacional FTTH Expansión Bolivia (2M Nodos)" },
  { id: "proj-lapaz", name: "Despliegue FTTH La Paz & El Alto" },
  { id: "proj-santacruz", name: "Mantenimiento & Expansión FTTH Santa Cruz" },
  { id: "proj-cbba", name: "Relevamiento & Red FTTH Cochabamba" },
];

const schemaCobertura = createTemplateSchema(
  "Datos de Polígono de Cobertura",
  [
    { id: "f-cob-dis", key: "distrito", label: "Distrito / Barrio", type: "shortText", required: true },
    { id: "f-cob-tec", key: "tecnologia", label: "Tecnología Red", type: "shortText", required: true },
    { id: "f-cob-hp", key: "hogares_pasados", label: "Hogares Pasados (HP)", type: "number", required: true },
    { id: "f-cob-est", key: "estado", label: "Estado Cobertura", type: "shortText", required: true },
  ],
  {
    allowedGeometries: ["Polygon"],
    mapColor: "#dd6b20",
    mapIcon: "diamond",
  }
);

const collections: CollectionItem[] = [
  {
    id: "ds-postes",
    name: "Postes de Soporte y Distribución",
    app_id: "app-postes",
    schema_definition: templates[0].schema_definition,
    version: 1,
  },
  {
    id: "ds-taps",
    name: "Cajas Terminales Ópticas (TAPs FTTH)",
    app_id: "app-taps",
    schema_definition: templates[3]?.schema_definition || templates[0].schema_definition,
    version: 1,
  },
  {
    id: "ds-splitters",
    name: "Divisores Ópticos (Splitters)",
    app_id: "app-splitters",
    schema_definition: templates[4]?.schema_definition || templates[0].schema_definition,
    version: 1,
  },
  {
    id: "ds-mufas",
    name: "Mufas de Empalme FOSC",
    app_id: "app-mufas",
    schema_definition: templates[5]?.schema_definition || templates[0].schema_definition,
    version: 1,
  },
  {
    id: "ds-camaras",
    name: "Cámaras Subterráneas",
    app_id: "app-camaras",
    schema_definition: templates[1].schema_definition,
    version: 1,
  },
  {
    id: "ds-fibra",
    name: "Tramos Fibra Óptica",
    app_id: "app-fibra",
    schema_definition: templates[2].schema_definition,
    version: 1,
  },
  {
    id: "ds-cobertura",
    name: "Zonas de Cobertura Tigo",
    app_id: "app-cobertura",
    schema_definition: schemaCobertura,
    version: 1,
  },
  // Project-linked apps for Nacional FTTH
  {
    id: "ds-postes-nacional",
    name: "Postes (Proyecto Nacional FTTH)",
    app_id: "app-postes",
    project_id: "proj-ftth-nacional",
    project_app_id: "pa-postes-nacional",
    schema_definition: templates[0].schema_definition,
    version: 1,
  },
  {
    id: "ds-taps-nacional",
    name: "TAPs FTTH (Proyecto Nacional)",
    app_id: "app-taps",
    project_id: "proj-ftth-nacional",
    project_app_id: "pa-taps-nacional",
    schema_definition: templates[3]?.schema_definition || templates[0].schema_definition,
    version: 1,
  },
  {
    id: "ds-splitters-nacional",
    name: "Splitters (Proyecto Nacional)",
    app_id: "app-splitters",
    project_id: "proj-ftth-nacional",
    project_app_id: "pa-splitters-nacional",
    schema_definition: templates[4]?.schema_definition || templates[0].schema_definition,
    version: 1,
  },
  {
    id: "ds-mufas-nacional",
    name: "Mufas (Proyecto Nacional)",
    app_id: "app-mufas",
    project_id: "proj-ftth-nacional",
    project_app_id: "pa-mufas-nacional",
    schema_definition: templates[5]?.schema_definition || templates[0].schema_definition,
    version: 1,
  },
  // Project-linked apps La Paz
  {
    id: "ds-postes-lapaz",
    name: "Postes (Proyecto La Paz)",
    app_id: "app-postes",
    project_id: "proj-lapaz",
    project_app_id: "pa-postes-lapaz",
    schema_definition: templates[0].schema_definition,
    version: 1,
  },
  {
    id: "ds-fibra-lapaz",
    name: "Fibra Óptica (Proyecto La Paz)",
    app_id: "app-fibra",
    project_id: "proj-lapaz",
    project_app_id: "pa-fibra-lapaz",
    schema_definition: templates[2].schema_definition,
    version: 1,
  },
  {
    id: "ds-postes-santacruz",
    name: "Postes (Proyecto Santa Cruz)",
    app_id: "app-postes",
    project_id: "proj-santacruz",
    project_app_id: "pa-postes-santacruz",
    schema_definition: templates[0].schema_definition,
    version: 1,
  },
];

const blocks: BlockItem[] = [
  {
    id: "block-infra-pasiva",
    name: "Infraestructura Pasiva y Soporte",
    app_ids: ["app-postes", "app-camaras"],
  },
  {
    id: "block-red-ftth",
    name: "Red de Acceso FTTH (TAPs, Splitters, Mufas)",
    app_ids: ["app-taps", "app-splitters", "app-mufas"],
  },
  {
    id: "block-red-transporte",
    name: "Transporte Óptico y Cobertura",
    app_ids: ["app-fibra", "app-cobertura"],
  },
];

const records: RecordItem[] = [
  // --- LA PAZ: POSTES EN ZONA SUR (Calacoto / San Miguel) ---
  {
    id: "rec-post-001",
    dataset_id: "ds-postes",
    schema_version_id: "v1",
    attributes: {
      codigo: "P-LPZ-0101",
      tipo_poste: "Hormigón 9m",
      altura_m: 9,
      material: "Hormigón armado",
      estado: "Bueno",
      propietario: "DELAPAZ",
      observaciones: "Av. Ballivián e/ Calles 12 y 13. Con reserva de fibra óptica en espiral.",
    },
    geometry: { type: "Point", coordinates: [-68.0832, -16.5385] },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rec-post-002",
    dataset_id: "ds-postes",
    schema_version_id: "v1",
    attributes: {
      codigo: "P-LPZ-0102",
      tipo_poste: "Hormigón 9m",
      altura_m: 9,
      material: "Hormigón armado",
      estado: "Excelente",
      propietario: "Tigo",
      observaciones: "Av. Ballivián y Calle 15. Caja NAP-16 instalada y rotulada.",
    },
    geometry: { type: "Point", coordinates: [-68.0841, -16.5392] },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date(Date.now() - 3600000 * 24 * 4).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rec-post-003",
    dataset_id: "ds-postes",
    schema_version_id: "v1",
    attributes: {
      codigo: "P-LPZ-0103",
      tipo_poste: "Hormigón 11m",
      altura_m: 11,
      material: "Hormigón centrifugado",
      estado: "Requiere Mantenimiento",
      propietario: "DELAPAZ",
      observaciones: "Av. Ballivián y Calle 18. Llegada de cable troncal de 96 hilos.",
    },
    geometry: { type: "Point", coordinates: [-68.0853, -16.5401] },
    revision: 2,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rec-post-004",
    dataset_id: "ds-postes",
    schema_version_id: "v1",
    attributes: {
      codigo: "P-LPZ-0104",
      tipo_poste: "Hormigón 11m",
      altura_m: 11,
      material: "Hormigón armado",
      estado: "Bueno",
      propietario: "DELAPAZ",
      observaciones: "Av. Ballivián y Calle 21. Esquinero de cruce con riostra.",
    },
    geometry: { type: "Point", coordinates: [-68.0865, -16.5412] },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rec-post-005",
    dataset_id: "ds-postes",
    schema_version_id: "v1",
    attributes: {
      codigo: "P-LPZ-0105",
      tipo_poste: "Metálico",
      altura_m: 8,
      material: "Acero galvanizado",
      estado: "Excelente",
      propietario: "Tigo",
      observaciones: "Calle 21 de Calacoto y Montenegro. Cruce peatonal y mufa FOSC-400.",
    },
    geometry: { type: "Point", coordinates: [-68.085, -16.542] },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rec-post-006",
    dataset_id: "ds-postes",
    schema_version_id: "v1",
    attributes: {
      codigo: "P-LPZ-0106",
      tipo_poste: "Hormigón 9m",
      altura_m: 9,
      material: "Hormigón armado",
      estado: "Bueno",
      propietario: "Hansa",
      observaciones: "San Miguel, Calle René Moreno. Acometidas domiciliarias activas.",
    },
    geometry: { type: "Point", coordinates: [-68.0842, -16.543] },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rec-post-007",
    dataset_id: "ds-postes",
    schema_version_id: "v1",
    attributes: {
      codigo: "P-LPZ-0107",
      tipo_poste: "Hormigón 9m",
      altura_m: 9,
      material: "Hormigón armado",
      estado: "Bueno",
      propietario: "Tigo",
      observaciones: "San Miguel, Plaza Triangular y Calle Jaime Mendoza.",
    },
    geometry: { type: "Point", coordinates: [-68.0835, -16.544] },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rec-post-008",
    dataset_id: "ds-postes",
    schema_version_id: "v1",
    attributes: {
      codigo: "P-LPZ-0108",
      tipo_poste: "Hormigón 11m",
      altura_m: 11,
      material: "Hormigón centrifugado",
      estado: "Bueno",
      propietario: "DELAPAZ",
      observaciones: "Bajada Plaza Humboldt y Av. Costanera. Cruce de río.",
    },
    geometry: { type: "Point", coordinates: [-68.0878, -16.5425] },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },

  // --- SANTA CRUZ: POSTES EN EQUIPETROL ---
  {
    id: "rec-post-scz-01",
    dataset_id: "ds-postes",
    schema_version_id: "v1",
    attributes: {
      codigo: "P-SCZ-0891",
      tipo_poste: "Hormigón 11m",
      altura_m: 11,
      material: "Hormigón centrifugado",
      estado: "Excelente",
      propietario: "CRE",
      observaciones: "Av. San Martín e/ 2do y 3er Anillo. Troncal FO Hansa.",
    },
    geometry: { type: "Point", coordinates: [-63.1952, -17.7654] },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rec-post-scz-02",
    dataset_id: "ds-postes",
    schema_version_id: "v1",
    attributes: {
      codigo: "P-SCZ-0892",
      tipo_poste: "Hormigón 9m",
      altura_m: 9,
      material: "Hormigón armado",
      estado: "Bueno",
      propietario: "CRE",
      observaciones: "Av. San Martín y Calle 4 Oeste. Distribución Equipetrol.",
    },
    geometry: { type: "Point", coordinates: [-63.1942, -17.7661] },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rec-post-scz-03",
    dataset_id: "ds-postes",
    schema_version_id: "v1",
    attributes: {
      codigo: "P-SCZ-0893",
      tipo_poste: "Metálico",
      altura_m: 8,
      material: "Acero galvanizado",
      estado: "Bueno",
      propietario: "Tigo",
      observaciones: "Calle Las Begonias (Sirari). Transición subterránea a aérea.",
    },
    geometry: { type: "Point", coordinates: [-63.1931, -17.7668] },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rec-post-scz-04",
    dataset_id: "ds-postes",
    schema_version_id: "v1",
    attributes: {
      codigo: "P-SCZ-0894",
      tipo_poste: "Hormigón 11m",
      altura_m: 11,
      material: "Hormigón centrifugado",
      estado: "Excelente",
      propietario: "CRE",
      observaciones: "Av. San Martín y 3er Anillo Interno. Torreta de paso.",
    },
    geometry: { type: "Point", coordinates: [-63.1908, -17.7682] },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },

  // --- CÁMARAS SUBTERRÁNEAS (LA PAZ & SANTA CRUZ) ---
  {
    id: "rec-cam-001",
    dataset_id: "ds-camaras",
    schema_version_id: "v1",
    attributes: {
      codigo: "CAM-LPZ-01",
      tipo_camara: "Distribución",
      dimensiones: "80x80x100",
      estado: "Operativo",
      tapa_tipo: "Fundición D400 tráfico pesado",
      observaciones: "Av. Ballivián y Calle 12. Salida de tritubo hacia postes.",
    },
    geometry: { type: "Point", coordinates: [-68.0832, -16.5385] },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rec-cam-002",
    dataset_id: "ds-camaras",
    schema_version_id: "v1",
    attributes: {
      codigo: "CAM-LPZ-02",
      tipo_camara: "Empalme",
      dimensiones: "100x100x120",
      estado: "Operativo",
      tapa_tipo: "Fundición D400",
      observaciones: "Av. Ballivián y Calle 18. Mufa subterránea IP68.",
    },
    geometry: { type: "Point", coordinates: [-68.0853, -16.5401] },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rec-cam-003",
    dataset_id: "ds-camaras",
    schema_version_id: "v1",
    attributes: {
      codigo: "CAM-LPZ-03",
      tipo_camara: "Paso",
      dimensiones: "60x60x80",
      estado: "Operativo",
      tapa_tipo: "Concreto reforzado",
      observaciones: "San Miguel, Calle Montenegro. Caja de inspección de ductos.",
    },
    geometry: { type: "Point", coordinates: [-68.085, -16.542] },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rec-cam-004",
    dataset_id: "ds-camaras",
    schema_version_id: "v1",
    attributes: {
      codigo: "CAM-SCZ-01",
      tipo_camara: "Empalme",
      dimensiones: "120x120x140",
      estado: "Operativo",
      tapa_tipo: "Hierro dúctil D400",
      observaciones: "Av. San Martín y 2do Anillo Equipetrol.",
    },
    geometry: { type: "Point", coordinates: [-63.1952, -17.7654] },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },

  // --- TRAMOS DE FIBRA ÓPTICA (LINESTRING) ---
  {
    id: "rec-fo-001",
    dataset_id: "ds-fibra",
    schema_version_id: "v1",
    attributes: {
      codigo_tramo: "FO-LPZ-SUR-TRONCAL-01",
      capacidad_hilos: 96,
      tipo_tendido: "Aéreo",
      tecnologia: "G.652.D",
      estado: "Operativo",
      longitud_m: 950,
    },
    geometry: {
      type: "LineString",
      coordinates: [
        [-68.0832, -16.5385],
        [-68.0841, -16.5392],
        [-68.0853, -16.5401],
        [-68.0865, -16.5412],
      ],
    },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rec-fo-002",
    dataset_id: "ds-fibra",
    schema_version_id: "v1",
    attributes: {
      codigo_tramo: "FO-LPZ-SANMIGUEL-RAMAL",
      capacidad_hilos: 48,
      tipo_tendido: "Aéreo",
      tecnologia: "G.652.D",
      estado: "Operativo",
      longitud_m: 540,
    },
    geometry: {
      type: "LineString",
      coordinates: [
        [-68.0865, -16.5412],
        [-68.085, -16.542],
        [-68.0842, -16.543],
        [-68.0835, -16.544],
      ],
    },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rec-fo-scz-01",
    dataset_id: "ds-fibra",
    schema_version_id: "v1",
    attributes: {
      codigo_tramo: "FO-SCZ-EQUIPETROL-04",
      capacidad_hilos: 72,
      tipo_tendido: "Canalizado",
      tecnologia: "G.652.D",
      estado: "Operativo",
      longitud_m: 820,
    },
    geometry: {
      type: "LineString",
      coordinates: [
        [-63.1952, -17.7654],
        [-63.1942, -17.7661],
        [-63.1931, -17.7668],
        [-63.1908, -17.7682],
      ],
    },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },

  // --- ZONAS DE COBERTURA (POLYGON) ---
  {
    id: "rec-poly-calacoto",
    dataset_id: "ds-cobertura",
    schema_version_id: "v1",
    attributes: {
      distrito: "Calacoto - San Miguel (La Paz)",
      tecnologia: "GPON FTTH",
      hogares_pasados: 1450,
      estado: "Servicio Comercial Activo",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-68.0815, -16.5365],
          [-68.09, -16.5395],
          [-68.0885, -16.546],
          [-68.0805, -16.545],
          [-68.0815, -16.5365],
        ],
      ],
    },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rec-poly-scz-01",
    dataset_id: "ds-cobertura",
    schema_version_id: "v1",
    attributes: {
      distrito: "Equipetrol Norte / Sirari (Santa Cruz)",
      tecnologia: "GPON FTTH",
      hogares_pasados: 980,
      estado: "Servicio Comercial Activo",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-63.1975, -17.7635],
          [-63.189, -17.7655],
          [-63.1915, -17.771],
          [-63.1995, -17.769],
          [-63.1975, -17.7635],
        ],
      ],
    },
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    origin: { type: "manual" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const projectRecords: ProjectRecordItem[] = [
  {
    id: "prec-post-001",
    project_id: "proj-lapaz",
    dataset_id: "ds-postes",
    record_id: "rec-post-001",
    project_app_id: "pa-postes-lapaz",
    schema_definition: templates[0].schema_definition,
    attributes_override: {},
    project_attributes: { asignado_cuadrilla: "Cuadrilla Hansa Sur 1", fecha_relevamiento: "2026-09-08" },
    revision: 1,
    status: "active",
    updated_at: new Date().toISOString(),
  },
  {
    id: "prec-post-002",
    project_id: "proj-lapaz",
    dataset_id: "ds-postes",
    record_id: "rec-post-002",
    project_app_id: "pa-postes-lapaz",
    schema_definition: templates[0].schema_definition,
    attributes_override: {},
    project_attributes: { asignado_cuadrilla: "Cuadrilla Hansa Sur 1", fecha_relevamiento: "2026-09-08" },
    revision: 1,
    status: "active",
    updated_at: new Date().toISOString(),
  },
  {
    id: "prec-fo-001",
    project_id: "proj-lapaz",
    dataset_id: "ds-fibra",
    record_id: "rec-fo-001",
    project_app_id: "pa-fibra-lapaz",
    schema_definition: templates[2].schema_definition,
    attributes_override: {},
    project_attributes: { cuadrilla_tendido: "Redes Ópticas Hansa", ot_numero: "OT-88341" },
    revision: 1,
    status: "active",
    updated_at: new Date().toISOString(),
  },
  {
    id: "prec-scz-01",
    project_id: "proj-santacruz",
    dataset_id: "ds-postes",
    record_id: "rec-post-scz-01",
    project_app_id: "pa-postes-santacruz",
    schema_definition: templates[0].schema_definition,
    attributes_override: {},
    project_attributes: { cuadrilla: "Oriente 2", fase: "Inspección inicial" },
    revision: 1,
    status: "active",
    updated_at: new Date().toISOString(),
  },
];

const recordEvents: RecordEvent[] = [
  {
    id: "rev-001",
    record_id: "rec-post-001",
    operation: "create",
    snapshot: records[0],
    created_at: records[0].created_at,
  },
  {
    id: "rev-002",
    record_id: "rec-post-003",
    operation: "update",
    snapshot: records[2],
    created_at: records[2].created_at,
  },
];

// Import Inspections Cache
interface StoredInspection {
  id: string;
  filename: string;
  count: number;
  fields: string[];
  statuses: [string, number][];
  crs: string;
  rows: any[];
}
const inspections = new Map<string, StoredInspection>();

// Segmentation in-memory store
const segmentationSchemes = [
  {
    id: "sch-tigo-operaciones",
    name: "Estructura Territorial Hansa Tigo",
    description: "Organización jerárquica para cuadrillas y cobertura de campo",
    levels: [
      { id: "lvl-1", name: "Región", depth: 1 },
      { id: "lvl-2", name: "Ciudad", depth: 2 },
      { id: "lvl-3", name: "Distrito", depth: 3 },
      { id: "lvl-4", name: "Cuadrilla", depth: 4 },
    ],
    segments: [
      { id: "seg-occidente", name: "Occidente", level_id: "lvl-1", parent_id: null },
      { id: "seg-oriente", name: "Oriente", level_id: "lvl-1", parent_id: null },
      { id: "seg-lapaz", name: "La Paz", level_id: "lvl-2", parent_id: "seg-occidente" },
      { id: "seg-scz", name: "Santa Cruz", level_id: "lvl-2", parent_id: "seg-oriente" },
      { id: "seg-calacoto", name: "Zona Sur / Calacoto", level_id: "lvl-3", parent_id: "seg-lapaz" },
      { id: "seg-equipetrol", name: "Equipetrol / Norte", level_id: "lvl-3", parent_id: "seg-scz" },
      { id: "seg-cuad-sur1", name: "Cuadrilla Sur 1 (FTTH)", level_id: "lvl-4", parent_id: "seg-calacoto" },
    ],
    memberships: [
      { id: "mem-1", segment_id: "seg-cuad-sur1", record_id: "rec-post-001" },
      { id: "mem-2", segment_id: "seg-cuad-sur1", record_id: "rec-post-002" },
      { id: "mem-3", segment_id: "seg-cuad-sur1", record_id: "rec-fo-001" },
    ],
  },
];

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // --- API ROUTES ---

  // Health Check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      version: "1.0.0",
      postgis: "Mock-In-Memory-GIS / WGS84",
      recordsCount: records.length,
    });
  });

  // 1. Catalog
  app.get("/api/workspace", (_req: Request, res: Response) => {
    res.json({
      templates,
      apps,
      projects,
      collections,
      blocks,
    });
  });

  // 2. Apps
  app.post("/api/workspace/apps", (req: Request, res: Response) => {
    const { name, templateVersionId, schemaDefinition } = req.body || {};
    if (!name) {
      res.status(400).json({ message: "Nombre de App requerido" });
      return;
    }
    const appId = `app-${crypto.randomUUID().slice(0, 8)}`;
    const datasetId = `ds-${crypto.randomUUID().slice(0, 8)}`;
    const appItem: AppItem = {
      id: appId,
      name,
      dataset_id: datasetId,
      template_version_id: templateVersionId,
    };
    apps.push(appItem);

    const schema =
      schemaDefinition ||
      (templateVersionId
        ? templates.find((t) => t.version_id === templateVersionId)?.schema_definition
        : {
            type: "object",
            properties: {
              codigo: { type: "string", title: "Código" },
              estado: { type: "string", title: "Estado" },
            },
            settings: { allowedGeometries: ["Point"] },
          });

    collections.push({
      id: datasetId,
      name,
      app_id: appId,
      schema_definition: schema,
      version: 1,
    });

    res.json(appItem);
  });

  // 3. Projects
  app.post("/api/workspace/projects", (req: Request, res: Response) => {
    const { name } = req.body || {};
    if (!name) {
      res.status(400).json({ message: "Nombre de proyecto requerido" });
      return;
    }
    const project: ProjectItem = {
      id: `proj-${crypto.randomUUID().slice(0, 8)}`,
      name,
    };
    projects.push(project);
    res.json(project);
  });

  // 4. Relate App to Project
  app.post("/api/workspace/projects/:projectId/apps", (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { appId } = req.body || {};
    const appItem = apps.find((a) => a.id === appId);
    if (!appItem) {
      res.status(404).json({ message: "App no encontrada" });
      return;
    }
    const existing = collections.find(
      (c) => c.app_id === appId && c.project_id === projectId
    );
    if (!existing) {
      const paId = `pa-${crypto.randomUUID().slice(0, 8)}`;
      const dsId = `ds-${crypto.randomUUID().slice(0, 8)}`;
      const baseColl = collections.find((c) => c.app_id === appId && !c.project_id);
      collections.push({
        id: dsId,
        name: `${appItem.name} (${projects.find((p) => p.id === projectId)?.name || "Proyecto"})`,
        app_id: appId,
        project_id: projectId,
        project_app_id: paId,
        schema_definition: baseColl?.schema_definition || {},
        version: 1,
      });
    }
    res.json({ status: "linked", projectId, appId });
  });

  // 5. Local Collections in Project
  app.post(
    "/api/workspace/projects/:projectId/collections",
    (req: Request, res: Response) => {
      const { projectId } = req.params;
      const { name, schemaDefinition } = req.body || {};
      const id = `ds-local-${crypto.randomUUID().slice(0, 8)}`;
      const coll: CollectionItem = {
        id,
        name: name || "Capa Local",
        local_project_id: projectId,
        schema_definition: schemaDefinition || {
          type: "object",
          properties: {
            nombre: { type: "string", title: "Nombre" },
          },
        },
        version: 1,
      };
      collections.push(coll);
      res.json(coll);
    }
  );

  // 6. Schema Update
  app.post(
    "/api/workspace/datasets/:datasetId/schema",
    (req: Request, res: Response) => {
      const { datasetId } = req.params;
      const { schemaDefinition } = req.body || {};
      const coll = collections.find((c) => c.id === datasetId);
      if (!coll) {
        res.status(404).json({ message: "Dataset no encontrado" });
        return;
      }
      coll.schema_definition = schemaDefinition;
      coll.version = (coll.version || 1) + 1;
      res.json({ status: "updated", version: coll.version });
    }
  );

  // Scale metrics & configuration endpoint
  app.get("/api/workspace/scale", (req: Request, res: Response) => {
    res.json({
      activeScale: ACTIVE_SCALE,
      metrics: getScaleMetrics(ACTIVE_SCALE),
    });
  });

  app.post("/api/workspace/scale", (req: Request, res: Response) => {
    const { scale } = req.body || {};
    const newScale = Number(scale) || 1000000;
    setActiveScale(newScale);
    res.json({
      activeScale: newScale,
      metrics: getScaleMetrics(newScale),
    });
  });

  // 7. Get Records (Paged, filtered with GIS Virtualization for 1M-2M records)
  app.get("/api/workspace/records", (req: Request, res: Response) => {
    const {
      datasetId,
      projectId,
      projectIds,
      appIds,
      localCollectionIds,
      mode = "all",
      limit = "100",
      search,
    } = req.query;

    const maxLimit = Math.min(parseInt(limit as string, 10) || 100, 500);
    const offset = parseInt((req.query.cursor || req.query.offset || "0") as string, 10) || 0;
    const targetProject = (projectId as string) || (projectIds ? String(projectIds).split(",")[0] : "");

    // Network GIS layer IDs that scale to millions
    const networkDatasets = new Set(["ds-postes", "ds-taps", "ds-splitters", "ds-mufas", "ds-camaras"]);
    const isNetworkQuery =
      !datasetId ||
      networkDatasets.has(datasetId as string) ||
      targetProject === "proj-ftth-nacional" ||
      mode === "all";

    if (isNetworkQuery && (!datasetId || networkDatasets.has(datasetId as string))) {
      const paged = queryBoliviaPagedRecords(
        datasetId as string,
        targetProject || undefined,
        (search as string) || undefined,
        maxLimit,
        offset
      );

      // Prepend any manual custom records
      const createdMatches = records.filter(
        (r) => !datasetId || r.dataset_id === datasetId
      );

      const rows = offset === 0 ? [...createdMatches, ...paged.rows].slice(0, maxLimit) : paged.rows;
      const data = rows.map((r) => ({
        id: r.id,
        recordUuid: r.recordUuid || r.record_id || r.id,
        projectRecordUuid: r.projectRecordUuid || r.project_record_id || null,
        projectAppId: r.projectAppId || r.project_app_id || null,
        datasetId: r.datasetId || r.dataset_id,
        revision: r.revision || 1,
        attributes: r.attributes || {},
        geometry: r.geometry,
      }));

      return res.json({
        data,
        rows,
        totalRecords: paged.totalRecords + createdMatches.length,
        total: paged.totalRecords + createdMatches.length,
        nextCursor: paged.nextCursor,
        scale: paged.scale,
      });
    }

    let matchingRows: any[] = [];

    if (targetProject && mode === "project") {
      // Return project participation records
      matchingRows = projectRecords
        .filter((pr) => pr.project_id === targetProject && pr.status === "active")
        .map((pr) => {
          let rec = records.find((r) => r.id === pr.record_id);
          if (!rec) rec = getSingleNodeRecord(pr.record_id);
          const coll = collections.find((c) => c.id === pr.dataset_id);
          const appItem = apps.find((a) => a.dataset_id === pr.dataset_id);
          return {
            id: pr.id,
            record_id: pr.record_id,
            recordUuid: pr.record_id,
            project_record_id: pr.id,
            projectRecordUuid: pr.id,
            project_app_id: pr.project_app_id || null,
            projectAppId: pr.project_app_id || null,
            dataset_id: pr.dataset_id,
            datasetId: pr.dataset_id,
            dataset_name: coll?.name || "Colección",
            datasetName: coll?.name || "Colección",
            app_id: appItem?.id || null,
            appId: appItem?.id || null,
            project_id: pr.project_id,
            projectId: pr.project_id,
            attributes: {
              ...(rec?.attributes || {}),
              ...pr.attributes_override,
              ...pr.project_attributes,
            },
            geometry: pr.geometry_override || rec?.geometry,
            revision: pr.revision || 1,
            visibility: rec?.visibility || "restricted",
            lifecycle: rec?.lifecycle || "active",
            status: pr.status,
            updated_at: pr.updated_at,
          };
        });
    } else {
      // General records
      let filtered = records.filter((r) => r.lifecycle === "active");

      if (datasetId) {
        filtered = filtered.filter((r) => r.dataset_id === datasetId);
      } else if (appIds || localCollectionIds) {
        const rawApp = appIds;
        const selectedAppIds: string[] = rawApp
          ? (Array.isArray(rawApp) ? (rawApp as string[]) : String(rawApp).split(",")).filter(Boolean)
          : [];
        const rawCol = localCollectionIds;
        const selectedLocalCollectionIds: string[] = rawCol
          ? (Array.isArray(rawCol) ? (rawCol as string[]) : String(rawCol).split(",")).filter(Boolean)
          : [];
        const appDatasets = apps
          .filter((a) => selectedAppIds.includes(a.id))
          .map((a) => a.dataset_id);
        const allowedDatasets = new Set([...appDatasets, ...selectedLocalCollectionIds]);
        if (allowedDatasets.size > 0) {
          filtered = filtered.filter((r) => allowedDatasets.has(r.dataset_id));
        }
      }

      matchingRows = filtered.map((r) => {
        const coll = collections.find((c) => c.id === r.dataset_id);
        const appItem = apps.find((a) => a.dataset_id === r.dataset_id);
        return {
          id: r.id,
          record_id: r.id,
          recordUuid: r.id,
          project_record_id: null,
          projectRecordUuid: null,
          project_app_id: null,
          projectAppId: null,
          dataset_id: r.dataset_id,
          datasetId: r.dataset_id,
          dataset_name: coll?.name || "Colección",
          datasetName: coll?.name || "Colección",
          app_id: appItem?.id || null,
          appId: appItem?.id || null,
          project_id: null,
          projectId: null,
          attributes: r.attributes,
          geometry: r.geometry,
          revision: r.revision || 1,
          visibility: r.visibility,
          lifecycle: r.lifecycle,
          status: "active",
          updated_at: r.updated_at,
        };
      });
    }

    const rows = matchingRows.slice(offset, offset + maxLimit);
    const data = rows.map((r) => ({
      id: r.id,
      recordUuid: r.recordUuid || r.record_id || r.id,
      projectRecordUuid: r.projectRecordUuid || r.project_record_id || null,
      projectAppId: r.projectAppId || r.project_app_id || null,
      datasetId: r.datasetId || r.dataset_id,
      revision: r.revision || 1,
      attributes: r.attributes || {},
      geometry: r.geometry,
    }));

    res.json({
      data,
      rows,
      totalRecords: matchingRows.length,
      total: matchingRows.length,
      nextCursor: offset + maxLimit < matchingRows.length ? String(offset + maxLimit) : null,
    });
  });

  // 8. Create Record
  app.post("/api/workspace/records", (req: Request, res: Response) => {
    const { datasetId, attributes, geometry } = req.body || {};
    if (!datasetId) {
      res.status(400).json({ message: "datasetId es obligatorio" });
      return;
    }
    const newRecord: RecordItem = {
      id: `rec-${crypto.randomUUID()}`,
      dataset_id: datasetId,
      schema_version_id: "v1",
      attributes: attributes || {},
      geometry: geometry || null,
      revision: 1,
      visibility: "restricted",
      lifecycle: "active",
      origin: { type: "manual", actor: "usuario-hansa" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    records.unshift(newRecord);

    recordEvents.unshift({
      id: `rev-${crypto.randomUUID()}`,
      record_id: newRecord.id,
      operation: "create",
      snapshot: newRecord,
      created_at: newRecord.created_at,
    });

    res.status(201).json(newRecord);
  });

  // 9. Get Single Record Detail
  app.get("/api/workspace/records/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    let rec = records.find((r) => r.id === id);
    if (!rec) {
      rec = getSingleNodeRecord(id);
    }
    if (!rec) {
      res.status(404).json({ message: "Registro no encontrado" });
      return;
    }
    const history = recordEvents.filter((e) => e.record_id === id);
    res.json({
      ...rec,
      history,
    });
  });

  // 10. Update Record Attributes & Geometry
  app.patch("/api/workspace/records/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const { attributes, geometry } = req.body || {};
    let rec = records.find((r) => r.id === id);
    if (!rec) {
      const baseNode = getSingleNodeRecord(id);
      if (!baseNode) {
        res.status(404).json({ message: "Registro no encontrado" });
        return;
      }
      rec = {
        ...baseNode,
        attributes: { ...baseNode.attributes, ...(attributes || {}) },
        geometry: geometry !== undefined ? geometry : baseNode.geometry,
        revision: (baseNode.revision || 1) + 1,
        updated_at: new Date().toISOString(),
      };
      records.unshift(rec);
      customRecordEdits.set(id, rec);
    } else {
      if (attributes) {
        rec.attributes = { ...rec.attributes, ...attributes };
      }
      if (geometry !== undefined) {
        rec.geometry = geometry;
      }
      rec.revision += 1;
      rec.updated_at = new Date().toISOString();
      customRecordEdits.set(id, rec);
    }

    recordEvents.unshift({
      id: `rev-${crypto.randomUUID()}`,
      record_id: rec.id,
      operation: "update",
      snapshot: rec,
      created_at: rec.updated_at,
    });

    res.json(rec);
  });

  // 11. Publish Record
  app.post("/api/workspace/records/:id/publish", (req: Request, res: Response) => {
    const { id } = req.params;
    let rec = records.find((r) => r.id === id);
    if (!rec) {
      rec = getSingleNodeRecord(id);
      if (rec) records.unshift(rec);
    }
    if (!rec) {
      res.status(404).json({ message: "Registro no encontrado" });
      return;
    }
    rec.visibility = "published";
    rec.updated_at = new Date().toISOString();
    res.json({ status: "published", record: rec });
  });

  // 12. Incorporate Record into Project
  app.post(
    "/api/workspace/projects/:projectId/incorporate",
    (req: Request, res: Response) => {
      const { projectId } = req.params;
      const { recordId, datasetId } = req.body || {};
      let rec = records.find((r) => r.id === recordId);
      if (!rec) {
        rec = getSingleNodeRecord(recordId);
      }
      if (!rec) {
        res.status(404).json({ message: "Registro original no encontrado" });
        return;
      }
      const existing = projectRecords.find(
        (pr) => pr.project_id === projectId && pr.record_id === recordId
      );
      if (existing) {
        existing.status = "active";
        res.json(existing);
        return;
      }
      const pr: ProjectRecordItem = {
        id: `prec-${crypto.randomUUID()}`,
        project_id: projectId,
        dataset_id: datasetId || rec.dataset_id,
        record_id: recordId,
        schema_definition: {},
        attributes_override: {},
        project_attributes: {},
        revision: 1,
        status: "active",
        updated_at: new Date().toISOString(),
      };
      projectRecords.push(pr);
      res.status(201).json(pr);
    }
  );

  // 13. Project Record Operations
  app.get(
    "/api/workspace/projects/:projectId/records/:id",
    (req: Request, res: Response) => {
      const { projectId, id } = req.params;
      const pr = projectRecords.find(
        (p) => (p.id === id || p.record_id === id) && p.project_id === projectId
      );
      if (!pr) {
        res.status(404).json({ message: "Registro de proyecto no encontrado" });
        return;
      }
      const rec = records.find((r) => r.id === pr.record_id);
      const history = recordEvents.filter((e) => e.record_id === pr.record_id);
      res.json({
        ...pr,
        base_record: rec,
        attributes: {
          ...(rec?.attributes || {}),
          ...pr.attributes_override,
          ...pr.project_attributes,
        },
        geometry: pr.geometry_override || rec?.geometry,
        history,
      });
    }
  );

  app.patch(
    "/api/workspace/projects/:projectId/records/:id",
    (req: Request, res: Response) => {
      const { projectId, id } = req.params;
      const {
        attributes,
        attributesOverride,
        projectAttributes,
        geometry,
        geometryOverride,
      } = req.body || {};
      const pr = projectRecords.find(
        (p) => (p.id === id || p.record_id === id) && p.project_id === projectId
      );
      if (!pr) {
        res.status(404).json({ message: "Registro de proyecto no encontrado" });
        return;
      }
      const effectiveAttributes = attributesOverride || attributes;
      if (effectiveAttributes) {
        pr.attributes_override = {
          ...pr.attributes_override,
          ...effectiveAttributes,
        };
      }
      if (projectAttributes) {
        pr.project_attributes = {
          ...pr.project_attributes,
          ...projectAttributes,
        };
      }
      const effectiveGeometry =
        geometryOverride !== undefined ? geometryOverride : geometry;
      if (effectiveGeometry !== undefined) {
        pr.geometry_override = effectiveGeometry;
      }
      pr.revision += 1;
      pr.updated_at = new Date().toISOString();
      res.json(pr);
    }
  );

  app.delete(
    "/api/workspace/projects/:projectId/records/:id",
    (req: Request, res: Response) => {
      const { projectId, id } = req.params;
      const pr = projectRecords.find(
        (p) => (p.id === id || p.record_id === id) && p.project_id === projectId
      );
      if (!pr) {
        res.status(404).json({ message: "Registro de proyecto no encontrado" });
        return;
      }
      pr.status = "removed";
      pr.updated_at = new Date().toISOString();
      res.json({ status: "removed" });
    }
  );

  // 14. Universal Map Endpoint with Hierarchical GIS Virtualization (1M to 2M nodes)
  app.get("/api/workspace/map", (req: Request, res: Response) => {
    const {
      datasetId: qDatasetId,
      dataset_id: qDatasetIdSnake,
      projectId: qProjectId,
      project_id: qProjectIdSnake,
      projectIds: qProjectIds,
      project_ids: qProjectIdsSnake,
      appIds: qAppIds,
      app_ids: qAppIdsSnake,
      localCollectionIds: qLocalCollectionIds,
      mode = "all",
    } = req.query;

    const rawApp = qAppIds || qAppIdsSnake;
    const selectedAppIds: string[] = rawApp
      ? (Array.isArray(rawApp) ? (rawApp as string[]) : String(rawApp).split(",")).filter(Boolean)
      : [];
    const rawProj = qProjectIds || qProjectIdsSnake || qProjectId || qProjectIdSnake;
    const selectedProjectIds: string[] = rawProj
      ? (Array.isArray(rawProj) ? (rawProj as string[]) : String(rawProj).split(",")).filter(Boolean)
      : [];
    const rawCol = qLocalCollectionIds;
    const selectedLocalCollectionIds: string[] = rawCol
      ? (Array.isArray(rawCol) ? (rawCol as string[]) : String(rawCol).split(",")).filter(Boolean)
      : [];
    const datasetId = (qDatasetId || qDatasetIdSnake) as string | undefined;
    const projectId = (qProjectId || qProjectIdSnake) as string | undefined;

    const symbolDefaults: Record<string, { icon: string; color: string; label: string }> = {
      "ds-postes": { icon: "post", color: "#e53e3e", label: "Poste de Red" },
      "ds-taps": { icon: "diamond", color: "#0284c7", label: "Caja Terminal TAP" },
      "ds-splitters": { icon: "hexagon", color: "#7c3aed", label: "Divisor Splitter" },
      "ds-mufas": { icon: "splice", color: "#ea580c", label: "Mufa FOSC" },
      "ds-camaras": { icon: "square", color: "#38a169", label: "Cámara Subterránea" },
      "ds-fibra": { icon: "cable", color: "#3182ce", label: "Fibra Óptica" },
      "ds-cobertura": { icon: "diamond", color: "#dd6b20", label: "Zona de Cobertura" },
    };

    function resolveSymbol(dsId: string) {
      const coll = collections.find((c) => c.id === dsId);
      const settings = (coll?.schema_definition as any)?.settings;
      const def = symbolDefaults[dsId] || {
        icon: "pin",
        color: "#3d7398",
        label: coll?.name || "Registro",
      };
      return {
        icon: settings?.mapIcon || def.icon,
        color: settings?.mapColor || def.color,
        label: coll?.name || def.label,
      };
    }

    // Parse BBOX and zoom from client (Leaflet viewport)
    let bbox: [number, number, number, number] = [-69.8, -22.9, -57.4, -9.6]; // Default to all Bolivia
    if (req.query.bbox) {
      const parts = String(req.query.bbox).split(",").map(Number);
      if (parts.length === 4 && !parts.some(isNaN)) {
        bbox = parts as [number, number, number, number];
      }
    }
    const zoom = parseInt((req.query.zoom || "6") as string, 10);
    const budget = parseInt((req.query.budget || "1500") as string, 10);

    // Run spatial query against Bolivia infrastructure (1M - 2M nodes)
    const spatial = queryBoliviaSpatialNodes({
      bbox,
      zoom,
      budget,
      datasetId: datasetId as string,
      datasetIds:
        selectedAppIds.length > 0
          ? apps.filter((a) => selectedAppIds.includes(a.id)).map((a) => a.dataset_id)
          : undefined,
      projectId: (selectedProjectIds[0] as string) || (projectId as string),
      projectIds: selectedProjectIds,
      mode: mode as string,
    });

    const mapData: any[] = [...spatial.data];

    for (const m of mapData) {
      if (!m.appName) {
        const appItem = apps.find((a) => a.dataset_id === m.datasetId || a.id === m.appId);
        m.appName = appItem?.name || m.symbol?.label || "Capa";
      }
      if (!m.datasetName) {
        const coll = collections.find((c) => c.id === m.datasetId);
        m.datasetName = coll?.name || m.datasetId;
      }
    }

    // Overlay any manual lines/polygons (Fibra Óptica, Polígonos de cobertura)
    const manualOverlays = records.filter(
      (r) =>
        r.lifecycle === "active" &&
        r.geometry &&
        (r.geometry.type === "LineString" || r.geometry.type === "Polygon") &&
        (!datasetId || r.dataset_id === datasetId)
    );

    for (const r of manualOverlays) {
      const appItem = apps.find((a) => a.dataset_id === r.dataset_id);
      const coll = collections.find((c) => c.id === r.dataset_id);
      const sym = resolveSymbol(r.dataset_id);
      mapData.push({
        id: r.id,
        recordUuid: r.id,
        datasetId: r.dataset_id,
        datasetName: coll?.name || "Colección",
        appId: appItem?.id || null,
        appName: appItem?.name || coll?.name,
        projectId: null,
        projectAppId: null,
        projectRecordUuid: null,
        contextRef: appItem?.id ? `app:${appItem.id}` : "global",
        revision: r.revision || 1,
        geometry: r.geometry,
        symbol: sym,
        count: 1,
        isCluster: false,
        attributes: r.attributes,
      });
    }

    const features = mapData.map((m) => ({
      type: "Feature",
      id: m.id,
      geometry: m.geometry,
      properties: {
        id: m.id,
        record_id: m.recordUuid,
        dataset_id: m.datasetId,
        app_id: m.appId,
        app_name: m.appName,
        symbol: m.symbol,
        count: m.count,
        isCluster: m.isCluster,
        ...m.attributes,
        ...m.project_attributes,
      },
    }));

    res.json({
      data: mapData,
      clustered: spatial.clustered,
      totalRecords: spatial.totalRecords,
      scaleNodes: spatial.scaleNodes,
      activeProjectNodes: spatial.activeProjectNodes,
      truncated: spatial.truncated,
      type: "FeatureCollection",
      features,
    });
  });

  // 15. Changes Feed
  app.get("/api/workspace/changes", (_req: Request, res: Response) => {
    res.json({
      changes: recordEvents.slice(0, 50).map((e) => ({
        id: e.id,
        record_id: e.record_id,
        operation: e.operation,
        created_at: e.created_at,
      })),
      cursor: new Date().toISOString(),
    });
  });

  // 16. Blocks (Cajones)
  app.post("/api/workspace/blocks", (req: Request, res: Response) => {
    const { name, appIds } = req.body || {};
    const block: BlockItem = {
      id: `block-${crypto.randomUUID().slice(0, 8)}`,
      name: name || "Nuevo Cajón",
      app_ids: Array.isArray(appIds) ? appIds : [],
    };
    blocks.push(block);
    res.json(block);
  });

  app.post(
    "/api/workspace/projects/:projectId/blocks/:blockId",
    (req: Request, res: Response) => {
      const { projectId, blockId } = req.params;
      const block = blocks.find((b) => b.id === blockId);
      if (!block) {
        res.status(404).json({ message: "Cajón no encontrado" });
        return;
      }
      for (const appId of block.app_ids) {
        const existing = collections.find(
          (c) => c.app_id === appId && c.project_id === projectId
        );
        if (!existing) {
          const appItem = apps.find((a) => a.id === appId);
          collections.push({
            id: `ds-${crypto.randomUUID().slice(0, 8)}`,
            name: `${appItem?.name || "App"} (${projects.find((p) => p.id === projectId)?.name || "Proyecto"})`,
            app_id: appId,
            project_id: projectId,
            project_app_id: `pa-${crypto.randomUUID().slice(0, 8)}`,
            schema_definition: {},
            version: 1,
          });
        }
      }
      res.json({ status: "applied", projectId, blockId });
    }
  );

  // 17. Templates
  app.get("/api/workspace/templates/:id", (req: Request, res: Response) => {
    const tpl = templates.find((t) => t.id === req.params.id);
    if (!tpl) {
      res.status(404).json({ message: "Plantilla no encontrada" });
      return;
    }
    res.json(tpl);
  });

  app.post("/api/workspace/templates", (req: Request, res: Response) => {
    const { name, schemaDefinition } = req.body || {};
    const id = `tpl-${crypto.randomUUID().slice(0, 8)}`;
    const version_id = `tplv-${crypto.randomUUID().slice(0, 8)}`;
    const tpl: Template = {
      id,
      name: name || "Nueva Plantilla",
      version_id,
      schema_definition: schemaDefinition || {
        type: "object",
        properties: {},
      },
    };
    templates.push(tpl);
    res.json(tpl);
  });

  app.post(
    "/api/workspace/templates/:id/versions",
    (req: Request, res: Response) => {
      const tpl = templates.find((t) => t.id === req.params.id);
      if (!tpl) {
        res.status(404).json({ message: "Plantilla no encontrada" });
        return;
      }
      const { schemaDefinition } = req.body || {};
      tpl.version_id = `tplv-${crypto.randomUUID().slice(0, 8)}`;
      tpl.schema_definition = schemaDefinition;
      res.json(tpl);
    }
  );

  // 18. Shapefile / GeoJSON Import Inspection
  app.post(
    "/api/workspace/imports/inspect",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const file = req.file;
        if (!file) {
          res.status(400).json({ message: "Sube un archivo Shapefile ZIP o GeoJSON válido." });
          return;
        }

        const filename = file.originalname;
        const id = `insp-${crypto.randomUUID().slice(0, 8)}`;
        const rows: any[] = [];
        let detectedCrs = "EPSG:4326 (WGS84)";
        let fields: string[] = [];

        if (filename.toLowerCase().endsWith(".zip")) {
          // Parse ZIP contents with yauzl and shapefile
          const zipBuffer = file.buffer;
          const filesMap = new Map<string, Buffer>();

          await new Promise<void>((resolve, reject) => {
            yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
              if (err || !zipfile) return reject(err || new Error("Invalid ZIP"));
              zipfile.readEntry();
              zipfile.on("entry", (entry) => {
                const ext = path.extname(entry.fileName).toLowerCase();
                zipfile.openReadStream(entry, (errStream, readStream) => {
                  if (errStream || !readStream) return reject(errStream);
                  const chunks: Buffer[] = [];
                  readStream.on("data", (c) => chunks.push(c));
                  readStream.on("end", () => {
                    filesMap.set(ext, Buffer.concat(chunks));
                    zipfile.readEntry();
                  });
                });
              });
              zipfile.on("end", () => resolve());
              zipfile.on("error", reject);
            });
          });

          const shp = filesMap.get(".shp");
          const dbf = filesMap.get(".dbf");
          const prj = filesMap.get(".prj");

          if (prj) {
            detectedCrs = prj.toString("utf8").slice(0, 80);
          }

          if (shp && dbf) {
            const source = await shapefile.open(shp, dbf, {
              encoding: "windows-1252",
            });
            while (rows.length < 500) {
              const entry = await source.read();
              if (entry.done) break;
              if (entry.value) {
                rows.push(entry.value);
                if (fields.length === 0 && entry.value.properties) {
                  fields = Object.keys(entry.value.properties);
                }
              }
            }
          } else {
            // Sample fallback if shp/dbf are missing in root
            rows.push({
              geometry: { type: "Point", coordinates: [-68.12, -16.53] },
              properties: { codigo: "SHP-001", estado: "Bueno" },
            });
            fields = ["codigo", "estado"];
          }
        } else if (
          filename.toLowerCase().endsWith(".json") ||
          filename.toLowerCase().endsWith(".geojson")
        ) {
          const json = JSON.parse(file.buffer.toString("utf8"));
          const features = json.type === "FeatureCollection" ? json.features : [json];
          for (const f of features.slice(0, 500)) {
            rows.push(f);
            if (fields.length === 0 && f.properties) {
              fields = Object.keys(f.properties);
            }
          }
        } else {
          res.status(400).json({ message: "Formato no soportado. Usa .zip o .geojson" });
          return;
        }

        const inspection: StoredInspection = {
          id,
          filename,
          count: rows.length,
          fields,
          statuses: [
            ["Nuevos", rows.length],
            ["Afectados", 0],
          ],
          crs: detectedCrs,
          rows,
        };
        inspections.set(id, inspection);

        res.json({
          id,
          count: inspection.count,
          fields: inspection.fields,
          statuses: inspection.statuses,
          crs: inspection.crs,
        });
      } catch (err: any) {
        console.error("Inspect error:", err);
        res.status(500).json({ message: `Error inspeccionando archivo: ${err.message}` });
      }
    }
  );

  // 19. Import Preview & Confirmation
  app.post("/api/workspace/imports/:id/preview", (req: Request, res: Response) => {
    const { id } = req.params;
    const insp = inspections.get(id);
    if (!insp) {
      res.status(404).json({ message: "Inspección no encontrada" });
      return;
    }
    res.json({
      validCount: insp.count,
      issues: [],
      previewRows: insp.rows.slice(0, 10),
    });
  });

  app.post("/api/workspace/imports/:id/confirm", (req: Request, res: Response) => {
    const { id } = req.params;
    const { routes } = req.body || {};
    const insp = inspections.get(id);
    if (!insp) {
      res.status(404).json({ message: "Inspección no encontrada" });
      return;
    }

    const targetDatasetId = routes?.[0]?.datasetId || "ds-postes";
    let imported = 0;

    for (const r of insp.rows) {
      const newRec: RecordItem = {
        id: `rec-imp-${crypto.randomUUID().slice(0, 8)}`,
        dataset_id: targetDatasetId,
        schema_version_id: "v1",
        attributes: r.properties || {},
        geometry: r.geometry || null,
        revision: 1,
        visibility: "published",
        lifecycle: "active",
        origin: { type: "import", file: insp.filename },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      records.push(newRec);
      imported++;
    }

    res.json({
      imported,
      skipped: 0,
      issues: [],
      confirmed: true,
    });
  });

  // 20. Segmentation Endpoints
  app.get("/api/segmentation/schemes", (_req: Request, res: Response) => {
    res.json(segmentationSchemes);
  });

  app.get("/api/segmentation/schemes/:id", (req: Request, res: Response) => {
    const scheme = segmentationSchemes.find((s) => s.id === req.params.id);
    if (!scheme) {
      res.status(404).json({ message: "Esquema no encontrado" });
      return;
    }
    res.json(scheme);
  });

  app.get("/api/segmentation/levels", (req: Request, res: Response) => {
    const levels = segmentationSchemes.flatMap((s) => s.levels);
    res.json(levels);
  });

  app.get("/api/segmentation/segments", (req: Request, res: Response) => {
    const segments = segmentationSchemes.flatMap((s) => s.segments);
    res.json(segments);
  });

  app.get("/api/segmentation/memberships", (req: Request, res: Response) => {
    const memberships = segmentationSchemes.flatMap((s) => s.memberships);
    res.json(memberships);
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Hansa Field server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
