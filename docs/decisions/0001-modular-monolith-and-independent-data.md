# ADR-0001: Monolito modular y datos independientes del ERP

## Estado

Aceptado

## Fecha

2026-09-02

## Contexto

Hansa Field debe comenzar como producto independiente, compartir infraestructura Linux/Docker con el ERP cuando corresponda y permitir una integración futura. Un fallo, despliegue o migración de Hansa Field no debe afectar la operación del ERP. El equipo inicial es pequeño y necesita entregar verticalmente sin asumir el costo operacional de microservicios.

## Decisión

Se utilizará un monolito modular TypeScript con repositorio, despliegue y base PostgreSQL/PostGIS independientes del ERP. La interfaz web y la API podrán ejecutarse en contenedores separados, pero los módulos de negocio mantendrán contratos internos y un único modelo transaccional. Las futuras consultas al ERP se realizarán mediante APIs versionadas, nunca mediante escritura directa en sus tablas.

## Alternativas consideradas

### Extender el repositorio y la base del ERP

Rechazado porque aumenta el acoplamiento, el radio de fallo y el riesgo de que migraciones o despliegues de un producto afecten al otro.

### Microservicios desde la primera versión

Rechazado porque la escala del equipo y la etapa de descubrimiento no justifican complejidad de red, despliegue, observabilidad y consistencia distribuida.

## Consecuencias

- Hansa Field puede desplegarse, migrarse y recuperarse de manera independiente.
- Los límites modulares deben mantenerse en código y datos aunque exista un solo backend.
- La integración futura necesita contratos, timeouts y degradación controlada.
- El sistema requiere su propia estrategia de respaldo y observabilidad.
