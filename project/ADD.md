# ADD — AstroBookings Client

- **Estado:** Aprobado (2026-11-05)
- **Última actualización:** 2026-11-05
- **PRD de referencia:** [PRD.md](PRD.md)

## 1. Visión general

Aplicación web de una sola página (SPA) en React que consume directamente la API **activity-bookings-express** ejecutada en local por la persona (fork) en `http://localhost:3000`. No hay backend propio ni base de datos en el cliente: todos los datos de negocio proceden de la API (PRD §6, fiabilidad de los datos).

```text
┌──────────────────────────── Navegador ─────────────────────────────┐
│                                                                    │
│  Páginas (features/*)  ──usan──▶  hooks de datos (use-*.ts)        │
│        │                               │                           │
│        │ muestran                       │ llaman                   │
│        ▼                               ▼                           │
│  Componentes UI (components/)     api/ (cliente HTTP + recursos)   │
│                                        │  valida respuestas (Zod)  │
│                                        ▼                           │
│                               domain/ (mapeo API → dominio,        │
│                               reglas, formato, errores en español) │
│                                                                    │
│  SessionProvider (contexto) ◀── eventos 401 ── api/http.ts         │
│        │ token + usuario                                           │
│        ▼                                                           │
│  localStorage ("astrobookings.session")                            │
└────────────────────────────────┬───────────────────────────────────┘
                                 │ fetch JSON (CORS habilitado en la API)
                                 ▼
               activity-bookings-express  (http://localhost:3000)
```

Flujo de una petición: página → hook → función de recurso (`api/bookings.ts`) → `http()` (añade token, gestiona errores y red) → validación de la respuesta con su esquema → función de mapeo de `domain/` → tipo de dominio que consume la UI. Los componentes nunca ven la forma cruda de la API.

Capas y responsabilidades:

| Capa | Carpeta | Responsabilidad | Depende de |
|---|---|---|---|
| Configuración | `src/config.ts` | Leer y validar `VITE_API_URL` | — |
| Cliente API | `src/api/` | `fetch`, cabeceras, token, errores HTTP/red, esquemas de respuesta | `config`, `domain` (solo tipos de error) |
| Dominio | `src/domain/` | Tipos del dominio, mapeo API → dominio, reglas de reservabilidad, importe, formato, traducción de errores | — (funciones puras) |
| Sesión | `src/features/session/` | Contexto de sesión, persistencia, caducidad, rutas protegidas, login/registro | `api`, `domain` |
| Funcionalidades | `src/features/launches/`, `src/features/bookings/` | Páginas, componentes específicos y hooks de datos | `api`, `domain`, `components`, `hooks` |
| UI genérica | `src/components/`, `src/hooks/` | Layout, estados de carga/error/vacío, campos de formulario, hook genérico de carga | `domain` (tipos de error) |

## 2. Stack

Versiones: se usa la **última versión estable** de cada paquete en el momento del *scaffolding* (spec `chore`), fijada en `package-lock.json`. Las versiones mayores objetivo a la fecha de este ADD son las de la tabla; quien haga el scaffolding comprueba la vigente con `npm view <paquete> version` y, si hay una mayor nueva estable, la usa siempre que no rompa las plantillas de las skills.

| Capa | Tecnología (mayor objetivo) | Motivo |
|---|---|---|
| Entorno | Node.js 24 LTS + npm | LTS activa; npm viene incluido, sin gestor extra |
| Lenguaje | TypeScript 5.9+ (`strict`, `noUncheckedIndexedAccess`) | Exigido por AGENTS.md |
| UI | React 19 | Exigido por AGENTS.md |
| Build y servidor de desarrollo | Vite 7+ (plantilla `react-ts`) | Exigido por AGENTS.md; soporta `.env.<mode>` sin configuración |
| Enrutado | **React Router 7** (modo declarativo: `BrowserRouter`, `Routes`, `useSearchParams`) | ADR-004. 7 pantallas con parámetros, rutas protegidas y estado en la URL (búsqueda, orden, filtro) |
| Validación de respuestas | **Zod 4** | ADR-005. Valida en tiempo de ejecución lo que llega de la API e infiere los tipos DTO |
| Estado | React (`useState`, `useReducer`, `useContext`) | ADR-006. Sin librería de estado ni de caché |
| Estilos | CSS plano (un `global.css` + CSS Modules de Vite cuando haga falta) | Sin dependencias; suficiente para diseño adaptable |
| Formato de precio y fecha | `Intl.NumberFormat` / `Intl.DateTimeFormat` (`es-ES`) | Nativo; sin librería de fechas |
| Tests unitarios y de componentes | Vitest 4 + jsdom + Testing Library (`react`, `user-event`, `jest-dom`) | Exigido por AGENTS.md |
| Tests e2e | Playwright (última 1.x) — Chromium y Firefox | Exigido por AGENTS.md; cubre la compatibilidad (Edge = Chromium) |
| Lint | ESLint (configuración de la plantilla de Vite + `typescript-eslint`) | Necesario para el script `lint` de la skill `coding-react` |
| Backend | activity-bookings-express (fork local, `http://localhost:3000`) | ADR-001 |

Dependencias de ejecución añadidas sobre React: **solo** `react-router` y `zod`. Todo lo demás es de desarrollo.

## 3. Estructura de carpetas

