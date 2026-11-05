# feat: Búsqueda y ordenación de lanzamientos

- **Estado:** Aprobada
- **PRD:** F6, F7 (+ D1, D3, V2; partes de F17 y F18)
- **Rama:** `feat/launch-search-sort`
- **Depende de:** `feat-launch-list`
- **Prioridad:** Should

## Contexto
Con varios lanzamientos, la persona necesita encontrar uno por texto (nombre, lugar o identificador legible) y ordenarlos por nombre, fecha o precio. La API ya busca (`q`) y ordena (`_sort`, `_order`); el cliente solo envía los parámetros y sigue ocultando los borradores (ADR-012). Como el nombre es `"<Cohete> · <Misión>"`, ordenar por nombre ordena primero por cohete y la opción se etiqueta así (V2). La búsqueda y el orden viven en la URL para sobrevivir a recargas y al botón "Atrás".

## Alcance
- **Incluido:**
  - Componente `LaunchFilters` en `/lanzamientos`: campo de búsqueda y dos selectores (criterio y dirección).
  - Parámetros de URL `q`, `orden` (`nombre` | `fecha` | `precio`) y `dir` (`asc` | `desc`).
  - Envío a la API de `q`, `_sort` (`name` | `date` | `price`) y `_order` (`asc` | `desc`).
  - Mensaje de "sin coincidencias".
- **Excluido:**
  - Filtros por estado, fecha o precio (no están en el PRD).
  - Ordenación o búsqueda en el cliente.

## Requisitos (EARS)
| ID | Requisito |
|---|---|
| R1 | El sistema deberá mostrar en `/lanzamientos` un campo de búsqueda con la etiqueta "Buscar lanzamientos" y un selector "Ordenar por" con las opciones "Nombre (cohete y misión)", "Fecha" y "Precio", y un selector "Dirección" con "Ascendente" y "Descendente". |
| R2 | Cuando la persona deje de escribir en el campo de búsqueda durante 300 ms, el sistema deberá poner el texto recortado en el parámetro `?q=` de la URL y pedir `GET /activities` con `q=<texto>` junto con el orden activo. |
| R3 | Si el texto de búsqueda queda vacío o solo con espacios, entonces el sistema deberá quitar `q` de la URL y pedir el listado sin `q`. |
| R4 | Cuando la persona cambie el criterio o la dirección, el sistema deberá actualizar `orden` y `dir` en la URL y pedir el listado con `_sort` y `_order` equivalentes (`nombre`→`name`, `fecha`→`date`, `precio`→`price`). |
| R5 | Mientras la URL no indique orden, el sistema deberá usar "Fecha" y "Ascendente" (`_sort=date&_order=asc`). |
| R6 | Cuando la persona abra `/lanzamientos` con `q`, `orden` o `dir` en la URL, el sistema deberá mostrar esos valores en los controles y usarlos en la petición. |
| R7 | Si `orden` o `dir` de la URL tienen un valor no admitido, entonces el sistema deberá usar el valor por defecto de ese parámetro. |
| R8 | El sistema deberá mostrar los lanzamientos en el orden en que los devuelve la API, ocultando los `draft` también en los resultados de búsqueda. |
| R9 | Si la búsqueda no devuelve ningún lanzamiento visible, entonces el sistema deberá mostrar "No hay lanzamientos que coincidan con «<texto>»." y un botón "Borrar búsqueda" que vacía el campo y quita `q` de la URL. |
| R10 | Si la petición de búsqueda u orden falla, entonces el sistema deberá mostrar el mensaje de error con "Reintentar" conservando el texto de búsqueda y el orden elegidos. |

## Criterios de aceptación
### R1
- **Dado** la persona abre `/lanzamientos`
- **Cuando** se carga la página
- **Entonces** existen `getByRole('searchbox', { name: 'Buscar lanzamientos' })`, `getByRole('combobox', { name: 'Ordenar por' })` con las tres opciones y `getByRole('combobox', { name: 'Dirección' })` con las dos

