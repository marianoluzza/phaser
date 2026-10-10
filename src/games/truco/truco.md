# Truco argentino

## Alcance de la v1

Es una partida de dos jugadores: la persona juega contra una IA, elegida entre
tres perfiles de dificultad o sorteada, y sólo se representan cartas con su
valor y palo, sin ilustraciones.

La partida comienza con 0-0. Cada mano reparte tres cartas a cada jugador y se
juegan hasta tres turnos. Quien gana dos turnos gana la mano y suma el valor
vigente del truco, con las reglas de desempate de las pardas.
Los primeros 15 puntos corresponden a las **malas**; al alcanzarlos, el nombre
y puntaje de ese bando se subrayan para indicar que está en las **buenas**. La
partida termina al llegar a 30 puntos. Incluye una primera versión de envido y
de los cantos de truco; todavía no incluye señas, flor, arrastre de puntos ni
multijugador.

## Escenas y navegación

- `truco:title`: instrucciones, elección del rival y comienzo de la partida.
- `truco:game`: reparto, selección de cartas, turnos, resultado de cada mano y
  puntaje acumulado; al llegar a 30 muestra las acciones **Menú**, que vuelve
  al título para elegir otro rival, y **Repetir**.
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

## Envido

Antes de jugar la primera carta, la acción **Primera** abre los cantos de
Envido, Real Envido y Falta Envido.
La IA también puede cantar, siempre antes de jugar su primera carta y mientras
no se haya cantado truco. Resuelto el envido, juega la carta que tenía
pendiente.

Cada canto se responde con **Quiero**, **No quiero** o subiéndolo, y los dos
bandos se turnan hasta que alguien quiere o no quiere. Cuando le toca a la
persona, las acciones pasan a esas tres respuestas —subir es **Primera**, que
sólo habilita los cantos válidos— y las cartas quedan bloqueadas. La cadena
sólo crece:

```text
Envido → Envido → Real Envido → Falta Envido
```

Envido se canta hasta dos veces, Real Envido una y la Falta cierra; se puede
saltar escalones pero no volver atrás. `rules.ts` define los cantos válidos
(`getEnvidoRaises`) y los puntos.

Aceptado el canto, la persona declara sus tantos con un cuadro integrado en las
acciones y la IA usa siempre su valor real, calculado con las tres cartas
repartidas aunque ya haya jugado alguna. Ese cuadro acepta dígitos, `Enter`
para declarar y `←` para borrar. Si el “quiero” fue de la persona, `Escape`
vuelve a la respuesta; si lo dijo la IA, ya no hay vuelta atrás. A la izquierda de las cartas de la IA queda un registro breve de los
cantos y respuestas: usa iconos para cada bando, muestra también el tanto real
de la IA y conserva las últimas entradas sin invadir las acciones.

El tanto se calcula con las dos mejores cartas del mismo palo más 20; si no hay
dos cartas del mismo palo, vale la carta numérica más alta (10, 11 y 12 valen
cero). Los empates favorecen a quien es mano.

- Querido, se suman los cantos de la cadena: Envido 2, Real Envido 3.
  Envido-Envido-Real vale 7.
- Si en la cadena hay Falta Envido, querido entrega los puntos necesarios para
  que quien gana alcance los 30 puntos de la partida.
- Un “no quiero” le da a quien cantó lo ya aceptado, es decir, todo menos el
  último canto, con un mínimo de 1: Envido-No quiero vale 1,
  Envido-Real-No quiero vale 2 y Envido-Envido-Real-Falta-No quiero vale 7.

La declaración del jugador todavía no se valida contra sus cartas: se puede
equivocar o mentir sin penalidad. El control de mentiras queda para una
siguiente iteración.

## Truco, Retruco y Vale 4

La acción **Segunda** abre el canto disponible: Truco, Retruco o Vale 4. Si la
IA canta, esa misma acción permite responder **Quiero** o **No quiero** y, si
corresponde, aceptar subiendo a Retruco o Vale 4. Una mano ganada vale la apuesta
aceptada; un “no quiero” entrega un punto menos que la apuesta propuesta.

La IA decide cantar antes de cada carta que juega. Cuando la persona canta,
la IA puede aceptar, rechazar o **subir**: subir acepta la apuesta y canta la
siguiente, que se responde desde **Segunda** con las cartas bloqueadas. Si la
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

| Perfil | Cartas | Envido | Truco |
| --- | --- | --- | --- |
| **Noob** | Una al azar. | Sube el 15 %, acepta el 45 % y canta al azar el 10 %. | Canta el 25 %, acepta la mitad, nunca sube. |
| **Pibe** | Gana con la carta más barata o descarta la peor; de mano tantea con la del medio. | Umbrales fijos de tanto que suben con lo que hay en juego (quiere desde 27, canta desde 28, sube desde 30). | Canta y acepta según sus chances; nunca miente ni sube. |
| **Viejo** | Además, juega según la baza anterior: tras una parda va con la mejor o empata, ganada la primera tira la baja. | Cuenta la ventaja de ser mano y mira el tanteador para la Falta; a veces sube con Real Envido sin tener tanto. | Acepta con la cuenta de apuesta (chances > 1 / 2·valor), sube con mano fuerte, farolea a veces y no rechaza si el “no quiero” le da la partida al rival. |

Los perfiles viven en `ai/` y comparten el contrato `TrucoAiProfile`. Cada
decisión recibe un `AiTableView` de sólo lectura que arma la escena: la mano
de la IA, las cartas de la baza actual, las bazas jugadas, si es mano, el
valor del truco, su tanto y el puntaje. Nunca incluye las cartas ocultas del
jugador. El perfil propone y la escena valida y aplica, por lo que una IA no
puede modificar el estado de la partida.

`ai/handStrength.ts` reúne lo que comparten Pibe y Viejo: elegir cartas por
fuerza y `estimateTrucoOdds`, que estima la chance de ganar la mano sorteando
200 veces las cartas posibles del rival entre las que la IA no vio.

`aiCatalog.ts` registra los perfiles en orden de dificultad y define el
predeterminado. `aiSelection.ts` guarda la elección en `localStorage`
(`truco.aiProfile`) y la resuelve al empezar cada partida. Con **Aleatorio**
se sortea un perfil por partida —**Repetir** vuelve a sortear— y la mesa lo
muestra como “RIVAL” para no delatar cuál tocó.

## Posibles mejoras

- Penalizar declaraciones falsas de envido.
- Que la IA responda a un truco con “el envido está primero”.
- Incorporar animaciones y sonidos de cartas.
- Separar una pantalla de resumen de mano si el flujo crece.
