// Galáctica: los cuatro jefes, uno por zona. Ocupan 2×2 celdas (32×32) y,
// como los enemigos chicos, miran hacia abajo. Se dibuja la mitad izquierda
// (x de 0 a 15) y `mx` la espeja; el eje de la nave cae entre x 15 y 16.
include("palette.px.js", { palette: true })

// Acorazado terrestre: casco ancho, puente al centro y tres cañones.
sprite("boss_terran", { w: 32, h: 32, mx: true },
  poly([0, 12, 7, 6, 7, 24, 0, 22], "G"),
  poly([1, 13, 7, 8, 7, 12, 1, 16], "g"),
  rect(6, 3, 10, 22, "G"),
  rect(8, 3, 8, 19, "g"),
  hline(6, 10, 10, "d"), hline(6, 17, 10, "d"), vline(7, 4, 20, "d"),
  rect(11, 7, 5, 6, "C"), rect(12, 8, 4, 3, "c"),
  rect(9, 19, 3, 3, "d"), px(10, 20, "y"),
  rect(2, 22, 2, 5, "s"), px(2, 27, "S"), px(3, 27, "S"),
  rect(9, 24, 2, 7, "s"), vline(10, 24, 7, "S"),
  rect(14, 25, 2, 6, "S"), vline(15, 25, 6, "s"),
  px(1, 14, "y"), px(4, 11, "y"))

// Reina insecto: abdomen rayado, alas grandes y pinzas.
sprite("boss_insect", { w: 32, h: 32, mx: true },
  ellipse(6, 13, 6, 10, "l"), ellipse(7, 12, 4, 7, "a"),
  line(2, 6, 11, 18, "A"), line(1, 14, 11, 19, "A"),
  ellipse(16, 9, 7, 9, "P"), ellipse(15, 8, 5, 7, "p"),
  hline(9, 5, 7, "y"), hline(9, 9, 7, "y"), hline(10, 13, 6, "y"),
  ellipse(16, 20, 5, 3, "P"), ellipse(16, 19, 4, 2, "p"),
  circ(16, 25, 4, "P"), circ(15, 24, 3, "p"),
  rect(12, 23, 2, 2, "c"), px(12, 23, "a"),
  line(13, 28, 11, 31, "q"), line(11, 31, 13, 31, "q"),
  px(15, 1, "y"), px(14, 0, "y"))

// Núcleo de cristal: un diamante grande con esquirlas que lo orbitan.
sprite("boss_crystal", { w: 32, h: 32, mx: true },
  poly([16, 1, 4, 16, 16, 30], "n"),
  poly([16, 2, 6, 16, 16, 28], "A"),
  poly([16, 4, 9, 13, 14, 13], "a"),
  line(6, 16, 16, 16, "n"), line(9, 13, 16, 22, "n"),
  circ(16, 16, 3, "w"), circ(16, 16, 2, "c"),
  poly([2, 4, 4, 2, 5, 6], "V"), px(3, 3, "v"),
  poly([1, 24, 3, 22, 4, 27], "V"), px(2, 24, "v"))

// Dragón: alas abiertas con membrana, cuernos y la cabeza abajo.
sprite("boss_dragon", { w: 32, h: 32, mx: true },
  poly([0, 2, 12, 9, 13, 22, 6, 18, 2, 21, 0, 12], "D"),
  line(0, 2, 12, 10, "r"), line(1, 9, 12, 14, "R"), line(0, 13, 12, 18, "R"),
  line(2, 21, 6, 18, "r"),
  ellipse(16, 13, 4, 10, "R"), ellipse(15, 12, 3, 8, "r"),
  vline(15, 0, 4, "R"), vline(16, 0, 2, "o"),
  ellipse(16, 25, 5, 4, "R"), ellipse(15, 24, 4, 3, "r"),
  line(11, 22, 9, 17, "y"), px(9, 16, "w"),
  px(13, 25, "y"), px(14, 25, "o"),
  rect(14, 29, 2, 2, "D"), px(15, 31, "o"),
  hline(14, 8, 2, "o"), hline(14, 12, 2, "o"), hline(14, 16, 2, "o"))

scene("bosses_lineup", { w: 144, h: 40, bg: "k" },
  layer("bosses", stamp("boss_terran", 4, 4), stamp("boss_insect", 40, 4),
    stamp("boss_crystal", 76, 4), stamp("boss_dragon", 112, 4)))

sheet("bosses", ["boss_*"], { pad: 1 })
