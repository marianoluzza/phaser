# Soporte para mando (joystick)

## Pedido textual (2026-11-27)

> Creo que ningun juego tiene soporte para joystick. Arrancá con socavon y vamos pasando al resto

> conviene hacer alguna funcion de utilidad que mapee las teclas direccionales, el WASD y los
> direccionales del joystick para que quede asi para todos?

> creo que todos deben tener el mismo esquema

> truco no tendra soporte con WASD, pero si para pad, de ultima que la lib permite anular alguno
> de los mandos

## Reglas

- R1 «ningun juego tiene soporte para joystick»: cada juego se juega entero con un mando, sin
  tocar el teclado: menús, partida, pausa y salidas. El teclado sigue andando igual que antes.
- R2 «Arrancá con socavon y vamos pasando al resto»: de a un juego, Socavón primero.
- R3 «una funcion de utilidad que mapee las teclas direccionales, el WASD y los direccionales del
  joystick»: una sola utilidad del núcleo (`src/core/input/controls.ts`) junta flechas, WASD,
  cruceta y stick izquierdo. Ninguna escena lee el mando por su cuenta.
- R4 «todos deben tener el mismo esquema»: el mismo botón hace lo mismo en todos los juegos.
- R5 «truco no tendra soporte con WASD, pero si para pad, de ultima que la lib permite anular
  alguno de los mandos»: `Controls` acepta `withoutKeys`; el Truco saca W, A, S y D en todas sus
  pantallas y el mando funciona entero.

## Esquema común (decisión de diseño, no del pedido)

Mando con el mapeo estándar del navegador (disposición de Xbox; en uno de PlayStation, A = ✕,
B = ○, X = □, Y = △). Vale cualquier mando conectado.

| Acción      | Teclado              | Mando                    | Dónde                          |
|-------------|----------------------|--------------------------|--------------------------------|
| Direcciones | Flechas y WASD       | Cruceta y stick izquierdo | Siempre                        |
| `confirm`   | Enter                | A o Start                | Menús, carteles de «seguir»    |
| `back`      | Esc                  | B o Select               | Menús: volver                  |
| `action`    | Espacio              | A                        | Partida: acción principal      |
| `pause`     | P                    | Start                    | Partida                        |
| `menu`      | Esc                  | Select                   | Partida: salir al menú         |
| Propias     | Las de cada juego    | B, X, Y                  | Partida y menús, por juego     |

- En la partida B no sale: es una acción del juego. Se sale con Select, como con Esc.
- El stick se lee de dos maneras. Mantenido (`isDown`, `direction`), cada eje cuenta por su lado:
  en diagonal la nave de Galáctica se mueve en los dos ejes. Como pulsación (`justDown`), sólo
  cuenta el eje más inclinado: una diagonal no rota en Tetris ni cambia dos semáforos.
- Un botón que sigue apretado al cambiar de escena no cuenta como una pulsación nueva (A en el
  título no se vuelve una acción en la mina).
- Si un juego usa una letra de WASD para otra cosa, la saca del esquema con `withoutKeys` (R5);
  las direcciones le quedan en las flechas y el mando. Así está el Truco.

### Socavón

| Acción          | Teclado | Mando |
|-----------------|---------|-------|
| Lámpara         | Z       | B     |
| Linterna        | X       | X     |
| Otra semilla    | N       | Y     |
| Menú (resultado)| M       | Y     |

### Tetris

| Acción          | Teclado   | Mando |
|-----------------|-----------|-------|
| Rotar           | ↑         | ↑ o B |
| Caída rápida    | Espacio   | A     |
| Otra vez (fin)  | Enter o R | A     |
| Título (fin)    | M         | Y     |

### Pipes

| Acción              | Teclado | Mando |
|---------------------|---------|-------|
| Colocar             | Enter, Espacio | A |
| Largar/acelerar agua| F       | B     |
| Reiniciar nivel     | R       | Y     |
| Configuración       | C       | Y     |
| Título (fin)        | M       | Y     |

