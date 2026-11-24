# Galáctica: fases nuevas

## Pedido textual (2026-11-22)

> Algunas cosas sobre galactica. Los enemigos atacan poco, no lleva mucho trabajo matarlos. Aumentaria un poco como se lanzan y algun que otro disparo desde las posiciones donde están estacionados. Y pensemos nuevas fases. Disparar podría gastar energia un poco más rápido para incentivar la puntería y no solo tener apretado. Se me ocurre también que puedas usar un escudo bajo demanda y eso gaste energía. Entonces el powerup no es escudo en ese momento, te sube ese contador. Lo usas cuando lo necesitas y gasta energia un poco más rápido que cuando no. Y creo que hay que dejar que la nave avance un poco hacia atrás y adelante, 50% de la pantalla quizas? Que se estila? Con todo esto subiría un poco la aparición de powerups.

Lo de combate quedó hecho en ese momento (ver `galactica.md`). De las fases se propuso, textual:

> | Fase | Qué pasa | Qué aprovecha |
> | --- | --- | --- |
> | 1. Convoy | Cruzan cargueros con escoltas. Sólo se rompen por la bodega y sueltan energía | puntería |
> | 2. Travesía | 25 s sin formación, entre campos de rocas con huecos | moverse adelante y atrás |
> | 3. Tormenta iónica | Descargas anunciadas por franjas. Si las bloqueás con el escudo, te devuelven energía | escudo en el momento justo |
>
> Yo haría **Travesía, Convoy y Tormenta**, una por zona entre la segunda oleada y la tercera, y en la cuarta las tres combinadas.

Respuesta del usuario:

> dale, vamos con esas tres

## Reglas

- R1 «una por zona entre la segunda oleada y la tercera»: zona 1 Travesía, 2 Convoy, 3 Tormenta.
  Pasa una sola vez y después viene la tercera oleada.
- R2 «en la cuarta las tres combinadas»: en el mismo tramo, a la vez.
- R3 «25 s sin formación, entre campos de rocas con huecos»: siempre hay camino para la nave más
  lenta.
- R4 «moverse adelante y atrás»: hay muros que cruzan de costado y cuyo hueco está a una altura.
- R5 «Cruzan cargueros con escoltas»: las escoltas acompañan y disparan con aviso.
- R6 «Sólo se rompen por la bodega»: el casco frena los disparos sin recibir daño.
- R7 «y sueltan energía»: cada carguero roto, siempre.
- R8 «Descargas anunciadas por franjas»: se ven antes de caer y siempre se llega a un lugar libre.
- R9 «Si las bloqueás con el escudo, te devuelven energía»: una vez por descarga, también si la
  nave venía parpadeando.
- R10 «escudo en el momento justo»: tenerlo prendido desde el principio no alcanza para todas.

Decisiones tomadas al implementar, no pedidos del usuario:

- D1 Desde que cae la segunda oleada hasta que sale la tercera no corren el reloj de energía ni
  el drenaje por energía vacía: el tramo dura fijo y no se puede apurar. Disparar y cubrirse se
  siguen cobrando.
- D2 La tormenta (y el tramo combinado) asegura 8 s de carga de escudo al empezar.
- D3 El tramo espera a que salgan de pantalla las rocas y cometas de la oleada anterior: si no,
  podrían tapar el hueco.

## Tareas

- [x] T1 Test por regla, visto fallar.
- [x] T2 Estado: tramo, rocas, cargueros y descargas (R1 a R10).
- [x] T3 Sprite del carguero con pxl y dibujo de avisos y descargas.
- [x] T4 HUD, carteles, sonido, Galactopedia y textos ES/EN.
- [x] T5 Simulador con las fases y ajuste de los premios.
- [x] T6 `galactica.md`, build, tests y recorrido en Chrome.

## Registro

- 2026-11-22: punto de partida con los 30 tests en verde y el simulador de 60 campañas por nave y
  estilo: 58 a 60 completas.
- Evidencia: 56 tests en verde (30 de antes y 26 de los tramos). La búsqueda de salida falla si se
  achica el hueco o se juntan dos muros; el test de escape, si se acorta el aviso.
- Simulador final, 100 campañas por nave y estilo: 97 a 100 completas.
- Corrección: el reloj corría en las pausas de alrededor del tramo y encarecía la zona 1. Test
  visto fallar y arreglado.
- Corrección: una escolta podía avisar y disparar desde afuera de la pantalla. Test visto fallar
  y arreglado.
- Recorrido `galactica` en Chrome sin errores de consola, con los cuatro tramos, la bodega rota a
  tiros y una descarga bloqueada con la tecla X. Capturas revisadas en español e inglés.
- Premios ajustados: bodega 15 %, bloqueo de 6 a 4 %.
- Pendiente: jugarlo una persona (dificultad y lectura de los avisos) y escuchar los dos sonidos
  nuevos. Sin commit ni deploy.

### Primera prueba a mano (2026-11-23)

Pedido textual:

> Va muy bien. El convoy cuando aparece por la derecha se alcanza a ver un poco a la derecha del
> panel, luego queda atras del panel y aparece. Viene con una guardia muy laxa igual. Y la fase de
> asteroides le subiría un poquito la velocidad de movimiento y de aparición. El 3er jefe cuando te
> repele, debería tener algun indicador de que eso está pasando, como un aura magnetica. Y también
> hay que subir un poco el area de recolección de la nave, a veces pasa cerca casi pegado el
> powerup y no lo toma.

- R11 «se alcanza a ver un poco a la derecha del panel»: en una ventana ancha nada se asoma afuera
  del campo. Los paños que lo tapan se cortaban en los 800 de la escena.
- R12 «una guardia muy laxa»: tres escoltas, una debajo de la bodega, y salvas cada 1 a 1,6 s
  (antes 1,8 a 2,8): de 9,65 a más de 14 por convoy.
- R13 «la fase de asteroides […] velocidad de movimiento y de aparición»: filas de 160 a 180 px/s,
  muros de 190 a 212 y doce líneas en vez de diez.
- R14 «el area de recolección»: de 24 a 42 px, lo que miden media nave y media cápsula.
- Lo del 3er jefe no existe en el código: ningún jefe empuja la nave. Respuesta del usuario: «me
  pareció en un momento que me obligaba a quedarme en la primer linea, como cuando no podias
  avanzar. No importa entonces, lo podemos analizar luego como una mecánica nueva». Queda afuera.
- Evidencia: los cinco tests nuevos vistos fallar y después en verde (61 en total, con la búsqueda
  de salida pasando con la Travesía más rápida). El chequeo de píxeles del recorrido en 1280×600
  falló con los paños de antes y pasa con los nuevos. Simulador de 100 campañas por nave y estilo:
  97 a 100 completas, 100 % de cargueros rotos en el Convoy.
