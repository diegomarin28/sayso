"""Exportación aislada y renders de montajes. Sin red, IA ni cambios en otras familias."""
import argparse
import json
import math
from pathlib import Path
import runpy
import sys

BASE = runpy.run_path(str(Path(__file__).with_name('dispositivos.py')), run_name='utilidades')
CORE = BASE['CORE']
bpy = CORE['bpy']
for nombre in ('caja', 'cilindro', 'prisma', 'restar', 'varios', 'tubo', 'esfera', 'girar', 'redondeado'):
    globals()[nombre] = CORE[nombre]


def anillo(w, d, h, esp, z=0, radio=0.5):
    o = prisma(redondeado(w, d, radio, 8), h, (0, 0, z))
    restar(o, prisma(redondeado(w - 2 * esp, d - 2 * esp, max(0.05, radio - esp), 8), h + 1, (0, 0, z), mat=None))
    return o


def ejecutar(familia, definiciones, montajes, reutilizadas=()):
    p = argparse.ArgumentParser()
    p.add_argument('--salida', default='public/models/piezas')
    p.add_argument('--renders')
    args = p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    vacios, tipos = [], {}
    for nombre, ajuste, equipos, fn in definiciones:
        if CORE['AJUSTES'].get(nombre) != ajuste:
            raise ValueError('Regla AJUSTES ausente o distinta: ' + nombre)
        CORE['COLORES']['cuerpo.' + nombre.split('@')[0]] = ('#8d9ba8', 0.65, 0.35)
        fn()
        v = CORE['armar'](nombre, equipos)
        v['ajuste'] = ajuste
        vacios.append(v)
        tipos[nombre] = {'familia': familia, 'ajuste': ajuste, 'equipos': equipos, 'descripcion': CORE['descripcion'](fn.__doc__)}
    BASE['cerrar_cuerpos'](vacios)
    salida = Path(args.salida)
    salida.mkdir(parents=True, exist_ok=True)
    CORE['exportar'](str(salida / (familia + '.glb')), vacios)
    CORE['actualizar_indice'](str(salida / 'indice.json'), {familia: familia + '.glb'}, tipos)
    if args.renders:
        # Se renderizan los GLB ya optimizados al pasar --publicados mediante revisar_publicados.py.
        vacios += [fn() for fn in reutilizadas]
        renderizar(args.renders, vacios, montajes)


def renderizar(carpeta, vacios, montajes, solo_montajes=False):
    """Mismo estudio para las piezas y los montajes, no modifica las mallas exportadas."""
    carpeta = Path(carpeta)
    carpeta.mkdir(parents=True, exist_ok=True)
    escena = bpy.context.scene
    escena.render.engine = 'BLENDER_EEVEE'
    escena.render.image_settings.file_format = 'JPEG'
    escena.render.image_settings.quality = 88
    escena.view_settings.view_transform = 'AgX'
    mundo = bpy.data.worlds.new('estudio_demo')
    mundo.use_nodes = True
    mundo.node_tree.nodes['Background'].inputs['Color'].default_value = (0.02, 0.025, 0.03, 1)
    mundo.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    escena.world = mundo
    for nombre, energia, rot in [('principal', 3, (0.55, -0.4, -0.5)), ('relleno', 1.7, (0.9, 0.5, 2.1))]:
        luz = bpy.data.lights.new(nombre, 'SUN')
        luz.energy = energia
        luz.angle = 0.12
        obj = bpy.data.objects.new(nombre, luz)
        obj.rotation_euler = rot
        escena.collection.objects.link(obj)
    datos = bpy.data.cameras.new('camara_demo')
    datos.type = 'ORTHO'
    datos.clip_start, datos.clip_end = 0.01, 4000
    cam = bpy.data.objects.new('camara_demo', datos)
    escena.collection.objects.link(cam)
    escena.camera = cam
    escena = bpy.context.scene
    Vector = CORE['Vector']
    # El estudio de piezas dejó textos de hojas: no deben aparecer en los montajes.
    for o in escena.objects:
        if o.type == 'FONT':
            o.hide_render = True
    modelos = {v.name: v for v in vacios}
    piezas_sueltas = {} if solo_montajes else {v.name: [{'tipo': v.name, 'pos': [0, 0, 0]}] for v in vacios}
    for nombre, piezas in {**piezas_sueltas, **montajes}.items():
        for v in vacios:
            for c in v.children:
                c.hide_render = True
        copias = []
        for item in piezas:
            original = modelos[item['tipo']]
            mn, mx = CORE['caja_mundo'](original)
            centro = Vector(tuple((a + b) / 2 for a, b in zip(mn, mx)))
            escala = item.get('escala', 1)
            rot = CORE['Matrix'].Rotation(math.radians(item.get('giro_x', 0)), 4, 'X')
            pos = Vector(item['pos'])
            for obj in original.children:
                copia = obj.copy()
                copia.data = obj.data.copy()
                copia.parent = None
                copia.hide_render = False
                escena.collection.objects.link(copia)
                copia.matrix_world = CORE['Matrix'].Translation(pos) @ rot @ CORE['Matrix'].Scale(escala, 4) @ CORE['Matrix'].Translation(-centro) @ obj.matrix_world
                copias.append(copia)
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ Vector(p) for o in copias for p in o.bound_box]
        mn = Vector(tuple(min(p[i] for p in pts) for i in range(3)))
        mx = Vector(tuple(max(p[i] for p in pts) for i in range(3)))
        centro = (mn + mx) / 2
        direccion = Vector((0.7, -1.1, 0.9)).normalized()
        cam = escena.camera
        cam.location = centro + direccion * (max(mx - mn) * 4 + 20)
        cam.rotation_euler = (-direccion).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        locales = [cam.matrix_world.inverted() @ p for p in pts]
        w = max(p.x for p in locales) - min(p.x for p in locales)
        h = max(p.y for p in locales) - min(p.y for p in locales)
        cam.data.ortho_scale = max(w, h * 1.25) * 1.18
        cx = (max(p.x for p in locales) + min(p.x for p in locales)) / 2
        cy = (max(p.y for p in locales) + min(p.y for p in locales)) / 2
        cam.location += cam.rotation_euler.to_quaternion() @ Vector((cx, cy, 0))
        escena.render.resolution_x, escena.render.resolution_y = 1000, 800
        escena.render.filepath = str(carpeta / (nombre + '.jpg'))
        bpy.ops.render.render(write_still=True)
        for o in copias:
            bpy.data.objects.remove(o, do_unlink=True)

