# Hansa Field: cómo funciona ahora

Guía de la versión conectada después del reset del 8 de septiembre de 2026. Es una base inicial, no la arquitectura completa terminada.

## Las piezas, en palabras simples

- **Template:** un molde de formulario. Define campos, pero no guarda registros.
- **App:** un formulario operativo con sus registros. Puede crearse con o sin Template.
- **Proyecto:** un espacio de trabajo. Puede empezar vacío, relacionar Apps o tener datos propios sin ninguna App.
- **Cajón:** una receta que agrupa Apps y sus configuraciones. Aplicarla relaciona esas Apps con un Proyecto; no copia registros.
- **Dataset:** el contenedor interno de datos de una App o de una colección local. No necesitas administrarlo como otra pantalla.

## Flujo principal

```text
Template (opcional)
        │
        ▼
       App ───────────────────► Crear o importar registros
        │                                  │
        │                                  ▼
        │                             Mapa y tabla
        │
        ├── Relacionar directamente ──┐
        │                            │
        └── Agrupar en un Cajón ──────┤
                                     ▼
                                  Proyecto
                                     │
                  ┌──────────────────┴──────────────────┐
                  ▼                                     ▼
          App relacionada                       Colección local
          (Project App)                         (sin ninguna App)
                  │                                     │
                  └──────────────────┬──────────────────┘
                                     ▼
                         Crear o importar registros
                                     │
                                     ▼
                              Mapa y tabla
                                     │
                                     ▼
                         Editar dentro del Proyecto
```

Relacionar una App **no incorpora automáticamente todos sus registros** al Proyecto.

## El mismo registro en dos proyectos

Un **Record** es el registro base. Un **Project Record** es su participación en un Proyecto.

```text
Registro base: altura = 9
          │
          ├── Proyecto A: muestra 9
          │
          └── Proyecto B: cambia su altura a 12
                         A y el registro base siguen en 9
```

**Incorporar** reutiliza el registro base y crea otra participación, sin duplicarlo. En la interfaz actual primero hay que relacionar la misma App con el Proyecto destino.

**Retirar del Proyecto** quita esa participación, no borra el registro base ni las participaciones de otros proyectos.

## Importación actual

```text
Elegir contexto: App o Proyecto
    → Subir ZIP Shapefile o GeoJSON
    → Asociar cada _status con una App/colección existente, o ignorarlo
    → Comprobar CRS
    → Casar columnas con campos del formulario
    → Revisar
    → Confirmar y guardar
```

Desde una App se crean registros base. Desde un Proyecto se crean registros base y su participación en ese Proyecto. La procedencia de la carga queda registrada.

El flujo conectado admite cargas nuevas en EPSG:4326, con un máximo inicial de 20.000 registros por archivo. **La reimportación que actualiza registros existentes todavía no está conectada en esta interfaz.**

## Qué podemos recuperar poco a poco

El código anterior sigue disponible, aunque sus pantallas y módulos no están activos. Podemos recuperar, por ejemplo, el constructor de formularios, el selector de iconos, los filtros o las herramientas de edición del mapa.

Para cada recuperación:

```text
Me indicas la pantalla o función anterior
    → Recuperamos su parte útil
    → La conectamos al modelo nuevo
    → La revisas
    → Continuamos con la siguiente
```

No necesitamos recuperar la base de datos antigua. La versión actual tiene una interfaz simplificada; edición gráfica de geometría, configuración avanzada de Project Apps, territorios, equivalencias y consolidación todavía requieren trabajo.

Inicio: [http://localhost:3200](http://localhost:3200).
