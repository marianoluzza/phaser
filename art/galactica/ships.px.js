// Galáctica: naves, pods, asteroides y recargas. Todo vive en una celda de
// 16×16 (las recargas, en 12×12). Se dibuja la mitad izquierda y `mx` la
// espeja. El jugador mira hacia arriba; los enemigos, hacia abajo.
//
// Sin contorno: a 16 px cuesta dos columnas y sobre el negro del espacio no se
// vería. Las siluetas se separan del fondo por valor, no por borde.
include("palette.px.js", { palette: true })

// --- Hangar: tres naves, tres etapas cada una ----------------------------
// Cada etapa se pinta encima de la anterior, así la línea de evolución se lee
// como una sola nave que crece.

// Halcón: equilibrada. Alas rojas, cabina celeste.
sprite("halcon_1", { mx: true }, `
  .......w
  .......w
  ......sw
  ......sc
  ......Cc
  ...r..sC
  ...r..sw
  ...R.ssw
  ..rr.ssw
  .rrRSssw
  rrRSSssw
  rRSSSssw
  R..SSssS
  ....RSS.
  .....oy.
  ......y.`)

// mk2: cañones en las puntas de las alas.
sprite("halcon_2", { base: "halcon_1" }, grid(0, 6, `
  w..............w
  s..............s
  s..............s
  S..............S`))

// mk3: alas más largas con luces y un tercer motor.
sprite("halcon_3", { base: "halcon_2" }, grid(0, 3, `
  w..............w
  s..............s
  s..............s
  S..............S
  .....c....c.....
  .....C....C.....`), grid(5, 13, `
  .o....o.
  .y.oy.y.
  ...yy...`))

// Aguja: rápida y fina. Casco largo, alas cortas verdes.
sprite("aguja_1", { mx: true }, `
  .......w
  .......w
  .......w
  ......sw
  ......cw
  ......Cs
  ......sw
  .....Esw
  ....EEsw
  ...EeEsw
  ..EeeSsw
  .EeeSSsw
  Ee..SSsS
  .....Ss.
  ......o.
  ......y.`)

sprite("aguja_2", { base: "aguja_1" }, grid(2, 5, `
  w..........w
  s..........s
  e..........e
  E..........E`))

sprite("aguja_3", { base: "aguja_2" }, grid(0, 7, `
  w..............w
  e..............e
  E..............E`), grid(4, 13, `
  .o......o.
  .y......y.`))

// Bastión: lenta y pesada. Alas anchas doradas, dos motores.
sprite("bastion_1", { mx: true }, `
  ........
  ........
  .....SSs
  ....SSsw
  ...oSscw
  ..ooSsCw
  .ooySssw
  ooyySssw
  oyyySssw
  oyyySsSw
  SSSSSssw
  SSSSSssS
  .S..SSs.
  ....o.y.
  ....y...
  ........`)

sprite("bastion_2", { base: "bastion_1" }, grid(1, 3, `
  w............w
  s............s
  S............S`))

sprite("bastion_3", { base: "bastion_2" }, grid(0, 5, `
  w..............w
  s..............s
  S..............S`), grid(2, 13, `
  o..........o
  y..........y`))

// --- Enemigos: cuatro familias, tres rangos ------------------------------
// Rango 1 (soldado) es el dibujo; élite y comandante cambian la pintura.

// Terrestres: cañonera blindada, dos cañones abajo.
sprite("terran_1", { mx: true }, `
  ........
  ...ddddd
  ..dGGGGg
  .dGggggg
  dGgggGGy
  dGggGddd
  dGGgGdcc
  .dGGGdcC
  ..dGGddd
  ..dGd.dG
  ..dGd..d
  ..dGd...
  ...s....
  ...s....
  ........
  ........`)
sprite("terran_2", { base: "terran_1", swap: { g: "s", G: "S", d: "R", y: "r" } })
sprite("terran_3", { base: "terran_1", swap: { g: "y", G: "o", d: "D", c: "r", C: "R" } })

// Insectos: avispa vista desde arriba; abdomen arriba, cabeza y pinzas abajo.
sprite("insect_1", { mx: true }, `
  .......P
  ......Py
  ......Pp
  ......yP
  ......Pp
  .lll..yP
  lllll.Pp
  .llllqPP
  ..lllqPp
  ....qPPp
  ...qqPpp
  ....qPyy
  .....Pcp
  .....qPP
  ....p..P
  .....p..`)
sprite("insect_2", { base: "insect_1", swap: { p: "e", P: "E", q: "d" } })
sprite("insect_3", { base: "insect_1", swap: { p: "r", P: "R", q: "D", l: "y" } })

// Cristales: un rombo facetado. Luz arriba a la izquierda, sombra abajo.
sprite("crystal_1", { mx: true }, `
  .......a
  ......aA
  .....aAA
  ....aAAa
  ...aAAaA
  ..aAAaAA
  .aAAaAAn
  aAAaAAnn
  nAAAAnnA
  .nAAnnAA
  ..nnnAAn
  ...nnAnn
  ....nnnn
  .....nnn
  ......nn
  .......n`)
sprite("crystal_2", { base: "crystal_1", swap: { a: "v", A: "V", n: "u" } })
sprite("crystal_3", { base: "crystal_1", swap: { a: "y", A: "o", n: "R" } })