### R2
- **Dado** la persona está en `/lanzamientos`
- **Cuando** escribe "falcon" y espera
- **Entonces** la URL contiene `q=falcon`, se envía una única petición `GET /activities?q=falcon&_sort=date&_order=asc` (no una por letra) y se muestran las tarjetas que devuelve la API simulada ("Misión Luna" y "Ventana Perdida")

### R3
- **Dado** la URL `/lanzamientos?q=falcon`
- **Cuando** la persona borra el campo o escribe solo "   "
- **Entonces** la URL ya no contiene `q` y la petición se envía sin `q`

### R4
- **Dado** la persona está en `/lanzamientos?q=falcon`
- **Cuando** elige "Precio" y "Descendente"
- **Entonces** la URL contiene `q=falcon&orden=precio&dir=desc` y se envía `GET /activities?q=falcon&_sort=price&_order=desc`
- **Y** al elegir "Nombre (cohete y misión)" se envía `_sort=name`

### R5
- **Dado** la URL `/lanzamientos` sin parámetros
- **Cuando** se carga la página
- **Entonces** los selectores muestran "Fecha" y "Ascendente" y la petición es `GET /activities?_sort=date&_order=asc`

### R6
- **Dado** la URL `/lanzamientos?q=kourou&orden=precio&dir=desc`
- **Cuando** la persona la abre (o recarga, o vuelve a ella con "Atrás")
- **Entonces** el campo muestra "kourou", los selectores "Precio" y "Descendente", y la petición es `GET /activities?q=kourou&_sort=price&_order=desc`

### R7
- **Dado** la URL `/lanzamientos?orden=plazas&dir=arriba`
- **Cuando** se carga la página
- **Entonces** los selectores muestran "Fecha" y "Ascendente" y la petición usa `_sort=date&_order=asc`

### R8
- **Dado** que para `q=kourou` la API simulada devuelve `activity-5` ("Ariane 6 · Mirador Orbital") y `activity-7` ("Vega · Prueba de Sistemas", `draft`)
- **Cuando** la persona busca "kourou"
- **Entonces** solo ve la tarjeta "Mirador Orbital"
- **Y** si para `_sort=price&_order=asc` la API devuelve `activity-3`, `activity-6`, `activity-1` en ese orden, las tarjetas aparecen en ese mismo orden

### R9
- **Dado** que para `q=zzz` la API devuelve `[]` (o para `q=vega` solo el borrador `activity-7`)
- **Cuando** la persona busca "zzz"
- **Entonces** ve "No hay lanzamientos que coincidan con «zzz»." y, al pulsar "Borrar búsqueda", el campo queda vacío, la URL no tiene `q` y vuelven a verse los 8 lanzamientos

### R10
- **Dado** la persona ha buscado "falcon" con orden "Precio" y la petición se aborta (red caída)
- **Cuando** se muestra el resultado
- **Entonces** ve el mensaje de red caída con "Reintentar", el campo sigue con "falcon" y el selector con "Precio"; al pulsar "Reintentar" se repite `GET /activities?q=falcon&_sort=price&_order=asc`

## Casos límite
- 0 resultados, o resultados que solo son borradores (R9).
- Texto con espacios alrededor (" falcon "): se envía `q=falcon` (R2).
- Texto con tildes o mayúsculas ("Órbita"): se envía tal cual; la API no distingue mayúsculas.
- Escritura rápida: solo cuenta la última búsqueda; las anteriores se cancelan (`feat-error-handling` R11).
- Valores de URL no admitidos (R7).
- "Ordenar por nombre" ordena por cohete y luego misión ("Ariane 6 · …" antes que "Electron · …"); "Paseo Lunar Express", sin cohete, se ordena por su nombre completo (V2).

## Fuera de la spec / notas
- Esta spec cambia la petición por defecto del listado: el criterio de `feat-launch-list` R1 ("sin parámetros de consulta") pasa a ser `GET /activities?_sort=date&_order=asc`; se actualiza ese test.
- El texto de búsqueda se codifica en la URL con `URLSearchParams` (por ejemplo, "Órbita Marciana" → `q=%C3%93rbita+Marciana`).
