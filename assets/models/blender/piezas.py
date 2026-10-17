"""
Biblioteca de piezas genéricas de notebook, modelada por script en Blender (sin abrirlo).

    npm run modelos:piezas
    # = blender -b --factory-startup --python assets/models/blender/piezas.py -- \
    #       --salida public/models/piezas.glb [--renders <carpeta>]

Qué exporta (public/models/piezas.glb):
- Un nodo por TIPO de pieza (`ventilador`, `ram`, `bateria`…). El visor elige el tipo por
  prefijo del id de la pieza del plano (`tornillos_ventilador` → `tornillo`) y ajusta la malla
  a las medidas del plano. Posiciones y medidas siguen saliendo del plano (IA o plantilla):
  acá no hay datos de ningún modelo de equipo, solo formas típicas.
- Dentro de cada tipo, una malla por material. El nombre del material es la receta que usa la
  app (`lib/planogenerator/materiales.ts`): `cuerpo.<tipo>` es la receta propia de la pieza, el
  resto (`contactos`, `chip`, `cobre`…) son recetas de detalle. Los colores de acá son solo
  para los renders de revisión.

Convención (Blender): 1 unidad = 1 cm, X derecha, Y hacia atrás, Z arriba. El exportador glTF
pasa a Y arriba (three: z hacia el frente = -Y de Blender).
"""

import argparse
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

# ---------- Materiales (colores solo para los renders) ----------

COLORES = {
    "cuerpo.base": ("#aeb5bc", 0.9, 0.38),
    "cuerpo.tapa_inferior": ("#c3c9cf", 0.9, 0.3),
    "cuerpo.placa_madre": ("#1d6b45", 0.15, 0.55),
    "cuerpo.disipador": ("#c8773f", 0.65, 0.32),
    "cuerpo.heatpipe": ("#d08550", 0.65, 0.3),
    "cuerpo.ventilador": ("#2c3036", 0.3, 0.55),
    "cuerpo.tornillo": ("#d5d9dd", 0.6, 0.3),
    "cuerpo.ram": ("#1f7a4d", 0.15, 0.55),
    "cuerpo.ssd": ("#1b2a4a", 0.2, 0.5),
    "cuerpo.wifi": ("#b9c0c6", 0.7, 0.32),
    "cuerpo.bateria": ("#33373d", 0.25, 0.7),
    "cuerpo.parlante": ("#25282c", 0.1, 0.9),
    "cuerpo.pila": ("#e1e4e7", 0.6, 0.25),
    "cuerpo.disco_duro": ("#b9c0c6", 0.8, 0.35),
    "cuerpo.cable": ("#2f3338", 0.1, 0.6),
    "cuerpo.bisagra": ("#8f979f", 0.85, 0.35),
    "cuerpo.conector": ("#c6ccd2", 0.85, 0.3),
    "cuerpo.soporte": ("#b0b7be", 0.85, 0.35),
    "aspas": ("#3b4048", 0.2, 0.5),
    "cubo": ("#1c1f23", 0.3, 0.4),
    "chip": ("#141619", 0.3, 0.45),
    "etiqueta": ("#d9dde1", 0.0, 0.8),
    "ranura": ("#4a4f56", 0.9, 0.3),
    "cobre": ("#c87a45", 0.75, 0.3),
    "contactos": ("#d6a843", 0.9, 0.28),
    "metal": ("#b8bec5", 0.85, 0.3),
    "pcb": ("#1d6b45", 0.15, 0.55),
    "goma": ("#141517", 0.0, 0.9),
    "plastico": ("#1b1d20", 0.1, 0.6),
    "conector": ("#e6e2d6", 0.0, 0.6),
}


def lineal(hex_color):
    c = [int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1.0]


def material(nombre):
    if nombre in bpy.data.materials:
        return bpy.data.materials[nombre]
    color, metal, rugosidad = COLORES[nombre]
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = lineal(color)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rugosidad
    return m


# ---------- Primitivas (todas con bmesh: no dependen del contexto de la UI) ----------

_partes = []  # objetos de la pieza que se está armando


