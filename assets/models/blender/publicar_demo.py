"""Exporta todos los scripts a temporales y publica solo GLB optimizados <=200 KiB."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[3]
CARPETA = Path(__file__).resolve().parent


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--salida', default=str(ROOT / 'public/models/piezas'))
    args = p.parse_args()
    blender = os.environ.get('BLENDER_BIN') or shutil.which('blender')
    if not blender and Path('/Applications/Blender.app/Contents/MacOS/Blender').exists():
        blender = '/Applications/Blender.app/Contents/MacOS/Blender'
    node = shutil.which('node')
    if not blender or not node:
        raise SystemExit('Se requieren Blender y Node en PATH (o BLENDER_BIN).')
    destino = Path(args.salida)
    with tempfile.TemporaryDirectory(prefix='sayso-modelos-') as tmp:
        crudos, finales = Path(tmp) / 'crudos', Path(tmp) / 'finales'
        crudos.mkdir(); finales.mkdir()
        if (destino / 'indice.json').exists():
            shutil.copy2(destino / 'indice.json', crudos / 'indice.json')
        for nombre in ('piezas', 'dispositivos', 'cotidianos', 'facultad', 'campus'):
            subprocess.run([blender, '-b', '--factory-startup', '--python', str(CARPETA / (nombre + '.py')),
                            '--', '--salida', str(crudos)], cwd=ROOT, check=True)
        subprocess.run([node, str(CARPETA / 'optimizar.mjs'), str(crudos), str(finales)], cwd=ROOT, check=True)
        indice = json.loads((crudos / 'indice.json').read_text())
        for archivo in indice['familias'].values():
            f = finales / archivo
            if not f.exists() or f.stat().st_size > 200 * 1024:
                raise SystemExit('No se publica: familia ausente o excedida: ' + archivo)
        destino.mkdir(parents=True, exist_ok=True)
        for f in finales.glob('*.glb'):
            shutil.copy2(f, destino / f.name)
        final = {'familias': {}, 'tipos': {}}
        if (destino / 'indice.json').exists():
            final = json.loads((destino / 'indice.json').read_text())
        for k in ('familias', 'tipos'):
            final[k].update(indice[k])
        (destino / 'indice.json').write_text(json.dumps(final, ensure_ascii=False, indent=1) + '\n')


if __name__ == '__main__':
    main()
