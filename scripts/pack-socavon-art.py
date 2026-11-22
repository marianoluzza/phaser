"""Junta los renders de spritekiln de Socavón en un atlas para Phaser.

Lo llama `build-socavon-art.mjs` con el Python del venv de spritekiln, que ya trae Pillow:

    python -I pack-socavon-art.py <carpeta de specs> <destino sin extensión> <spec>...

Recorta cada cuadro y repite su borde un píxel, para que los tiles no muestren
costuras con el zoom de la cámara. En `meta.clips` deja, por animación, sus
cuadros, duraciones y origen (el pie del sprite).
"""

import json
import sys
from pathlib import Path

from PIL import Image

ATLAS_WIDTH = 512
PADDING = 2


def extruded(sprite):
    width, height = sprite.size
    out = Image.new('RGBA', (width + 2, height + 2))
    out.paste(sprite.crop((0, 0, width, 1)), (1, 0))
    out.paste(sprite.crop((0, height - 1, width, height)), (1, height + 1))
    out.paste(sprite.crop((0, 0, 1, height)), (0, 1))
    out.paste(sprite.crop((width - 1, 0, width, height)), (width + 1, 1))
    out.paste(sprite, (1, 1))
    return out


def collect(specs, assets):
    sprites, clips = [], {}
    for asset in assets:
        name = Path(asset).stem
        folder = (specs / asset).parent / 'out' / name
        data = json.loads((folder / f'{name}.json').read_text(encoding='utf-8'))
        sheet = Image.open(folder / data['meta']['image']).convert('RGBA')
        info = data['spritekiln']
        size, pivot = info['frame_size'], info['pivot']
        for anim, clip in info['animations'].items():
            # Un solo lado por animación: el motor espeja al mirar a la izquierda.
            side = clip['directions'].get('e') or clip['directions']['s']
            names = []
            for index, source in enumerate(side['frames']):
                box = data['frames'][source]['frame']
                cell = sheet.crop((box['x'], box['y'], box['x'] + box['w'], box['y'] + box['h']))
                bounds = cell.getbbox() or (0, 0, 1, 1)
                key = f'{name}/{anim}/{index}'
                names.append(key)
                sprites.append((key, cell.crop(bounds), bounds, size))
            clips[f'{name}/{anim}'] = {
                'frames': names,
                'durations': side['durations'],
                'loop': clip['loop'],
                'origin': [round(pivot['x'] / size, 5), round(pivot['y'] / size, 5)],
            }
    return sprites, clips


def main():
    specs, target, assets = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3:]
    sprites, clips = collect(specs, assets)

    x = y = row = 0
    placed = []
    for key, sprite, bounds, size in sorted(sprites, key=lambda item: (-item[1].height, item[0])):
        width, height = sprite.width + 2 + PADDING, sprite.height + 2 + PADDING
        if x + width > ATLAS_WIDTH:
            x, y, row = 0, y + row, 0
        placed.append((key, sprite, bounds, size, x, y))
        x, row = x + width, max(row, height)

    atlas = Image.new('RGBA', (ATLAS_WIDTH, y + row))
    frames = {}
    for key, sprite, bounds, size, left, top in placed:
        atlas.paste(extruded(sprite), (left, top))
        frames[key] = {
            'frame': {'x': left + 1, 'y': top + 1, 'w': sprite.width, 'h': sprite.height},
            'rotated': False,
            'trimmed': sprite.size != (size, size),
            'spriteSourceSize': {'x': bounds[0], 'y': bounds[1], 'w': sprite.width, 'h': sprite.height},
            'sourceSize': {'w': size, 'h': size},
        }

    target.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(target.with_suffix('.png'), optimize=True)
    meta = {'image': f'{target.name}.png', 'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1', 'clips': clips}
    target.with_suffix('.json').write_text(
        json.dumps({'frames': frames, 'meta': meta}, separators=(',', ':'), sort_keys=True) + '\n',
        encoding='utf-8',
    )
    print(f'{target}.png: {len(frames)} cuadros, {atlas.width}x{atlas.height}')


if __name__ == '__main__':
    main()
