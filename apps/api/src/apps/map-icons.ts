export const MAP_ICON_IDS = [
  "pin",
  "square",
  "triangle",
  "diamond",
  "hexagon",
  "home",
  "building",
  "tower",
  "mast",
  "post",
  "lamp-post",
  "splice",
  "electric",
  "generator",
  "battery",
  "satellite",
  "node",
  "olt",
  "cable",
  "cable-dashed",
] as const;

export type MapIconId = (typeof MAP_ICON_IDS)[number];
