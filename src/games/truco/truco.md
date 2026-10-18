# Truco argentino

## Alcance de la v1

Es una partida de dos jugadores: la persona juega contra una IA, elegida entre
tres perfiles de dificultad o sorteada. Las cartas muestran su valor y su palo
dibujado, sin las figuras de la baraja.

La partida comienza con 0-0. Cada mano reparte tres cartas a cada jugador y se
juegan hasta tres turnos. Quien gana dos turnos gana la mano y suma el valor
vigente del truco, con las reglas de desempate de las pardas.
Los primeros 15 puntos corresponden a las **malas** y los siguientes a las
**buenas**; el anotador los separa con una raya dorada. La partida termina al
llegar a 30 puntos. Incluye una primera versión de envido y
de los cantos de truco; todavía no incluye señas, flor, arrastre de puntos ni
multijugador.

## Escenas y navegación

- `truco:title`: instrucciones, elección del rival y comienzo de la partida.
- `truco:game`: reparto, selección de cartas, turnos, resultado de cada mano y
  puntaje acumulado; al llegar a 30 muestra las acciones **Menú**, que vuelve
  al título para elegir otro rival, y **Repetir**.
- `Escape`: vuelve al launcher, salvo mientras se están ingresando tantos de
  envido, cuando cancela esa entrada.

## Controles

Cartas y cantos comparten un solo foco, que mueven tanto el mouse como el
teclado: pasar el puntero sobre una carta jugable o un botón le da el foco, y
lo conserva aunque el puntero se vaya. La carta con foco se levanta; el botón
se agranda y brilla.

| Tecla | Acción |
| --- | --- |
| Flechas | Mueven el foco al elemento habilitado más cercano en esa dirección. |
| `A` `S` `D` | Llevan el foco a la primera, segunda o tercera carta. |
| `Enter` / `Espacio` | Juegan la carta o activan el botón con foco. |
| `Q` / `N` | Quiero / No quiero (`Y` / `N` en inglés). |
| `E` `R` `F` | Envido, Real Envido y Falta Envido. |
| `T` | Truco, Retruco o Vale 4: el canto siguiente. |
| `B` | Son buenas, al declarar el envido después de la IA (`G` en inglés). |

Las flechas no distinguen cartas de botones (`objects/focusNavigator.ts`).
Como la grilla de cantos queda a la izquierda de la mano, `←` desde la primera
carta entra a la grilla y `→` desde la columna del truco vuelve a las cartas.
En horizontal, si no hay nada de ese lado, el foco da la vuelta y entra por el
extremo opuesto. Los botones apagados se saltean.

Al empezar el turno, el foco va a la carta del medio. Cuando hay que responder
un canto no hay foco: la búsqueda parte de un lugar imaginario antes de la
primera carta, así `←` entra a la grilla por la derecha y `→`, como no hay
cartas jugables, da la vuelta y entra por la izquierda. Así un `Enter` apurado
no acepta nada. Al terminar la mano el foco va a **Siguiente**, y al terminar
la partida, a **Repetir**. Mientras se declaran los tantos de envido, el
teclado es del cuadro de puntos: dígitos, `Backspace` para borrar y
`Enter` para declarar.

Los cantos están todos a la vista en una grilla fija debajo del registro
(`objects/actionButton.ts`), sin submenús. Los botones nunca cambian de lugar,
sólo se prenden y se apagan, y cada uno muestra su tecla en una esquina. Las
teclas de las cartas aparecen debajo de la mano mientras se puede jugar.

```text
QUIERO        NO QUIERO    ← responden el canto pendiente
ENVIDO        TRUCO        ← el truco muestra el siguiente canto
REAL ENVIDO
FALTA ENVIDO
```

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

Antes de jugar la primera carta se puede cantar Envido, Real Envido o Falta
Envido desde la columna izquierda de la grilla.
La IA también puede cantar, siempre antes de jugar su primera carta y mientras
no se haya cantado truco. Resuelto el envido, juega la carta que tenía
pendiente.

Cada canto se responde con **Quiero**, **No quiero** o subiéndolo, y los dos
bandos se turnan hasta que alguien quiere o no quiere. Cuando le toca a la
persona, se prenden **Quiero** y **No quiero**, la columna del envido deja
habilitados sólo los cantos válidos para subir y las cartas quedan bloqueadas. La cadena
sólo crece:

```text
Envido → Envido → Real Envido → Falta Envido
```

Envido se canta hasta dos veces, Real Envido una y la Falta cierra; se puede
saltar escalones pero no volver atrás. `rules.ts` define los cantos válidos
(`getEnvidoRaises`) y los puntos.