### Galáctica

| Acción              | Teclado          | Mando |
|---------------------|------------------|-------|
| Disparar (mantener) | Espacio, Z, J    | A     |
| Escudo (mantener)   | X, K             | X     |
| Galactopedia        | G                | Y     |
| Título (resultado)  | M                | Y     |

### Astro Chess

| Acción                         | Teclado        | Mando  |
|--------------------------------|----------------|--------|
| Levantar o dejar pieza         | Espacio        | A      |
| Soltar la pieza                | Esc            | B      |
| Al combate / resolver / saltear| Enter          | Start  |
| Bitácora                       | RePág / AvPág  | L1 / R1|
| Ayuda (título)                 | H              | Y      |

## Tareas

- [x] Mando de prueba en el driver de capturas y `npm run test:mando`.
- [x] `src/core/input/controls.ts` con el esquema común.
- [x] Socavón: título, partida y resultado, con los textos de ayuda.
- [x] Launcher: ← → (o A D, cruceta, stick) cambia de ficha; Enter, A o Start la abre. Idioma y
  pantalla completa siguen con el mouse.
- [x] Tetris: A cae de una (como Espacio), B o ↑ rota, Start pausa, Select al título; en el fin,
  A juega otra vez (Enter y R también), Y al título y B al arcade.
- [x] Truco: el mando mueve el foco y A lo activa; ↑ ↓ eligen el tanto, A lo dice y B aprieta
  «Atrás» o «Son buenas»; Select sale. Sin WASD (R5).
- [x] Pipes: cruceta o stick mueven el cursor, A coloca, B larga o acelera el agua, Y reinicia,
  Select al título; en el título Y abre la configuración, que se recorre con ↑ ↓ y se cierra con B.
- [x] Astro Chess: cruceta o stick mueven el foco del plano, A levanta y deja, B suelta, Start va
  al combate y resuelve o saltea la ronda, L1/R1 recorren la bitácora, Select abandona; Y abre la
  ayuda, que se hojea con la cruceta y se cierra con B.
- [ ] Tanques.
- [x] Semáforos: cruceta o stick cambian el semáforo de ese lado, Select sale; en el final A juega
  de nuevo, Y va al título y B al arcade. El stick cuenta sólo su eje más inclinado (también en
  Tetris, que rotaba con el stick en diagonal hacia arriba).
- [x] Galáctica: cruceta o stick vuelan (en diagonal también), A dispara y X escuda mientras se
  mantengan, Start pausa, Select sale; en el título Y abre la Galactopedia, que se hojea con la
  cruceta y se cierra con B; en el resultado A sigue, Y al título y B al arcade.
- [x] Jukebox: cruceta o stick eligen y pasan página, L1/R1 cambian entre música y efectos, A oye,
  X para, B o Select salen. Copiar sigue en Ctrl+C.

## Registro

- 2026-11-27, Socavón. `npm run test:mando -- socavon` falló antes del cambio («modo tras la
  cruceta = false») y pasa después: cruceta y stick en el título, Y otra semilla, Start entra sin
  pausar la mina nueva aunque siga apretado, stick y cruceta mueven, X linterna, Start pausa y
  sigue, B no sale de la mina, A baja de mina, Select sale, y en el resultado A, Y y B. Con
  teclado, `npm run shots -- socavon` pasa entero; `npm run test:socavon` y `npm run build` en
  verde. Textos con «ENTER / A», «ESPACIO / A», etc., revisados en las capturas del título, la
  pausa y el resultado. Sin probar con un mando físico.
- 2026-11-27, launcher. `npm run test:mando` sumó la prueba `launcher` (cruceta y stick cambian la
  ficha, Start abre la primera) y la de Socavón ahora llega al juego con el mando: las dos fallaron
  antes del cambio y pasan después. Con teclado, `npm run shots -- launcher` y `-- ancho` (flechas,
  Enter y cambios de ventana) pasan; `npm run build` en verde. El driver de la prueba usa un solo
  navegador y servidor para todas: levantar Vite de nuevo chocaba con el que se estaba apagando.
  La pantalla completa no puede pedirse con el mando: el navegador sólo la concede en un gesto de
  mouse, teclado o toque.
