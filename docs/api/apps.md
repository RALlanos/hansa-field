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
