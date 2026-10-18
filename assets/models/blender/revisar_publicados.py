"""Render de los GLB optimizados con las recetas reales del visor, tras decodificar.mts.

blender -b --factory-startup --python revisar_publicados.py -- \
  --script relojes_demo.py --glb /tmp/decodificados/relojes_demo.glb --renders renders/relojes_demo
"""
import argparse
from pathlib import Path
import runpy
import sys
import bpy

p = argparse.ArgumentParser()
p.add_argument('--script', required=True)
p.add_argument('--glb', required=True)
p.add_argument('--renders', required=True)
p.add_argument('--solo-montajes', action='store_true')
args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
script = Path(args.script)
if not script.is_absolute():
    script = Path(__file__).with_name(args.script)
datos = runpy.run_path(str(script), run_name='revision_geometria_publicada')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path(args.glb).resolve()))
vacios = [o for o in bpy.context.scene.objects if o.type == 'EMPTY' and o.get('ajuste')]
if len(vacios) != len(datos['D']):
    raise ValueError('Los nodos publicados no coinciden con las formas del script')
vacios += [fn() for fn in datos.get('REUSO', ())]
datos['H']['renderizar'](args.renders, vacios, datos['M'], args.solo_montajes)