- 2026-11-27, Tetris. `npm run test:mando -- tetris` falló antes del cambio (el título no
  arrancaba con A) y pasa después: el A que abre la ficha no arranca la partida, cruceta y stick
  mueven, B y ↑ rotan, abajo baja, A deja caer, Start pausa y sigue, Select al título, y en el fin
  A, Y y B; B en el título vuelve al arcade. Nuevo recorrido con teclado `npm run shots -- tetris`
  (→, ↑, Espacio, P, Esc, R, M): pasó con el código anterior y pasa con el nuevo. Las tres
  pruebas de mando juntas, dos veces seguidas, y `npm run build` en verde. Capturas revisadas:
  el tercer renglón de controles del título pisaba «Cómo jugar» y se bajó el bloque.
  La prueba de Tetris falló de a ratos hasta corregir el driver: `padUp` seguido de `padPress`
  no dejaba pasar ningún frame con el botón suelto; ahora `padUp` espera.
- 2026-11-27, Truco. `npm run test:mando -- truco` falló antes del cambio (la cruceta no cambiaba
  de rival) y pasa después: D no cambia de rival en el título, cruceta y stick sí; A en «Quiero»
  abre el cuadro del tanto, ↑ ↑ da 21, ↓ ↓ da 7, B lo cierra; con el tanto de la IA dicho, B es
  «son buenas»; ← mueve el foco, la letra D sigue eligiendo la tercera carta y A la juega; Select
  sale y B en el título vuelve. Con teclado, `npm run shots -- truco` (flechas, A, Enter, B,
  dígitos y Esc) pasa; las cuatro pruebas de mando juntas y `npm run build`, en verde. Primero
  puse «son buenas» en Y, pero el botón muestra la tecla B: quedó en B, que en el cuadro aprieta el
  único botón de abajo. `TrucoGameOverScene` no la abre ninguna escena (la partida termina en la
  mesa); se pasó a `Controls` igual, sin prueba propia.
- 2026-11-27, Pipes. `npm run test:mando -- pipes` falló antes del cambio (Y no abría la
  configuración) y pasa después: Y abre la configuración, ↓ la desplaza y B vuelve; cruceta y
  stick mueven el cursor, A coloca, Y reinicia, B larga el agua; en el fin de nivel A sigue
  (nivel 4) o empieza de nuevo (nivel 1), Y al título y B al arcade; Select sale de la partida y
  B del título. Pipes no tenía recorrido con teclado: `npm run shots -- pipes` (C, ↓, Esc, →,
  Espacio, Enter, R, F, Enter, R, M, Esc) pasó con el código anterior y pasa con el nuevo. Las
  cinco pruebas de mando juntas y `npm run build`, en verde. En las capturas, «R / Y REINICIAR
  NIVEL» se salía del botón y quedó «R / Y REINICIAR». Ya estaban antes, sin tocar: en el título,
  «Cómo jugar» pisa el primer renglón de controles y el texto de la meta pisa el botón Jugar.
  Cambio de comportamiento: perdido el nivel, Enter también empieza de nuevo (antes sólo R).
- 2026-11-28, título de Pipes. Se corrigieron las dos superposiciones que ya estaban: los textos
  se apilan con su alto real («Cómo jugar», controles, meta) y los botones arrancan debajo de la
  meta, con la misma separación entre ellos que antes. Captura revisada sin superposiciones;
  `npm run shots -- pipes`, `npm run test:mando -- pipes` y `npm run build`, en verde.
