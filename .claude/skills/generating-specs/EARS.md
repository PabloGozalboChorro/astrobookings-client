# EARS — Easy Approach to Requirements Syntax

Patrones para escribir requisitos sin ambigüedad. Elige un patrón por requisito.

| Patrón | Plantilla | Ejemplo |
|---|---|---|
| Ubicuo | El sistema deberá {respuesta}. | El sistema deberá mostrar el precio de cada lanzamiento en euros. |
| Dirigido por evento | **Cuando** {disparador}, el sistema deberá {respuesta}. | Cuando el cliente confirme la reserva, el sistema deberá enviar la petición a la API. |
| Dirigido por estado | **Mientras** {estado}, el sistema deberá {respuesta}. | Mientras se cargan los lanzamientos, el sistema deberá mostrar un indicador de carga. |
| Comportamiento no deseado | **Si** {condición}, **entonces** el sistema deberá {respuesta}. | Si el cliente solicita más plazas de las disponibles, entonces el sistema deberá impedir la reserva y mostrar las plazas restantes. |
| Opcional | **Donde** {característica}, el sistema deberá {respuesta}. | Donde el lanzamiento esté completo, el sistema deberá mostrarlo como "Agotado". |
| Complejo | Combinación de los anteriores. | Mientras haya conexión, cuando el cliente pulse "Reservar", el sistema deberá… |

## Reglas
- Un solo "deberá" por requisito.
- Sin términos vagos ("rápido", "fácil", "adecuado"): usa valores concretos.
- Escribe el comportamiento observable, no la implementación.