Aceptado el canto, los tantos se dicen en orden: primero la mano y después el
otro, que ya sabe contra qué compite. Quien no es mano puede contestar con su
número o con **Son buenas**, que pierde el envido sin mostrar nada. Decir los
tantos revela parte de las cartas: un 33 es un 7 y un 6 del mismo palo, un 4
avisa que no hay dos del mismo palo. Por eso callar es una táctica, y también
lo es, con el envido ya perdido, cantar otro número para despistar.

La persona declara con un cuadro integrado en las acciones, que acepta
dígitos, `Enter` para declarar y `Backspace` para borrar. Si es mano y el
“quiero” fue suyo, `Escape` vuelve a la respuesta; si lo dijo la IA, ya no hay
vuelta atrás. Si la IA es mano, dice su tanto apenas se quiere y el cuadro
suma el botón **Son buenas**. La IA calcula su tanto con las tres cartas
repartidas aunque ya haya jugado alguna; cuándo lo muestra depende de su
perfil (ver *Perfiles de IA*). A la izquierda de la mesa queda el registro de
cantos, respuestas y tantos dichos (ver *Representación visual*).

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

Gana el número más alto entre los dichos y los empates son de la mano. Las
declaraciones todavía no se validan contra las cartas: se puede equivocar o
mentir sin penalidad. Las IA sólo mienten con el envido ya perdido, así que su
mentira nunca les gana puntos. Mostrar las cartas del tanto ganador al final
de la mano queda para una siguiente iteración.

## Truco, Retruco y Vale 4

El botón de truco muestra siempre el canto siguiente: Truco, Retruco o Vale 4.
Si la IA canta, se responde con **Quiero** o **No quiero**, o con ese mismo
botón, que acepta y sube. Una mano ganada vale la apuesta
aceptada; un “no quiero” entrega un punto menos que la apuesta propuesta.

La IA decide cantar antes de cada carta que juega. Cuando la persona canta,
la IA puede aceptar, rechazar o **subir**: subir acepta la apuesta y canta la
siguiente, que se responde igual, con las cartas bloqueadas. Si la IA canta
Truco durante la primera ronda, la columna del envido sigue habilitada para
resolver primero el Envido mientras el Truco esté pendiente: **Quiero** y
**No quiero** responden siempre al envido antes que al truco. Si la persona
cantó el Truco o si éste ya fue respondido, el envido se anula para esa mano.

## Estado principal

La lógica vive en `rules.ts`: construcción y mezcla de la baraja, comparación
de cartas, escala de poder y elección de la IA. `TrucoGameScene` conserva el
estado de la partida y usa los Game Objects sólo como representación:

- puntaje de ambos jugadores;
- cartas disponibles;
- turnos ganados dentro de la mano;
- carta de cada jugador sobre la mesa;
- jugador que es mano y próximo turno.

## Representación visual

Como en Tanques y Semáforos, todo se dibuja con `Graphics` vectoriales en vez
de imágenes: se rasterizan a la resolución real del canvas y se ven nítidos
con el zoom de `core/renderScale.ts`. Antes los palos eran emojis, y cada
sistema operativo los dibujaba distinto.

- `objects/cardRenderer.ts`: carta crema con el número en dos esquinas y el
  palo en el centro. El filete lleva la "pinta" de la baraja española: oros
  continuo, copas cortado una vez, espadas dos y bastos tres, cada uno con su
  color. Las cartas jugables tienen un halo dorado y se levantan al apuntarlas;
  las de una baza jugada, verde si ganaron, rojo y en sombra si perdieron, y
  neutro si fue parda. El dorso es bordó con rombos y un sol en el medallón.
  El número de abajo va derecho y no cabeza abajo, para que el 6 no se lea 9.
- `objects/tableCards.ts`: las cartas se mueven en vez de aparecer en su
  lugar. La escena vuelve a dibujar la mesa entera en cada cambio y sólo dice
  dónde va cada carta. La clase recuerda dónde estaba cada una en el dibujo
  anterior, aunque fuera a mitad de camino, y la desliza desde ahí. Al
  repartir, las cartas salen del mazo, en el centro de la mesa, alternando
  desde quien es mano. La carta que la IA saca de su mano se da vuelta en el
  aire. Si dos jugadas se mueven en el mismo dibujo, la respuesta sale un
  momento después. Las cartas viajan por encima de las demás y el resaltado de
  la baza aparece recién al llegar. Como jugar, responder y cerrar la baza
  ocurren en una misma cadena de llamadas, la escena puede dibujar varias veces
  en el mismo frame: cada dibujo retoma la carta donde quedó y conserva la
  demora que le faltaba.