```text
.env.example               VITE_API_URL=http://localhost:3000 (documentación)
.env.development           VITE_API_URL=http://localhost:3000 (se versiona: es local, no secreto)
.env.e2e                   VITE_API_URL=http://localhost:3999 (puerto sin servidor: lo no interceptado falla)
vite.config.ts             Configuración de Vite y de Vitest (bloque `test`)
playwright.config.ts       Proyectos e2e (mock) y smoke (API real)

src/
  main.tsx                 Punto de entrada: monta <App/> con BrowserRouter
  App.tsx                  Definición de rutas (§5.1) dentro de <SessionProvider> y <Layout>
  config.ts                Lee import.meta.env.VITE_API_URL; lanza error claro si falta
  api/
    http.ts                http<T>(path, schema, init): URL base, JSON, Bearer token, errores, red, 401 global
    errors.ts              ApiError (status, kind, message, fieldErrors), NetworkError, ContractError
    schemas.ts             Esquemas Zod de las respuestas (ActivityDto, BookingDto, AuthResponseDto, ErrorResponseDto…)
    auth.ts                register(), login()
    activities.ts          getActivities({ q, sort, order }), getActivity(id)
    bookings.ts            createBooking(), getMyBookings(), getBooking(id)
  domain/                  Módulo ÚNICO de mapeo API → dominio y reglas de negocio (funciones puras)
    launch.ts              type Launch, toLaunch(dto), parseLaunchName(name) (D1), isVisible (D3),
                           getBookability(launch, now) (D3, D4)
    booking.ts             type Booking, toBooking(dto), totalAmount(price, participants), paymentStatusLabel (F16)
    format.ts              formatPrice (EUR, D7), formatDateTime / formatDate (es-ES, D8), formatDuration
    api-errors.ts          parseAvailableSeats(message) (D2/F10), toUserMessage(error) y traducción de
                           mensajes y errores por campo al español (F17)
    session.ts             type Session, getTokenExpiry(token) (exp del JWT), isExpired(session, now)
  hooks/
    use-async-data.ts      Hook genérico de carga: { status: loading | error | ready }, cancelación con AbortController
  components/
    Layout.tsx             Cabecera, navegación, estado de sesión y botón "Cerrar sesión"; <main>
    LoadingIndicator.tsx   role="status"
    ErrorMessage.tsx       role="alert"; muestra mensaje traducido; botón "Reintentar" opcional
    EmptyState.tsx         Mensaje de "no hay datos"
    FormField.tsx          label + input + error por campo asociado con aria-describedby
    NotFoundPage.tsx       Ruta *
  features/
    session/
      SessionProvider.tsx  Contexto: session, signIn, signOut, aviso de sesión caducada
      use-session.ts       Hook de acceso al contexto
      session-storage.ts   load/save/clear en localStorage (con validación Zod y caducidad)
      RequireAuth.tsx      Envoltorio de rutas protegidas
      LoginPage.tsx        F2
      RegisterPage.tsx     F1
    launches/
      LaunchListPage.tsx   F5–F7; estado de búsqueda/orden en la URL
      LaunchFilters.tsx    Búsqueda (F6) y orden (F7)
      LaunchCard.tsx       Elemento del listado (F5)
      LaunchDetailPage.tsx F8 + contenedor de BookingForm
      BookabilityNotice.tsx Motivo por el que no se puede reservar (F11)
      use-launches.ts      Carga del listado (filtra draft)
      use-launch.ts        Carga del detalle
    bookings/
      BookingForm.tsx      F9–F12, F18: plazas, importe, envío
      use-create-booking.ts Envío con protección contra doble envío
      MyBookingsPage.tsx   F14, F19
      BookingFilter.tsx    F19
      BookingDetailPage.tsx F13 (confirmación) y F15
      PaymentStatusBadge.tsx F16
      use-my-bookings.ts
      use-booking.ts
  styles/
    global.css

tests/
  setup.ts                 jest-dom, limpieza, process.env.TZ = 'UTC'
  unit/
    domain/                launch.test.ts, booking.test.ts, format.test.ts, api-errors.test.ts, session.test.ts
    api/                   http.test.ts, auth.test.ts, activities.test.ts, bookings.test.ts
    features/              LoginPage.test.tsx, RegisterPage.test.tsx, RequireAuth.test.tsx, LaunchCard.test.tsx,
                           LaunchListPage.test.tsx, BookingForm.test.tsx, MyBookingsPage.test.tsx, …
  e2e/
    fixtures/
      api-mock.ts          Helper que registra page.route para cada endpoint y permite sobrescribir respuestas
      data.ts              Lanzamientos, reservas y respuestas de error de ejemplo (formas reales de la API)
    auth.spec.ts           F1–F4
    launches.spec.ts       F5–F8, F11
    booking.spec.ts        F9–F13, F18
    my-bookings.spec.ts    F14–F16, F19
    errors.spec.ts         F17 (red caída, errores por campo)
    smoke/
      real-api.smoke.spec.ts  Recorrido completo contra la API real (opcional)
```

Notas:
- Los tipos DTO (forma de la API) se infieren de los esquemas en `api/schemas.ts` (`z.infer`) y no salen de `api/` + `domain/`. Los tipos de dominio viven en `domain/`. No se crea `src/types/` (desviación consciente de la estructura por defecto de `coding-react`).
- Los tests de `tests/unit/` reflejan la estructura de `src/` para localizarlos fácilmente.

## 4. Integración con la API

- **URL base:** `VITE_API_URL` (por defecto en desarrollo `http://localhost:3000`, vía `.env.development`).
- **Origen:** API del curso **activity-bookings-express**, fork ejecutado en local con `npm run dev` (puerto 3000). Contrato verificado leyendo su código (`src/routes/*.ts`, `src/types/*.ts`, `src/services/*.ts`, `src/middleware/auth.middleware.ts`, `src/utils/jwt.ts`).
- **CORS:** la API ya ejecuta `app.use(cors())` (todas las procedencias), por lo que el navegador puede llamar directamente desde `http://localhost:5173`. **No se usa proxy de Vite** (ADR-003).
- **Autenticación:** cabecera `Authorization: Bearer <accessToken>`. JWT firmado con caducidad `24h` (claim `exp`). Payload `{ userId: "user-N", email }`.
- **Formato:** JSON en peticiones y respuestas (`Content-Type: application/json`).

### 4.1 Endpoints usados

| # | Método | Endpoint | Sesión | Petición | Respuesta OK | Errores relevantes | Requisitos |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/users` | No | `{ username, email, password, terms: true }` | **201** `AuthResponse` (incluye token: la persona queda con sesión iniciada) | 400 `Validation failed` + `errors[]` por campo (`username`, `email`, `password`, `terms`); 400 `Email is already registered` + `errors:[{field:'email'}]` | F1 |
| 2 | POST | `/login` | No | `{ email, password }` | **200** `AuthResponse` | 400 `Validation failed` (campos vacíos); **401** `Invalid email or password` (no indica cuál falla) | F2 |
| 3 | GET | `/activities?q=&_sort=&_order=` | No | `q` busca en `name`, `location`, `slug` (sin distinguir mayúsculas); `_sort` ∈ `name` \| `date` \| `price`; `_order` ∈ `asc` \| `desc` | **200** `Activity[]` (incluye `draft`) | 500 `Failed to retrieve activities` | F5–F7 |
| 4 | GET | `/activities/:id` | No | — | **200** `Activity` | 404 `Activity not found` | F8 |
| 5 | POST | `/bookings` | **Sí** | `{ activityId, participants }` (`participants` número ≥ 1) | **201** `Booking` **sin** el objeto `activity` | 400 `Validation failed` + `errors[]` (`activityId`, `participants`); 400 `Capacity exceeded. Available: X, Requested: Y`; 401; **402** `Payment could not be processed`; 404 `Activity not found` | F9–F13 |
| 6 | GET | `/bookings` | **Sí** | (`?activityId=` existe pero no se usa, ADR-009) | **200** `BookingWithActivity[]` (solo las de la persona) | 401; 500 `Failed to retrieve bookings` (p. ej. si una reserva apunta a una actividad borrada) | F14, F16, F19 |
| 7 | GET | `/bookings/:id` | **Sí** | — | **200** `BookingWithActivity` | 401; 404 `Booking not found` (no existe **o** no es de la persona) | F13, F15, F16 |