- 2026-11-28, Astro Chess. `npm run test:mando -- astro-chess` falló antes del cambio (Y no abría
  la ayuda) y pasa después: Y abre la ayuda, cruceta y stick pasan página y eligen, B vuelve; en
  los puestos A levanta, B suelta sin salir y con la mano vacía vuelve, A + ↑ + A deja una pieza
  en un puesto, Start avisa sin armería y confirma; en el combate A levanta, B suelta sin salir,
  Start resuelve y saltea, R1/L1 recorren la bitácora; al final A reintenta y B va al título;
  Select abandona y B en el título vuelve al arcade. Con teclado, `npm run shots -- astro-chess`
  pasó con el código anterior y pasa con el nuevo. Las seis pruebas de mando juntas y
  `npm run build`, en verde. Para que las etiquetas con «ENTER / START» entraran se ensancharon
  los botones de los puestos, de abandonar y del cartel final; capturas revisadas. Cambio de
  comportamiento: mantener apretada una flecha ya no repite el movimiento del foco ni pasa varias
  páginas de la ayuda (antes usaba la repetición del sistema); WASD ahora también mueve el foco.
- 2026-11-28, Semáforos y stick. `npm run test:mando -- traffic` falló antes del cambio (A no
  arrancaba la partida). Con las escenas ya pasadas a `Controls` volvió a fallar donde debía: el
  stick en diagonal (0,8; −0,6) cambiaba el semáforo del norte además del este. Con el eje
  dominante en `Controls` pasa entero: la cruceta y el stick cambian cada semáforo, A, B y Start
  no salen, Select vuelve al título, y en el final A, Y y B. Con teclado, `npm run shots --
  traffic` (flechas, WASD, Enter, M, Esc) pasó con el código anterior y pasa con el nuevo; también
  `npm run shots -- tetris`. Las siete pruebas de mando juntas y `npm run build`, en verde. En la
  captura, «ENTER / A  JUGAR» se salía del botón del título y se ensanchó; revisado en español e
  inglés. Tanques queda pendiente: su próximo paso es un segundo jugador en el mismo teclado, que
  pide repartir flechas/WASD y los mandos por jugador.
- 2026-11-28, Jukebox. `npm run test:mando -- jukebox` falló antes del cambio (↓ de la cruceta no
  cambiaba de fila) y pasa después: cruceta y stick eligen, ← → pasan página, R1 y L1 cambian de
  pestaña, A oye y X para (espiados, para no bajar audio de R2), B y Select salen. El Jukebox no
  tenía recorrido con teclado: `npm run shots -- jukebox` (↓ ↓ ↑, → ←, Tab, Enter, Espacio, Esc)
  pasó con el código anterior y pasa con el nuevo. Las ocho pruebas de mando juntas y
  `npm run build`, en verde. El pie suma un renglón con el mando; captura revisada. Copiar no va
  al mando: `navigator.clipboard` pide un gesto de teclado, mouse o toque.
- 2026-11-28, Galáctica. `npm run test:mando -- galactica` falló antes del cambio (→ no cambiaba
  de nave). Al pasar las escenas a `Controls`, la nave no podía volar en diagonal con el stick:
  el arreglo de Semáforos dejaba un solo eje también para moverse. `Controls` ahora separa las dos
  lecturas (mantenido por eje, pulsación por eje dominante) y la prueba lo mira: stick en
  (−0,8; −0,7) da move −1 y moveY −1. Pasa entero: hangar con cruceta y stick, Galactopedia con Y,
  páginas, elección y B; A despega; A dispara y X escuda mientras se mantienen; B no sale; Start
  pausa y sigue; Select al título; en el resultado A juega de nuevo desde la zona 1, Y al título
  y B al arcade. Con teclado, `npm run shots -- galactica` pasó con el código anterior. Después
  del cambio falló su control del convoy en ventana ancha: el pie del panel con «P / START ·
  ESC / SELECT» se salía del panel; ahora va en dos renglones y pasa. Las nueve pruebas de mando
  juntas y `npm run build`, en verde. Capturas revisadas: título, Galactopedia, pausa, resultado y
  ficha del launcher. El escudo quedó en la X del mando, no en B, para que «ESCUDO X» del panel
  valga para teclado y mando.
