"""
Fotos de ejemplo del MODO DEMO (lib/demo/modo.ts): una notebook FICTICIA ("EJEMPLO NB-15", la del
fixture de shared/) fotografiada sobre una mesa, hecha por script en Blender. No es un equipo real.

    blender -b --factory-startup --python assets/models/blender/fotos_demo.py -- --salida public/demo/fotos

Salen frente.jpg (abierta), etiqueta.jpg (dada vuelta, la etiqueta de abajo), etiqueta-movida.jpg (la
misma, movida: la primera que rechaza el control de calidad) y puertos.jpg (el costado).
"""

import argparse
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

ETIQUETA = ["EJEMPLO", "Modelo: NB-15 (ficticio)", "S/N: SN-0000-DEMO", "Entrada: 19 V  3,42 A", "Equipo de prueba, no es real"]


def color(hex_color):
    c = [int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1.0]


def material(nombre, hex_color, metal=0.0, rugosidad=0.5, emision=0.0):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = color(hex_color)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rugosidad
    if emision:
        b.inputs["Emission Color"].default_value = color(hex_color)
        b.inputs["Emission Strength"].default_value = emision
    return m


def caja(dim, pos, mat, bisel=0.0, padre=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=dim, verts=bm.verts)
    me = bpy.data.meshes.new("c")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("c", me)
    bpy.context.scene.collection.objects.link(o)
    o.location = pos
    o.data.materials.append(mat)
    if bisel:
        m = o.modifiers.new("b", "BEVEL")
        m.width, m.segments = bisel, 3
    if padre:
        o.parent = padre
    return o


def cortar(o, *cortadores):
    for c in cortadores:
        m = o.modifiers.new("x", "BOOLEAN")
        m.operation, m.solver, m.object = "DIFFERENCE", "EXACT", c
        c.hide_render = True
        c.hide_viewport = True


def texto(cuerpo, pos, tam, mat, padre=None, rot=(0, 0, 0)):
    t = bpy.data.curves.new("t", "FONT")
    t.body, t.size, t.align_x, t.align_y = cuerpo, tam, "LEFT", "CENTER"
    t.extrude = 0.002
    o = bpy.data.objects.new("t", t)
    bpy.context.scene.collection.objects.link(o)
    o.location, o.rotation_euler = pos, rot
    o.data.materials.append(mat)
    if padre:
        o.parent = padre
    return o


def notebook():
    """Base con teclado y touchpad, puertos al costado y la tapa abierta con la pantalla prendida."""
    alu = material("aluminio", "#5b5f66", 0.8, 0.35)
    tecla = material("tecla", "#17181b", 0.1, 0.6)
    vidrio = material("vidrio", "#05070a", 0.2, 0.08)
    pantalla = material("pantalla", "#2a5f9e", 0.0, 0.4, emision=1.6)
    oscuro = material("oscuro", "#0b0b0d", 0.0, 0.8)
    W, D, H = 34.0, 23.0, 1.8
    raiz = bpy.data.objects.new("notebook", None)
    bpy.context.scene.collection.objects.link(raiz)
    base = caja((W, D, H), (0, 0, H / 2), alu, 0.4, raiz)
    puertos = [((1.2, 1.4, 0.55), (W / 2, 3.0 - i * 2.2, H / 2)) for i in range(2)]
    puertos += [((1.2, 0.9, 0.35), (W / 2, -2.0, H / 2)), ((1.2, 1.6, 0.6), (W / 2, -4.6, H / 2)), ((1.2, 0.5, 0.5), (W / 2, -7.0, H / 2))]
    cortadores = [caja(d, p, oscuro) for d, p in puertos]
    cortar(base, *cortadores)
    for d, p in puertos:
        caja((0.2, d[1] * 0.9, d[2] * 0.9), (W / 2 - 0.3, p[1], p[2]), oscuro, padre=raiz)
    for fila in range(6):
        for col in range(14):
            caja((1.75, 1.6, 0.25), (-W / 2 + 3.4 + col * 2.03, 6.6 - fila * 1.95, H + 0.05), tecla, 0.12, raiz)
    caja((11.0, 6.5, 0.05), (0, -7.6, H), material("touchpad", "#6a6e75", 0.7, 0.3), 0.3, raiz)
    tapa = bpy.data.objects.new("tapa", None)
    bpy.context.scene.collection.objects.link(tapa)
    tapa.parent = raiz
    tapa.location = (0, D / 2 - 0.3, H)
    tapa.rotation_euler = (math.radians(-20), 0, 0)  # parada es 90°: 20° más atrás
    caja((W, 0.7, 22.5), (0, 0.35, 11.25), alu, 0.3, tapa)
    caja((W - 1.2, 0.05, 21.0), (0, -0.03, 11.6), vidrio, padre=tapa)
    caja((W - 2.6, 0.04, 18.5), (0, -0.06, 12.2), pantalla, padre=tapa)
    texto("EJEMPLO", (-1.6, -0.08, 1.4), 0.7, material("marca", "#c9ccd1", 0.8, 0.3), tapa, rot=(math.radians(90), 0, 0))
    return raiz, base