Detalles del contrato que condicionan el cliente:
- `GET /activities` solo aplica filtros/orden si llega `q`, `slug` o `_sort`; `_order` por sí solo se ignora. El cliente envía únicamente los parámetros con valor.
- `_sort=name` ordena por el `name` completo (`"<Cohete> · <Misión>"`), es decir, **primero por cohete** (ver §9, P2).
- Todos los 401 del middleware tienen `message` `Authentication required. Please provide a valid token.` (sin token) o `Invalid or expired token. Please login again.` (token inválido o caducado).
- La validación de `participants` en la API solo exige `typeof number` y `≥ 1`: acepta decimales. El cliente garantiza un **entero** ≥ 1.
- Los mensajes de la API están **en inglés**; la interfaz es en español (D8). El cliente los traduce (ADR-008).
- El cobro se intenta **después** de comprobar las plazas: un 402 implica que había plazas pero el pago (importe múltiplo de 1000) falló; no se crea reserva ni pago.

### 4.2 Modelos

Esquemas de respuesta (`src/api/schemas.ts`), reflejo exacto de lo que devuelve la API:

```ts
import { z } from 'zod';

export const activityStatusSchema = z.enum(['draft', 'published', 'confirmed', 'sold-out', 'done', 'cancelled']);
export const paymentStatusSchema = z.enum(['pending', 'paid', 'refunded']);

// Fecha ISO 8601; la API admite también fechas sin hora ("2026-10-26").
const isoDateString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date');

export const activityDtoSchema = z.object({
  id: z.string(),                 // "activity-N"
  name: z.string(),               // "<Cohete> · <Misión>" (D1)
  slug: z.string(),
  price: z.number(),              // por plaza, en euros (D7)
  date: isoDateString,
  duration: z.number(),           // minutos
  location: z.string(),
  minParticipants: z.number(),
  maxParticipants: z.number(),
  status: activityStatusSchema,
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export const authResponseDtoSchema = z.object({
  user: z.object({
    id: z.number(),               // ¡numérico! (en reservas userId es "user-N")
    username: z.string(),
    email: z.string(),
    terms: z.boolean(),
  }),
  accessToken: z.string(),
});

// POST /bookings → 201 (sin datos de la actividad)
export const bookingDtoSchema = z.object({
  id: z.string(),                 // "booking-N"
  activityId: z.string(),
  userId: z.string(),             // "user-N"
  participants: z.number(),
  createdAt: z.string(),
  paymentId: z.string().optional(),
  paymentStatus: paymentStatusSchema.optional(),
});

// GET /bookings y GET /bookings/:id
export const bookingWithActivityDtoSchema = bookingDtoSchema.extend({
  paymentStatus: paymentStatusSchema, // la API lo resuelve a 'pending' si falta
  activity: z.object({
    name: z.string(),
    slug: z.string(),
    price: z.number(),
    date: isoDateString,
    duration: z.number(),
    location: z.string(),
    status: activityStatusSchema,
  }),
});

export const errorResponseDtoSchema = z.object({
  message: z.string(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })),
});
```

Peticiones (tipos simples en los módulos de recurso):

```ts
type RegisterRequest = { username: string; email: string; password: string; terms: true }; // ¡terms, no termsAccepted!
type LoginRequest = { email: string; password: string };
type CreateBookingRequest = { activityId: string; participants: number }; // entero ≥ 1
type ActivitiesQuery = { q?: string; sort?: 'name' | 'date' | 'price'; order?: 'asc' | 'desc' };
```

Modelos del dominio (`src/domain/`), lo único que ve la UI:

```ts
type LaunchStatus = 'published' | 'confirmed' | 'sold-out' | 'done' | 'cancelled' | 'draft';

interface Launch {
  id: string;
  slug: string;
  fullName: string;          // name tal cual
  mission: string;           // parte tras " · " (o el name completo si no hay separador)
  rocket: string | null;     // parte antes de " · " (null si no hay separador)
  location: string;
  date: Date;
  durationMinutes: number;
  pricePerSeat: number;      // euros
  totalSeats: number;        // maxParticipants (D2)
  minParticipants: number;
  status: LaunchStatus;
}

type Bookability =
  | { bookable: true }
  | { bookable: false; reason: 'sold-out' | 'done' | 'cancelled' | 'draft' | 'past-date' };

type PaymentStatus = 'pending' | 'paid' | 'refunded';

interface Booking {
  id: string;
  launchId: string;
  participants: number;
  createdAt: Date;
  paymentStatus: PaymentStatus;
  // Solo en GET /bookings y /bookings/:id:
  launch?: Pick<Launch, 'slug' | 'fullName' | 'mission' | 'rocket' | 'location' | 'date' | 'durationMinutes' | 'pricePerSeat' | 'status'>;
  totalAmount?: number;      // pricePerSeat × participants (solo si hay launch)
}

interface Session {
  accessToken: string;
  user: { username: string; email: string };
  expiresAt: number;         // epoch ms, del claim exp del JWT
}
```

### 4.3 Validación en tiempo de ejecución

- Toda respuesta 2xx se valida con su esquema Zod (`schema.safeParse`) dentro de `http()`. Si no cuadra, se lanza `ContractError` y la UI muestra "El servidor ha devuelto una respuesta inesperada" (F17). Nunca se usa `as T` sobre datos de red.
- Toda respuesta no 2xx se intenta leer como `errorResponseDtoSchema`; si el cuerpo no es JSON o no cuadra, se crea un `ApiError` con `message` genérico según el código.
- Los esquemas no son `strict`: campos extra de la API se ignoran (tolerancia a cambios compatibles del fork).

### 4.4 Modelo de errores del cliente

```ts
type ApiErrorKind = 'validation' | 'capacity' | 'unauthorized' | 'payment' | 'not-found' | 'server';

class ApiError extends Error {
  status: number;
  kind: ApiErrorKind;            // 400+errors[] → validation; 400 "Capacity exceeded" → capacity; 401; 402; 404; resto → server
  fieldErrors: Record<string, string>; // de errors[] (field → mensaje traducido)
  availableSeats: number | null; // solo kind 'capacity' (parseAvailableSeats)
}
class NetworkError extends Error {}   // fetch rechazado (API apagada, CORS, DNS)
class ContractError extends Error {}  // respuesta 2xx con forma inesperada
```

