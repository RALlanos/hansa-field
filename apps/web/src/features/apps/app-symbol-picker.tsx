import { MAP_ICON_OPTIONS, MapSymbol, type MapIconId } from "./map-symbols";

type Props = Readonly<{
  icon: MapIconId;
  color: string;
  onIconChange: (icon: MapIconId) => void;
  onColorChange: (color: string) => void;
}>;

export function AppSymbolPicker({
  icon,
  color,
  onIconChange,
  onColorChange,
}: Props) {
  return (
    <>
      <fieldset className="map-symbol-fieldset">
        <legend>Símbolo del mapa</legend>
        <div className="map-symbol-grid">
          {MAP_ICON_OPTIONS.map((option) => (
            <button
              aria-label={option.label}
              aria-pressed={icon === option.id}
              className="map-symbol-option"
              key={option.id}
              onClick={() => onIconChange(option.id)}
              style={{ color }}
              type="button"
            >
              <MapSymbol color={color} icon={option.id} />
            </button>
          ))}
        </div>
      </fieldset>
      <label>
        Color de la capa
        <span className="map-color-control">
          <input
            aria-label="Seleccionar color de la App"
            type="color"
            value={color}
            onChange={(event) => onColorChange(event.target.value)}
          />
          <output>{color.toUpperCase()}</output>
        </span>
      </label>
    </>
  );
}
