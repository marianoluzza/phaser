# Socavón

Sigilo con luz y ruido en una mina vertical. Hay que robarle la llave a un sereno, abrir la bóveda
y sacar todo el botín por el montacargas, con la campana sonando.

Es un juego propio del género de plataformas de una pantalla por galería, escaleras y botín. Los
personajes, las minas y las reglas de sigilo son de Socavón.

## Controles

| Tecla | Qué hace |
|---|---|
| ← → / A D | Caminar, cruzar por las manijas, salir del nicho |
| ↑ ↓ / W S | Escalera. ↑ bajo un agarre cuelga y en un nicho esconde; ↓ colgado suelta |
| Espacio | La acción del momento, que se lee abajo de la pantalla |
| Z | Apagar o prender la lámpara de al lado |
| X | Linterna del casco |
| P / Esc | Pausa / menú |

## Reglas

- **Botín.** Una bolsa por vez, y frena: cargado se corre menos que un sereno. Soltarla es la forma
  de escapar. La mina termina al entregar todo.
- **Carretilla.** Junta hasta tres bolsas al pasar, pero se oye y no sube escaleras ni cruza pozos.
- **Llave y bóveda.** La llave se saca por la espalda, o a un sereno aturdido. Cada bóveda gasta una
  llave y da dos bolsas.
- **Campana.** Abrir la bóveda la hace sonar 20 segundos: los serenos van para ahí y se apuran. Se
  calla con Espacio junto a una campana.
- **Luz.** Con linterna o bajo una lámpara, un sereno ve a 8 celdas; a oscuras, a 2,2. Su haz
  dibuja ese alcance real. Al pasar vuelven a prender las lámparas apagadas hace más de 10 segundos.
- **Ruido.** El pico, la carretilla y las caídas se oyen en la galería y, atenuados, en las vecinas.
- **Manijas.** Cruzan pozos con las manos libres. Los serenos no pueden seguirte. Gastan la misma
  barra que el agarre: agotada, se cae a la galería de abajo o, si no hay, al fondo y se pierde una
  vida. Ningún pozo es tan largo que no se cruce con media barra.
- **Muros.** Tres golpes de pico. Tapan la vista.
- **Vagoneta.** Tiembla antes de salir. En marcha atropella al minero y aturde a los serenos;
  detenida no le hace nada a nadie. En el medio de su riel suele haber un nicho.
- **Agarre.** Un hierro en C en el techo de cada riel. Con las manos libres, ↑ cuelga al minero y la
  vagoneta le pasa por abajo. Aguanta 6 segundos, tiembla y cae. Para volver a agarrarse tiene que
  llenarse la barra. Colgado ahí, un sereno lo agarra venga de donde venga.
- **Viajar.** Cayéndole encima, desde el agarre o desde un pozo, se queda adentro: hay una celda de
  margen. De frente mata. Detenida, Espacio sube y baja, con bolsa o pico y sin carretilla. Lo que
  esté tirado ahí se levanta antes de subir.
- **Testigo.** Agachado en la vagoneta no lo ven ni lo agarran, salvo quien lo perseguía y lo vio
  subir: ése lo agarra si lo toca con la vagoneta detenida. Deja de ser testigo si lo pierde o
  queda atropellado.
- **Nichos.** Esconden de serenos y vagonetas, salvo que te metas con un perseguidor encima.
- **Siempre hay otro camino.** Ningún objetivo queda al final de un camino único: un sereno parado
  en cualquier lugar se rodea por otra galería, de ida y con el botín de vuelta.
- **Serenos que circulan.** No descansan en rieles ni escaleras. Si no pueden llegar a quien ven,
  dan la vuelta o, si no hay vuelta, desisten. Recién atropellados salen del riel, se alejan y por
  4 segundos, mientras parpadean, la vagoneta no los vuelve a tirar.
- **Entrada.** La patrulla no pasa por la galería de arriba: es el respiro al llegar y al revivir.
  Un ruido o una persecución sí pueden llevar a un sereno hasta ahí.

Los números están en `constants/tuning.ts`.

## Módulo

```mermaid
flowchart LR
    Hand["constants/levels.ts<br/>minas a mano"] --> Rows["renglones de texto"]
    Seed["state/generator.ts<br/>semilla + profundidad"] --> Rows
    Rows --> Check["state/level.ts<br/>parseLevel y checkLevel"]
    Check --> Mine["state/Mine.ts<br/>reglas, sin Phaser"]
    Mine --> Brain["state/guardBrain.ts"]
    Mine --> View["objects/MineView.ts"]
    Mine --> Hud["objects/Hud.ts"]
```