`domain/api-errors.ts › toUserMessage(error)` convierte cualquiera de ellos en el texto en español que se muestra (ver ADR-008).

## 5. Gestión de estado y navegación

### 5.1 Rutas y pantallas

| Ruta | Pantalla | Protegida | Requisitos | Notas |
|---|---|---|---|---|
| `/` | — | No | — | Redirige a `/lanzamientos` |
| `/lanzamientos` | `LaunchListPage` | No | F5, F6, F7 | Estado en la URL: `?q=&orden=fecha&dir=asc` |
| `/lanzamientos/:id` | `LaunchDetailPage` (+ `BookingForm`) | No (reservar sí) | F8–F12, F18 | Sin sesión, el formulario se sustituye por enlaces a "Iniciar sesión" y "Crear cuenta" con retorno a esta ruta |
| `/acceso` | `LoginPage` | No | F2, F4 | `?volver=<ruta>`; muestra aviso si llega por sesión caducada |
| `/registro` | `RegisterPage` | No | F1 | Tras 201 la persona queda con sesión iniciada (la API devuelve token) |
| `/reservas` | `MyBookingsPage` | **Sí** | F14, F16, F19 | Filtro en la URL: `?lanzamiento=<activityId>` |
| `/reservas/:id` | `BookingDetailPage` | **Sí** | F13, F15, F16 | Con `state.justCreated` muestra el bloque de confirmación de F13 |
| `*` | `NotFoundPage` | No | — | |

Cabecera (`Layout`): enlaces "Lanzamientos" y, con sesión, "Mis reservas", nombre de usuario y "Cerrar sesión"; sin sesión, "Iniciar sesión" y "Crear cuenta".

Rutas protegidas: `RequireAuth` comprueba la sesión (y su caducidad). Sin sesión válida redirige a `/acceso?volver=<ruta actual>`. Tras iniciar sesión se navega a `volver` (solo rutas internas que empiecen por `/`).

Un lanzamiento en `draft` abierto por URL se trata como **no encontrado** (D3).

### 5.2 Estado

| Estado | Dónde vive | Motivo |
|---|---|---|
| Sesión (token, usuario, caducidad, aviso de caducada) | `SessionProvider` (React Context) + `localStorage` | Es el único estado global (D6, F3, F4) |
| Búsqueda, orden, filtro de reservas | Parámetros de la URL (`useSearchParams`) | Sobrevive a recargas y al botón "Atrás"; sin estado duplicado |
| Datos remotos (listado, detalle, reservas) | Hook de cada vista sobre `useAsyncData` | Se piden siempre frescos al entrar en la vista; no se cachean (fiabilidad de datos) |
| Formularios | Estado local del componente | Simple |
| Plazas disponibles conocidas | Estado local de `BookingForm` | Solo se conocen tras un 400 de capacidad (D2) y caducan al recargar |

`useAsyncData(loader, deps)` devuelve `{ status: 'loading' } | { status: 'error'; error } | { status: 'ready'; data }` y un `reload()`. Cancela con `AbortController` la petición anterior al cambiar `deps` (evita condiciones de carrera al escribir en la búsqueda). Cada vista renderiza explícitamente los tres estados y el vacío (coding-react, regla 3).

Búsqueda (F6): el campo actualiza `?q=` con *debounce* de 300 ms; el orden (F7) se aplica en la API (`_sort`/`_order`). Los `draft` se filtran en el cliente después de recibir la respuesta.

### 5.3 Autenticación y sesión (D6, F3, F4)

- **Almacenamiento:** `localStorage["astrobookings.session"] = { accessToken, user: { username, email }, expiresAt }`. Sobrevive a recargas y a cerrar el navegador (D6). Se valida con Zod al leer; si es inválido o ha caducado, se borra.
- **Caducidad:** `expiresAt` = claim `exp` del JWT × 1000 (decodificación base64url del payload, sin verificar firma; no hace falta librería). Si no se puede decodificar, se usa el momento de recepción + 24 h.
- **Comprobación proactiva:** al arrancar la app, al entrar en una ruta protegida y antes de cada petición autenticada. Si ha caducado → sesión cerrada con aviso de caducidad (sin llamar a la API).
- **401 global:** `http()` recibe la opción `auth: true` en las peticiones que llevan token. Si una de ellas responde 401, `http()` notifica a la sesión (`onSessionRejected`, suscripción registrada por `SessionProvider`), que borra la sesión, guarda el aviso "Tu sesión ha caducado o no es válida. Inicia sesión de nuevo." y redirige a `/acceso?volver=<ruta>`. El 401 de `POST /login` **no** dispara este flujo (lleva `auth: false`) y se muestra como "Email o contraseña incorrectos" (F2).
- **Cierre de sesión (F3):** borra `localStorage`, limpia el contexto y navega a `/lanzamientos`. Las rutas protegidas vuelven a exigir sesión.
- **Varias pestañas:** fuera de alcance (cada pestaña lee `localStorage` al arrancar).

### 5.4 Reserva (F9–F13, F18)

1. `LaunchDetailPage` calcula `getBookability(launch, new Date())`. Si no es reservable, muestra `BookabilityNotice` con el motivo (F11) y no muestra el formulario.
2. `BookingForm`: campo numérico "Número de plazas" (`min=1`, `step=1`, `max` = plazas disponibles conocidas ?? `totalSeats`). Muestra en vivo "Importe total: `formatPrice(totalAmount(price, n))`" (F9).
3. Envío con `use-create-booking`: estado `idle | submitting | error | success`. El botón se deshabilita en `submitting` y un `ref` (`inFlight`) bloquea un segundo envío antes del re-render (F18). No hay reintentos automáticos.
4. Respuestas:
   - 201 → `navigate('/reservas/<id>', { state: { justCreated: true } })`; la página de detalle pide `GET /bookings/:id` (que sí trae la actividad) y muestra la confirmación con lanzamiento, plazas, importe y estado, y enlace a "Mis reservas" (F13).
   - 400 `capacity` → "Solo quedan X plazas libres" (X de `availableSeats`); el `max` del campo pasa a X; si X = 0, se indica que no quedan plazas y se deshabilita el envío (F10).
   - 402 → "El pago no se ha podido procesar. La reserva no se ha realizado." (F12).
   - 400 `validation` → errores junto al campo (F17).
   - 401 → flujo global (F4). 404 → "El lanzamiento ya no existe". Red → mensaje de conexión.

## 6. Mapeo API → dominio (`src/domain/`)

Único lugar donde se interpreta la forma de la API. Todas son funciones puras con test unitario.

