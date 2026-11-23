# Socavón

## Pedido textual (2026-11-22)

> Quiero hacer un clon del Bagitman de commodore 64. Para el armado de los niveles, hagamos el
> original pero fijate como podemos hacer que sean procedurales luego. Para los gráficos hacelos
> con spritekiln/pipx la herramienta globa (quizas debas inicializarla local)
> Te dejo algo de arte conceptual para que te sirva "D:\Descargas\dibujos-de-la-mina.zip"

## Alcance

No se reproduce Bagitman: ni nombre, personajes, mapas, pantallas, música ni look. Se hace un
juego propio del género, con los diseños del arte conceptual del pedido.

Socavón es sigilo con luz y ruido en una mina vertical: robarle la llave al sereno, abrir la
bóveda y sacar el botín por el montacargas con la campana sonando.

## Reglas

Las citas son del pedido o rótulos del arte conceptual. El resto son decisiones de diseño
tomadas al implementar, no pedidos del usuario.

- R1 «hagamos [...] fijate como podemos hacer que sean procedurales luego»: niveles propios a
  mano y niveles por semilla, los dos en un mismo formato de texto; todo nivel generado se puede
  completar.
- R2 «Para los gráficos hacelos con spritekiln [...] quizas debas inicializarla local»:
  personajes, objetos y tiles salen de specs de spritekiln, en un solo atlas.
- R3 «BOLSA DE DINERO»: se carga de a una, frena, se puede soltar y se entrega en el montacargas.
- R4 «CARRETILLA»: lleva hasta tres bolsas, hace ruido, no sube escaleras.
- R5 «VAGONETA Y RIELES»: va y viene; atropella al minero y aturde a los serenos.
- R6 «ESCALERA»: la usan el minero, también cargado, y los serenos.
- R7 «MANIJAS DE TECHO»: cruzan pozos sólo con las manos libres; abajo, uno se deja caer.
- R8 «PICO» y «MURO ROMPIBLE»: tres golpes, cada uno se oye.
- R9 «BÓVEDA»: pide la llave, que se le saca al sereno por la espalda; da dos bolsas.
- R10 «LÁMPARA DE ACEITE»: se apaga; a oscuras y sin linterna el sereno ve mucho menos.
- R11 «CAMPANA DE ALARMA»: suena al abrir la bóveda, atrae a los serenos y se puede callar.
- R12 «cuidador.png»: patrulla, escucha, ve de frente, persigue y atrapa; no ve a quien se
  esconde en un nicho.
- R13 La partida: tres vidas; se pasa de mina con todo el botín entregado; récord local.
- R15 «recien jugue y la boveda estaba al final de un camino, no pude evitar de ninguna manera al
  guardia, varios puntos del mapa necesitan  un camino redundante porque si el guardia se queda en
  un solo lugar no podes avanzar»: un sereno parado en cualquier lugar no deja sin camino a ningún
  objetivo, ni de ida ni de vuelta; y un sereno no se queda clavado.
- R16 La vagoneta como escape. Dos mensajes de Mariano, textuales:

  > El carro te mata? si te tiras encima deberías subirte. Si accionas con el carro detenido, te
  > subis o bajas. El guardia no te hace nada si vas en el carro, pero si te agarra si te está
  > siguiendo y te vio subir y te toca con el carro detenido. ¿Cómo ves esta mecánica? Vi ademas
  > que el carro también atonta al guardia aunque no siempre ¿como funciona eso?

  > Era solo desde arriba. En el original, te deja agarrarte un soporte que es como un hierro en
  > forma de C pegado al techo algo asi: |] como si "|" fuera el techo y "]" fuera la manija pero
  > dados vuelta. Esto podríamos recrearlo con un timeout de agotamiento cosas que no puedas quedar
  > ahi para siempre e igual el viejo te agarra ahi. No se si da la altura del tunel para el minero
  > agarrado contra el techo y el vagón pasando por abajo. Luego de ahi te soltas para entrar al
  > vagón.

  - R16.1 «un soporte [...] pegado al techo»: sobre cada riel hay un agarre; ↑ con las manos libres.
  - R16.2 «el vagón pasando por abajo»: colgado no te pisa, y en el dibujo entra sin tocarse.
  - R16.3 «timeout de agotamiento cosas que no puedas quedar ahi para siempre»: se cansa, cae y
    tiene que descansar antes de volver a agarrarse.
  - R16.4 «igual el viejo te agarra ahi».
  - R16.5 «te soltas para entrar al vagón», «Era solo desde arriba»: se sube cayéndole encima,
    desde el agarre o desde un pozo. De frente sigue matando.
  - R16.6 «Si accionas con el carro detenido, te subis o bajas».
  - R16.7 «El guardia no te hace nada si vas en el carro, pero si te agarra si te está siguiendo y
    te vio subir y te toca con el carro detenido»: tienen que darse las tres. Si lo pierde o queda
    atropellado deja de ser testigo. Al que no lo vio subir, el minero agachado le es invisible.

  Ajustes propuestos por el asistente antes de este segundo mensaje, implementados con él:
  - R16.8 margen de una celda al caer encima;
  - R16.9 ninguna parada queda sin salida con el testigo detrás;
  - R16.10 ningún objetivo pegado a una parada, para que Espacio no se pise;
  - R16.11 inmunidad del sereno al levantarse de 6 a 4 s, y a la vista con parpadeo;
  - R16.12 el choque al pie de una escalera mide igual para el sereno y el minero.
  - R16.13 «dale, que las argollas también cansen»: colgado de las argollas de un pozo se gasta la
    misma barra. Al agotarse cae a la galería de abajo; si abajo no hay galería, pierde una vida
    (decisión del asistente, avisada). Ningún pozo es tan largo que no se cruce con la barra a la
    mitad.