`Mine.step(dt, input)` avanza el estado y devuelve eventos. La escena los convierte en sonidos y
efectos. `Mine.action()` decide qué hace Espacio y también alimenta la ayuda, así que no pueden
contradecirse.

## Formato de una mina

Un renglón por galería y un carácter por celda. La leyenda está al comienzo de `state/level.ts`.

```text
##Hl.E.....H..H$..l...H...##
#H..Hl.n.$...T..hhh.l...H..#
#.WH.E...lH.n..K.H.%.$.l.H##
###.$..l.....n..l.B...V.l..#
```

Para agregar una mina se suma a `LEVELS` con su `id`, su nombre en los dos idiomas y en
`MINE_NAMES`, y se corre `npm run test:socavon`.

## Minas procedurales

El generador escribe el mismo formato que las hechas a mano:

1. Define galerías de largo irregular y las dos paradas del montacargas.
2. Agrega muros y pozos, y tres escaleras por galería: una en cada punta y otra en el medio.
3. Tiende rieles con un nicho en el medio y un agarre a dos celdas del nicho, sólo donde las dos
   paradas tienen salida. Después no pone nada pegado a una parada.
4. Reparte pico, bóvedas, llaves, serenos, bolsas, carretilla, lámparas y campanas. Los objetivos
   sólo van en celdas con camino redundante (`redundantCells`).
5. Pasa la candidata por `checkLevel`; si no sirve, prueba otra con el mismo azar con semilla.

El validador exige que todo lo necesario se alcance caminando (con una bolsa no se usan manijas),
que al pico se llegue sin romper muros, que haya llaves para las bóvedas y que ningún pozo tire a un
lugar sin salida.

De cada riel exige un agarre con techo (no bajo un pozo ni una escalera), ningún objetivo pegado
a una parada, porque Espacio ahí es subir y bajar, y salida en las dos paradas aunque el testigo
tape todo el riel.

También exige camino redundante. Para cada celda donde podría pararse un sereno, tapa esa y las dos
de al lado, y todo objetivo tiene que seguir conectado con la entrada. Al diseñar a mano la regla
práctica es una escalera a cada lado de cada objetivo, separadas por más de dos celdas.

La profundidad suma galerías (4 a 7), bolsas, serenos, rieles y, desde la 6, una segunda bóveda.
La campaña usa las minas a mano y sigue con generadas; la veta sin fin es toda generada y muestra su
semilla para poder repetirla.

Cambiar el generador cambia qué mina da cada semilla.

## Pruebas

```bash
npm run test:socavon           # una prueba por regla y 500 minas completadas
npm run test:socavon -- 10000  # más minas
npm run shots -- socavon       # recorrido completo en Chrome
```

El piloto de `state/autopilot.ts` completa las minas con serenos y vagonetas quietos: prueba que se
pueden terminar, no que sean justas ni divertidas. La dificultad se ajusta jugando.

## Arte

```mermaid
flowchart LR
    Specs["arte/spritekiln/art/specs<br/>YAML"] -->|"npm run art:socavon"| Atlas["public/assets/socavon<br/>mine.png + mine.json"]
    Atlas -->|"load.atlas"| Scenes["Escenas"]
```

- El estilo está grabado en `arte/spritekiln/spritekiln.toml`: lateral, personajes de 40 px,
  contorno oscuro, toon, chibi y cara mínima. Los specs parten del arte conceptual del proyecto.
- Se dibuja a ×2, con filtro NEAREST. Un tile son 24 px y una galería, tres tiles.
- Los tiles no llevan contorno y QA de spritekiln los informa cortados en el borde: es a propósito
  y el script sólo tolera ese error, en ese asset.
- Una animación nueva es un bloque en su spec. Después de `npm run art:socavon` se usa como
  `asset/animacion` con `showClip`.
- Colgado sobre un riel entran justo el minero horizontal y la vagoneta: 20 px y 28 de los 48 del
  túnel. Un test lo mide contra el atlas (`GRIP_LIFT` y `CART_LIFT` en `objects/geometry.ts`).
- La luz es un tinte por pieza (`objects/lighting.ts`), no una máscara.

El audio sale de la biblioteca del arcade (`audio.ts`).