| Función | Regla | Origen |
|---|---|---|
| `parseLaunchName(name)` | Divide por la **primera** aparición de `" · "` (espacio, U+00B7, espacio). `rocket` = parte izquierda recortada, `mission` = resto recortado. Si no hay separador o alguna parte queda vacía → `rocket: null`, `mission: name`. | D1 |
| `toLaunch(dto)` | Renombra campos (§4.2), `date` → `Date`. | PRD §7 |
| `isVisible(launch)` | `status !== 'draft'`. | D3 |
| `getBookability(launch, now)` | Reservable si `status ∈ {published, confirmed}` **y** `date > now`. Si no: motivo por prioridad `draft` > `cancelled` > `done` > `sold-out` > `past-date`. `now` se inyecta para poder probarlo. | D3, D4, F11 |
| `bookabilityReasonText(reason)` | `sold-out` "Agotado: no quedan plazas", `done` "Este lanzamiento ya se ha realizado", `cancelled` "Este lanzamiento se ha cancelado", `past-date` "La fecha de este lanzamiento ya ha pasado", `draft` "No disponible". | F11, D8 |
| `totalAmount(price, participants)` | `Math.round(price × participants × 100) / 100` (evita errores de coma flotante). | F9, F14 |
| `toBooking(dto)` | Mapea reserva; si trae `activity`, construye `launch` con `parseLaunchName` y `totalAmount`. | F14, F15 |
| `paymentStatusLabel(status)` | `pending` "Pendiente de pago", `paid` "Pagada", `refunded` "Reembolsada". | F16 |
| `formatPrice(amount)` | `Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })` → `249.999,00 €`. Ojo: `es-ES` no agrupa números de 4 cifras (`2500,00 €`) y usa espacio no separable antes de `€`; los tests comparan con la salida del propio `Intl` o normalizan espacios. | D7 |
| `formatDateTime(date)` | `Intl.DateTimeFormat('es-ES', { dateStyle: 'full', timeStyle: 'short' })` en la zona horaria del navegador → "lunes, 15 de marzo de 2027, 15:30". Tests con `TZ=UTC`. | D8 |
| `formatDuration(minutes)` | "45 min", "3 h 30 min", "3 días 2 h". | F5 |
| `parseAvailableSeats(message)` | Regex `/Available:\s*(\d+)/`; devuelve número o `null` si el texto no cuadra (entonces se muestra "No hay plazas suficientes" sin número). | D2, F10 |
| `toUserMessage(error)` | Traduce `ApiError`/`NetworkError`/`ContractError` a español (ADR-008). | F17 |

## 7. Configuración

- `VITE_API_URL` es obligatoria. `src/config.ts` la lee una vez; si falta, la app muestra un error de configuración claro en vez de pedir a `undefined/...`. Se normaliza quitando la `/` final.
- Ficheros: `.env.example` (documenta la variable), `.env.development` (versionado, `http://localhost:3000`, no es secreto ni entorno real), `.env.e2e` (versionado, `http://localhost:3999`, puerto sin servidor), `.env` y `.env.local` para sobrescrituras personales (ya ignorados en `.gitignore`).
- **CORS:** resuelto por la propia API (`cors()`); sin proxy. Si un fork lo quitara, la solución sería añadir `server.proxy` en `vite.config.ts` y apuntar `VITE_API_URL` a `/api` (no se implementa ahora).
- Scripts de npm: `dev` (`vite`), `build` (`tsc -b && vite build`), `preview`, `typecheck` (`tsc --noEmit`), `lint` (`eslint .`), `test` (`vitest run`), `test:e2e` (`playwright test --project=chromium --project=firefox`), `test:e2e:smoke` (`playwright test --project=smoke`).
- Puertos: app en 5173 (desarrollo); e2e en 5174 (`vite --mode e2e --port 5174 --strictPort`) para no chocar con un `npm run dev` abierto.

## 8. Datos de ejemplo (D5)

La API carga `db/seed/activities.json` y después `db/activities.json`, y **los datos persistidos sobrescriben a la semilla por `id`** (`JsonRepository.load`). El `db/activities.json` del repositorio original ya contiene `activity-1…` (yoga, surf…). Por tanto la spec `chore` del fork debe:

1. Sustituir `db/seed/activities.json` por los lanzamientos de abajo.
2. Vaciar `db/activities.json` (`[]`) — si no, los ids coincidentes seguirían mostrando las actividades antiguas.
3. Vaciar `db/bookings.json` y `db/payments.json` (`[]`) — una reserva que apunte a una actividad inexistente hace fallar `GET /bookings` con 500 para esa persona.

Formato (campos exactos de `Activity` de la API):

| Campo | Tipo | Regla para la semilla |
|---|---|---|
| `id` | string | `activity-<n>` correlativo (el servicio calcula el siguiente id con el sufijo numérico) |
| `name` | string | `"<Cohete> · <Misión>"` con `·` U+00B7 (D1); al menos uno **sin** separador para probar el caso alternativo |
| `slug` | string | Minúsculas ASCII con guiones, sin tildes (`falcon-9-mision-luna`) |
| `price` | number | Euros por plaza. Sin factor común con 1000 (impar y no múltiplo de 5, p. ej. `249999`) para que el pago no falle salvo en el caso de prueba |
| `date` | string | ISO 8601 UTC con hora (`2027-03-15T14:30:00.000Z`); futuras desde 2027, salvo las de prueba de fecha pasada |
| `duration` | number | Minutos |
| `location` | string | Lugar de despegue |
| `minParticipants` | number | ≥ 1 y ≤ `maxParticipants` |
| `maxParticipants` | number | Pequeño (3–12) para poder agotar plazas en una demo |
| `status` | string | Uno de los seis estados |
| `userId` | string | `"user-1"` (proveedor existente en `db/users.json`) |
| `createdAt` | string | ISO 8601 (`2026-11-01T10:00:00.000Z`) |

Conjunto mínimo propuesto (9 lanzamientos):

| id | name | status | date | Propósito |
|---|---|---|---|---|
| activity-1 | Falcon 9 · Misión Luna | published | 2027-03-15 | Reserva normal |
| activity-2 | Starship · Órbita Marciana | confirmed | 2027-06-01 | Reservable en `confirmed` |
| activity-3 | New Shepard · Vuelo Suborbital | published | 2027-02-10 | `price: 12500` → con N par el importe es múltiplo de 1000 → **402** (demo F12) |
| activity-4 | Soyuz · Estación Orbital | sold-out | 2027-04-20 | No reservable: agotado |
| activity-5 | Ariane 6 · Mirador Orbital | cancelled | 2027-09-12 | No reservable: cancelado |
| activity-6 | Electron · Amanecer Orbital | done | 2026-09-30 | No reservable: realizado (fecha pasada coherente) |
| activity-7 | Vega · Prueba de Sistemas | draft | 2027-11-01 | Oculto en el listado (D3) |
| activity-8 | Paseo Lunar Express | published | 2027-12-24 | Sin `" · "`: sin cohete (D1) |
| activity-9 | Falcon Heavy · Ventana Perdida | published | 2026-10-01 | `published` pero fecha pasada → no reservable (D4) |