def etiqueta_abajo(raiz):
    """Etiqueta blanca en la tapa de abajo (se ve con la notebook dada vuelta) y las patas de goma."""
    blanco = material("etiqueta", "#eceae4", 0.0, 0.6)
    negro = material("tinta", "#1a1a1a", 0.0, 0.7)
    goma = material("goma", "#111214", 0.0, 0.9)
    caja((9.0, 5.6, 0.02), (4.0, -3.0, -0.01), blanco, padre=raiz)
    for i, linea in enumerate(ETIQUETA):
        tam = 0.9 if i == 0 else 0.48
        # Girada como la notebook (π en Y): dada vuelta se lee derecha.
        texto(linea, (8.1, -1.0 - (0 if i == 0 else 0.4) - i * 0.85, -0.03), tam, negro, raiz, rot=(0, math.pi, 0))
    for x in (-14.5, 14.5):
        for y in (-9.5, 9.5):
            caja((5.0, 0.9, 0.3), (x * 0.9, y, -0.15), goma, 0.12, raiz)


def escena_base():
    esc = bpy.context.scene
    try:
        esc.render.engine = "BLENDER_EEVEE"
    except TypeError:
        esc.render.engine = "BLENDER_EEVEE_NEXT"
    esc.view_settings.view_transform = "AgX"
    mundo = bpy.data.worlds.new("w")
    mundo.use_nodes = True
    mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (0.35, 0.33, 0.3, 1)
    mundo.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    esc.world = mundo
    caja((300, 300, 1), (0, 0, -0.5), material("mesa", "#7b5a3e", 0.0, 0.55))
    for nombre, energia, pos in [("ventana", 14000, (-60, -40, 90)), ("relleno", 4000, (70, 30, 60))]:
        d = bpy.data.lights.new(nombre, "AREA")
        d.energy, d.size = energia, 60
        o = bpy.data.objects.new(nombre, d)
        o.location = pos
        o.rotation_euler = (Vector((0, 0, 0)) - Vector(pos)).to_track_quat("-Z", "Y").to_euler()
        esc.collection.objects.link(o)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    esc.collection.objects.link(cam)
    esc.camera = cam
    esc.render.resolution_x, esc.render.resolution_y = 1200, 900
    esc.render.image_settings.file_format = "JPEG"
    esc.render.image_settings.quality = 80
    return esc, cam


def foto(esc, cam, archivo, desde, hacia, lente=35):
    cam.location = desde
    cam.rotation_euler = (Vector(hacia) - Vector(desde)).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = lente
    esc.render.filepath = archivo
    bpy.ops.render.render(write_still=True)


def mover(origen, destino, pasos=18, dx=2, dy=1):
    """Copia de la foto "movida": promedia la imagen corrida de a poco en diagonal (como un pulso que tiembla)."""
    import numpy as np

    img = bpy.data.images.load(origen)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    suma = np.zeros_like(px)
    for i in range(pasos):
        suma += np.roll(px, (i * dy - pasos * dy // 2, i * dx - pasos * dx // 2), axis=(0, 1))
    img.pixels[:] = (suma / pasos).ravel()
    img.filepath_raw = destino
    img.file_format = "JPEG"
    img.save(quality=80)


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--salida", default="public/demo/fotos")
    args = p.parse_args(argv)
    os.makedirs(args.salida, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    esc, cam = escena_base()
    raiz, _ = notebook()
    etiqueta_abajo(raiz)
    ruta = lambda n: os.path.abspath(os.path.join(args.salida, n))

    foto(esc, cam, ruta("frente.jpg"), (4, -44, 30), (0, 3, 9), lente=40)
    foto(esc, cam, ruta("puertos.jpg"), (46, -16, 10), (14, -2, 2), lente=50)
    # Dada vuelta: la tapa cerrada sobre el teclado y la notebook girada en Y; la etiqueta queda arriba.
    bpy.data.objects["tapa"].rotation_euler = (math.radians(90), 0, 0)
    raiz.rotation_euler = (0, math.pi, 0)
    raiz.location = (0, 0, 2.8)
    foto(esc, cam, ruta("etiqueta.jpg"), (-4, -19, 24), (-4, -3, 2.8), lente=50)
    mover(ruta("etiqueta.jpg"), ruta("etiqueta-movida.jpg"))
    for n in ("frente", "puertos", "etiqueta", "etiqueta-movida"):
        print(f"Foto {n}.jpg: {os.path.getsize(ruta(n + '.jpg')) / 1024:.0f} KB")


main()
