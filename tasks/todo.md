# Hansa Field — Task List

## Phase 1: Foundation and first vertical slice

### Task 1: Environment and repository baseline

**Description:** Verificar el entorno disponible y crear el repositorio mínimo sin incorporar todavía módulos de negocio.

**Acceptance criteria:**

- [x] Versiones y puertos requeridos están documentados.
- [x] El repositorio contiene estructura web/API compartida y reglas de trabajo.
- [x] No se depende del repositorio ni de la base del ERP.

**Verification:**

- [x] Instalación reproducible de dependencias.
- [x] Comando mínimo de diagnóstico exitoso.

**Dependencies:** None

**Estimated scope:** M

### Task 2: Executable web/API shell

**Description:** Crear una aplicación web y API mínimas, con configuración validada, health checks y contenedores de desarrollo.

**Acceptance criteria:**

- [ ] Web y API arrancan localmente.
- [ ] Health checks distinguen aplicación, base y servicios auxiliares.
- [ ] Configuración inválida falla con un mensaje claro.

**Verification:**

- [ ] Pruebas enfocadas pasan.
- [ ] Compilación web/API exitosa.
- [ ] Comprobación manual desde navegador.

**Dependencies:** Task 1

**Estimated scope:** M

### Task 3: PostGIS persistence baseline

**Description:** Añadir PostgreSQL/PostGIS, migraciones y las tablas mínimas para Apps, versiones y registros geográficos.

**Acceptance criteria:**

- [ ] Migración nueva y reversión controlada funcionan en una base de prueba.
- [ ] UUID y geometrías Point/LineString/Polygon se validan y persisten.
- [ ] Existen índices espaciales y restricciones esenciales.

**Verification:**

- [ ] Pruebas de integración contra PostGIS real.
- [ ] Migraciones aplican desde una base vacía.

**Dependencies:** Task 2

**Estimated scope:** M

## Checkpoint A: Foundation

- [ ] Web/API/PostGIS arrancan reproduciblemente.
- [ ] Pruebas y compilaciones pasan.
- [ ] Revisión antes del primer flujo funcional.

### Task 4: Create and list Apps

**Description:** Entregar el primer flujo vertical para crear una App desde el área de Apps y visualizar su listado.

**Acceptance criteria:**

- [ ] Una App se crea con nombre, código estable y geometrías admitidas.
- [ ] Código duplicado y entrada inválida se rechazan claramente.
- [ ] La App creada aparece en el listado sin recarga completa.

**Verification:**

- [ ] Pruebas unitarias y de integración.
- [ ] Prueba E2E de creación y listado.

**Dependencies:** Task 3

**Estimated scope:** M

### Task 5: Master records with UUID

**Description:** Crear y consultar registros maestros de una App con atributos dinámicos mínimos y geometría mixta.

**Acceptance criteria:**

- [ ] Cada registro recibe UUID estable.
- [ ] Punto, línea y polígono se guardan y recuperan sin pérdida.
- [ ] La consulta por extensión utiliza PostGIS y no descarga el universo completo.

**Verification:**

- [ ] Pruebas unitarias y de integración espacial.
- [ ] Plan de consulta revisado para uso del índice.

**Dependencies:** Task 4

**Estimated scope:** M

### Task 6: Minimal import preview and confirmation

**Description:** Importar una muestra GeoJSON/CSV pequeña hacia una App con validación, previsualización y confirmación.

**Acceptance criteria:**

- [ ] Ningún registro se publica antes de confirmar.
- [ ] El resultado informa válidos e inválidos.
- [ ] Repetir datos con UUID conocido actualiza; UUID desconocido invalida; ausencia de UUID crea candidato nuevo.

**Verification:**

- [ ] Pruebas con fixtures válidos, inválidos y repetidos.
- [ ] E2E carga → previsualización → confirmación.

**Dependencies:** Task 5

**Estimated scope:** M

### Task 7: Map viewport flow

**Description:** Mostrar en MapLibre los registros importados consultando únicamente la extensión visible.

**Acceptance criteria:**

- [ ] Puntos, líneas y polígonos aparecen correctamente.
- [ ] Mover o ampliar el mapa actualiza la consulta por extensión.
- [ ] Seleccionar un elemento abre sus atributos básicos.

**Verification:**

- [ ] Pruebas del contrato de consulta.
- [ ] E2E de importación y visualización.
- [ ] Comprobación manual con la muestra entregada.

**Dependencies:** Task 6

**Estimated scope:** M

### Task 8: CAD compatibility spike

**Description:** Evaluar sin integrar todavía la lectura de DWG/DXF en Linux y comparar el resultado con el convertidor Tigo entregado.

**Acceptance criteria:**

- [ ] Se prueba LPZ93/LPZ04 o una muestra equivalente sin modificar los originales.
- [ ] Se documentan geometrías, bloques, atributos, capas, calidad y limitaciones.
- [ ] Se registra una decisión sobre librería/servicio, licencia, despliegue y fallback DXF/GeoPackage.

**Verification:**

- [ ] Resultados reproducibles y conteos comparables.
- [ ] Revisión técnica de licencia y compatibilidad con Docker/Linux.

**Dependencies:** Task 2

**Estimated scope:** M

## Checkpoint B: First vertical slice

- [ ] Todas las pruebas y compilaciones pasan.
- [ ] Crear App → importar → confirmar → ver mapa funciona de extremo a extremo.
- [ ] La reimportación demuestra la semántica UUID.
- [ ] La decisión CAD está documentada.
- [ ] Demostración y aprobación del usuario antes de Phase 2.