Ejemplo de dos entradas:

```json
[
  {
    "id": "activity-1",
    "name": "Falcon 9 · Misión Luna",
    "slug": "falcon-9-mision-luna",
    "price": 249999,
    "date": "2027-03-15T14:30:00.000Z",
    "duration": 4320,
    "location": "Cabo Cañaveral, Florida (EE. UU.)",
    "minParticipants": 2,
    "maxParticipants": 6,
    "status": "published",
    "userId": "user-1",
    "createdAt": "2026-11-01T10:00:00.000Z"
  },
  {
    "id": "activity-4",
    "name": "Soyuz · Estación Orbital",
    "slug": "soyuz-estacion-orbital",
    "price": 389999,
    "date": "2027-04-20T08:15:00.000Z",
    "duration": 14400,
    "location": "Cosmódromo de Baikonur (Kazajistán)",
    "minParticipants": 2,
    "maxParticipants": 3,
    "status": "sold-out",
    "userId": "user-1",
    "createdAt": "2026-11-01T10:00:00.000Z"
  }
]
```

El fichero completo es objeto de una spec `chore` (repositorio del fork, no de este cliente). Los mismos datos, en forma de DTO, sirven como fixtures de los tests e2e (`tests/e2e/fixtures/data.ts`) para que mocks y API real coincidan.

## 9. Estrategia de pruebas

| Nivel | Herramienta | Qué cubre | Cómo |
|---|---|---|---|
| Unitario (dominio) | Vitest | `domain/*`: `parseLaunchName` (con/sin separador, partes vacías, varios separadores), `getBookability` (cada estado; fecha igual/anterior/posterior a `now`), `totalAmount` (decimales), formatos (EUR, fechas, duración), `parseAvailableSeats` (texto válido, 0, texto inesperado), `toUserMessage` (cada tipo de error y fallback), `getTokenExpiry`/`isExpired` | Funciones puras; `now` inyectado; `TZ=UTC` |
| Unitario (cliente API) | Vitest + `vi.spyOn(globalThis, 'fetch')` | `http()`: URL base, cabecera Bearer, parseo de `errors[]`, clasificación por `kind`, `NetworkError` cuando `fetch` rechaza, `ContractError` con forma inválida, 401 con `auth: true` notifica a la sesión y con `auth: false` no; recursos: método, ruta, cuerpo (`terms: true`), parámetros de consulta | `fetch` mockeado en el borde con respuestas copiadas de la API real |
| Componentes | Vitest + Testing Library + user-event (jsdom) | Formularios (labels, errores por campo, envío), `BookingForm` (importe en vivo, botón deshabilitado al enviar, doble clic = una petición, mensajes 400/402), `LaunchCard`/`BookabilityNotice`, `RequireAuth` (redirección), `SessionProvider` (persistencia y caducidad), estados cargando/error/vacío de cada página | Se mockea el módulo `src/api/*` (no la lógica); `MemoryRouter` para rutas |
| E2E (determinista) | Playwright + `page.route` | Un test por criterio de aceptación de cada spec: registro, login, logout, sesión caducada (401 simulado), listado sin drafts, búsqueda y orden (se comprueban los parámetros enviados), detalle, reserva correcta → confirmación, capacidad excedida, pago rechazado, no reservable por estado/fecha, Mis reservas, filtro, detalle de reserva ajena (404), API caída (`route.abort()`), móvil (viewport 375 px) | `tests/e2e/fixtures/api-mock.ts` intercepta `http://localhost:3999/**`; cualquier petición no interceptada falla (puerto sin servidor). Sesión inyectada con `page.addInitScript` en `localStorage` cuando el test no prueba el login. Chromium + Firefox |
| Smoke e2e (opcional) | Playwright, proyecto `smoke` | Un recorrido feliz contra la API real: registro con email único → listado → reservar 1 plaza en `activity-1` → ver en Mis reservas | Requiere el fork en marcha con la semilla (§8). No forma parte de `test:e2e`; se ejecuta con `npm run test:e2e:smoke`. Escribe datos en el fork |

Convenciones: nombres de test con el requisito de la spec (`R<n>`) según las skills; sin esperas fijas; localizadores accesibles (`getByRole`, `getByLabel`). Criterio de terminado: `typecheck`, `lint`, `test` y `test:e2e` en verde.

## 10. Decisiones (ADR)

### ADR-001: Backend = fork local de activity-bookings-express
- **Contexto:** PRD §7 fija la API del curso. Hay que elegir entre ella y una API simulada (json-server, MSW).
- **Decisión:** usar el fork en `http://localhost:3000`. No se crea API simulada para desarrollo; los tests usan interceptación (ADR-007).
- **Consecuencias:** la persona debe arrancar el fork para usar la app. Contrato real desde el primer día. Las peculiaridades de la API (inglés, sin plazas disponibles, sin validación de estado) se absorben en `domain/`.

### ADR-002: SPA con React + Vite, sin framework de servidor
- **Contexto:** app pequeña, sin SEO ni renderizado en servidor; AGENTS.md fija React + Vite.
- **Decisión:** SPA cliente pura con la plantilla `react-ts` de Vite.
- **Consecuencias:** despliegue como estáticos; las rutas profundas requieren *fallback* a `index.html` (Vite ya lo hace en `dev` y `preview`).

### ADR-003: Llamada directa a la API con `VITE_API_URL`, sin proxy
- **Contexto:** el navegador necesita CORS. La API ya tiene `app.use(cors())`.
- **Decisión:** llamar directamente a `VITE_API_URL`. No se configura `server.proxy`.
- **Consecuencias:** configuración mínima y URL configurable (PRD §6). En e2e se apunta a un puerto sin servidor para garantizar determinismo. Si CORS desapareciera en el fork, se activa el proxy (§7).

