// server-gis-engine.ts
// High-performance Big Data Spatial Engine for Bolivia Telecom & FTTH Infrastructure
// Supports 1,000,000 to 2,000,000+ nodes with spatial quad-clustering, deterministic PRNG, and instant BBOX querying.

export interface GisMacroZone {
  id: string;
  name: string;
  department: string;
  centroid: [number, number]; // [lon, lat]
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  weight: number; // proportion of total network nodes
  subzones: GisSubZone[];
}

export interface GisSubZone {
  id: string;
  name: string;
  centroid: [number, number];
  bbox: [number, number, number, number];
  weight: number;
}

export const BOLIVIA_ZONES: GisMacroZone[] = [
  {
    id: "zone-scz",
    name: "Santa Cruz de la Sierra y Región Metropolitana",
    department: "Santa Cruz",
    centroid: [-63.1806, -17.7833],
    bbox: [-63.28, -17.87, -63.08, -17.69],
    weight: 0.32, // ~32% -> ~686,000 nodes in 2.1M scale
    subzones: [
      {
        id: "scz-equipetrol",
        name: "Equipetrol / Sirari / Canal Isuto",
        centroid: [-63.195, -17.766],
        bbox: [-63.208, -17.778, -63.182, -17.754],
        weight: 0.22,
      },
      {
        id: "scz-centro",
        name: "Casco Viejo (1er y 2do Anillo)",
        centroid: [-63.182, -17.784],
        bbox: [-63.196, -17.798, -63.168, -17.77],
        weight: 0.28,
      },
      {
        id: "scz-norte",
        name: "Zona Norte (Av. Banzer / 3er al 5to Anillo)",
        centroid: [-63.172, -17.742],
        bbox: [-63.19, -17.76, -63.15, -17.72],
        weight: 0.25,
      },
      {
        id: "scz-plan3000",
        name: "Plan 3000 y Villa 1ro de Mayo",
        centroid: [-63.125, -17.818],
        bbox: [-63.15, -17.85, -63.1, -17.78],
        weight: 0.25,
      },
    ],
  },
  {
    id: "zone-lpz",
    name: "La Paz y El Alto Metropolitano",
    department: "La Paz",
    centroid: [-68.13, -16.51],
    bbox: [-68.25, -16.62, -68.04, -16.45],
    weight: 0.26, // ~26% -> ~557,000 nodes
    subzones: [
      {
        id: "lpz-sur",
        name: "Zona Sur (Calacoto, San Miguel, Obrajes, Achumani)",
        centroid: [-68.084, -16.54],
        bbox: [-68.096, -16.552, -68.072, -16.528],
        weight: 0.28,
      },
      {
        id: "lpz-centro",
        name: "Centro Histórico, Sopocachi y San Pedro",
        centroid: [-68.134, -16.505],
        bbox: [-68.146, -16.518, -68.122, -16.492],
        weight: 0.24,
      },
      {
        id: "lpz-miraflores",
        name: "Miraflores y Villa Fátima",
        centroid: [-68.12, -16.495],
        bbox: [-68.132, -16.51, -68.105, -16.48],
        weight: 0.18,
      },
      {
        id: "lpz-elalto",
        name: "El Alto (Ceja, Satélite, Villa Adela, 16 de Julio)",
        centroid: [-68.185, -16.51],
        bbox: [-68.22, -16.54, -68.15, -16.48],
        weight: 0.3,
      },
    ],
  },
  {
    id: "zone-cbb",
    name: "Cochabamba - Valle Central",
    department: "Cochabamba",
    centroid: [-66.16, -17.39],
    bbox: [-66.24, -17.45, -66.1, -17.34],
    weight: 0.17, // ~17% -> ~364,000 nodes
    subzones: [
      {
        id: "cbb-norte",
        name: "Cala Cala, Queru Queru y Recoleta",
        centroid: [-66.162, -17.372],
        bbox: [-66.176, -17.386, -66.148, -17.358],
        weight: 0.35,
      },
      {
        id: "cbb-centro",
        name: "Centro Histórico y La Coronilla",
        centroid: [-66.158, -17.398],
        bbox: [-66.172, -17.412, -66.144, -17.384],
        weight: 0.35,
      },
      {
        id: "cbb-quillacollo",
        name: "Eje Metropolitano Quillacollo / Sacaba",
        centroid: [-66.21, -17.4],
        bbox: [-66.24, -17.44, -66.18, -17.36],
        weight: 0.3,
      },
    ],
  },
  {
    id: "zone-chq",
    name: "Chuquisaca - Sucre Casco Histórico y Anillos",
    department: "Chuquisaca",
    centroid: [-65.26, -19.04],
    bbox: [-65.28, -19.07, -65.23, -19.01],
    weight: 0.06, // ~128,000 nodes
    subzones: [
      {
        id: "chq-sucre",
        name: "Sucre Casco Viejo y Zona Ravelo",
        centroid: [-65.258, -19.042],
        bbox: [-65.275, -19.065, -65.24, -19.02],
        weight: 1.0,
      },
    ],
  },
  {
    id: "zone-oru",
    name: "Oruro - Casco Central y Distrito Minero",
    department: "Oruro",
    centroid: [-67.11, -17.96],
    bbox: [-67.15, -18.0, -67.08, -17.93],
    weight: 0.055, // ~118,000 nodes
    subzones: [
      {
        id: "oru-centro",
        name: "Oruro Centro y Zona Ferroviaria",
        centroid: [-67.112, -17.965],
        bbox: [-67.14, -17.99, -67.09, -17.94],
        weight: 1.0,
      },
    ],
  },
  {
    id: "zone-pot",
    name: "Potosí - Villa Imperial",
    department: "Potosí",
    centroid: [-65.75, -19.58],
    bbox: [-65.78, -19.61, -65.72, -19.55],
    weight: 0.05, // ~107,000 nodes
    subzones: [
      {
        id: "pot-centro",
        name: "Potosí Centro y Cantumarca",
        centroid: [-65.753, -19.582],
        bbox: [-65.775, -19.605, -65.73, -19.56],
        weight: 1.0,
      },
    ],
  },
  {
    id: "zone-tar",
    name: "Tarija - Valle Central",
    department: "Tarija",
    centroid: [-64.73, -21.53],
    bbox: [-64.76, -21.56, -64.7, -21.5],
    weight: 0.045, // ~96,000 nodes
    subzones: [
      {
        id: "tar-centro",
        name: "Tarija Centro y Senac",
        centroid: [-64.732, -21.532],
        bbox: [-64.755, -21.555, -64.71, -21.51],
        weight: 1.0,
      },
    ],
  },
  {
    id: "zone-ben",
    name: "Beni - Trinidad y Ribera",
    department: "Beni",
    centroid: [-64.9, -14.83],
    bbox: [-64.93, -14.86, -64.87, -14.8],
    weight: 0.025, // ~53,000 nodes
    subzones: [
      {
        id: "ben-trinidad",
        name: "Trinidad Casco Central",
        centroid: [-64.901, -14.832],
        bbox: [-64.925, -14.855, -64.875, -14.81],
        weight: 1.0,
      },
    ],
  },
  {
    id: "zone-pan",
    name: "Pando - Cobija Zona Fronteriza",
    department: "Pando",
    centroid: [-68.76, -11.02],
    bbox: [-68.78, -11.05, -68.74, -11.0],
    weight: 0.015, // ~32,000 nodes
    subzones: [
      {
        id: "pan-cobija",
        name: "Cobija Centro y Av. 9 de Febrero",
        centroid: [-68.762, -11.025],
        bbox: [-68.778, -11.045, -68.745, -11.01],
        weight: 1.0,
      },
    ],
  },
];