// Esquirla: lo que queda de un cristal de élite al romperse.
sprite("shard", { mx: true }, `
  ...v
  ..vV
  .vVV
  vVVu
  .Vuu
  ..uu
  ...u`)

// Míticas: dragón con las alas abiertas; cabeza abajo, cola arriba.
sprite("dragon_1", { mx: true }, `
  .......R
  .......r
  r......R
  rR.....r
  rDR...Rr
  .rDR..Rr
  .rDDR.Rr
  ..rDDRRr
  ..rDDDRr
  ...rDRro
  ....rRro
  .....Rro
  ....rRRr
  .....Ryr
  ......Rr
  .......o`)
sprite("dragon_2", { base: "dragon_1", swap: { r: "g", R: "G", D: "d", o: "y" } })
sprite("dragon_3", { base: "dragon_1", swap: { r: "p", R: "P", D: "q", o: "c", y: "a" } })

// --- Eventos -------------------------------------------------------------

// Pod: cápsula con anillo de luces. Al romperse suelta naves o una recarga.
sprite("pod", { mx: true }, `
  ........
  .....SSS
  ....SsSs
  ...Ssssw
  ..SsswwW
  ..rrrrrr
  .SsyrRyr
  .Ssrrrrr
  .SsssssS
  .SsscCss
  ..SsscCs
  ..SSsssS
  ...SSSSS
  ....SSSS
  ........
  ........`)

// Asteroides: dos piedras; en el juego giran.
sprite("rock_1", { w: 16, h: 16 },
  circ(8, 8, 7, "m"), circ(7, 7, 5, "b"), circ(10, 10, 4, "m"),
  circ(11, 5, 1, "M"), circ(5, 10, 1, "M"), px(9, 9, "M"), px(6, 4, "M"),
  shade([0, 10, 16, 6]))
sprite("rock_2", { w: 16, h: 16 },
  ellipse(8, 8, 7, 5, "m"), ellipse(7, 7, 5, 3, "b"),
  circ(4, 8, 1, "M"), px(11, 6, "M"), px(12, 9, "M"), shade([0, 10, 16, 6]))

// --- Recargas y mejoras: cápsulas de 12×12 con su símbolo ----------------

sprite("_cap", { mx: true }, `
  ....WW
  ..WWXX
  .WXXXX
  .WXXXX
  WXXXXX
  WXXXXX
  WXXXXX
  WXXXXX
  .WXXXX
  .WXXXX
  ..WWXX
  ....WW`)

sprite("pick_life", { base: "_cap", swap: { W: "R", X: "r" } }, grid(3, 3, `
  ..ww..
  ..ww..
  wwwwww
  wwwwww
  ..ww..
  ..ww..`))
sprite("pick_energy", { base: "_cap", swap: { W: "o", X: "y" } }, grid(3, 2, `
  ...k..
  ..kk..
  .kkkkk
  kkkkk.
  ..kk..
  ..k...`))
sprite("pick_core", { base: "_cap", swap: { W: "n", X: "C" } }, grid(3, 2, `
  ..aa..
  .aAAa.
  aAAAAa
  .aAAa.
  ..aA..
  ..aa..`))
sprite("pick_shield", { base: "_cap", swap: { W: "u", X: "V" } }, grid(3, 3, `
  .wwww.
  ww..ww
  w....w
  ww..ww
  .wwww.`))
sprite("pick_double", { base: "_cap", swap: { W: "R", X: "o" } }, grid(3, 3, `
  w....w
  w....w
  ww..ww
  ww..ww
  ww..ww
  ww..ww`))
sprite("pick_speed", { base: "_cap", swap: { W: "E", X: "e" } }, grid(3, 2, `
  ..ww..
  .w..w.
  w....w
  ..ww..
  .w..w.
  w....w`))

// Cómo se ven sobre el espacio.
scene("lineup", { w: 196, h: 92, bg: "k" },
  layer("enemies",
    stamp("terran_1", 4, 4), stamp("terran_2", 22, 4), stamp("terran_3", 40, 4),
    stamp("insect_1", 64, 4), stamp("insect_2", 82, 4), stamp("insect_3", 100, 4),
    stamp("crystal_1", 124, 4), stamp("crystal_2", 142, 4), stamp("crystal_3", 160, 4), stamp("shard", 180, 8),
    stamp("dragon_1", 4, 24), stamp("dragon_2", 22, 24), stamp("dragon_3", 40, 24),
    stamp("pod", 64, 24), stamp("rock_1", 84, 24), stamp("rock_2", 102, 24),
    stamp("pick_life", 124, 26), stamp("pick_energy", 138, 26), stamp("pick_core", 152, 26),
    stamp("pick_shield", 166, 26), stamp("pick_double", 180, 26), stamp("pick_speed", 124, 42)),
  layer("players",
    stamp("halcon_1", 4, 70), stamp("halcon_2", 22, 70), stamp("halcon_3", 40, 70),
    stamp("aguja_1", 64, 70), stamp("aguja_2", 82, 70), stamp("aguja_3", 100, 70),
    stamp("bastion_1", 124, 70), stamp("bastion_2", 142, 70), stamp("bastion_3", 160, 70)))

sheet("ships", [
  "halcon_*", "aguja_*", "bastion_*",
  "terran_*", "insect_*", "crystal_*", "dragon_*", "shard",
  "pod", "rock_*", "pick_*",
], { pad: 1 })