- R17 Nicho y campana. Mensaje de Mariano, textual:
  > Cuando estás oculto en la puerta, el guardia está pasando por detrás y debería pasar por
  > delante tuyo y de la puerta. La campana tenes que poder activarla vos también. Es una forma de
  > distraer a los guardias.
  - R17.1 escondido en el nicho, el sereno que pasa se dibuja por delante del minero y del nicho.
  - R17.2 con la campana callada, Espacio al lado la toca: suena 8 segundos y los serenos que no
    persiguen ni están aturdidos van para ahí, como al abrir la bóveda. Sonando, Espacio la calla.
    Sólo con las manos libres, y lo que esté tirado al lado se levanta antes (decisiones del
    asistente, avisadas: cargado, Espacio sigue soltando la bolsa).
- R18 «Arregla tambien lo de la carretilla al soltarla que queda siempre igual»: suelta, la
  carretilla queda mirando para el lado en que se la llevaba, no siempre a la derecha.
- R19 Oscuridad, memoria y oído. Mensajes de Mariano, textuales:
  > Hoy la luz del minero no sirve para nada, quizás debería ser tan oscuro que no puedas jugar
  > sin la luz no?

  > Primero hace commit de lo que tenemos. Hasta aca está bien salvo eso. Despues, no solo haría
  > los 3 puntos. Si no que sumaría que no puedas ver los pisos que no estás. Ahí si se vuelve de
  > suspenso y planificación. El guardía podría un encendedor de muy poca luz cuando no hay luz
  > para que con eso vaya a encender las linternas. De todas formas ellos no necesitan ver la
  > linterna, son del lugar y saben donde están pero esa pequeña luz le permite ver por donde va.
  > ¿Cómo lo ves? Más adelante podemos armar trampas, otro tipos de guardias, artefactos y
  > artilugios. El protagonista también debería poder oir cosas dentro de un rango. Es otra forma
  > de sentir.

  > Donde no estás es negro total. De donde venis podría ser algo así como una radiografía que se
  > va tiñiendo a negro. Es como lo que recordas. Pero fijo, sin movimiento. ¿Está bueno eso, es
  > muy complicado? Cuando estás sobre la escalera y empezas a bajar/subir, permitiría que veas el
  > final de la escalera, así no pasa que justo empezas a bajar y estaba el guardia y te agarra,
  > sería mas de suerte que de planificar. Luego si cuando ya estás mitad y mitad, podes ver los 2
  > pisos.

  > dale, arrancá con la primera etapa

  Los «3 puntos» son los que propuso el asistente y Mariano aceptó: oscuridad de verdad en el
  propio piso, más lento a tientas, y que prender la linterna se note. Etapas acordadas: 1) pisos
  negros, memoria y escalera; 2) oído; 3) oscuridad en el propio piso, lentitud a tientas,
  linterna que se nota y encendedor del sereno.

  Etapa 1:
  - R19.1 «Donde no estás es negro total»: se ve en vivo sólo la galería en la que está el
    minero, de punta a punta. Las demás se ven negras, con lo que se mueve oculto.
  - R19.2 «permitiría que veas el final de la escalera»: al empezar a trepar o a caer se ve
    también, en vivo, el otro extremo: dos celdas a cada lado (decisión del asistente).
  - R19.3 «cuando ya estás mitad y mitad, podes ver los 2 pisos»: en el tramo del medio, del 30 al
    70 % del recorrido (decisión del asistente), se ven las dos galerías enteras.
  - R19.4 «una radiografía que se va tiñiendo a negro [...] fijo, sin movimiento»: lo que se dejó
    de ver queda como se lo vio por última vez, en un tono frío, y se apaga a negro en 12 segundos
    (decisión del asistente). Un sereno que se fue sigue en el recuerdo donde se lo vio; lo que
    cambia mientras no se ve (una lámpara que se prende, una vagoneta que se mueve) no cambia en
    el recuerdo. Lo nunca visto es negro.
  - R19.5 La etapa 1 sólo cambia lo que se ve: las reglas del juego, el piloto y el balance quedan
    iguales.