- `objects/scoreBoard.ts`: anotador de fósforos. Cada tanto es un fósforo; los
  cuatro primeros cierran los lados de un cuadrado y el quinto lo cruza en
  diagonal. Hay tres cuadrados de malas y tres de buenas por bando, y el total
  en números al pie. Los fósforos nuevos caen de a uno. Una mano dibujada junto
  al nombre indica quién es mano en ese reparto, y el nombre deja siempre su
  lugar para que no salte. Si el nombre del rival es largo, se achica la letra.
- `objects/cantosLog.ts`: cada renglón lleva un distintivo de quien habló, una
  silueta dorada para la persona y un robotito cobrizo para la IA; los resultados van en una franja destacada. Los
  renglones largos pasan al siguiente y, cuando el panel se llena, se
  descartan los más viejos.

## Perfiles de IA

| Perfil | Cartas | Envido | Tantos | Truco |
| --- | --- | --- | --- | --- |
| **Noob** | Una al azar. | Sube el 15 %, acepta el 45 % y canta al azar el 10 %. | Dice siempre el suyo, aunque pierda. Ignora el del jugador. | Canta el 25 %, acepta la mitad, nunca sube. |
| **Pibe** | Gana con la carta más barata o descarta la peor; de mano tantea con la del medio. | Umbrales fijos de tanto que suben con lo que hay en juego (quiere desde 27, canta desde 28, sube desde 30). | Dice el suyo si gana; si no, “son buenas”. Se cree todo lo que dice el jugador. | Canta y acepta según sus chances; nunca miente ni sube. |
| **Viejo** | Además, juega según la baza anterior: tras una parda va con la mejor o empata, ganada la primera tira la baja. | Cuenta la ventaja de ser mano y mira el tanteador para la Falta; a veces sube con Real Envido sin tener tanto. | Dice el suyo sólo si gana; perdido, “son buenas” o, el 30 %, otro número que también pierde. Le cree a medias a un tanto perdedor. | Acepta con la cuenta de apuesta (chances > 1 / 2·valor), sube con mano fuerte, farolea a veces y no rechaza si el “no quiero” le da la partida al rival. |

Los perfiles viven en `ai/` y comparten el contrato `TrucoAiProfile`. Cada
decisión recibe un `AiTableView` de sólo lectura que arma la escena: la mano
de la IA, las cartas de la baza actual, las bazas jugadas, si es mano, el
valor del truco, su tanto, lo que el jugador dijo del suyo y el puntaje. Nunca
incluye las cartas ocultas del jugador. El perfil propone y la escena valida y
aplica, por lo que una IA no puede modificar el estado de la partida. Al
declarar los tantos, `decideDeclareEnvido` recibe además el número que ya dijo
el jugador, si fue mano; siendo mano, la IA tiene que decir un número.

`ai/handStrength.ts` reúne lo que comparten Pibe y Viejo: elegir cartas por
fuerza y `estimateTrucoOdds`, que estima la chance de ganar la mano
recorriendo todas las cartas posibles del rival entre las que la IA no vio
—unas 7800 manos como mucho, en pocos milisegundos—.

El tanto del jugador queda en el `AiTableView` como pista (`EnvidoClue`): el
número que dijo y si ganó con él, o el “son buenas”, que avisa que no supera
el tanto de la IA. `estimateTrucoOdds` calcula el tanto de cada mano posible
—sumando las cartas que el jugador ya jugó— y aparta las que coinciden con lo
que dijo. Recibe cuánto se le cree a la pista: con 1 sólo cuentan esas manos,
con 0 se ignora y en el medio se mezclan las dos estimaciones. Si ninguna mano
coincide, las cartas jugadas ya delataron la mentira y la pista se descarta.
Pibe le cree todo; Viejo le cree todo a un tanto ganador o a un “son buenas”, y
a medias a un número que perdió, porque él también canta números falsos.

`aiCatalog.ts` registra los perfiles en orden de dificultad y define el
predeterminado. `aiSelection.ts` guarda la elección en `localStorage`
(`truco.aiProfile`) y la resuelve al empezar cada partida. Con **Aleatorio**
se sortea un perfil por partida —**Repetir** vuelve a sortear— y la mesa lo
muestra como “RIVAL” para no delatar cuál tocó.

## Posibles mejoras

- Mostrar las cartas del tanto ganador al final de la mano y penalizar las
  declaraciones falsas que ganaron; las perdedoras siguen siendo libres.
- Que la IA note cuando las cartas jugadas desmienten un tanto y deje de
  creerle al jugador por el resto de la partida.
- Que la IA responda a un truco con “el envido está primero”.
- Recoger las cartas de la mesa al terminar la mano, antes del reparto.
- Separar una pantalla de resumen de mano si el flujo crece.