def objeto(bm, mat):
    me = bpy.data.meshes.new("tmp")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("tmp", me)
    bpy.context.scene.collection.objects.link(o)
    if mat:
        o["mat"] = mat
        _partes.append(o)
    return o


def aplicar(o):
    """Aplica los modificadores del objeto (bevel, boolean) sobre su malla."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear()
    o.data = me


def biselar(o, ancho, segmentos=2):
    m = o.modifiers.new("bisel", "BEVEL")
    m.width = ancho
    m.segments = segmentos
    m.limit_method = "ANGLE"
    aplicar(o)


def ubicar(o, pos, rot_z=0.0):
    o.location = pos
    o.rotation_euler = (0, 0, rot_z)
    bpy.context.view_layer.update()
    return o


def caja(dim, pos=(0, 0, 0), mat="cuerpo", bisel=0.0, rot_z=0.0, seg=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=dim, verts=bm.verts)
    o = objeto(bm, mat)
    if bisel:
        biselar(o, bisel, seg)
    return ubicar(o, pos, rot_z)


def cilindro(r, alto, pos=(0, 0, 0), mat="cuerpo", seg=32, bisel=0.0, r_arriba=None, eje="z"):
    """Eje z por defecto; `eje="x"` lo acuesta (ej. el barril de una bisagra)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r,
        radius2=r if r_arriba is None else r_arriba, depth=alto,
    )
    if eje == "x":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "Y"))
    o = objeto(bm, mat)
    if bisel:
        biselar(o, bisel)
    return ubicar(o, pos)