// Current Scale Setting (Default: 2.1 Million nodes)
export let ACTIVE_SCALE = 2_145_000;

export function setActiveScale(newScale: number) {
  if (newScale >= 10_000 && newScale <= 5_000_000) {
    ACTIVE_SCALE = newScale;
  }
  return ACTIVE_SCALE;
}

// Pseudo-random integer generator based on deterministic seed
export function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Network Item Types
export type NetworkLayerType =
  | "ds-postes"
  | "ds-taps"
  | "ds-splitters"
  | "ds-mufas"
  | "ds-camaras"
  | "ds-fibra"
  | "ds-cobertura";

export interface VirtualNode {
  id: string;
  dataset_id: NetworkLayerType;
  revision: number;
  attributes: Record<string, any>;
  geometry: {
    type: "Point" | "LineString" | "Polygon";
    coordinates: any;
  };
  symbol: {
    icon: string;
    color: string;
    label: string;
  };
  project_id: string | null;
  project_attributes?: Record<string, any>;
}

// Deterministic attributes generator for any virtual node ID
export function generateNodeAttributes(
  datasetId: NetworkLayerType,
  seed: number,
  zone: GisMacroZone,
  subzoneName: string,
): { attributes: Record<string, any>; symbol: { icon: string; color: string; label: string } } {
  const r1 = pseudoRandom(seed);
  const r2 = pseudoRandom(seed + 1);
  const r3 = pseudoRandom(seed + 2);
  const r4 = pseudoRandom(seed + 3);

  const deptCode = zone.department.slice(0, 3).toUpperCase();
  const numCode = String(1000 + (Math.floor(seed) % 8999));

  if (datasetId === "ds-postes") {
    const tipos = ["Hormigón 9m", "Hormigón 11m", "Hormigón 12m", "Metálico Tubular", "Madera Tratada"];
    const materiales = ["Hormigón armado", "Hormigón centrifugado", "Acero galvanizado", "Madera tratada"];
    const estados = ["Excelente", "Bueno", "Requiere Mantenimiento", "Crítico"];
    const propietarios =
      zone.department === "La Paz"
        ? ["DELAPAZ", "Tigo", "Entel", "Hansa"]
        : zone.department === "Santa Cruz"
          ? ["CRE", "Tigo", "Entel", "Hansa"]
          : zone.department === "Cochabamba"
            ? ["ELFEC", "Tigo", "Entel", "Hansa"]
            : ["ENDE", "Tigo", "Entel", "Hansa"];

    return {
      attributes: {
        codigo: `P-${deptCode}-${numCode}`,
        tipo_poste: tipos[Math.floor(r1 * tipos.length)],
        altura_m: r1 > 0.6 ? 11 : r1 > 0.2 ? 9 : 8,
        material: materiales[Math.floor(r2 * materiales.length)],
        estado: estados[Math.floor(r3 * (r3 > 0.8 ? estados.length : 2))],
        propietario: propietarios[Math.floor(r4 * propietarios.length)],
        reserva_fo: r1 > 0.5 ? "Sí (Espiral 30m)" : "No",
        departamento: zone.department,
        municipio: subzoneName,
        observaciones: `Poste de distribución en ${subzoneName}. Soporte de cableado aéreo y cajas FTTH.`,
      },
      symbol: { icon: "post", color: "#e53e3e", label: "Poste de Red" },
    };
  }

  if (datasetId === "ds-taps") {
    const puertos = r1 > 0.4 ? "16 Puertos Drop" : "8 Puertos Drop";
    const totalP = r1 > 0.4 ? 16 : 8;
    const ocupados = Math.floor(r2 * (totalP + 1));
    const libres = totalP - ocupados;
    const pwr = (-17 - r3 * 4.5).toFixed(1);

    return {
      attributes: {
        codigo: `TAP-${deptCode}-S${Math.floor(seed % 9) + 1}-${numCode}`,
        capacidad_puertos: puertos,
        puertos_ocupados: ocupados,
        puertos_libres: libres,
        atenuacion_dbm: Number(pwr),
        nivel_split: r1 > 0.4 ? "Segundo Nivel (1:16)" : "Segundo Nivel (1:8)",
        conector_drop: "SC/APC",
        estado: libres === 0 ? "Saturado (100% Ocupado)" : "Operativo Comercial",
        codigo_poste: `P-${deptCode}-${numCode}`,
        zona: subzoneName,
        observaciones: `Caja terminal óptica con ${ocupados}/${totalP} puertos en servicio comercial.`,
      },
      symbol: { icon: "diamond", color: "#0284c7", label: "Caja Terminal (TAP FTTH)" },
    };
  }

  if (datasetId === "ds-splitters") {
    const splits = ["1:8", "1:16", "1:4", "1:32"];
    const chosenSplit = splits[Math.floor(r1 * splits.length)];
    const loss = chosenSplit === "1:8" ? 10.4 : chosenSplit === "1:16" ? 13.8 : chosenSplit === "1:4" ? 7.2 : 17.1;

    return {
      attributes: {
        codigo: `SPL-${deptCode}-${chosenSplit.replace(":", "X")}-${numCode}`,
        relacion_division: chosenSplit,
        tecnologia: "PLC Balanced (Planar Lightwave Circuit)",
        perdida_insercion_db: loss,
        longitud_onda: "1310 / 1490 / 1550 nm (GPON + RF Overlay)",
        ubicacion: r2 > 0.5 ? "Caja Terminal TAP" : "Mufa Aérea FOSC",
        conector_tipo: "SC/APC",
        estado: "Operativo Calibrado",
        zona: subzoneName,
      },
      symbol: { icon: "hexagon", color: "#7c3aed", label: "Divisor Óptico (Splitter)" },
    };
  }

  if (datasetId === "ds-mufas") {
    const caps = ["48 Fusiones", "96 Fusiones", "144 Fusiones", "24 Fusiones"];
    return {
      attributes: {
        codigo: `FOSC-${deptCode}-D-${numCode}`,
        tipo_caja: r1 > 0.3 ? "Domo Vertical IP68" : "Torpedo Horizontal",
        capacidad_fusiones: caps[Math.floor(r2 * caps.length)],
        bandejas_usadas: `${Math.floor(r3 * 4) + 1} de 4 bandejas`,
        tipo_instalacion: r4 > 0.3 ? "Aérea en Poste" : "Cámara Subterránea",
        cable_troncal: "Cable ADSS 96 hilos G.652D",
        estado: "Sellado Estanco Conforme",
        zona: subzoneName,
      },
      symbol: { icon: "splice", color: "#ea580c", label: "Mufa de Empalme FOSC" },
    };
  }

  if (datasetId === "ds-camaras") {
    return {
      attributes: {
        codigo: `CAM-${deptCode}-${numCode}`,
        tipo_camara: r1 > 0.5 ? "Distribución" : r1 > 0.2 ? "Paso" : "Empalme",
        dimensiones: "80x80x100 cm",
        estado: "Operativo",
        tapa_tipo: "Hierro dúctil D400 tráfico pesado",
        observaciones: `Cámara subterránea en calzada de ${subzoneName}.`,
      },
      symbol: { icon: "square", color: "#16a34a", label: "Cámara Subterránea" },
    };
  }

  // Default / fallback
  return {
    attributes: {
      codigo: `NODE-${deptCode}-${numCode}`,
      estado: "Operativo",
      departamento: zone.department,
    },
    symbol: { icon: "pin", color: "#3d7398", label: "Elemento de Red" },
  };
}

