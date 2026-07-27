# Truco argentino

## Alcance de la v1

Es una partida de dos jugadores: la persona juega contra una IA y sólo se
representan cartas con su valor y palo, sin ilustraciones.

La partida comienza con 0-0. Cada mano reparte tres cartas a cada jugador y se
juegan hasta tres turnos. Quien gana dos turnos gana la mano y suma el valor
vigente del truco, con las reglas de desempate de las pardas.
Los primeros 15 puntos corresponden a las **malas**; al alcanzarlos, el nombre
y puntaje de ese bando se subrayan para indicar que está en las **buenas**. La
partida termina al llegar a 30 puntos. Incluye una primera versión de envido y
de los cantos de truco; todavía no incluye señas, flor, arrastre de puntos ni
multijugador.

## Escenas y navegación

- `truco:title`: instrucciones y comienzo de la partida.
- `truco:game`: reparto, selección de cartas, turnos, resultado de cada mano y
  puntaje acumulado; al llegar a 30 muestra las acciones **Menú** y
  **Repetir**.
- `Escape`: vuelve al launcher, salvo mientras se están ingresando tantos de
  envido, cuando cancela esa entrada.
- `Enter`: declara los tantos de envido escritos en el panel de acciones.

Al terminar una mano, la mesa se conserva durante tres segundos y el botón
**Siguiente** se completa gradualmente. Se puede tocar en cualquier momento
para repartir la mano siguiente sin esperar el resto del tiempo.

## Reglas y escala de valores

Se usa la baraja española de 40 cartas: 1 a 7, 10, 11 y 12 de cada palo.
La fuerza de mayor a menor es:

1. 1 de espadas.
2. 1 de bastos.
3. 7 de espadas.
4. 7 de oros.
5. Los 3.
6. Los 2.
7. Los 1 restantes.
8. Los 12, 11, 10, 7, 6, 5 y 4, en ese orden.

Si dos cartas tienen la misma fuerza, la ronda queda **parda**. La mano inicial
alterna entre jugador e IA y abre la primera ronda. Las siguientes las abre quien
ganó la ronda anterior; si hay parda, conserva la salida quien ya la tenía.

- Parda en la primera y victoria en la segunda: gana la mano quien ganó la
  segunda; no se juega la tercera.
- Victoria en la primera y parda en la segunda: gana quien ganó la primera.
- Dos primeras pardas: se juega la tercera; si también es parda, gana quien es
  mano.
- Un jugador gana la primera, el otro la segunda: la tercera define; si es
  parda, gana quien ganó la primera.

El perfil inicial, **Noob**, juega una carta disponible al azar tanto cuando es
mano como cuando responde. No evalúa la fuerza de las cartas ni intenta
anticipar la jugada rival.

## Envido

Antes de jugar la primera carta, la acción **Primera** abre los cantos de
Envido, Real Envido y Falta Envido.
El Noob acepta cada canto al azar; si acepta, la persona declara sus tantos con
un cuadro integrado en las acciones y el Noob usa siempre su valor real. Ese
cuadro acepta dígitos, `Enter` para declarar, `←` para borrar y `Escape` para
cancelar. A la izquierda de las cartas de la IA queda un registro breve de los
cantos y respuestas: usa iconos para cada bando, muestra también el tanto real
de la IA y conserva las últimas entradas sin invadir las acciones.

El tanto se calcula con las dos mejores cartas del mismo palo más 20; si no hay
dos cartas del mismo palo, vale la carta numérica más alta (10, 11 y 12 valen
cero). Los empates favorecen a quien es mano.

- Envido aceptado: 2 puntos; Real Envido aceptado: 3 puntos.
- Un “no quiero” otorga 1 punto a quien cantó.
- Falta Envido entrega los puntos necesarios para que quien gana alcance los
  30 puntos de la partida.

La declaración del jugador todavía no se valida contra sus cartas: se puede
equivocar o mentir sin penalidad. La escalada de cantos y el control de mentiras
quedan para una siguiente iteración.

## Truco, Retruco y Vale 4

La acción **Segunda** abre el canto disponible: Truco, Retruco o Vale 4. Si la
IA canta, esa misma acción permite responder **Quiero** o **No quiero** y, si
corresponde, aceptar subiendo a Retruco o Vale 4. Una mano ganada vale la apuesta
aceptada; un “no quiero” entrega un punto menos que la apuesta propuesta.

El Noob acepta los cantos y decide cantarlos al azar cuando le toca jugar. Si la
IA canta Truco durante la primera ronda, **Primera** sigue habilitada para
resolver primero el Envido mientras el Truco esté pendiente; la respuesta queda
en **Segunda**. Si la persona cantó el Truco o si éste ya fue respondido,
**Primera** se anula para esa mano.

## Estado principal

La lógica vive en `rules.ts`: construcción y mezcla de la baraja, comparación
de cartas, escala de poder y elección de la IA. `TrucoGameScene` conserva el
estado de la partida y usa los Game Objects sólo como representación:

- puntaje de ambos jugadores;
- cartas disponibles;
- turnos ganados dentro de la mano;
- carta de cada jugador sobre la mesa;
- jugador que es mano y próximo turno.

## Perfiles de IA

Los perfiles viven en `ai/` y comparten el contrato `TrucoAiProfile`. Cada uno
recibe una vista de solo lectura de las cartas disponibles y propone una carta.
La escena valida que siga en la mano antes de retirarla, por lo que una IA no
puede modificar el estado de la partida. `aiCatalog.ts` registra los perfiles
instalados y define el predeterminado.

## Posibles mejoras

- Permitir escalar los cantos de envido y penalizar declaraciones falsas.
- Agregar perfiles de IA, como uno conservador o agresivo.
- Incorporar animaciones y sonidos de cartas.
- Separar una pantalla de resumen de mano si el flujo crece.
