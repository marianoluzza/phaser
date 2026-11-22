/**
 * Las minas hechas a mano con las que arranca la campaña. Son propias de
 * Socavón. Cada una presenta algo: la primera, la llave y la bóveda; la
 * segunda, los rieles; la tercera, dos bóvedas. Todo objetivo tiene bajadas
 * a los dos lados: un sereno parado no puede cortar el único camino. El formato está en
 * `state/level.ts`; después de la última sigue el generador.
 */
export const LEVELS = [
	{
		id: 'entrance',
		rows: [
			'##Hl.E.....H..H$..l...H...##',
			'#H..Hl.n.$...T..hhh.l...H..#',
			'#.WH.E...lH.n..K.H.%.$.l.H##',
			'###.$..l.....n..l.B...V.l..#',
		],
	},
	{
		id: 'rails',
		rows: [
			'#.lH...$....EHl...$..H...###',
			'##...Hn.l.hh....K.n.l....H.#',
			'#.H.$.C====n=A====.EH.lW...#',
			'#...HT.lH...%.$.n.G...H.lH##',
			'####.$....C==A=n====.B..V.l#',
		],
	},
	{
		id: 'deep',
		rows: [
			'###.H..l.$....E.Hl..H....###',
			'#H$...H..n.hhh.l..K..H.n.H.#',
			'#..l....H.%.$H..l..n..T.H..#',
			'#.H..W.l...H..E.C=A=n===H.##',
			'#..$..K..n.H...hhhH.lV.B..H#',
			'######..l....%$.B..V..n.Gl.#',
		],
	},
] as const;