// Generate project-specific attributes when incorporated into the FTTH project
export function generateProjectAttributes(
  datasetId: NetworkLayerType,
  seed: number,
  zone: GisMacroZone,
): Record<string, any> {
  const r1 = pseudoRandom(seed + 10);
  const r2 = pseudoRandom(seed + 11);
  const cuadrillas = [
    "Cuadrilla Hansa FTTH 01 (Sur)",
    "Cuadrilla Hansa FTTH 02 (Norte)",
    "Contratista Andina Redes",
    "Cuadrilla Fusión Rápida Tigo",
    "Cuadrilla Hansa Relevamiento",
  ];
  const estados = ["En Servicio Activo", "Certificado OTDR", "Fusión Concluida", "Montaje Finalizado"];
  const olts = [
    `OLT-${zone.department.slice(0, 3).toUpperCase()}-CENTRO-01`,
    `OLT-${zone.department.slice(0, 3).toUpperCase()}-SUR-02`,
    `OLT-${zone.department.slice(0, 3).toUpperCase()}-NORTE-01`,
  ];

  return {
    fase_proyecto: "Fase 1 - Despliegue Masivo FTTH Bolivia",
    estado_despliegue: estados[Math.floor(r1 * estados.length)],
    cuadrilla_asignada: cuadrillas[Math.floor(r2 * cuadrillas.length)],
    potencia_medida_dbm: Number((-17.5 - r1 * 4.2).toFixed(2)),
    olt_cabecera: olts[Math.floor(r2 * olts.length)],
    fecha_certificacion: "2026-08-28",
    aprobado_supervision: "Conforme Hansa / Supervisión Tigo",
  };
}

