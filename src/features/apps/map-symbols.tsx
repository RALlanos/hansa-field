import type { CSSProperties } from "react";

export const MAP_ICON_OPTIONS = [
  { id: "pin", label: "Ubicación" },
  { id: "square", label: "Caja" },
  { id: "triangle", label: "Registro" },
  { id: "diamond", label: "Punto de acceso" },
  { id: "hexagon", label: "Concentrador" },
  { id: "home", label: "Cliente" },
  { id: "building", label: "Edificio" },
  { id: "tower", label: "Torre de telecomunicaciones" },
  { id: "mast", label: "Mástil" },
  { id: "post", label: "Poste" },
  { id: "lamp-post", label: "Poste con luminaria" },
  { id: "splice", label: "Cruce o empalme" },
  { id: "electric", label: "Energía" },
  { id: "generator", label: "Generador" },
  { id: "battery", label: "Batería" },
  { id: "satellite", label: "Antena parabólica" },
  { id: "node", label: "Nodo móvil" },
  { id: "olt", label: "Equipo OLT" },
  { id: "cable", label: "Línea continua" },
  { id: "cable-dashed", label: "Línea segmentada" },
] as const;

export type MapIconId = (typeof MAP_ICON_OPTIONS)[number]["id"];

const mapIconIds = new Set<string>(MAP_ICON_OPTIONS.map(({ id }) => id));
const defaultColor = "#3d7398";

export function normalizeMapIcon(icon: string): MapIconId {
  return mapIconIds.has(icon) ? (icon as MapIconId) : "pin";
}

export function normalizeMapColor(color: string): string {
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : defaultColor;
}

export function mapLineDashArray(icon: string): string | undefined {
  return normalizeMapIcon(icon) === "cable-dashed" ? "8 6" : undefined;
}

export function mapIconMarkerHtml(icon: string, color: string): string {
  const normalizedIcon = normalizeMapIcon(icon);
  const normalizedColor = normalizeMapColor(color);
  return `<span class="record-map-symbol" style="color:${normalizedColor}"><svg aria-hidden="true" viewBox="0 0 24 24"><use href="/map-symbols.svg#map-icon-${normalizedIcon}"></use></svg></span>`;
}

type MapSymbolProps = Readonly<{
  icon: string;
  color: string;
  className?: string;
  label?: string;
}>;

export function MapSymbol({ icon, color, className, label }: MapSymbolProps) {
  const style: CSSProperties = { color: normalizeMapColor(color) };
  const accessibility = label
    ? { "aria-label": label, role: "img" as const }
    : { "aria-hidden": true as const };

  return (
    <svg
      {...accessibility}
      className={className}
      style={style}
      viewBox="0 0 24 24"
    >
      <use href={`/map-symbols.svg#map-icon-${normalizeMapIcon(icon)}`} />
    </svg>
  );
}