- R20 Correcciones de la etapa 1. Mensajes de Mariano, textuales:
  > El muro tiene que restringir la vista igual que le restringe al guardia. Las escaleras que
  > duran más de un piso no permiten bajar en los intermedios. A veces cuando volves a un piso, el
  > recuerdo muestra un guardia subiendo la escalera pero no es real y solo se ve yendo al piso, si
  > no vas al piso el recuerdo no lo muestra, o sea, volver te crea un recuerdo o no se si lo
  > oculta y realmente estaba. No, creo que se lo que pasa, como está ahi arriba, cuando vas al
  > piso no lo ves, pero en el recuerdo lo viste irse, supongo que esa parte del recuerdo no se
  > actualiza cuando volves. Cuando cruzas un pozo, deberías poder ver lo de abajo.

  > Lo del recuerdo y el sereno es que no limpia las posiciones de cosas dinamicas el nuevo
  > recuerdo, creo que es eso

  - R20.1 la roca y los muros sin romper cortan la vista como al sereno: se ve el muro, no lo de
    atrás. También en la ventana de la escalera.
  - R20.2 en una escalera de varios pisos, con ← o → apretado la escalera no atrapa: se baja en el
    piso del medio aunque ↓ siga apretado. Sin ← ni →, sigue de largo como antes.
  - R20.3 colgado de las argollas se ve la galería de abajo alrededor del minero, dos celdas a cada
    lado, como en la escalera.
  - R20.4 lo que se mueve y se recuerda se borra del recuerdo en cuanto se ve ese lugar sin él:
    al sereno que se lo vio irse no lo trae el recuerdo de esa galería.
- R14 Convenciones del arcade: módulo propio, ES/EN, ancho elástico y lo demás sin cambios.

## Tareas

- [x] T1 Test por regla, visto fallar.
- [x] T2 Estado sin Phaser y niveles a mano.
- [x] T3 Generador y prueba de que se completa.
- [x] T4 spritekiln local, specs y atlas.
- [x] T5 Escenas, ficha del launcher, textos y audio.
- [x] T6 Build, tests, capturas y revisión visual.
- [x] T7 Documentación.
- [x] T8 R15: camino redundante y serenos que no se clavan.
- [x] T9 R16: agarre del techo y vagoneta como escape.
- [x] T10 R16.13: las argollas también cansan.
- [x] T11 R17: el sereno pasa por delante del nicho y la campana se toca a mano.
- [x] T12 R18: la carretilla suelta conserva su lado.
- [x] T13 R19 etapa 1: pisos negros, memoria que se apaga y vista desde la escalera.
- [x] T13b R20: muros que tapan, escaleras de varios pisos, recuerdo que se limpia, pozos.
- [ ] T14 R19 etapa 2: oído.
- [ ] T15 R19 etapa 3: oscuridad en el propio piso, a tientas, linterna que se nota, encendedor.

## Registro de correcciones y evidencia

2026-11-22

- Estilo de spritekiln confirmado por Mariano: «Retro 40 px (Recomendado)».
- La carpeta de spritekiln es `arte/spritekiln/`, como pide su skill `spritekiln-juego`.
- El minero va sin bigote: a 40 px el estilo elegido es de cara mínima.
- Test visto fallar antes de implementar (los módulos no existían).
- Bugs encontrados al verificar, cada uno con su test visto fallar:
  - el botín de una bóveda junto a un pozo caía sobre el pozo;
  - el pico tirado encima de una bolsa impedía levantarla;
  - al perder de vista al minero, el sereno frenaba en vez de ir adonde lo vio;
  - la campana seguía sonando con la mina vacía;
  - quieto en la entrada, se moría antes de 30 s en hasta el 37 % de las minas generadas. La
    patrulla ya no pasa por esa galería: 0 de 903.