// In-memory overlay of edited/created records
export const customRecordEdits = new Map<string, any>();
export const customProjectIncorporate = new Map<string, { projectId: string; attributes: Record<string, any> }>();

export interface SpatialQueryParams {
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  zoom: number;
  budget?: number;
  datasetId?: string;
  datasetIds?: string[];
  projectId?: string;
  projectIds?: string[];
  mode?: string;
}

export interface SpatialResult {
  data: any[];
  clustered: boolean;
  totalRecords: number;
  truncated: boolean;
  scaleNodes: number;
  activeProjectNodes: number;
}

// Check if two bounding boxes intersect
export function bboxIntersects(
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean {
  return !(a[0] > b[2] || a[2] < b[0] || a[1] > b[3] || a[3] < b[1]);
}

// Check if a point is inside bbox
export function pointInBbox(
  lon: number,
  lat: number,
  bbox: [number, number, number, number],
): boolean {
  return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

// Helper: Calculate total nodes for a specific dataset or project
export function getScaleMetrics(scale = ACTIVE_SCALE) {
  const postesCount = Math.round(scale * 0.58);
  const tapsCount = Math.round(scale * 0.17);
  const splittersCount = Math.round(scale * 0.10);
  const mufasCount = Math.round(scale * 0.07);
  const camarasCount = Math.round(scale * 0.05);
  const fibraCount = Math.round(scale * 0.03);

  // In the FTTH project (proj-ftth-nacional): all TAPs, splitters, mufas, plus 35% of postes
  const projectFtthNodes = tapsCount + splittersCount + mufasCount + Math.round(postesCount * 0.35);

  return {
    totalScale: scale,
    postesCount,
    tapsCount,
    splittersCount,
    mufasCount,
    camarasCount,
    fibraCount,
    projectFtthNodes,
  };
}

// Universal Spatial Query Engine
export function queryBoliviaSpatialNodes(params: SpatialQueryParams): SpatialResult {
  const {
    bbox,
    zoom,
    budget = 1500,
    datasetId,
    datasetIds,
    projectId,
    projectIds,
  } = params;

  const metrics = getScaleMetrics(ACTIVE_SCALE);
  const isProjectFilter = Boolean(projectId || (projectIds && projectIds.length > 0));
  const activeTotal = isProjectFilter ? metrics.projectFtthNodes : ACTIVE_SCALE;

  const activeDatasetSet = new Set<string>();
  if (datasetId) activeDatasetSet.add(datasetId);
  if (datasetIds) datasetIds.forEach((id) => activeDatasetSet.add(id));

  // Determine which layers are allowed
  const allowsPostes = activeDatasetSet.size === 0 || activeDatasetSet.has("ds-postes");
  const allowsTaps = activeDatasetSet.size === 0 || activeDatasetSet.has("ds-taps");
  const allowsSplitters = activeDatasetSet.size === 0 || activeDatasetSet.has("ds-splitters");
  const allowsMufas = activeDatasetSet.size === 0 || activeDatasetSet.has("ds-mufas");
  const allowsCamaras = activeDatasetSet.size === 0 || activeDatasetSet.has("ds-camaras");

  const LAYER_METAS: {
    id: NetworkLayerType;
    appId: string;
    name: string;
    icon: string;
    color: string;
    weight: number;
    projectWeight: number;
    seedOffset: number;
    allowed: boolean;
  }[] = [
    {
      id: "ds-postes",
      appId: "app-postes",
      name: "Postes de Red",
      icon: "post",
      color: "#e11d48",
      weight: 0.60,
      projectWeight: 0.40,
      seedOffset: 10,
      allowed: allowsPostes,
    },
    {
      id: "ds-taps",
      appId: "app-taps",
      name: "TAPs FTTH",
      icon: "diamond",
      color: "#0284c7",
      weight: 0.20,
      projectWeight: 0.35,
      seedOffset: 20,
      allowed: allowsTaps,
    },
    {
      id: "ds-splitters",
      appId: "app-splitters",
      name: "Splitters",
      icon: "square",
      color: "#7c3aed",
      weight: 0.10,
      projectWeight: 0.14,
      seedOffset: 30,
      allowed: allowsSplitters,
    },
    {
      id: "ds-mufas",
      appId: "app-mufas",
      name: "Mufas FO",
      icon: "splice",
      color: "#ea580c",
      weight: 0.06,
      projectWeight: 0.08,
      seedOffset: 40,
      allowed: allowsMufas,
    },
    {
      id: "ds-camaras",
      appId: "app-camaras",
      name: "Cámaras Subterráneas",
      icon: "triangle",
      color: "#059669",
      weight: 0.04,
      projectWeight: 0.03,
      seedOffset: 50,
      allowed: allowsCamaras,
    },
  ];

  const SUBZONE_OFFSETS: Partial<Record<NetworkLayerType, [number, number]>> = {
    "ds-postes": [-0.006, 0.004],
    "ds-taps": [0.006, 0.004],
    "ds-splitters": [-0.004, -0.005],
    "ds-mufas": [0.004, -0.005],
    "ds-camaras": [0.0, -0.008],
  };

  const BLOCK_OFFSET_RATIOS: Partial<Record<NetworkLayerType, [number, number]>> = {
    "ds-postes": [-0.22, 0.16],
    "ds-taps": [0.22, 0.16],
    "ds-splitters": [-0.18, -0.18],
    "ds-mufas": [0.18, -0.18],
    "ds-camaras": [0.0, -0.28],
  };

  const results: any[] = [];

  // --- LEVEL 1: ZOOM < 8 -> Country Scale Macro-Clusters (Todo agrupado a nivel nacional/departamental) ---
  if (zoom < 8) {
    for (const zone of BOLIVIA_ZONES) {
      if (!bboxIntersects(zone.bbox, bbox)) continue;

      let zoneTotal = Math.round(activeTotal * zone.weight);
      if (zoneTotal <= 0) zoneTotal = 1500;

      if (activeDatasetSet.size === 1) {
        const singleDs = Array.from(activeDatasetSet)[0] as NetworkLayerType;
        const meta = LAYER_METAS.find((m) => m.id === singleDs);
        if (meta) {
          zoneTotal = Math.round(zoneTotal * (isProjectFilter ? meta.projectWeight : meta.weight));
        }
      }

      results.push({
        id: `cluster-${zone.id}`,
        recordUuid: null,
        datasetId: activeDatasetSet.size === 1 ? Array.from(activeDatasetSet)[0] : "ds-postes",
        appId: "app-postes",
        projectId: projectId || null,
        projectAppId: null,
        projectRecordUuid: null,
        contextRef: `macro-cluster:${zone.id}`,
        revision: 1,
        geometry: {
          type: "Point",
          coordinates: zone.centroid,
        },
        symbol: {
          icon: "post",
          color: "#0284c7",
          label: `${zone.name} (${zone.department}) - Red Nacional`,
        },
        count: zoneTotal,
        isCluster: true,
      });
    }

    return {
      data: results,
      clustered: true,
      totalRecords: activeTotal,
      truncated: false,
      scaleNodes: ACTIVE_SCALE,
      activeProjectNodes: metrics.projectFtthNodes,
    };
  }

  // --- LEVEL 2: ZOOM 8 to 11 -> Metropolitan / Subzone Clusters SEPARADOS POR APP / CAPA ---
  if (zoom >= 8 && zoom < 12) {
    for (const zone of BOLIVIA_ZONES) {
      if (!bboxIntersects(zone.bbox, bbox)) continue;
      const zoneTotal = activeTotal * zone.weight;

      for (const sub of zone.subzones) {
        if (!bboxIntersects(sub.bbox, bbox)) continue;
        let subTotal = Math.round(zoneTotal * sub.weight);
        if (subTotal <= 0) subTotal = 250;

        // Create individual clusters for each active layer (Postes, TAPs, Splitters, etc.)
        for (const meta of LAYER_METAS) {
          if (!meta.allowed) continue;

          const layerWeight = isProjectFilter ? meta.projectWeight : meta.weight;
          const layerCount = Math.max(1, Math.round(subTotal * layerWeight));
          const [offX, offY] = SUBZONE_OFFSETS[meta.id] || [0, 0];

          results.push({
            id: `cluster-${sub.id}-${meta.id}`,
            recordUuid: null,
            datasetId: meta.id,
            appId: meta.appId,
            projectId: projectId || null,
            projectAppId: null,
            projectRecordUuid: null,
            contextRef: `sub-cluster:${sub.id}:${meta.id}`,
            revision: 1,
            geometry: {
              type: "Point",
              coordinates: [
                Number((sub.centroid[0] + offX).toFixed(6)),
                Number((sub.centroid[1] + offY).toFixed(6)),
              ],
            },
            symbol: {
              icon: meta.icon,
              color: meta.color,
              label: `${meta.name} - ${sub.name} (${zone.department})`,
            },
            count: layerCount,
            isCluster: true,
          });
        }
      }
    }

    return {
      data: results,
      clustered: true,
      totalRecords: activeTotal,
      truncated: false,
      scaleNodes: ACTIVE_SCALE,
      activeProjectNodes: metrics.projectFtthNodes,
    };
  }

  // --- LEVEL 3: ZOOM 12 to 15 -> Manzano / Sector Clusters SEPARADOS POR APP / CAPA ---
  if (zoom >= 12 && zoom < 16) {
    const gridStep = zoom === 12 ? 0.010 : zoom === 13 ? 0.005 : zoom === 14 ? 0.0028 : 0.0016;
    const minLon = Math.max(bbox[0], -69.5);
    const maxLon = Math.min(bbox[2], -62.5);
    const minLat = Math.max(bbox[1], -22.5);
    const maxLat = Math.min(bbox[3], -10.0);

    for (const zone of BOLIVIA_ZONES) {
      if (!bboxIntersects(zone.bbox, bbox)) continue;

      for (const sub of zone.subzones) {
        if (!bboxIntersects(sub.bbox, bbox)) continue;

        const subMinLon = Math.max(sub.bbox[0], minLon);
        const subMaxLon = Math.min(sub.bbox[2], maxLon);
        const subMinLat = Math.max(sub.bbox[1], minLat);
        const subMaxLat = Math.min(sub.bbox[3], maxLat);

        for (let lon = subMinLon; lon <= subMaxLon; lon += gridStep) {
          for (let lat = subMinLat; lat <= subMaxLat; lat += gridStep) {
            const seed = Math.abs(Math.floor((lon * 10000 + lat * 10000)));
            const r = pseudoRandom(seed);
            const blockTotal = Math.floor(r * (zoom >= 15 ? 40 : zoom === 14 ? 75 : 140)) + 10;

            const centerLon = lon + gridStep * 0.5;
            const centerLat = lat + gridStep * 0.5;

            // Generate separated clusters per allowed layer in this block
            for (const meta of LAYER_METAS) {
              if (!meta.allowed) continue;

              const layerWeight = isProjectFilter ? meta.projectWeight : meta.weight;
              let layerCount = Math.round(blockTotal * layerWeight);
              if (layerCount <= 0) {
                // Secondary elements (splitters, mufas) appear with probabilistic density
                if (pseudoRandom(seed + meta.seedOffset) < 0.45) {
                  layerCount = 1;
                } else {
                  continue;
                }
              }

              const [ratioX, ratioY] = BLOCK_OFFSET_RATIOS[meta.id] || [0, 0];
              const clusterLon = centerLon + gridStep * ratioX;
              const clusterLat = centerLat + gridStep * ratioY;

              results.push({
                id: `cluster-block-${seed}-${meta.id}`,
                recordUuid: null,
                datasetId: meta.id,
                appId: meta.appId,
                projectId: projectId || null,
                projectAppId: null,
                projectRecordUuid: null,
                contextRef: `block:${sub.name}:${meta.id}`,
                revision: 1,
                geometry: {
                  type: "Point",
                  coordinates: [Number(clusterLon.toFixed(6)), Number(clusterLat.toFixed(6))],
                },
                symbol: {
                  icon: meta.icon,
                  color: meta.color,
                  label: `${meta.name} (${layerCount}) - Sector ${sub.name}`,
                },
                count: layerCount,
                isCluster: true,
              });

              if (results.length >= budget) break;
            }

            if (results.length >= budget) break;
          }
          if (results.length >= budget) break;
        }
        if (results.length >= budget) break;
      }
      if (results.length >= budget) break;
    }

    return {
      data: results,
      clustered: true,
      totalRecords: activeTotal,
      truncated: results.length >= budget,
      scaleNodes: ACTIVE_SCALE,
      activeProjectNodes: metrics.projectFtthNodes,
    };
  }

  // --- LEVEL 4: ZOOM >= 16 -> Individual Exact Network Nodes ---
  // Renders real network nodes: Postes (Red), TAPs (Cyan), Splitters (Purple), Mufas (Orange), Cámaras (Green)
  const step = 0.00035; // ~38 meters spacing, typical for urban poles in Bolivia
  const minLon = bbox[0];
  const maxLon = bbox[2];
  const minLat = bbox[1];
  const maxLat = bbox[3];

  for (const zone of BOLIVIA_ZONES) {
    if (!bboxIntersects(zone.bbox, bbox)) continue;

    for (const sub of zone.subzones) {
      if (!bboxIntersects(sub.bbox, bbox)) continue;

      const subMinLon = Math.max(sub.bbox[0], minLon);
      const subMaxLon = Math.min(sub.bbox[2], maxLon);
      const subMinLat = Math.max(sub.bbox[1], minLat);
      const subMaxLat = Math.min(sub.bbox[3], maxLat);

      for (let lon = subMinLon; lon <= subMaxLon; lon += step) {
        for (let lat = subMinLat; lat <= subMaxLat; lat += step) {
          const seed = Math.abs(Math.floor((lon * 100000 + lat * 100000)));
          const rType = pseudoRandom(seed);
          const rProj = pseudoRandom(seed + 42);

          // Deterministic layer assignment:
          // ~60% Postes, ~20% TAPs, ~10% Splitters, ~6% Mufas, ~4% Cámaras
          let nodeType: NetworkLayerType = "ds-postes";
          let appId = "app-postes";

          if (rType < 0.60) {
            nodeType = "ds-postes";
            appId = "app-postes";
            if (!allowsPostes) continue;
          } else if (rType < 0.80) {
            nodeType = "ds-taps";
            appId = "app-taps";
            if (!allowsTaps) continue;
          } else if (rType < 0.90) {
            nodeType = "ds-splitters";
            appId = "app-splitters";
            if (!allowsSplitters) continue;
          } else if (rType < 0.96) {
            nodeType = "ds-mufas";
            appId = "app-mufas";
            if (!allowsMufas) continue;
          } else {
            nodeType = "ds-camaras";
            appId = "app-camaras";
            if (!allowsCamaras) continue;
          }

          const nodeId = `rec-node-${zone.department.slice(0, 3).toLowerCase()}-${seed}`;

          // Project inclusion:
          // In FTTH project: all TAPs, Splitters, and Mufas are included, plus ~40% of postes
          const isPartOfFtth =
            nodeType === "ds-taps" ||
            nodeType === "ds-splitters" ||
            nodeType === "ds-mufas" ||
            rProj < 0.40;

          if (isProjectFilter && !isPartOfFtth) {
            continue;
          }

          // Generate detailed attributes
          const { attributes, symbol } = generateNodeAttributes(nodeType, seed, zone, sub.name);
          const projectAttrs = isPartOfFtth ? generateProjectAttributes(nodeType, seed, zone) : undefined;

          // Check for any user overlay edits
          const edited = customRecordEdits.get(nodeId);
          const mergedAttributes = edited ? { ...attributes, ...edited.attributes } : attributes;

          results.push({
            id: nodeId,
            recordUuid: nodeId,
            datasetId: nodeType,
            appId,
            projectId: isPartOfFtth ? (projectId || "proj-ftth-nacional") : null,
            projectAppId: isPartOfFtth ? `pa-${nodeType}` : null,
            projectRecordUuid: isPartOfFtth ? `prec-${nodeId}` : null,
            contextRef: isPartOfFtth ? `project:proj-ftth-nacional` : `app:${appId}`,
            revision: edited?.revision || 1,
            geometry: {
              type: "Point",
              coordinates: [Number(lon.toFixed(6)), Number(lat.toFixed(6))],
            },
            symbol,
            count: 1,
            isCluster: false,
            attributes: mergedAttributes,
            project_attributes: projectAttrs,
          });

          if (results.length >= budget) break;
        }
        if (results.length >= budget) break;
      }
      if (results.length >= budget) break;
    }
    if (results.length >= budget) break;
  }

  return {
    data: results,
    clustered: false,
    totalRecords: activeTotal,
    truncated: results.length >= budget,
    scaleNodes: ACTIVE_SCALE,
    activeProjectNodes: metrics.projectFtthNodes,
  };
}

// Paginated Table Records Query across 1-2 million nodes
export function queryBoliviaPagedRecords(
  datasetId?: string,
  projectId?: string,
  search?: string,
  limit = 100,
  offset = 0,
) {
  const metrics = getScaleMetrics(ACTIVE_SCALE);
  const isProject = Boolean(projectId);

  let targetTotal = isProject ? metrics.projectFtthNodes : ACTIVE_SCALE;

  // Filter by dataset if specified
  let allowedDatasets: NetworkLayerType[] = [
    "ds-postes",
    "ds-taps",
    "ds-splitters",
    "ds-mufas",
    "ds-camaras",
  ];

  if (datasetId) {
    allowedDatasets = [datasetId as NetworkLayerType];
    if (datasetId === "ds-postes") targetTotal = isProject ? Math.round(metrics.postesCount * 0.35) : metrics.postesCount;
    else if (datasetId === "ds-taps") targetTotal = metrics.tapsCount;
    else if (datasetId === "ds-splitters") targetTotal = metrics.splittersCount;
    else if (datasetId === "ds-mufas") targetTotal = metrics.mufasCount;
    else if (datasetId === "ds-camaras") targetTotal = metrics.camarasCount;
  }

  const rows: any[] = [];
  const start = offset;
  const end = Math.min(offset + limit, targetTotal);

  for (let i = start; i < end; i++) {
    const seed = i * 17 + 1013;
    const zoneIndex = Math.floor(pseudoRandom(seed + 1) * BOLIVIA_ZONES.length);
    const zone = BOLIVIA_ZONES[zoneIndex] || BOLIVIA_ZONES[0];
    const subIndex = Math.floor(pseudoRandom(seed + 2) * zone.subzones.length);
    const sub = zone.subzones[subIndex] || zone.subzones[0];

    // Pick layer
    const dsIndex = Math.floor(pseudoRandom(seed + 3) * allowedDatasets.length);
    const dsId = allowedDatasets[dsIndex] || "ds-postes";

    const nodeId = `rec-node-${zone.department.slice(0, 3).toLowerCase()}-${seed}`;
    const { attributes, symbol } = generateNodeAttributes(dsId, seed, zone, sub.name);
    const isFtth = dsId !== "ds-postes" || pseudoRandom(seed + 9) < 0.35;
    const projectAttrs = isFtth ? generateProjectAttributes(dsId, seed, zone) : {};

    // Check custom edit
    const edited = customRecordEdits.get(nodeId);
    const finalAttrs = edited ? { ...attributes, ...edited.attributes } : attributes;

    // Coordinate inside subzone
    const lon = sub.bbox[0] + pseudoRandom(seed + 4) * (sub.bbox[2] - sub.bbox[0]);
    const lat = sub.bbox[1] + pseudoRandom(seed + 5) * (sub.bbox[3] - sub.bbox[1]);

    rows.push({
      id: nodeId,
      record_id: nodeId,
      recordUuid: nodeId,
      project_record_id: isFtth ? `prec-${nodeId}` : null,
      projectRecordUuid: isFtth ? `prec-${nodeId}` : null,
      project_app_id: isFtth ? `pa-${dsId}` : null,
      projectAppId: isFtth ? `pa-${dsId}` : null,
      dataset_id: dsId,
      datasetId: dsId,
      dataset_name: symbol.label,
      datasetName: symbol.label,
      app_id: dsId.replace("ds-", "app-"),
      appId: dsId.replace("ds-", "app-"),
      project_id: isFtth ? (projectId || "proj-ftth-nacional") : null,
      projectId: isFtth ? (projectId || "proj-ftth-nacional") : null,
      attributes: {
        ...finalAttrs,
        ...(isProject ? projectAttrs : {}),
      },
      geometry: {
        type: "Point",
        coordinates: [Number(lon.toFixed(6)), Number(lat.toFixed(6))],
      },
      revision: edited?.revision || 1,
      visibility: "published",
      lifecycle: "active",
      status: "active",
      updated_at: new Date(Date.now() - (seed % 864000000)).toISOString(),
    });
  }

  const nextCursor = end < targetTotal ? String(end) : null;

  return {
    data: rows,
    rows,
    totalRecords: targetTotal,
    total: targetTotal,
    nextCursor,
    scale: ACTIVE_SCALE,
  };
}

// Retrieve single record by ID (either custom edited or deterministically generated)
export function getSingleNodeRecord(id: string) {
  const edited = customRecordEdits.get(id);
  if (edited) {
    return edited;
  }

  // Parse seed and dept from ID (e.g. rec-node-lpz-10492)
  const parts = id.split("-");
  const seed = parseInt(parts[parts.length - 1], 10) || 12345;
  const deptCode = parts[2] || "lpz";

  const zone =
    BOLIVIA_ZONES.find((z) => z.department.slice(0, 3).toLowerCase() === deptCode.toLowerCase()) ||
    BOLIVIA_ZONES[0];
  const sub = zone.subzones[0];

  const rType = pseudoRandom(seed);
  let dsId: NetworkLayerType = "ds-postes";
  if (rType < 0.6) dsId = "ds-postes";
  else if (rType < 0.8) dsId = "ds-taps";
  else if (rType < 0.9) dsId = "ds-splitters";
  else if (rType < 0.96) dsId = "ds-mufas";
  else dsId = "ds-camaras";

  const { attributes, symbol } = generateNodeAttributes(dsId, seed, zone, sub.name);
  const projectAttrs = generateProjectAttributes(dsId, seed, zone);

  const lon = sub.bbox[0] + pseudoRandom(seed + 4) * (sub.bbox[2] - sub.bbox[0]);
  const lat = sub.bbox[1] + pseudoRandom(seed + 5) * (sub.bbox[3] - sub.bbox[1]);

  return {
    id,
    dataset_id: dsId,
    schema_version_id: "v1",
    attributes,
    project_attributes: projectAttrs,
    geometry: {
      type: "Point",
      coordinates: [Number(lon.toFixed(6)), Number(lat.toFixed(6))],
    },
    symbol,
    revision: 1,
    visibility: "published",
    lifecycle: "active",
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  };
}

