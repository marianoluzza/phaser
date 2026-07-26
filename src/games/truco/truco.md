# Truco argentino

## Alcance de la v1

Es una partida de dos jugadores: la persona juega contra una IA y sólo se
representan cartas con su valor y palo, sin ilustraciones.

La partida comienza con 0-0. Cada mano reparte tres cartas a cada jugador y se
juegan hasta tres turnos. Quien gana dos turnos gana la mano y suma un punto.
La partida termina cuando una persona llega a 15 puntos. No se incluye todavía
envido, truco, retruco, falta envido, señas, flor, arrastre de puntos ni
multijugador.

## Escenas y navegación

- `truco:title`: instrucciones y comienzo de la partida.
- `truco:game`: reparto, selección de cartas, turnos, resultado de cada mano y
  puntaje acumulado.
- `truco:game-over`: resultado al alcanzar 15 puntos.
- `Escape`: vuelve al launcher desde la partida o el resultado.
- `Enter`: comienza, continúa una mano o reinicia según la pantalla.

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

Si dos cartas tienen la misma fuerza, gana la mano (el jugador que inició el
turno). La mano inicial alterna entre jugador e IA.

La IA juega cualquier carta cuando es mano. Cuando responde, elige siempre la
carta más fuerte que todavía tiene, incluso si no puede ganar el turno.

## Estado principal

La lógica vive en `rules.ts`: construcción y mezcla de la baraja, comparación
de cartas, escala de poder y elección de la IA. `TrucoGameScene` conserva el
estado de la partida y usa los Game Objects sólo como representación:

- puntaje de ambos jugadores;
- cartas disponibles;
- turnos ganados dentro de la mano;
- carta de cada jugador sobre la mesa;
- jugador que es mano y próximo turno.

## Posibles mejoras

- Agregar envido y sus puntajes.
- Agregar llamados de truco, retruco y aceptación/rechazo.
- Mejorar la estrategia de la IA.
- Incorporar animaciones y sonidos de cartas.
- Separar una pantalla de resumen de mano si el flujo crece.