- Evidencia: `npm run test:socavon` (25 pruebas), 10.000 minas completadas por el piloto, 903
  minas con serenos activos y entradas al azar sin invariantes rotas, `npm run build` y todos los
  recorridos de `npm run shots`.
- R15, reproducido antes de tocar nada:
  - caminos únicos: 10/11, 11/12 y 7/15 objetivos de las minas a mano, y 1000/1000 generadas (en
    861, la bóveda). Ahora 0;
  - serenos clavados: hasta 92 s aturdidos en cadena por la vagoneta y sin límite mirando a alguien
    del otro lado de un pozo. Ahora unos 12 s como máximo al patrullar, contando el aturdimiento;
  - 9 tests vistos fallar;
  - un jugador automático que esquiva, con serenos activos, en 270 generadas: vaciadas 250 → 270,
    con tres vidas 84 → 139, muertes 2740 → 862. La mina 2: de no completarse con 50 muertes a
    completarse con 2.
- R16:
  - medido antes de animar: el túnel tiene 48 px, la vagoneta llega a 28 y el minero horizontal
    ocupa los 20 que quedan. No hizo falta agrandar la galería;
  - tests por regla vistos fallar (28 al empezar y uno más por el bug de abajo), 10.000 minas
    válidas y completables, 1503 con entradas al azar sin invariantes rotas, build y los 8
    recorridos de Chrome, el de Socavón con agarre, caída, viaje, subida y bajada por teclado;
  - bug encontrado al verificar: lo que caía bajo la vagoneta detenida no se podía levantar,
    porque subir le ganaba. Ahora primero se levanta;
  - al bajar la inmunidad a 4 s aparecieron serenos hasta 19,2 s al borde del riel. Ahora, recién
    levantados, se alejan: 12,1 s como máximo en 1500 minas. El test de R15 que medía los 6 s
    viejos pasó a medir 4;
  - testigo, en 1356 rieles, de 1 a 3 celdas detrás: con linterna llega siempre y deja de 0,63 a
    1,73 s para bajar; sin linterna, a 3 celdas ya lo pierde;
  - el jugador automático, que no usa la mecánica nueva: 139 → 138 de 270 con tres vidas, muertes
    862 → 865;
  - el generador pone algo menos de rieles: 883 → 859 minas de 1000 con vagoneta.
- R17 y R18:
  - tests vistos fallar: tocar la campana y su duración (2), la carretilla suelta (1). Los de
    perseguidor y aturdido, y cargado o con algo tirado al lado, pasan desde antes y cuidan que
    tocar no le gane a nada;
  - recorrido de Chrome con tres chequeos: escondido, el minero queda debajo del sereno en el
    orden de dibujo y vuelve arriba al salir; la campana tocada suena 8 s y Espacio la calla; la
    carretilla soltada yendo a la izquierda queda espejada;
  - 71 tests y 500 minas generadas completables, tipos y build.
- R19 etapa 1:
  - 6 tests de la regla de qué se ve (R19.1 a R19.3), vistos fallar contra un esqueleto vacío;
    77 tests y 500 minas generadas completables, sin tocar reglas ni piloto (R19.5);
  - recorrido de Chrome con chequeos sobre la escena real: lo nunca visto sale negro; al bajar se
    ve el pie de la escalera y cuatro celdas más allá no; en el medio se ven las dos galerías; el
    sereno que se fue queda en el recuerdo donde se lo vio; a los 12 s el recuerdo es negro;
  - el primer tinte del recuerdo (gris neutro) casi no se distinguía de lo vivo en las capturas:
    marrón y apenas más oscuro. Se pasó a un azul que, sobre la paleta cálida, deja gris frío.
- R20:
  - 4 tests vistos fallar: muro y roca (2), pozo (1) y escalera de varios pisos, que siguió de
    largo hasta y = 1,67 con → apretado;
  - el sereno fantasma, reproducido en Chrome antes de dar el arreglo por bueno: con el arreglo
    desactivado, el recuerdo lo traía (`ghost: true`); con el arreglo, no. Causa: el recuerdo de lo
    que se mueve quedaba guardado aunque se viera ese lugar vacío, y reaparecía al irse;
  - recorrido de Chrome: detrás del muro, negro; 81 tests, 500 minas y build.
- Pendiente: balance jugado por una persona (el piloto no mide dificultad), sonido escuchado por
  una persona, controles táctiles, commit y deploy (no pedidos).