def prisma(puntos, alto, pos=(0, 0, 0), mat="cuerpo", bisel=0.0):
    """Polígono 2D (x, y) extruido en Z, centrado en z."""
    bm = bmesh.new()
    cara = bm.faces.new([bm.verts.new((x, y, -alto / 2)) for x, y in puntos])
    r = bmesh.ops.extrude_face_region(bm, geom=[cara])
    arriba = [v for v in r["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, alto), verts=arriba)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = objeto(bm, mat)
    if bisel:
        biselar(o, bisel)
    return ubicar(o, pos)


def varios(formas):
    """Un solo objeto (sin material) con varias cajas o cilindros: sirve de cortador."""
    bm = bmesh.new()
    for f in formas:
        tipo, medida, (x, y, z) = f
        mat = Matrix.Translation((x, y, z))
        if tipo == "caja":
            bmesh.ops.create_cube(bm, size=1.0, matrix=mat @ Matrix.Diagonal((*medida, 1.0)))
        else:
            r, alto = medida
            bmesh.ops.create_cone(
                bm, cap_ends=True, cap_tris=False, segments=16, radius1=r, radius2=r, depth=alto, matrix=mat,
            )
    return objeto(bm, None)


def restar(o, *cortadores):
    for c in cortadores:
        m = o.modifiers.new("b", "BOOLEAN")
        m.operation = "DIFFERENCE"
        m.solver = "EXACT"
        m.use_self = True  # los cortadores de `varios` pueden cruzarse entre sí (la cruz del tornillo)
        m.use_hole_tolerant = True
        m.object = c
        aplicar(o)
        bpy.data.objects.remove(c)
    return o


def redondeado(ancho, prof, r, seg=6):
    pts = []
    for sx, sy, a0 in [(1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)]:
        cx, cy = sx * (ancho / 2 - r), sy * (prof / 2 - r)
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def armar(tipo):
    """Junta las partes de la pieza por material y las cuelga de un nodo vacío con el nombre del tipo."""
    bpy.context.view_layer.update()
    grupos = {}
    for o in _partes:
        grupos.setdefault(o["mat"], []).append(o)
    vacio = bpy.data.objects.new(tipo, None)
    bpy.context.scene.collection.objects.link(vacio)
    for mat, objs in grupos.items():
        bm = bmesh.new()
        for o in objs:
            me = o.data.copy()
            me.transform(o.matrix_world)
            bm.from_mesh(me)
            bpy.data.meshes.remove(me)
            bpy.data.objects.remove(o)
        nombre_mat = f"cuerpo.{tipo}" if mat == "cuerpo" else mat
        me = bpy.data.meshes.new(f"{tipo}__{mat}")
        bm.to_mesh(me)
        bm.free()
        me.shade_smooth()
        me.set_sharp_from_angle(angle=math.radians(35))
        me.materials.append(material(nombre_mat))
        o = bpy.data.objects.new(f"{tipo}__{mat}", me)
        bpy.context.scene.collection.objects.link(o)
        o.parent = vacio
    _partes.clear()
    return vacio


# ---------- Piezas ----------

def ventilador():
    """Ventilador centrífugo (blower): carcasa en D, rotor con álabes, aletas de cobre en la salida."""
    R, CY, H = 2.7, -0.3, 0.9

    def contorno_d(r, y_fin):
        pts = [(r, y_fin)]
        for i in range(25):
            a = math.radians(-180 * i / 24)
            pts.append((r * math.cos(a), CY + r * math.sin(a)))
        return pts + [(-r, y_fin)]

    prisma(contorno_d(R, 3.0), 0.06, (0, 0, 0.03))
    pared = prisma(contorno_d(R, 2.4), H - 0.12, (0, 0, H / 2))
    restar(pared, prisma(contorno_d(R - 0.08, 3.5), H, (0, 0, H / 2), mat=None))
    tapa = prisma(contorno_d(R, 3.0), 0.06, (0, 0, H - 0.03))
    restar(tapa, cilindro(1.75, 1.0, (0, CY, H), mat=None, seg=48))
    for i in range(16):
        x = -R + 0.17 + i * (2 * R - 0.34) / 15
        caja((0.035, 0.6, H - 0.12), (x, 2.7, H / 2), "cobre")
    cilindro(0.75, 0.6, (0, CY, 0.39), "cubo", seg=40, bisel=0.04)
    cilindro(0.55, 0.012, (0, CY, 0.696), "etiqueta", seg=40)
    for i in range(23):
        a = 2 * math.pi * i / 23
        caja((1.45, 0.045, 0.6), (math.cos(a) * 1.62, CY + math.sin(a) * 1.62, 0.39), "aspas", rot_z=a + 0.45)
    for x, y in [(-R - 0.1, CY - 0.6), (R + 0.1, CY - 0.6), (R + 0.05, 2.0)]:
        oreja = cilindro(0.38, 0.06, (x, y, H - 0.03), "metal", seg=24)
        restar(oreja, cilindro(0.15, 1.0, (x, y, H), mat=None, seg=16))
    return armar("ventilador")


def disipador():
    """Placa de cobre sobre el procesador, con soporte en X y cuatro tornillos con resorte."""
    caja((2.6, 2.6, 0.1), (0, 0, 0.05), bisel=0.02)
    caja((1.6, 1.6, 0.05), (0, 0, 0.125), bisel=0.01)
    for giro in (math.pi / 4, -math.pi / 4):
        caja((5.2, 0.45, 0.05), (0, 0, 0.175), "metal", bisel=0.015, rot_z=giro)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * 1.78, sy * 1.78
            cilindro(0.2, 0.06, (x, y, 0.23), "metal", seg=20)
            cabeza = cilindro(0.28, 0.07, (x, y, 0.295), "metal", seg=24, bisel=0.02)
            restar(cabeza, varios([("caja", (0.34, 0.06, 0.1), (x, y, 0.34)), ("caja", (0.06, 0.34, 0.1), (x, y, 0.34))]))
    return armar("disipador")


def heatpipe():
    """Dos caños de cobre aplastados, con las puntas redondeadas."""
    for y in (-0.2, 0.2):
        caja((5.0, 0.32, 0.2), (0, y, 0.1), bisel=0.09, seg=4)
    return armar("heatpipe")


def tornillo():
    """Tornillo de cabeza redonda con cruz Phillips."""
    cilindro(0.12, 0.14, (0, 0, 0.07), seg=20)
    cabeza = cilindro(0.3, 0.16, (0, 0, 0.22), seg=32, bisel=0.04)
    restar(cabeza, varios([("caja", (0.36, 0.07, 0.2), (0, 0, 0.3)), ("caja", (0.07, 0.36, 0.2), (0, 0, 0.3))]))
    caja((0.34, 0.06, 0.02), (0, 0, 0.21), "ranura")
    caja((0.06, 0.34, 0.02), (0, 0, 0.21), "ranura")
    return armar("tornillo")


def peine(xs, y, largo, z, ancho=0.12):
    """Contactos dorados del borde de una placa (arriba y abajo)."""
    for x in xs:
        for zz in z:
            caja((ancho, largo, 0.012), (x, y, zz), "contactos")


def ram():
    """Módulo SO-DIMM: placa con muesca, contactos dorados, chips en las dos caras y etiqueta."""
    placa = caja((6.8, 3.0, 0.1), (0, 0, 0.15))
    restar(
        placa,
        caja((0.14, 0.5, 0.3), (-0.6, -1.5, 0.15), mat=None),
        cilindro(0.16, 0.3, (-3.4, -0.4, 0.15), mat=None, seg=16),
        cilindro(0.16, 0.3, (3.4, -0.4, 0.15), mat=None, seg=16),
    )
    xs = [-3.15 + i * 0.185 for i in range(35)]
    peine([x for x in xs if abs(x + 0.6) > 0.16], -1.3, 0.38, (0.206, 0.094))
    for x in (-2.4, -0.8, 0.8, 2.4):
        caja((1.15, 0.95, 0.08), (x, 0.35, 0.24), "chip", bisel=0.01)
        caja((1.15, 0.95, 0.08), (x, 0.35, 0.06), "chip", bisel=0.01)
    caja((3.0, 0.8, 0.01), (0, 0.35, 0.285), "etiqueta")
    caja((0.5, 0.4, 0.05), (2.9, -0.55, 0.225), "chip")
    for i in range(10):
        caja((0.12, 0.06, 0.04), (-2.8 + i * 0.6, -0.65, 0.22), "metal")
    return armar("ram")


def ssd():
    """SSD M.2 2280: placa, contactos con muesca M, controlador, dos NAND, etiqueta y media luna del tornillo."""
    placa = caja((8.0, 2.2, 0.08), (0, 0, 0.1))
    restar(
        placa,
        caja((0.5, 0.13, 0.3), (-3.9, 0.5, 0.1), mat=None),
        cilindro(0.2, 0.3, (4.0, 0, 0.1), mat=None, seg=20),
    )
    ys = [-0.95 + i * 0.16 for i in range(13)]
    for y in ys:
        if abs(y - 0.5) > 0.12:
            for z in (0.145, 0.055):
                caja((0.32, 0.09, 0.012), (-3.82, y, z), "contactos")
    caja((1.2, 1.2, 0.1), (-2.4, 0, 0.19), "chip", bisel=0.01)
    caja((1.7, 1.5, 0.12), (-0.4, 0, 0.2), "chip", bisel=0.01)
    caja((1.7, 1.5, 0.12), (1.6, 0, 0.2), "chip", bisel=0.01)
    caja((3.9, 1.7, 0.01), (0.6, 0, 0.266), "etiqueta")
    for i in range(6):
        caja((0.14, 0.07, 0.05), (3.0, -0.75 + i * 0.3, 0.165), "metal")
    return armar("ssd")


def wifi():
    """Placa Wi-Fi M.2 2230: blindaje metálico, dos conectores de antena y media luna del tornillo."""
    placa = caja((2.2, 3.0, 0.08), (0, 0, 0.06), "pcb")
    restar(placa, caja((0.13, 0.5, 0.3), (0.45, -1.5, 0.06), mat=None), cilindro(0.2, 0.3, (0, 1.5, 0.06), mat=None, seg=20))
    xs = [-0.95 + i * 0.16 for i in range(13)]
    for x in xs:
        if abs(x - 0.45) > 0.12:
            for z in (0.105, 0.015):
                caja((0.09, 0.32, 0.012), (x, -1.32, z), "contactos")
    caja((1.8, 1.7, 0.12), (0, -0.15, 0.16), bisel=0.02)
    caja((1.3, 1.1, 0.005), (0, -0.15, 0.222), "etiqueta")
    for x in (-0.5, 0.5):
        cilindro(0.14, 0.08, (x, 1.0, 0.14), "contactos", seg=20)
        cilindro(0.05, 0.1, (x, 1.0, 0.15), "metal", seg=12)
    return armar("wifi")


def pila():
    """Pila de botón (tipo CR2032) con el aro aislante."""
    cilindro(1.0, 0.2, (0, 0, 0.1), seg=48, bisel=0.03)
    cilindro(0.92, 0.04, (0, 0, 0.22), "goma", seg=48)
    cilindro(0.82, 0.07, (0, 0, 0.265), seg=48, bisel=0.02)
    return armar("pila")


def bateria():
    """Batería de tres celdas planas, placa de protección con cinta, conector y orejas de fijación."""
    for x in (-8.6, 0, 8.6):
        caja((8.2, 6.2, 0.7), (x, -0.45, 0.4), bisel=0.25, seg=3)
    caja((4.0, 2.4, 0.01), (0, -0.45, 0.755), "etiqueta")
    caja((22.0, 0.9, 0.16), (0, 3.1, 0.13), "pcb")
    caja((21.6, 0.85, 0.02), (0, 3.1, 0.22), "plastico")
    caja((1.6, 0.55, 0.32), (9.6, 3.35, 0.39), "conector", bisel=0.03)
    caja((1.2, 0.35, 0.03), (9.6, 3.62, 0.25), "plastico")
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * 12.95, -0.45 + sy * 2.4
            oreja = caja((0.8, 0.8, 0.05), (x, y, 0.06), "metal", bisel=0.05)
            restar(oreja, cilindro(0.17, 0.5, (x, y, 0.06), mat=None, seg=16))
    return armar("bateria")


def parlante():
    """Caja de parlante con rejilla, membrana y orejas con gomas."""
    caja_p = prisma(redondeado(3.0, 1.8, 0.35), 0.55, (0, 0, 0.275), bisel=0.05)
    restar(caja_p, prisma(redondeado(2.1, 1.25, 0.5), 0.2, (0, 0, 0.6), mat=None))
    prisma(redondeado(2.0, 1.15, 0.48), 0.02, (0, 0, 0.47), "goma")
    rejilla = prisma(redondeado(2.1, 1.25, 0.5), 0.025, (0, 0, 0.535), "metal")
    restar(rejilla, varios([("cil", (0.065, 0.2), (-0.84 + i * 0.21, -0.42 + j * 0.21, 0.535)) for i in range(9) for j in range(5)]))
    for x in (-1.72, 1.72):
        oreja = cilindro(0.3, 0.08, (x, 0, 0.04), seg=24)
        restar(oreja, cilindro(0.08, 0.5, (x, 0, 0.04), mat=None, seg=12))
        goma = cilindro(0.17, 0.18, (x, 0, 0.1), "goma", seg=20, bisel=0.03)
        restar(goma, cilindro(0.07, 0.5, (x, 0, 0.1), mat=None, seg=12))
    caja((0.5, 0.3, 0.2), (0.8, -1.05, 0.15), "conector", bisel=0.02)
    return armar("parlante")


def placa_madre():
    """Placa madre esquemática: agujeros de montaje, chips, componentes chicos y conectores. Todo bajo 0.18 cm."""
    placa = caja((32.0, 13.0, 0.1), (0, 0, 0.05))
    agujeros = [(-15.3, -5.8), (-15.3, 5.8), (-5, 6), (5, -6), (15.3, -5.8), (15.3, 5.8), (0, 0), (-8, -3)]
    restar(placa, varios([("cil", (0.18, 0.5), (x, y, 0.05)) for x, y in agujeros]))
    for x, y in agujeros:
        aro = cilindro(0.36, 0.014, (x, y, 0.107), "contactos", seg=20)
        restar(aro, cilindro(0.18, 0.5, (x, y, 0.1), mat=None, seg=16))
    azar = random.Random(7)  # fijo: la placa sale igual cada vez
    for _ in range(14):
        w, d = azar.uniform(0.6, 1.6), azar.uniform(0.6, 1.4)
        caja((w, d, 0.06), (azar.uniform(-14.5, 14.5), azar.uniform(-5.5, 5.5), 0.13), "chip", bisel=0.01)
    for _ in range(90):
        mat = azar.choice(["metal", "metal", "chip", "conector"])
        w = azar.uniform(0.12, 0.35)
        caja((w, w * 0.55, 0.04), (azar.uniform(-15.5, 15.5), azar.uniform(-6.2, 6.2), 0.12), mat)
    for x, y, w in [(-12, -6.0, 2.0), (3, 6.0, 1.4), (10, -6.0, 1.0), (-3, -6.1, 1.6)]:
        caja((w, 0.5, 0.08), (x, y, 0.14), "conector", bisel=0.01)
    return armar("placa_madre")


def base():
    """Chasis (lado del teclado, boca abajo): bordes redondeados, puertos a los costados y rejilla atrás."""
    cuerpo = prisma(redondeado(36.0, 25.0, 1.6, 8), 1.2, (0, 0, 0.6), bisel=0.15)
    puertos = []
    for lado in (-1, 1):
        x = lado * 18.0
        puertos += [
            ("caja", (1.2, 1.25, 0.5), (x, 3.5 * lado, 0.6)),
            ("caja", (1.2, 0.85, 0.32), (x, 1.5 * lado, 0.6)),
        ]
    puertos += [("caja", (1.2, 1.5, 0.45), (-18.0, -1.0, 0.6)), ("caja", (1.2, 0.4, 0.4), (18.0, -2.0, 0.6))]
    puertos += [("caja", (0.25, 1.2, 0.45), (5.5 + i * 0.6, 12.5, 0.6)) for i in range(15)]
    restar(cuerpo, varios(puertos))
    for lado in (-1, 1):
        x = lado * 17.75
        caja((0.5, 0.9, 0.12), (x, 3.5 * lado, 0.6), "plastico")
    return armar("base")


def tapa_inferior():
    """Tapa inferior: placa con rejilla de ventilación, patas de goma y agujeros de los tornillos."""
    tapa = prisma(redondeado(36.0, 25.0, 1.6, 8), 0.12, (0, 0, 0.06), bisel=0.03)
    # Rejilla chica: con la tapa en rayos X, muchas ranuras tapan lo que hay debajo.
    cortes = [("caja", (0.22, 1.2, 0.5), (6.0 + i * 0.8, 6.0 + j * 1.8, 0.06)) for i in range(12) for j in range(2)]
    tornillos = [(x, y) for x in (-16.8, -6, 6, 16.8) for y in (-11.3, 11.3)] + [(-16.8, 0), (16.8, 0)]
    cortes += [("cil", (0.16, 0.5), (x, y, 0.06)) for x, y in tornillos]
    restar(tapa, varios(cortes))
    for x, y in tornillos:
        aro = cilindro(0.32, 0.012, (x, y, 0.126), "metal", seg=20)
        restar(aro, cilindro(0.16, 0.5, (x, y, 0.12), mat=None, seg=16))
    for y in (-10.0, 10.0):
        prisma(redondeado(26.0, 0.9, 0.44), 0.13, (0, y, 0.185), "goma", bisel=0.03)
    return armar("tapa_inferior")


def disco_duro():
    """Disco de 2,5": carcasa de aluminio, etiqueta, tornillos de la tapa y conector SATA."""
    caja((10.0, 7.0, 0.65), (0, 0, 0.325), bisel=0.08)
    cilindro(1.6, 0.03, (-1.2, 0.2, 0.66), seg=48)
    caja((5.0, 3.6, 0.01), (2.0, -0.6, 0.655), "etiqueta")
    for x, y in [(-4.6, 3.1), (-4.6, -3.1), (4.6, 3.1), (4.6, -3.1), (-1.2, 2.6), (2.6, 2.6)]:
        cilindro(0.16, 0.04, (x, y, 0.67), "metal", seg=16)
    caja((0.5, 4.0, 0.45), (5.15, -1.0, 0.25), "plastico", bisel=0.03)
    for i in range(7):
        caja((0.05, 0.3, 0.02), (5.38, -2.6 + i * 0.5, 0.25), "contactos")
    return armar("disco_duro")


def cable():
    """Cable plano (flex) con un conector en cada punta."""
    caja((5.4, 0.8, 0.03), (0, 0, 0.075))
    for x in (-2.9, 2.9):
        caja((0.5, 1.0, 0.15), (x, 0, 0.075), "plastico", bisel=0.02)
        caja((0.5, 0.75, 0.01), (x - 0.02 * (1 if x > 0 else -1), 0, 0.155), "contactos")
    caja((1.2, 0.85, 0.01), (-1.6, 0, 0.095), "etiqueta")
    return armar("cable")


def bisagra():
    """Bisagra: hoja metálica con tres agujeros y el barril atrás."""
    hoja = caja((3.6, 1.6, 0.15), (0, -0.2, 0.075), bisel=0.04)
    restar(hoja, varios([("cil", (0.17, 0.5), (x, -0.4, 0.075)) for x in (-1.2, 0, 1.2)]))
    cilindro(0.42, 4.0, (0, 0.95, 0.42), seg=24, eje="x", bisel=0.04)
    caja((3.0, 0.5, 0.12), (0, 0.6, 0.12))
    for x in (-1.2, 0, 1.2):
        aro = cilindro(0.3, 0.02, (x, -0.4, 0.16), "metal", seg=16)
        restar(aro, cilindro(0.17, 0.5, (x, -0.4, 0.16), mat=None, seg=12))
    return armar("bisagra")


def conector():
    """Puerto o conector (USB, alimentación): carcasa metálica con boca y lengüeta, patas para soldar."""
    carcasa = caja((1.3, 1.5, 0.6), (0, 0, 0.3), bisel=0.04)
    restar(carcasa, caja((1.1, 0.8, 0.42), (0, -0.5, 0.3), mat=None))
    caja((0.9, 0.7, 0.1), (0, -0.4, 0.3), "plastico")
    for x in (-0.55, 0.55):
        caja((0.15, 0.3, 0.05), (x * 1.25, 0.4, 0.025), "metal")
    return armar("conector")


def soporte():
    """Soporte metálico (bracket): chapa con alivianados, agujeros y orejas."""
    chapa = caja((6.0, 4.0, 0.06), (0, 0, 0.03), bisel=0.03)
    cortes = [("caja", (1.6, 1.2, 0.5), (x, 0.3, 0.03)) for x in (-1.8, 0, 1.8)]
    cortes += [("cil", (0.16, 0.5), (x, y, 0.03)) for x in (-2.6, 2.6) for y in (-1.5, 1.5)]
    restar(chapa, varios(cortes))
    for x in (-2.97, 2.97):  # pestañas dobladas hacia arriba
        caja((0.06, 2.0, 0.45), (x, -0.4, 0.225), bisel=0.02)
    return armar("soporte")


PIEZAS = [
    base, tapa_inferior, placa_madre, ventilador, disipador, heatpipe, tornillo, ram, ssd, wifi, pila,
    bateria, parlante, disco_duro, cable, bisagra, conector, soporte,
]


# ---------- Exportar y renders de revisión ----------

def exportar(salida):
    os.makedirs(os.path.dirname(os.path.abspath(salida)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=salida,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_materials="EXPORT",
        export_texcoords=False,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
    )


def caja_mundo(vacio):
    pts = [o.matrix_world @ v.co for o in vacio.children for v in o.data.vertices]
    mn = [min(p[i] for p in pts) for i in range(3)]
    mx = [max(p[i] for p in pts) for i in range(3)]
    return mn, mx


def renders(carpeta, vacios):
    """Hoja de piezas (todas en una grilla, cada una escalada a su celda) + un render por pieza."""
    os.makedirs(carpeta, exist_ok=True)
    escena = bpy.context.scene
    try:
        escena.render.engine = "BLENDER_EEVEE"
    except TypeError:
        escena.render.engine = "BLENDER_EEVEE_NEXT"
    mundo = bpy.data.worlds.new("fondo")
    mundo.use_nodes = True
    mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (0.012, 0.013, 0.016, 1)
    mundo.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    escena.world = mundo
    escena.view_settings.view_transform = "AgX"

    def luz(nombre, tipo, energia, rot, tam=10):
        d = bpy.data.lights.new(nombre, tipo)
        d.energy = energia
        if tipo == "AREA":
            d.size = tam
        o = bpy.data.objects.new(nombre, d)
        o.rotation_euler = rot
        escena.collection.objects.link(o)
        return o

    sol = luz("sol", "SUN", 3.0, (math.radians(40), 0, math.radians(30)))
    sol.data.angle = math.radians(8)
    luz("relleno", "SUN", 1.0, (math.radians(60), 0, math.radians(-140)))
    luz("cenital", "SUN", 1.2, (0, 0, 0))

    cam_d = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_d)
    escena.collection.objects.link(cam)
    escena.camera = cam

    def encuadrar(centro, radio, ancho, alto, elevacion=38, azimut=-35):
        cam_d.type = "ORTHO"
        cam_d.ortho_scale = radio * 2.3
        el, az = math.radians(elevacion), math.radians(azimut)
        dirx, diry, dirz = math.cos(el) * math.sin(az), -math.cos(el) * math.cos(az), math.sin(el)
        cam.location = (centro[0] + dirx * 200, centro[1] + diry * 200, centro[2] + dirz * 200)
        direccion = Vector((-dirx, -diry, -dirz))
        cam.rotation_euler = direccion.to_track_quat("-Z", "Y").to_euler()
        cam_d.clip_end = 1000
        escena.render.resolution_x, escena.render.resolution_y = ancho, alto

    # Una por pieza.
    for v in vacios:
        for otro in vacios:
            for o in [otro] + list(otro.children):
                o.hide_render = otro is not v
        mn, mx = caja_mundo(v)
        centro = [(a + b) / 2 for a, b in zip(mn, mx)]
        radio = max(mx[i] - mn[i] for i in range(3)) / 2
        encuadrar(centro, radio, 900, 700)
        escena.render.filepath = os.path.join(carpeta, f"{v.name}.png")
        bpy.ops.render.render(write_still=True)

    # Hoja con todas: cada pieza escalada para que su lado mayor mida 7 y en una celda de 10.
    columnas = 5
    for i, v in enumerate(vacios):
        for o in [v] + list(v.children):
            o.hide_render = False
        mn, mx = caja_mundo(v)
        lado = max(mx[0] - mn[0], mx[1] - mn[1])
        s = 7.0 / lado
        centro = [(a + b) / 2 for a, b in zip(mn, mx)]
        fila, col = divmod(i, columnas)
        v.scale = (s, s, s)
        v.location = (col * 10 - centro[0] * s, -fila * 10 - centro[1] * s, -mn[2] * s)
        t = bpy.data.curves.new(f"t_{v.name}", "FONT")
        t.body = v.name
        t.size = 0.9
        t.align_x = "CENTER"
        to = bpy.data.objects.new(f"t_{v.name}", t)
        to.location = (col * 10, -fila * 10 - 4.6, 0)
        to.data.materials.append(material("etiqueta"))
        escena.collection.objects.link(to)
    bpy.context.view_layer.update()
    filas = math.ceil(len(vacios) / columnas)
    encuadrar(((columnas - 1) * 5, -(filas - 1) * 5 - 1, 0), columnas * 5 * 0.95, 2400, 1500, elevacion=50, azimut=-20)
    escena.render.filepath = os.path.join(carpeta, "hoja.png")
    bpy.ops.render.render(write_still=True)


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--salida", default="public/models/piezas.glb")
    p.add_argument("--renders")
    args = p.parse_args(argv)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    vacios = [hacer() for hacer in PIEZAS]
    exportar(args.salida)
    print(f"Exportado {args.salida}: {os.path.getsize(args.salida) / 1024:.0f} KB, {len(vacios)} tipos")
    if args.renders:
        renders(args.renders, vacios)


main()