### ADR-004: React Router 7 en modo declarativo
- **Contexto:** 7 pantallas, parámetros (`:id`), rutas protegidas, redirección tras login, estado en la URL. Alternativas: enrutado manual con `history` (más código propio y propenso a errores), TanStack Router (más potente pero más conceptos), React Router en modo *framework*/*data* (loaders; más de lo necesario).
- **Decisión:** `react-router` 7 con `BrowserRouter` + `Routes`. Sin loaders ni actions.
- **Consecuencias:** una dependencia estándar y bien documentada; los datos se cargan en hooks (ADR-006), coherente con las plantillas de `coding-react`.

### ADR-005: Validación de respuestas con Zod
- **Contexto:** la API tiene incoherencias (id numérico frente a `"user-N"`, campos opcionales, fechas sin hora) y PRD §6 exige no mostrar datos incorrectos. Alternativa: *type guards* escritos a mano para 5 formas de respuesta (más código y más fácil de desincronizar).
- **Decisión:** esquemas Zod 4 en `api/schemas.ts`; tipos DTO con `z.infer`. Los formularios **no** usan Zod: validación nativa HTML + funciones puras.
- **Consecuencias:** una dependencia de ejecución (~pequeña). Un cambio incompatible del fork se detecta como `ContractError` visible en vez de un fallo silencioso.

### ADR-006: Sin librería de estado ni de caché de datos
- **Contexto:** solo la sesión es global; los datos deben ser frescos (plazas y estados cambian) y no hay pantallas que compartan datos. Alternativas: TanStack Query, Redux/Zustand.
- **Decisión:** Context para la sesión; hook genérico `useAsyncData` con `AbortController` para cada vista; URL para filtros y orden.
- **Consecuencias:** menos dependencias y conceptos. Se renuncia a caché y reintentos automáticos (no son requisitos). Si en el futuro hiciera falta caché, TanStack Query encaja sin cambiar `api/`.

### ADR-007: E2E deterministas con `page.route` y fixtures con la forma real de la API
- **Contexto:** la API persiste en ficheros JSON; ejecutar e2e contra ella deja datos y depende de su estado. La skill `testing-e2e-playwright` recomienda interceptar.
- **Decisión:** los e2e interceptan `VITE_API_URL` (`.env.e2e` → `http://localhost:3999`) con fixtures que reproducen las respuestas reales (incluidos los textos de error). Un proyecto `smoke` opcional valida contra la API real.
- **Consecuencias:** tests rápidos y repetibles; el riesgo de desalineación con la API se cubre con el smoke y con la validación Zod.

### ADR-008: Traducción de mensajes de la API al español en el cliente
- **Contexto:** F17 pide mostrar el mensaje de la API, pero sus mensajes están en inglés y D8 fija la interfaz en español.
- **Decisión:** `domain/api-errors.ts` traduce: (a) por `kind`/código (401, 402, 404, 500, red, contrato) con textos fijos; (b) errores por campo según `field` (`username`, `email`, `password`, `terms`, `participants`) con el mensaje en español de la regla conocida; (c) `Email is already registered` → "Ya existe una cuenta con este email". Si llega un mensaje desconocido, se muestra el texto genérico del código seguido del original entre paréntesis, para no ocultar información.
- **Consecuencias:** interfaz coherente en español; tabla de traducciones con test. Requiere validación (ver §13, decisión V1).

### ADR-009: Filtro de "Mis reservas" en el cliente
- **Contexto:** F19 filtra por lanzamiento. La API admite `?activityId=`, pero para construir el desplegable hace falta la lista completa de reservas.
- **Decisión:** se pide `GET /bookings` una vez y se filtra en el cliente por `activityId`; opciones del desplegable = lanzamientos distintos de las reservas de la persona. Filtro en la URL (`?lanzamiento=`).
- **Consecuencias:** una sola petición y un solo estado; no se usa el parámetro `activityId` de la API.

### ADR-010: Sesión en `localStorage` con caducidad leída del JWT
- **Contexto:** D6 exige que la sesión sobreviva a recargas hasta caducar (24 h).
- **Decisión:** `localStorage` + `expiresAt` del claim `exp`; comprobación proactiva y 401 global (§5.3). Sin cookies (la API no las emite).
- **Consecuencias:** simple. Expuesto a XSS (aceptable: proyecto de formación, PRD §7). Se evitan llamadas con token caducado.

### ADR-011: Confirmación de reserva en la página de detalle de la reserva
- **Contexto:** `POST /bookings` devuelve la reserva sin la actividad; F13 pide mostrar lanzamiento, plazas, importe y estado.
- **Decisión:** tras el 201 se navega a `/reservas/:id` con `state.justCreated`; esa página pide `GET /bookings/:id` (enriquecida) y muestra el bloque "Reserva confirmada" y el enlace a "Mis reservas".
- **Consecuencias:** una sola pantalla para F13 y F15; la confirmación muestra datos de la API, no recompuestos. Una petición extra. Si esa petición falla, se indica que la reserva sí se creó (con su id) y se ofrece ir a "Mis reservas".

### ADR-012: Búsqueda y orden en la API; ocultación de `draft` en el cliente
- **Contexto:** la API soporta `q`, `_sort` y `_order` pero no filtra por estado.
- **Decisión:** búsqueda y orden se delegan en la API (debounce 300 ms, cancelación de la petición anterior); los `draft` se descartan al recibir la respuesta.
- **Consecuencias:** coherente con el PRD (§7) y sin duplicar lógica. "Ordenar por nombre" ordena por cohete y luego misión (ver §13, V2).

## 11. Riesgos

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | La API permite reservar en `draft`, `cancelled`, `done`, `sold-out` y fechas pasadas | Reservas incoherentes | `getBookability` en el cliente oculta el formulario; tests unitarios y e2e por estado. Riesgo residual: llamadas directas a la API (fuera del producto) |
| R2 | Plazas disponibles desconocidas antes de reservar (D2) | F10 depende del rechazo de la API | `max` del campo = `totalSeats`; tras el 400 se usa X del mensaje; si el texto cambia, `parseAvailableSeats` devuelve `null` y se muestra un mensaje genérico (test del caso) |
| R3 | Importes múltiplos de 1000 → 402 siempre | Lanzamientos con precios "redondos" (p. ej. 250 000 €) **no se pueden reservar nunca** | Semilla con precios sin factor común con 1000 (§8); mensaje claro de F12; documentado en la spec `chore`. No se avisa antes de enviar (sería lógica de la pasarela simulada en el cliente) |
| R4 | `db/activities.json` persistido sobrescribe la semilla por id | Se seguirían viendo las actividades antiguas | La spec `chore` vacía `db/activities.json`, `db/bookings.json` y `db/payments.json` (§8) |
| R5 | `GET /bookings` devuelve 500 si una reserva apunta a una actividad borrada | "Mis reservas" no carga | Mensaje de error con "Reintentar"; mantener los datos del fork coherentes (R4). Fuera de control del cliente |
| R6 | El importe se calcula con el precio **actual** de la actividad, no el cobrado (el pago guarda `amount` pero no se expone) | Importe mostrado distinto del cobrado si el proveedor cambia el precio | Aceptado (PRD §7); se documenta en la spec de Mis reservas |
| R7 | Mensajes de la API en inglés | Incoherencia con D8 | Traducción en `domain/api-errors.ts` con fallback (ADR-008) |
| R8 | Fixtures de e2e desalineados con la API real | Tests en verde con la app rota | Fixtures copiados de respuestas reales; validación Zod también en e2e; smoke opcional contra la API |
| R9 | Token en `localStorage` (XSS) | Robo de sesión | Aceptado en formación; sin `dangerouslySetInnerHTML`; React escapa contenidos |
| R10 | Reloj del navegador desajustado | Caducidad o reservabilidad por fecha mal calculadas | El 401 de la API es la fuente final para la sesión; para la fecha, el riesgo se acepta |
| R11 | La API acepta `participants` decimales | Reservas con 1,5 plazas | El cliente solo envía enteros ≥ 1 (validación del formulario y del recurso) |
| R12 | Versiones nuevas de React Router / Zod / Vitest con cambios incompatibles con las plantillas | Fricción en el scaffolding | Fijar versiones en `package-lock.json`; el scaffolding verifica que las plantillas compilan |
| R13 | Defecto del fork: los servicios de usuarios, reservas y pagos se crean antes de cargar `db/` (detectado en `chore-seed-space-launches`) | `POST /login` siempre 401; el registro sobrescribe `user-1`; tras reiniciar, las reservas y pagos nuevos reutilizan ids y sobrescriben los existentes | Spec `fix-api-user-session` en el fork, sin cambiar el contrato; requisito previo de `feat-user-session` y `feat-user-registration` contra la API real |

## 12. Trazabilidad

| Req. | Descripción breve | Módulos / componentes |
|---|---|---|
| F1 | Registro | `RegisterPage`, `FormField`, `api/auth.register`, `domain/api-errors` (errores por campo), `SessionProvider.signIn` |
| F2 | Inicio de sesión | `LoginPage`, `api/auth.login` (`auth: false`), `domain/api-errors` |
| F3 | Cierre de sesión | `Layout` (botón), `SessionProvider.signOut`, `session-storage.clear`, `RequireAuth` |
| F4 | Sesión no válida | `api/http` (401 con `auth: true` → `onSessionRejected`), `domain/session.isExpired`, `SessionProvider`, `RequireAuth`, `LoginPage` (aviso) |
| F5 | Listado | `LaunchListPage`, `LaunchCard`, `use-launches`, `api/activities.getActivities`, `domain/launch` (`toLaunch`, `parseLaunchName`, `isVisible`), `domain/format` |
| F6 | Búsqueda | `LaunchFilters`, `LaunchListPage` (`?q=`), `api/activities` (`q`) |
| F7 | Orden | `LaunchFilters`, `api/activities` (`_sort`, `_order`) |
| F8 | Detalle de lanzamiento | `LaunchDetailPage`, `use-launch`, `api/activities.getActivity`, `NotFound`/404 → `ErrorMessage` |
| F9 | Reservar N plazas e importe | `BookingForm`, `domain/booking.totalAmount`, `domain/format.formatPrice`, `LaunchDetailPage` (enlaces a login/registro sin sesión) |
| F10 | No superar plazas | `BookingForm` (`max`), `domain/api-errors.parseAvailableSeats`, `api/errors` (`kind: 'capacity'`) |
| F11 | Solo `published`/`confirmed` y futuro | `domain/launch.getBookability`, `BookabilityNotice`, `LaunchCard` |
| F12 | Pago rechazado | `api/errors` (`kind: 'payment'`), `BookingForm`, `domain/api-errors` |
| F13 | Confirmación | `use-create-booking` → `BookingDetailPage` (`state.justCreated`), `api/bookings.createBooking` + `getBooking` |
| F14 | Mis reservas | `MyBookingsPage`, `use-my-bookings`, `api/bookings.getMyBookings`, `domain/booking.toBooking`, `EmptyState` |
| F15 | Detalle de reserva | `BookingDetailPage`, `use-booking`, `api/bookings.getBooking` (404 = no existe o no es tuya) |
| F16 | Estado comprensible | `PaymentStatusBadge`, `domain/booking.paymentStatusLabel` |
| F17 | Errores visibles | `api/http`, `api/errors`, `domain/api-errors.toUserMessage`, `ErrorMessage`, `FormField` |
| F18 | Indicador de trabajo y sin doble envío | `LoadingIndicator`, `use-async-data`, `use-create-booking` (`inFlight`), botones deshabilitados |
| F19 | Filtro por lanzamiento | `BookingFilter`, `MyBookingsPage` (`?lanzamiento=`) |

## 13. Decisiones validadas

Validadas el 2026-11-05: se aceptan todas las recomendaciones (V1–V6).

| # | Tema | Decisión | Alternativa descartada |
|---|---|---|---|
| V1 | Mensajes de error de la API en inglés frente a D8 (español) | Traducir en el cliente con fallback al original (ADR-008) | Mostrar el mensaje original en inglés |
| V2 | "Ordenar por nombre" (F7) con `name = "<Cohete> · <Misión>"` | Usar `_sort=name` (orden por cohete y luego misión) y etiquetarlo "Nombre (cohete y misión)" | Ordenar en el cliente por `mission` |
| V3 | Dependencias extra: `react-router` y `zod` | Aceptar ambas (ADR-004, ADR-005) | Enrutado manual / *type guards* a mano |
| V4 | Confirmación de F13 en `/reservas/:id` | Aceptar (ADR-011) | Pantalla de confirmación separada compuesta con los datos del lanzamiento ya cargado |
| V5 | Lanzamiento `draft` abierto por URL directa | Tratarlo como "no encontrado" | Mostrar el detalle como no reservable |
| V6 | Lanzamiento de prueba con `price: 12500` en la semilla para demostrar el 402 | Incluirlo (§8) | Semilla sin casos de demo de pago rechazado |

## 14. Propuesta de actualización de AGENTS.md (sección 2, Stack)

Aplicada en AGENTS.md el 2026-11-05:

| Capa | Tecnología |
|---|---|
| Lenguaje | TypeScript (modo `strict`) |
| UI | React + Vite |
| Enrutado | React Router (modo declarativo) |
| Validación de respuestas de la API | Zod |
| Estilos | CSS plano / CSS Modules (sin librería de UI) |
| Tests unitarios y de componentes | Vitest + Testing Library (jsdom) |
| Tests end-to-end | Playwright (API interceptada con `page.route`; proyecto `smoke` opcional contra la API real) |
| Backend | API del curso **activity-bookings-express** (fork local en `http://localhost:3000`, configurable con `VITE_API_URL`) |
