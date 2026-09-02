# Contrato API — Apps

## Estado

Activo para el entorno local de usuario maestro. La autenticación y autorización se agregarán antes de exponer Hansa Field fuera de la red controlada.

## `GET /api/apps`

Lista las Apps de forma ascendente por nombre.

Respuesta `200`:

```json
{
  "data": [
    {
      "id": "uuid",
      "code": "POSTES",
      "name": "Postes",
      "allowedGeometries": ["Point"],
      "createdAt": "2026-09-02T00:00:00.000Z"
    }
  ]
}
```

## `POST /api/apps`

Crea una App. El código identifica la App de manera estable e inequívoca para importaciones futuras.

Entrada:

```json
{
  "code": "POSTES",
  "name": "Postes",
  "allowedGeometries": ["Point", "LineString"]
}
```

- `code`: mayúsculas, números y guion bajo; 2–64 caracteres.
- `name`: texto de 2–120 caracteres.
- `allowedGeometries`: uno o más de `Point`, `LineString`, `Polygon`.

Respuesta `201`: la App creada con el mismo formato de `GET`.

Errores:

- `422 VALIDATION_ERROR`: cuerpo inválido.
- `409 APP_CODE_CONFLICT`: el código ya existe.

No se aceptan campos adicionales en este contrato.

## `GET /api/apps/:appId`

Obtiene la definición base de una App para abrir su constructor. Devuelve `404 APP_NOT_FOUND` si no existe.

## `GET /api/apps/:appId/versions/latest`

Obtiene la última versión guardada del formulario o `null` si la App aún no fue configurada.

## `POST /api/apps/:appId/versions`

Guarda una nueva versión inmutable del formulario. El cuerpo contiene `sections`; cada sección tiene UUID, título y campos. Un campo define UUID, `key` estable en minúsculas con guion bajo, etiqueta, tipo, obligatoriedad y, cuando aplique, opciones.

Los tipos disponibles son: `shortText`, `longText`, `number`, `boolean`, `date`, `time`, `singleChoice`, `multipleChoice`, `photo`, `file` y `signature`.

La primera versión es `1`; guardar nuevamente crea la siguiente. Los registros futuros referenciarán la versión con la que fueron creados.

## `PATCH /api/apps/:appId`

Actualiza únicamente los ajustes globales visuales: `description`, `mapIcon` (`pin`, `post`, `cable`, `node`, `building`) y `mapColor` hexadecimal. No modifica ni convierte atributos ya creados.

## Registros manuales

`GET /api/apps/:appId/records` lista los registros de una App.

`POST /api/apps/:appId/records` crea un registro con `attributes` y una geometría `Point` GeoJSON o `null`. La versión más reciente guardada de la App se vincula automáticamente. `PATCH /api/apps/:appId/records/:recordId` edita atributos y ubicación sin cambiar esa versión histórica.

La interfaz inicial permite Punto o sin ubicación; líneas, polígonos, importación y edición directa sobre el mapa se incorporarán como incrementos posteriores.
