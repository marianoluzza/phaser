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
- Pendiente: balance jugado por una persona (el piloto no mide dificultad), sonido escuchado por
  una persona, controles táctiles, commit y deploy (no pedidos).

