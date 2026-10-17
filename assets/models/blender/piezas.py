"""
Biblioteca universal de piezas genéricas (notebook, celular y electrodomésticos), modelada por
script en Blender (sin abrirlo).

    npm run modelos:piezas
    # = blender -b --factory-startup --python assets/models/blender/piezas.py -- \
    #       --salida public/models/piezas [--renders <carpeta>]

Qué exporta (public/models/piezas/): un GLB por FAMILIA (computo, electronica, movimiento,
frio_calor, estructura, carcasas) e `indice.json` (tipo → familia, descripción y equipos), para que
el visor baje solo las familias que usa el plano. En cada GLB:
- Un nodo por TIPO de pieza (`ventilador`, `ram`, `bateria`…). El visor elige el tipo por
  prefijo del id de la pieza del plano (`tornillos_ventilador` → `tornillo`) y ajusta la malla
  a las medidas del plano. Posiciones y medidas siguen saliendo del plano (IA o plantilla):
  acá no hay datos de ningún modelo de equipo, solo formas típicas.
- Un tipo puede tener VARIANTES (`bateria` de notebook y `bateria@celular`): mismo tipo y misma
  receta, otra forma. La app elige la que menos se deforma al ajustarla a las medidas del plano
  (todas están en cm reales), así que una batería de 26 cm usa la de notebook y una de 6 cm la de celular.
- Dentro de cada tipo, una malla por material. El nombre del material es la receta que usa la
  app (`lib/planogenerator/materiales.ts`): `cuerpo.<tipo>` es la receta propia de la pieza, el
  resto (`contactos`, `chip`, `cobre`…) son recetas de detalle. Los colores de acá son solo
  para los renders de revisión.

Convención (Blender): 1 unidad = 1 cm, X derecha, Y hacia atrás, Z arriba. El exportador glTF
pasa a Y arriba (three: z hacia el frente = -Y de Blender).
"""

import argparse
import json
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
    "cuerpo.pantalla": ("#10141b", 0.3, 0.25),
    "cuerpo.placa": ("#173f35", 0.15, 0.5),
    "cuerpo.camara": ("#2a2e34", 0.6, 0.35),
    "cuerpo.marco": ("#9aa2ab", 0.9, 0.35),
    "cuerpo.tapa_trasera": ("#2b3440", 0.4, 0.2),
    "cuerpo.fuente": ("#2a4a3e", 0.15, 0.5),
    "cuerpo.capacitor": ("#24406e", 0.2, 0.45),
    "cuerpo.transformador": ("#5b6168", 0.7, 0.45),
    "cuerpo.panel": ("#d9dcdf", 0.05, 0.45),
    "cuerpo.motor": ("#3b4249", 0.6, 0.45),
    "cuerpo.bomba": ("#4a4f55", 0.1, 0.55),
    "cuerpo.correa": ("#202224", 0.0, 0.85),
    "cuerpo.tambor": ("#c9ced3", 0.85, 0.3),
    "cuerpo.compresor": ("#1f2a24", 0.4, 0.45),
    "cuerpo.serpentin": ("#c4ccd2", 0.8, 0.35),
    "cuerpo.condensador": ("#1b1d20", 0.4, 0.5),
    "cuerpo.termostato": ("#d4d0c4", 0.05, 0.5),
    "cuerpo.resistencia": ("#7e8389", 0.7, 0.45),
    "cuerpo.valvula": ("#e3e5e7", 0.05, 0.45),
    "cuerpo.manguera": ("#6a6f74", 0.0, 0.8),
    "cuerpo.filtro": ("#cfd4d8", 0.05, 0.5),
    "cuerpo.puerta": ("#e8eaec", 0.2, 0.4),
    "cuerpo.carcasa": ("#dfe3e7", 0.3, 0.4),
    "cuerpo.evaporador": ("#c9d0d6", 0.8, 0.35),
    "cuerpo.turbina": ("#d9dcdf", 0.1, 0.5),
    "cuerpo.retroiluminacion": ("#e9ecef", 0.1, 0.4),
    "cuerpo.tira_led": ("#f2f2ee", 0.0, 0.5),
    "cuerpo.bandeja": ("#cfe3ea", 0.1, 0.25),
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
    "vidrio": ("#07090d", 0.4, 0.06),
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


def girar(o, rot):
    """Rotación completa (x, y, z en radianes, orden XYZ): para lo que no alcanza con `rot_z`."""
    o.rotation_euler = rot
    bpy.context.view_layer.update()
    return o


def esfera(r, pos=(0, 0, 0), mat="cuerpo", escala=(1, 1, 1), seg=24, anillos=12):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=anillos, radius=r)
    bmesh.ops.scale(bm, vec=escala, verts=bm.verts)
    return ubicar(objeto(bm, mat), pos)


def tubo(puntos, r, mat="cuerpo", seg=12, radios=None):
    """Tubo que sigue una polilínea 3D (caño, manguera, resistencia, cable). `radios`: uno por punto
    (ej. para el corrugado de una manguera). El aro se transporta en paralelo: no se retuerce."""
    bm = bmesh.new()
    pts = [Vector(p) for p in puntos]
    aros, n = [], None
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        if n is None:
            ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
            n = t.cross(ref).normalized()
        else:
            n = (n - t * n.dot(t)).normalized()
        b = t.cross(n)
        rr = radios[i] if radios else r
        aros.append([bm.verts.new(p + (n * math.cos(a) + b * math.sin(a)) * rr) for a in (2 * math.pi * k / seg for k in range(seg))])
    for a, b in zip(aros, aros[1:]):
        for k in range(seg):
            bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    bm.faces.new(list(reversed(aros[0])))
    bm.faces.new(aros[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return ubicar(objeto(bm, mat), (0, 0, 0))


def arco(centro, radio, a0, a1, n=12, plano="xz"):
    """Puntos de un arco (grados) en el plano dado, para armar codos de `tubo`."""
    cx, cy, cz = centro
    pts = []
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        c, s = math.cos(a) * radio, math.sin(a) * radio
        pts.append((cx + c, cy, cz + s) if plano == "xz" else (cx + c, cy + s, cz) if plano == "xy" else (cx, cy + c, cz + s))
    return pts


def caja(dim, pos=(0, 0, 0), mat="cuerpo", bisel=0.0, rot_z=0.0, seg=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=dim, verts=bm.verts)
    o = objeto(bm, mat)
    if bisel:
        biselar(o, bisel, seg)
    return ubicar(o, pos, rot_z)


def cilindro(r, alto, pos=(0, 0, 0), mat="cuerpo", seg=32, bisel=0.0, r_arriba=None, eje="z"):
    """Eje z por defecto; `eje="x"` lo acuesta (ej. el barril de una bisagra); `eje="y"`, hacia atrás."""
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r,
        radius2=r if r_arriba is None else r_arriba, depth=alto,
    )
    if eje == "x":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "Y"))
    elif eje == "y":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-math.pi / 2, 3, "X"))
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


def armar(nombre, equipos=None):
    """Junta las partes de la pieza por material y las cuelga de un nodo vacío con el nombre del tipo
    (o `tipo@variante`). El material del cuerpo es el del tipo: las variantes comparten receta.
    `equipos` (EQUIPOS_*) dice para qué equipos es la forma: va al GLB como `extras.equipos`."""
    tipo = nombre.split("@")[0]
    bpy.context.view_layer.update()
    grupos = {}
    for o in _partes:
        grupos.setdefault(o["mat"], []).append(o)
    vacio = bpy.data.objects.new(nombre, None)
    if equipos:
        vacio["equipos"] = equipos
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
        me = bpy.data.meshes.new(f"{nombre}__{mat}")
        bm.to_mesh(me)
        bm.free()
        me.shade_smooth()
        me.set_sharp_from_angle(angle=math.radians(35))
        me.materials.append(material(nombre_mat))
        o = bpy.data.objects.new(f"{nombre}__{mat}", me)
        bpy.context.scene.collection.objects.link(o)
        o.parent = vacio
    _partes.clear()
    return vacio


# ---------- Piezas ----------

# Para qué equipos es cada forma, en palabras (sin tildes). Solo se marcan los tipos que tienen
# variantes: si la recepción dice "celular", la app descarta las variantes marcadas para otro equipo.
# Una variante sin marca (ej. el USB-C, que usan los dos) sirve para cualquiera.
EQUIPOS_NOTEBOOK = "notebook laptop portatil netbook ultrabook"
EQUIPOS_CELULAR = "celular telefono smartphone movil"
EQUIPOS_HELADERA = "heladera refrigerador freezer congelador nevera"
EQUIPOS_SPLIT = "aire split acondicionado climatizador"
EQUIPOS_TV = "televisor tv monitor"
EQUIPOS_LAVARROPAS = "lavarropas lavasecarropas lavadora secarropas"
EQUIPOS_MICROONDAS = "microondas"
EQUIPOS_ELECTRO = " ".join([EQUIPOS_HELADERA, EQUIPOS_SPLIT, EQUIPOS_TV, EQUIPOS_LAVARROPAS, EQUIPOS_MICROONDAS])

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
    return armar("ventilador", EQUIPOS_NOTEBOOK)


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
    return armar("bateria", EQUIPOS_NOTEBOOK)


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
    return armar("parlante", EQUIPOS_NOTEBOOK)


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
    return armar("placa_madre", EQUIPOS_NOTEBOOK)


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
    return armar("conector", EQUIPOS_NOTEBOOK)


def soporte():
    """Soporte metálico (bracket): chapa con alivianados, agujeros y orejas."""
    chapa = caja((6.0, 4.0, 0.06), (0, 0, 0.03), bisel=0.03)
    cortes = [("caja", (1.6, 1.2, 0.5), (x, 0.3, 0.03)) for x in (-1.8, 0, 1.8)]
    cortes += [("cil", (0.16, 0.5), (x, y, 0.03)) for x in (-2.6, 2.6) for y in (-1.5, 1.5)]
    restar(chapa, varios(cortes))
    for x in (-2.97, 2.97):  # pestañas dobladas hacia arriba
        caja((0.06, 2.0, 0.45), (x, -0.4, 0.225), bisel=0.02)
    return armar("soporte")


# ---------- Piezas de celular (boca arriba, la parte de abajo del equipo hacia -Y) ----------

def pantalla():
    """Módulo de pantalla: vidrio con esquinas redondeadas sobre el panel, chapa trasera, flex con conector
    y el agujero de la cámara frontal. Sirve también para la pantalla de una notebook (se estira)."""
    W, D, R = 7.2, 15.6, 0.9
    caja((0.9, 0.45, 0.1), (0, -D / 2 + 2.6, 0.05), "plastico", bisel=0.02)
    caja((0.7, 0.3, 0.01), (0, -D / 2 + 2.6, 0.105), "contactos")
    caja((1.6, 2.2, 0.02), (0, -D / 2 + 1.6, 0.11), "plastico")
    prisma(redondeado(W - 0.3, D - 0.4, R - 0.15, 8), 0.04, (0, 0, 0.14), "metal")
    prisma(redondeado(W - 0.06, D - 0.06, R - 0.03, 8), 0.12, (0, 0, 0.22))
    prisma(redondeado(W, D, R, 8), 0.07, (0, 0, 0.315), "vidrio", bisel=0.025)
    cilindro(0.17, 0.012, (0, D / 2 - 0.65, 0.355), "goma", seg=24)
    aro = cilindro(0.21, 0.008, (0, D / 2 - 0.65, 0.354), "metal", seg=24)
    restar(aro, cilindro(0.17, 0.1, (0, D / 2 - 0.65, 0.354), mat=None, seg=24))
    return armar("pantalla")


def placa_compacta():
    """Placa de celular (o placa hija de notebook): PCB en L, blindajes metálicos, conectores
    board-to-board, componentes chicos y agujeros de montaje."""
    contorno = [(-3.0, -5.6), (3.0, -5.6), (3.0, 5.6), (-0.4, 5.6), (-0.4, 2.6), (-3.0, 2.6)]
    placa = prisma(contorno, 0.08, (0, 0, 0.04))
    agujeros = [(-2.6, -5.2), (2.6, -5.2), (2.6, 5.2), (-0.8, 5.2), (-2.6, 2.2)]
    restar(placa, varios([("cil", (0.12, 0.5), (x, y, 0.04)) for x, y in agujeros]))
    for x, y in agujeros:
        aro = cilindro(0.22, 0.01, (x, y, 0.085), "contactos", seg=16)
        restar(aro, cilindro(0.12, 0.5, (x, y, 0.08), mat=None, seg=12))
    # Blindajes: el grande tapa el procesador y la memoria.
    for (w, d), (x, y) in [((4.6, 3.4), (0.4, -1.4)), ((2.2, 2.0), (1.5, 1.6)), ((4.4, 1.6), (0.3, -4.4))]:
        caja((w, d, 0.12), (x, y, 0.14), "metal", bisel=0.02)
    caja((1.2, 0.6, 0.004), (0.4, -1.4, 0.202), "etiqueta")
    for (w, d), (x, y) in [((0.9, 0.35), (-2.3, 1.6)), ((0.9, 0.35), (2.3, 4.7)), ((0.7, 0.3), (1.2, 4.6)), ((0.9, 0.35), (-2.2, -2.8))]:
        caja((w, d, 0.1), (x, y, 0.13), "plastico", bisel=0.015)
        caja((w - 0.15, d - 0.15, 0.006), (x, y, 0.183), "contactos")
    azar = random.Random(11)  # fijo: la placa sale igual cada vez
    for _ in range(40):
        x, y = azar.uniform(-2.8, 2.8), azar.uniform(-5.4, 5.4)
        if x < -0.4 and y > 2.6:
            continue  # el hueco de la L (ahí va la cámara)
        w = azar.uniform(0.08, 0.22)
        caja((w, w * 0.55, 0.04), (x, y, 0.1), azar.choice(["metal", "chip", "conector"]))
    return armar("placa")


def alias(nombre, de, equipos=None):
    """Otro nodo con las mismas mallas que `de` (el GLB las guarda una sola vez)."""
    vacio = bpy.data.objects.new(nombre, None)
    if equipos:
        vacio["equipos"] = equipos
    bpy.context.scene.collection.objects.link(vacio)
    for hijo in de.children:
        o = bpy.data.objects.new(f"{nombre}__{hijo.name.split('__')[1]}", hijo.data)
        bpy.context.scene.collection.objects.link(o)
        o.parent = vacio
    return vacio


def bateria_celular():
    """Batería de celular: celda plana (pouch) con etiqueta, placa de protección arriba, flex con
    conector y las tiras para despegarla."""
    W, D = 5.8, 8.6
    prisma(redondeado(W, D, 0.3, 6), 0.45, (0, 0, 0.225), bisel=0.08)
    caja((4.4, 5.2, 0.006), (0, -0.4, 0.452), "etiqueta")
    caja((4.6, 0.55, 0.12), (0, D / 2 + 0.3, 0.2), "pcb")
    caja((4.4, 0.5, 0.02), (0, D / 2 + 0.3, 0.27), "plastico")
    caja((1.8, 0.4, 0.02), (1.4, D / 2 + 0.3, 0.29), "plastico")
    caja((0.8, 0.38, 0.1), (2.5, D / 2 + 0.3, 0.33), "plastico", bisel=0.015)
    caja((0.65, 0.25, 0.006), (2.5, D / 2 + 0.3, 0.383), "contactos")
    for x in (-1.6, 1.6):
        caja((0.7, 0.9, 0.01), (x, -D / 2 - 0.3, 0.005), "goma")
    return armar("bateria@celular", EQUIPOS_CELULAR)


def camara():
    """Cámara (frontal o de una notebook): bloque con lente, aro metálico y un tramo de flex."""
    caja((0.9, 0.9, 0.42), (0, 0, 0.21), bisel=0.04)
    cilindro(0.34, 0.2, (0, 0, 0.52), "metal", seg=32, bisel=0.02)
    cilindro(0.25, 0.02, (0, 0, 0.625), "vidrio", seg=32)
    caja((0.5, 0.45, 0.02), (0, -0.67, 0.03), "plastico")
    return armar("camara")


def camara_modulo():
    """Módulo de cámaras traseras: soporte metálico con tres cámaras (dos grandes y una chica) y el flash."""
    caja((2.7, 2.7, 0.1), (0, 0, 0.05), "metal", bisel=0.03)
    for (x, y), r in [((-0.65, 0.65), 0.5), ((-0.65, -0.65), 0.5), ((0.65, 0.65), 0.38)]:
        cilindro(r + 0.1, 0.5, (x, y, 0.35), seg=32, bisel=0.03)
        cilindro(r, 0.08, (x, y, 0.64), "metal", seg=32)
        cilindro(r - 0.08, 0.02, (x, y, 0.685), "vidrio", seg=32)
    cilindro(0.18, 0.06, (0.65, -0.65, 0.13), "etiqueta", seg=24)
    return armar("camara@modulo", EQUIPOS_CELULAR)


def conector_usb_c():
    """Conector de carga USB-C: carcasa ovalada con la boca hacia -Y, lengüeta con contactos y alas para atornillar."""
    carcasa = caja((0.9, 0.75, 0.32), (0, 0, 0.16), bisel=0.15, seg=4)
    restar(carcasa, caja((0.8, 0.8, 0.22), (0, -0.2, 0.16), mat=None))
    caja((0.66, 0.5, 0.07), (0, -0.05, 0.16), "plastico")
    for z in (0.197, 0.123):
        caja((0.55, 0.35, 0.004), (0, -0.12, z), "contactos")
    for sx in (-1, 1):
        ala = caja((0.3, 0.32, 0.03), (sx * 0.6, 0.12, 0.015), "metal")
        restar(ala, cilindro(0.06, 0.2, (sx * 0.62, 0.12, 0.015), mat=None, seg=12))
    caja((0.7, 0.12, 0.03), (0, 0.42, 0.015), "metal")
    return armar("conector@usb_c")


def parlante_celular():
    """Parlante de celular: caja de plástico con la salida de sonido hacia -Y, rejilla y contactos de resorte."""
    prisma(redondeado(1.8, 1.0, 0.15), 0.35, (0, 0, 0.175), bisel=0.03)
    caja((1.2, 0.06, 0.14), (0, -0.52, 0.18), "metal")
    caja((0.9, 0.5, 0.004), (-0.2, 0.05, 0.352), "etiqueta")
    for x in (0.55, 0.75):
        caja((0.12, 0.25, 0.06), (x, 0.25, 0.38), "contactos", bisel=0.01)
    return armar("parlante@celular", EQUIPOS_CELULAR)


def marco():
    """Marco (chasis) de celular: aro de aluminio con placa media, botones, cortes de antena,
    boca del USB-C, agujeros del parlante y bandeja de la SIM."""
    W, D, R, H = 7.4, 15.8, 1.0, 0.8
    aro = prisma(redondeado(W, D, R, 8), H, (0, 0, H / 2), bisel=0.12)
    cortes = [
        ("caja", (0.95, 0.6, 0.34), (0, -D / 2, 0.4)),
        ("caja", (0.6, 0.6, 0.12), (-1.6, -D / 2, 0.4)),
    ]
    cortes += [("caja", (0.12, 0.6, 0.12), (1.3 + i * 0.25, -D / 2, 0.4)) for i in range(5)]
    cortes += [("caja", (0.6, 1.6, 0.22), (-W / 2, 3.6, 0.4))]
    restar(aro, prisma(redondeado(W - 0.4, D - 0.4, R - 0.2, 8), H + 0.2, (0, 0, H / 2), mat=None), varios(cortes))
    placa = prisma(redondeado(W - 0.36, D - 0.36, R - 0.18, 8), 0.06, (0, 0, 0.35), "metal")
    restar(placa, caja((2.8, 3.0, 0.3), (-1.6, 5.4, 0.35), mat=None))
    for x, y, largo in [(W / 2 + 0.03, 2.4, 1.3), (-W / 2 - 0.03, 1.2, 2.2)]:
        caja((0.08, largo, 0.18), (x, y, 0.4), bisel=0.03)
    caja((0.05, 1.5, 0.18), (-W / 2 + 0.02, 3.6, 0.4), "metal")
    for y in (-D / 2 + 2.0, D / 2 - 2.0):
        for sx in (-1, 1):
            caja((0.22, 0.12, H - 0.04), (sx * (W / 2 - 0.1), y, H / 2), "plastico")
    return armar("marco")


def tapa_trasera():
    """Tapa trasera de celular vista desde afuera: vidrio o plástico con bordes curvos, isla de las
    cámaras con su hueco y, del lado de adentro, la bobina de carga inalámbrica y el adhesivo del borde."""
    W, D, R = 7.3, 15.7, 0.95
    cx, cy = -1.6, 5.4  # mismo lugar que el hueco de la placa media del marco
    tapa = prisma(redondeado(W, D, R, 8), 0.1, (0, 0, 0.09), bisel=0.045)
    restar(tapa, prisma(redondeado(2.9, 2.9, 0.5, 6), 0.4, (cx, cy, 0.09), mat=None))
    isla = prisma(redondeado(3.3, 3.3, 0.65, 6), 0.06, (cx, cy, 0.17), "metal", bisel=0.02)
    restar(isla, prisma(redondeado(2.9, 2.9, 0.5, 6), 0.4, (cx, cy, 0.17), mat=None))
    for r in (1.7, 1.4, 1.1):
        espira = cilindro(r, 0.02, (0, -1.2, 0.03), "cobre", seg=40)
        restar(espira, cilindro(r - 0.16, 0.1, (0, -1.2, 0.03), mat=None, seg=40))
    adhesivo = prisma(redondeado(W - 0.1, D - 0.1, R - 0.05, 8), 0.02, (0, 0, 0.03), "goma")
    restar(adhesivo, prisma(redondeado(W - 0.5, D - 0.5, R - 0.25, 8), 0.1, (0, 0, 0.03), mat=None))
    return armar("tapa_trasera")


# ---------- Electrodomésticos: electrónica ----------

def placa_control():
    """Placa de control de electrodoméstico: PCB con relés, capacitores, transformador chico, borneras y disipador."""
    W, D = 15.0, 10.0
    placa = caja((W, D, 0.16), (0, 0, 0.08))
    restar(placa, varios([("cil", (0.2, 0.5), (x, y, 0.08)) for x in (-7, 7) for y in (-4.5, 4.5)]))
    for x in (-5.5, -3.0, -0.5):  # relés
        caja((2.0, 1.5, 1.6), (x, 3.0, 0.96), "plastico", bisel=0.05)
        caja((1.4, 0.8, 0.005), (x, 3.0, 1.765), "etiqueta")
    for x, y, r, h in [(4.5, 3.0, 0.5, 1.6), (6.0, 3.0, 0.4, 1.2), (4.5, -0.5, 0.3, 0.9)]:
        cilindro(r, h, (x, y, 0.16 + h / 2), "chip", seg=20)
        cilindro(r * 0.9, 0.01, (x, y, 0.165 + h), "metal", seg=20)
    caja((2.4, 2.0, 2.0), (1.5, -2.5, 1.16), "metal")
    caja((1.6, 2.1, 1.4), (1.5, -2.5, 1.16), "cobre")
    for x in (-6.0, -4.0, -2.0):  # borneras
        caja((1.6, 1.0, 1.0), (x, -4.2, 0.66), "conector", bisel=0.03)
    caja((2.6, 0.25, 2.4), (5.5, -3.2, 1.36), "metal")
    for i in range(5):
        caja((0.08, 1.0, 2.2), (4.5 + i * 0.5, -2.6, 1.26), "metal")
    caja((1.8, 1.0, 0.12), (-3.0, 0.2, 0.22), "chip")
    azar = random.Random(23)
    for _ in range(24):
        w = azar.uniform(0.2, 0.5)
        caja((w, w * 0.5, 0.12), (azar.uniform(-6.8, 6.8), azar.uniform(-1.5, 1.6), 0.22), azar.choice(["metal", "chip", "conector"]))
    return armar("placa@control")


def fuente():
    """Fuente de alimentación de placa abierta: capacitor grande, transformador de ferrite, disipadores, bobina y borneras."""
    placa = caja((14.0, 8.0, 0.16), (0, 0, 0.08))
    restar(placa, varios([("cil", (0.2, 0.5), (x, y, 0.08)) for x in (-6.5, 6.5) for y in (-3.5, 3.5)]))
    cilindro(1.1, 3.0, (-4.5, 1.0, 1.66), "chip", seg=28)
    cilindro(1.0, 0.02, (-4.5, 1.0, 3.17), "metal", seg=28)
    caja((2.6, 2.2, 2.2), (0.5, 0.5, 1.26), "conector")
    caja((3.0, 1.0, 2.6), (0.5, 0.5, 1.46), "chip")
    for x in (3.6, 5.6):
        caja((0.2, 6.0, 3.0), (x, 0, 1.66), "metal")
        for i in range(5):
            caja((0.8, 0.06, 2.8), (x + 0.5, -2.4 + i * 1.2, 1.56), "metal")
    cilindro(0.9, 0.6, (-1.5, -2.5, 0.46), "cobre", seg=24)
    cilindro(0.4, 0.62, (-1.5, -2.5, 0.47), "chip", seg=16)
    caja((3.0, 1.0, 1.2), (-5.0, -3.2, 0.76), "conector", bisel=0.03)
    caja((2.0, 1.0, 1.2), (5.5, -3.2, 0.76), "conector", bisel=0.03)
    cilindro(0.25, 1.6, (-2.5, 3.2, 0.45), "vidrio", seg=12, eje="x")
    return armar("fuente")


def capacitor():
    """Capacitor electrolítico: lata con funda plástica, tapa de aluminio con la cruz de alivio y dos patas."""
    R, H = 0.8, 2.6
    cilindro(R, H, (0, 0, 0.3 + H / 2), seg=28, bisel=0.05)
    cilindro(R * 0.92, 0.02, (0, 0, 0.31 + H), "metal", seg=28)
    caja((R * 1.4, 0.05, 0.01), (0, 0, 0.325 + H), "ranura")
    caja((0.05, R * 1.4, 0.01), (0, 0, 0.325 + H), "ranura")
    caja((0.02, 0.4, H * 0.8), (R - 0.005, 0, 0.3 + H / 2), "etiqueta")
    for x in (-0.3, 0.3):
        cilindro(0.04, 0.3, (x, 0, 0.15), "metal", seg=8)
    return armar("capacitor")


def capacitor_motor():
    """Capacitor de arranque o de marcha de un motor: lata grande con la etiqueta, tapa plástica y terminales faston."""
    R, H = 2.2, 6.5
    cilindro(0.3, 0.8, (0, 0, 0.4), "metal", seg=12)
    cilindro(R, H, (0, 0, 0.8 + H / 2), seg=36, bisel=0.1)
    cilindro(R + 0.01, 3.0, (0, 0, 0.8 + H * 0.45), "etiqueta", seg=36)
    cilindro(R * 0.95, 0.4, (0, 0, 1.0 + H), "plastico", seg=36)
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        caja((0.6, 0.08, 0.8), (math.cos(a) * 0.9, math.sin(a) * 0.9, 1.6 + H), "metal", rot_z=a)
    return armar("capacitor@motor")


def transformador():
    """Transformador de núcleo de hierro: chapas laminadas, bobinado de cobre con su papel, soporte con patas y terminales."""
    nucleo = caja((6.0, 4.0, 5.0), (0, 0, 2.9))
    restar(nucleo, caja((1.2, 4.4, 3.0), (-1.5, 0, 2.9), mat=None), caja((1.2, 4.4, 3.0), (1.5, 0, 2.9), mat=None))
    for i in range(6):
        caja((6.02, 0.01, 0.02), (0, -2.005, 0.9 + i * 0.8), "ranura")
    caja((3.0, 4.8, 3.0), (0, 0, 2.9), "cobre")
    caja((3.04, 4.84, 0.7), (0, 0, 2.9), "conector")
    placa = caja((8.4, 4.4, 0.15), (0, 0, 0.33), "metal")
    restar(placa, varios([("cil", (0.25, 0.5), (x, 0, 0.33)) for x in (-3.7, 3.7)]))
    for x in (-0.9, -0.3, 0.3, 0.9):
        caja((0.3, 0.05, 0.6), (x, -2.42, 4.3), "contactos")
    return armar("transformador")


def panel():
    """Panel de control: frente de plástico con display, botones y una perilla."""
    W, D, H = 30.0, 2.0, 8.0
    caja((W, D, H), (0, 0, H / 2), bisel=0.3)
    caja((7.0, 0.05, 3.2), (-7.0, -D / 2 - 0.02, H / 2 + 0.5), "vidrio")
    for i in range(4):
        cilindro(0.6, 0.3, (1.0 + i * 2.0, -D / 2 - 0.15, H / 2), "plastico", seg=20, eje="y", bisel=0.05)
    cilindro(1.8, 1.2, (11.0, -D / 2 - 0.6, H / 2), "metal", seg=32, eje="y", bisel=0.15)
    caja((0.15, 0.05, 1.0), (11.0, -D / 2 - 1.22, H / 2 + 1.0), "etiqueta")
    return armar("panel")


def conector_terminal():
    """Conector de cables (tipo Molex o ficha de bornes): carcasa de plástico con contactos y cables saliendo atrás."""
    caja((2.4, 1.2, 1.0), (0, 0, 0.5), "conector", bisel=0.05)
    caja((0.6, 0.6, 0.15), (0, 0, 1.07), "conector")
    for i in range(4):
        x = -0.84 + i * 0.56
        caja((0.3, 0.02, 0.3), (x, -0.61, 0.5), "ranura")
        caja((0.12, 0.05, 0.12), (x, -0.6, 0.5))
        tubo([(x, 0.6, 0.5), (x, 1.8, 0.5), (x * 1.3, 3.0, 0.4)], 0.1, "plastico", seg=8)
    return armar("conector@terminal")


def pantalla_panel():
    """Panel de televisor o monitor: vidrio con marco metálico fino; atrás, chapa con nervios, placa T-con, flex de los drivers arriba y el cable."""
    W, H, P = 100.0, 58.0, 1.0
    caja((W - 0.6, P, H - 0.6), (0, 0, H / 2))
    caja((W - 1.2, 0.05, H - 1.2), (0, -P / 2 - 0.03, H / 2), "vidrio")
    marco_m = caja((W, P + 0.3, H), (0, 0.1, H / 2), "metal", bisel=0.1)
    restar(marco_m, caja((W - 1.0, P + 1.0, H - 1.0), (0, 0.1, H / 2), mat=None))
    caja((W - 4.0, 0.2, H - 4.0), (0, P / 2 + 0.1, H / 2), "metal")
    for z in (H * 0.3, H * 0.5, H * 0.7):
        caja((W - 8.0, 0.2, 1.2), (0, P / 2 + 0.3, z), "metal", bisel=0.05)
    caja((22.0, 0.3, 7.0), (0, P / 2 + 0.55, 6.0), "pcb")
    for x, w in [(-6.0, 2.5), (-1.5, 1.5), (3.0, 3.0)]:
        caja((w, 0.25, w * 0.7), (x, P / 2 + 0.82, 6.5), "chip")
    for i in range(10):
        x = -W / 2 + 7.0 + i * (W - 14.0) / 9
        caja((3.6, 0.06, 3.0), (x, P / 2 + 0.25, H - 1.2), "plastico")
        caja((1.2, 0.1, 0.6), (x, P / 2 + 0.3, H - 1.4), "chip")
    tubo([(10.5, P / 2 + 0.7, 6.0), (16.0, P / 2 + 0.9, 8.0), (22.0, P / 2 + 0.9, 12.0)], 0.35, "plastico", seg=10)
    return armar("pantalla@panel", EQUIPOS_TV)


# ---------- Electrodomésticos: movimiento ----------

def motor():
    """Motor eléctrico: carcasa con aletas de enfriamiento, tapas, eje, patas y caja de conexiones."""
    L, R = 14.0, 5.5
    z = R + 1.0
    cilindro(R, L, (0, 0, z), seg=36, eje="x")
    for i in range(9):
        cilindro(R + 0.25, 0.35, (-L / 2 + 1.5 + i * 1.4, 0, z), seg=36, eje="x")
    for sx in (-1, 1):
        cilindro(R * 0.92, 1.0, (sx * (L / 2 + 0.5), 0, z), "metal", seg=36, eje="x", bisel=0.2)
    cilindro(0.6, 4.0, (L / 2 + 3.0, 0, z), "metal", seg=16, eje="x")
    for sy in (-1, 1):
        caja((L * 0.6, 1.2, 1.6), (0, sy * R * 0.6, 0.8), "metal")
    caja((L * 0.8, 2 * R * 0.9, 0.4), (0, 0, 0.2), "metal")
    caja((3.0, 3.0, 1.6), (0, 0, z + R + 0.6), "plastico", bisel=0.1)
    tubo([(1.5, 0, z + R + 1.0), (3.0, 0, z + R + 1.6), (5.0, 0, z + R + 1.8)], 0.25, "plastico", seg=10)
    return armar("motor")


def ventilador_axial():
    """Ventilador axial (heladera, unidad exterior de aire, microondas): hélice de cinco aspas con su cubo, aro y motor."""
    R = 6.0
    cilindro(1.3, 1.6, (0, 0, 2.6), "cubo", seg=32, bisel=0.2)
    aspa = [(1.0, -0.6), (3.0, -1.6), (5.2, -1.8), (R - 0.3, -1.0), (R - 0.3, 0.8), (4.5, 1.3), (2.5, 1.0), (1.0, 0.6)]
    for i in range(5):
        a = 2 * math.pi * i / 5
        girar(prisma(aspa, 0.08, (0, 0, 2.6), "aspas"), (math.radians(28), 0, a))
    cilindro(1.6, 2.2, (0, 0, 1.1), "metal", seg=28)
    aro = cilindro(R + 0.5, 1.2, (0, 0, 2.6), seg=48)
    restar(aro, cilindro(R + 0.25, 2.0, (0, 0, 2.6), mat=None, seg=48))
    for i in range(3):
        a = 2 * math.pi * i / 3 + 0.5
        largo = R + 0.3
        caja((largo, 0.35, 0.15), (math.cos(a) * largo / 2, math.sin(a) * largo / 2, 0.6), "plastico", rot_z=a)
    return armar("ventilador@axial", EQUIPOS_ELECTRO)


def ventilador_tangencial():
    """Turbina tangencial (unidad interior de aire split): jaula larga de álabes con discos de refuerzo y eje."""
    L, R = 60.0, 4.5
    for i in range(7):
        cilindro(R, 0.25, (-L / 2 + i * L / 6, 0, R), seg=32, eje="x")
    for k in range(28):
        a = 2 * math.pi * k / 28
        alabe = caja((L, 0.08, 0.9), (0, math.cos(a) * (R - 0.5), R + math.sin(a) * (R - 0.5)), "aspas")
        girar(alabe, (a + 0.5, 0, 0))
    cilindro(0.4, L + 4.0, (0, 0, R), "metal", seg=12, eje="x")
    cilindro(1.2, 1.5, (L / 2 + 1.0, 0, R), "metal", seg=24, eje="x")
    return armar("ventilador@tangencial", EQUIPOS_SPLIT)


def bomba():
    """Bomba de agua (desagote de lavarropas): voluta con el filtro y su tapa adelante, entrada y salida con espigas,
    motor sincrónico (núcleo, bobina y ficha) atrás y orejas para atornillarla."""
    z = 4.0
    cilindro(3.2, 2.2, (0, 0, z), seg=36, eje="y", bisel=0.2)
    cilindro(2.6, 3.0, (0, -2.6, z), seg=32, eje="y")
    cilindro(2.8, 0.8, (0, -4.4, z), "plastico", seg=32, eje="y", bisel=0.2)
    caja((4.2, 0.8, 0.8), (0, -5.0, z), "plastico", bisel=0.2)
    entrada = [(1.6, -1.0, z + 2.4), (2.4, -1.0, z + 4.2), (3.0, -1.0, z + 5.6), (3.4, -1.0, z + 6.6)]
    tubo(entrada, 1.2, seg=20, radios=[1.2, 1.2, 1.3, 1.2])
    salida = [(-2.8, 0, z + 0.6), (-4.4, 0, z + 1.2), (-5.4, 0, z + 2.0), (-6.4, 0, z + 2.8), (-7.2, 0, z + 3.4)]
    tubo(salida, 0.7, seg=16, radios=[0.7, 0.7, 0.8, 0.7, 0.8])
    caja((5.0, 2.0, 5.0), (0, 2.2, z), "metal")
    for i in range(5):
        caja((5.02, 0.02, 0.05), (0, 1.19, z - 2.0 + i), "ranura")
    caja((3.0, 2.4, 1.8), (0, 2.3, z + 3.3), "cobre")
    caja((2.2, 1.2, 1.2), (0, 3.6, z + 3.3), "conector", bisel=0.05)
    for x in (-0.5, 0.5):
        caja((0.3, 0.05, 0.5), (x, 4.22, z + 3.3), "contactos")
    for x, zz in [(-3.9, z - 2.0), (3.9, z - 2.0), (0, z + 3.6)]:
        oreja = caja((1.4, 0.5, 1.4), (x, 0.9, zz), bisel=0.1)
        restar(oreja, cilindro(0.3, 1.0, (x, 0.9, zz), mat=None, seg=12, eje="y"))
    return armar("bomba")


def correa():
    """Correa de transmisión (poly-V), parada como en un lavarropas: un lazo largo entre dos poleas."""
    banda = prisma(redondeado(28.0, 56.0, 13.9, 12), 2.0, (0, 0, 28.0))
    restar(banda, prisma(redondeado(27.0, 55.0, 13.4, 12), 2.4, (0, 0, 28.0), mat=None))
    girar(banda, (math.pi / 2, 0, 0))
    return armar("correa")


def tambor():
    """Tambor de lavarropas de carga frontal: cuba de acero perforada con nervios, abierta adelante, paletas,
    aro de balanceo atrás, cruceta de aluminio y eje."""
    R, P = 24.0, 30.0
    cuba = cilindro(R, P, (0, 0, R), seg=48, eje="y")
    restar(cuba, cilindro(R - 0.3, P, (0, -0.4, R), mat=None, seg=48, eje="y"))
    aro = cilindro(R + 0.3, 1.2, (0, -P / 2 + 0.6, R), "metal", seg=48, eje="y")
    restar(aro, cilindro(R - 3.0, 2.0, (0, -P / 2 + 0.6, R), mat=None, seg=48, eje="y"))
    for y in (-P / 2 + 8.5, P / 2 - 8.5):
        nervio = cilindro(R + 0.15, 0.6, (0, y, R), "metal", seg=48, eje="y")
        restar(nervio, cilindro(R - 0.1, 1.0, (0, y, R), mat=None, seg=48, eje="y"))
    balanceo = cilindro(R + 0.4, 1.6, (0, P / 2 - 0.8, R), "metal", seg=48, eje="y")
    restar(balanceo, cilindro(R - 1.5, 2.0, (0, P / 2 - 0.8, R), mat=None, seg=48, eje="y"))
    for j, y in enumerate((-P / 2 + 3.5, -P / 2 + 6.5, -1.5, 1.5, P / 2 - 6.5, P / 2 - 3.5)):
        for k in range(24):
            a = 2 * math.pi * k / 24 + j * 0.13
            agujero = cilindro(0.35, 0.06, (math.cos(a) * (R + 0.01), y, R + math.sin(a) * (R + 0.01)), "ranura", seg=6)
            girar(agujero, (0, math.pi / 2 - a, 0))
    for a in (math.radians(90), math.radians(210), math.radians(330)):
        paleta = caja((3.0, P - 3.0, 2.5), (math.cos(a) * (R - 1.4), 0.5, R + math.sin(a) * (R - 1.4)), "metal", bisel=0.4)
        girar(paleta, (0, math.pi / 2 - a, 0))
    for a in (math.radians(90), math.radians(210), math.radians(330)):
        brazo = caja((R * 0.95, 1.2, 2.0), (math.cos(a) * R * 0.475, P / 2 + 0.6, R + math.sin(a) * R * 0.475), "metal", bisel=0.3)
        girar(brazo, (0, -a, 0))
    cilindro(3.0, 1.6, (0, P / 2 + 1.2, R), "metal", seg=24, eje="y")
    cilindro(1.2, 5.0, (0, P / 2 + 3.5, R), "metal", seg=20, eje="y")
    return armar("tambor")


def compresor():
    """Compresor hermético (heladera o aire): cápsula con domo, costura soldada y chapa de datos, patas con gomas,
    caños de cobre (succión, descarga y el de proceso aplastado) y la caja del relé con el cable."""
    R, H, z0 = 7.0, 12.0, 1.9
    caja((18.0, 14.0, 0.4), (0, 0, 0.2), "metal")
    for sx in (-1, 1):
        for sy in (-1, 1):
            cilindro(0.9, 0.8, (sx * 7.8, sy * 5.8, 0.6), "goma", seg=16)
            cilindro(0.35, 1.2, (sx * 7.8, sy * 5.8, 0.8), "metal", seg=10)
        caja((2.0, 14.0, 1.5), (sx * 4.0, 0, 1.15), "metal")
    cilindro(R, H, (0, 0, z0 + H / 2), seg=40)
    esfera(R, (0, 0, z0 + H), escala=(1, 1, 0.45), seg=40, anillos=12)
    esfera(R, (0, 0, z0), escala=(1, 1, 0.3), seg=40, anillos=12)
    cilindro(R + 0.15, 0.5, (0, 0, z0 + H * 0.7), "metal", seg=40)
    girar(caja((4.0, 0.05, 2.6), (2.6, -R + 0.45, z0 + H * 0.4), "etiqueta"), (0, 0, math.radians(-22)))
    zt = z0 + H
    # Succión (la más gruesa), descarga y proceso: suben del domo y se doblan hacia atrás.
    for x, y, r in [(-2.5, -1.0, 0.45), (2.5, -1.0, 0.3)]:
        tubo([(x, y, zt + 2.4), (x, y, zt + 4.0)] + arco((x, y + 1.0, zt + 4.0), 1.0, 180, 90, n=6, plano="yz")[1:] + [(x, y + 3.0, zt + 5.0)], r, "cobre", seg=12)
    tubo([(0, 0.8, zt + 2.9), (0, 0.8, zt + 5.5)], 0.3, "cobre", seg=12)
    caja((0.9, 0.2, 0.6), (0, 0.8, zt + 5.8), "cobre")
    caja((4.0, 2.4, 3.6), (0, -R - 0.6, z0 + H * 0.45), "plastico", bisel=0.2)
    caja((1.2, 0.3, 1.2), (1.0, -R - 1.85, z0 + H * 0.3), "conector", bisel=0.05)
    tubo([(1.0, -R - 2.0, z0 + H * 0.3), (1.6, -R - 3.4, z0 + H * 0.2), (2.6, -R - 4.4, z0 + 1.2)], 0.25, "plastico", seg=10)
    return armar("compresor")


def evaporador():
    """Evaporador de heladera (placa roll-bond): chapa de aluminio con los canales del gas en relieve, el capilar y el caño de succión."""
    W, H = 40.0, 30.0
    caja((W, 0.15, H), (0, 0, H / 2))
    n, pts = 9, []
    paso = (H - 4.0) / (n - 1)
    for i in range(n):
        z = 2.0 + i * paso
        izq, der = (-W / 2 + 2.5, -0.1, z), (W / 2 - 2.5, -0.1, z)
        pts += [izq, der] if i % 2 == 0 else [der, izq]
        if i < n - 1:
            cx = W / 2 - 2.5 if i % 2 == 0 else -W / 2 + 2.5
            a0, a1 = (-90, 90) if i % 2 == 0 else (270, 90)
            pts += arco((cx, -0.1, z + paso / 2), paso / 2, a0, a1, n=6)[1:-1]
    tubo(pts, 0.35, "metal", seg=8)
    tubo([(-W / 2 + 2.5, -0.1, 2.0), (-W / 2 + 1.0, -0.6, 1.0), (-W / 2 - 1.0, -0.8, -1.0)], 0.4, "cobre", seg=10)
    tubo([(-W / 2 + 3.5, -0.1, 2.0), (-W / 2 + 2.6, -0.5, 0.5), (-W / 2 + 1.5, -0.7, -1.0)], 0.12, "cobre", seg=6)
    return armar("evaporador", EQUIPOS_HELADERA)


def turbina_centrifuga():
    """Turbina centrífuga (jaula de ardilla: horno, secarropas, aire de conducto): rueda corta de álabes curvos con disco trasero y cubo."""
    R, L = 6.0, 8.0
    cilindro(R, 0.3, (L / 2, 0, R), seg=40, eje="x")
    aro = cilindro(R, 0.4, (-L / 2, 0, R), seg=40, eje="x")
    restar(aro, cilindro(R - 1.2, 1.0, (-L / 2, 0, R), mat=None, seg=40, eje="x"))
    for k in range(36):
        a = 2 * math.pi * k / 36
        alabe = caja((L - 0.4, 0.06, 1.0), (0, math.cos(a) * (R - 0.6), R + math.sin(a) * (R - 0.6)), "aspas")
        girar(alabe, (a + 0.6, 0, 0))
    cilindro(1.4, 1.6, (L / 2 - 0.8, 0, R), "metal", seg=24, eje="x")
    cilindro(0.4, 3.0, (L / 2 + 1.0, 0, R), "metal", seg=12, eje="x")
    return armar("turbina@centrifuga")


def retroiluminacion():
    """Retroiluminación de televisor: chapa reflectora con tiras de LED (barras de aluminio con las lentes) y sus fichas."""
    W, H = 96.0, 56.0
    caja((W, 0.1, H), (0, 0.4, H / 2))
    for i in range(8):
        z = 4.0 + i * (H - 8.0) / 7
        caja((W - 6.0, 0.15, 1.2), (0, 0.27, z), "metal")
        for j in range(11):
            cilindro(0.45, 0.3, (-W / 2 + 6.0 + j * (W - 12.0) / 10, 0.2, z), "etiqueta", seg=8, eje="y")
        caja((1.2, 0.3, 0.8), (-W / 2 + 2.4, 0.2, z), "conector", bisel=0.05)
    return armar("retroiluminacion", EQUIPOS_TV)


def tira_led():
    """Tira de LED suelta (retroiluminación, luz interior): barra de aluminio con lentes y una ficha en la punta."""
    caja((40.0, 0.15, 1.2), (0, 0, 0.075), "metal")
    for j in range(8):
        cilindro(0.45, 0.3, (-17.5 + j * 5.0, 0, 0.3), "etiqueta", seg=8)
    caja((38.0, 0.6, 0.04), (0, 0, 0.17))
    caja((1.2, 0.8, 0.3), (20.6, 0, 0.15), "conector", bisel=0.05)
    return armar("tira_led")


def bandeja():
    """Bandeja o cajón (verduras de heladera, cajón del freezer): caja abierta arriba, de plástico, con la manija en el frente."""
    W, P, H = 50.0, 30.0, 20.0
    caj = caja((W, P, H), (0, 0, H / 2), bisel=0.8)
    restar(caj, caja((W - 0.8, P - 0.8, H), (0, 0, H / 2 + 0.4), mat=None), caja((14.0, 2.0, 3.0), (0, -P / 2, H - 2.5), mat=None))
    for x in (-W / 4, W / 4):
        caja((0.3, P - 1.0, 1.0), (x, 0, 0.9), "plastico")
    return armar("bandeja")


def bandeja_goteo():
    """Bandeja de goteo o de condensado (aire split, heladera): batea larga y baja con nervios y el pico de desagote."""
    W, P, H = 70.0, 10.0, 3.0
    caj = caja((W, P, H), (0, 0, H / 2), bisel=0.4)
    restar(caj, caja((W - 0.8, P - 0.8, H), (0, 0, H / 2 + 0.4), mat=None))
    for i in range(6):
        caja((0.3, P - 1.0, 0.8), (-W / 2 + 6.0 + i * (W - 12.0) / 5, 0, 0.8), "plastico")
    cilindro(0.8, 3.0, (-W / 2 - 1.0, 0, 1.2), seg=16, eje="x")
    return armar("bandeja@goteo")


def bandeja_estante():
    """Estante de heladera: vidrio templado con perfil de plástico adelante y atrás."""
    W, P = 55.0, 35.0
    caja((W - 1.0, P - 1.0, 0.4), (0, 0, 0.6), "vidrio")
    for y in (-P / 2 + 0.6, P / 2 - 0.6):
        caja((W, 1.2, 1.2), (0, y, 0.6), bisel=0.2)
    return armar("bandeja@estante")


# ---------- Electrodomésticos: frío y calor ----------

def serpentin():
    """Serpentín de aletas (evaporador o condensador de aire): aletas de aluminio atravesadas por caños de cobre con codos."""
    L, H, P = 40.0, 20.0, 3.0
    n = 50
    for i in range(n):
        caja((0.03, P, H), (-L / 2 + i * L / (n - 1), 0, H / 2 + 0.2))
    for sx in (-1, 1):
        caja((0.3, P + 0.4, H + 0.4), (sx * (L / 2 + 0.2), 0, H / 2 + 0.2), "metal")
    zs = [H / 2 + 0.2 - 7.5 + k * 3.0 for k in range(6)]
    for y in (-0.7, 0.7):
        for z in zs:
            cilindro(0.45, L + 1.2, (0, y, z), "cobre", seg=12, eje="x")
        for k in range(5):
            derecha = k % 2 == 0
            cx = (L / 2 + 0.6) if derecha else -(L / 2 + 0.6)
            angulos = (-90, 90) if derecha else (90, 270)
            tubo(arco((cx, y, (zs[k] + zs[k + 1]) / 2), 1.5, *angulos, n=8), 0.45, "cobre", seg=10)
    return armar("serpentin")


def condensador_heladera():
    """Condensador de heladera (tubo y alambre): caño negro en zigzag con varillas soldadas a los dos lados."""
    W, H, n = 45.0, 80.0, 12
    paso = (H - 6.0) / (n - 1)
    pts = []
    for i in range(n):
        z = 3.0 + i * paso
        izq, der = (-W / 2 + 3.0, 0, z), (W / 2 - 3.0, 0, z)
        pts += [izq, der] if i % 2 == 0 else [der, izq]
        if i < n - 1:
            cx = W / 2 - 3.0 if i % 2 == 0 else -W / 2 + 3.0
            a0, a1 = (-90, 90) if i % 2 == 0 else (270, 90)
            pts += arco((cx, 0, z + paso / 2), paso / 2, a0, a1, n=8)[1:-1]
    tubo(pts, 0.4, seg=10)
    for j in range(40):
        x = -W / 2 + 1.5 + j * (W - 3.0) / 39
        for y in (-0.5, 0.5):
            cilindro(0.08, H - 2.0, (x, y, H / 2), seg=6)
    for z in (0.8, H - 0.8):
        caja((W, 0.3, 1.6), (0, 0, z), "metal")
    return armar("condensador", EQUIPOS_HELADERA)


def termostato():
    """Termostato mecánico (heladera, horno): caja con eje y perilla, soporte, terminales y el tubo capilar enrollado."""
    caja((4.0, 3.0, 2.6), (0, 0, 1.3), bisel=0.1)
    soporte = caja((5.6, 0.15, 3.4), (0, -1.6, 1.7), "metal")
    restar(soporte, varios([("caja", (0.4, 0.5, 0.4), (x, -1.6, 2.9)) for x in (-2.4, 2.4)]))
    cilindro(0.3, 1.5, (0, -2.4, 1.3), "metal", seg=12, eje="y")
    cilindro(1.2, 1.0, (0, -3.6, 1.3), "plastico", seg=28, eje="y", bisel=0.1)
    caja((0.15, 0.05, 0.8), (0, -4.12, 1.9), "etiqueta")
    for x in (-1.2, 0, 1.2):
        caja((0.5, 0.05, 0.8), (x, 1.52, 2.0), "contactos")
    pts = [(1.6, 1.5, 1.3), (1.6, 3.3, 1.3)]
    for i in range(64):
        t = 2 * math.pi * i / 16
        pts.append((1.6 - i * 3.2 / 63, 4.5 + math.sin(t) * 1.2, 1.3 - math.cos(t) * 1.2 + 1.2))
    tubo(pts, 0.06, "cobre", seg=6)
    return armar("termostato")


def resistencia():
    """Resistencia calefactora tubular (lavarropas, horno, deshielo): caño doblado en U con brida y dos terminales."""
    L, z = 30.0, 2.5
    pts = [(-L / 2, -1.5, z), (L / 2, -1.5, z)] + arco((L / 2, 0, z), 1.5, -90, 90, n=12, plano="xy")[1:-1] + [(L / 2, 1.5, z), (-L / 2, 1.5, z)]
    tubo(pts, 0.4, seg=12)
    caja((0.4, 6.0, 4.0), (-L / 2 - 0.2, 0, z), "metal", bisel=0.05)
    for y in (-1.5, 1.5):
        cilindro(0.2, 1.8, (-L / 2 - 1.3, y, z), "metal", seg=10, eje="x")
        cilindro(0.5, 0.4, (-L / 2 - 0.7, y, z), "metal", seg=6, eje="x")
    return armar("resistencia")


def valvula():
    """Electroválvula de agua: cuerpo de plástico con la entrada roscada, bobina con terminales y dos salidas."""
    z = 1.6
    cilindro(1.4, 4.0, (0, 0, z), seg=24, eje="x")
    cilindro(1.1, 2.2, (-3.1, 0, z), seg=24, eje="x")
    for i in range(5):
        cilindro(1.2, 0.15, (-3.9 + i * 0.4, 0, z), "plastico", seg=24, eje="x")
    caja((2.4, 2.4, 2.2), (0.4, 0, z + 2.3), "plastico", bisel=0.1)
    for x in (-0.2, 1.0):
        caja((0.6, 0.05, 0.8), (x, 0, z + 3.8), "contactos")
    for y in (-0.7, 0.7):
        cilindro(0.4, 2.5, (2.6, y, z), seg=16, eje="x")
    return armar("valvula")


# ---------- Electrodomésticos: estructura ----------

def manguera():
    """Manguera corrugada (desagote o carga de agua): tubo flexible en curva suave, con los extremos lisos."""
    n = 81
    pts = [(-20.0 + 40.0 * i / (n - 1), 0, 2.0 + 1.5 * math.sin(2 * math.pi * i / (n - 1))) for i in range(n)]
    radios = [1.15 if i < 4 or i > n - 5 else 1.2 + 0.12 * (i % 2) for i in range(n)]
    tubo(pts, 1.2, seg=14, radios=radios)
    return armar("manguera")


def filtro():
    """Filtro de aire (aire split, campana): marco plástico con malla fina y dos nervios."""
    W, H = 26.0, 30.0
    marco_f = prisma(redondeado(W, H, 0.8), 0.6, (0, 0, 0.3))
    restar(marco_f, prisma(redondeado(W - 2.0, H - 2.0, 0.4), 1.0, (0, 0, 0.3), mat=None))
    for i in range(14):
        caja((W - 2.0, 0.18, 0.1), (0, -H / 2 + 1.0 + i * (H - 2.0) / 13, 0.3), "ranura")
    for i in range(12):
        caja((0.18, H - 2.0, 0.1), (-W / 2 + 1.0 + i * (W - 2.0) / 11, 0, 0.3), "ranura")
    for x in (-W / 6, W / 6):
        caja((0.4, H - 2.0, 0.4), (x, 0, 0.3))
    return armar("filtro")


def filtro_cartucho():
    """Filtro de cartucho (agua, desagote): cilindro plisado con tapas y la rosca arriba."""
    R, H = 3.0, 18.0
    for z in (0.4, H - 0.4):
        cilindro(R + 0.2, 0.8, (0, 0, z), seg=32)
    cilindro(R - 0.8, H - 1.6, (0, 0, H / 2), "plastico", seg=24)
    for k in range(36):
        a = 2 * math.pi * k / 36
        caja((0.8, 0.12, H - 1.6), (math.cos(a) * (R - 0.4), math.sin(a) * (R - 0.4), H / 2), "etiqueta", rot_z=a)
    cilindro(1.2, 1.5, (0, 0, H + 0.75), seg=24)
    return armar("filtro@cartucho")


def cable_redondo():
    """Cable de alimentación o de conexión: cable redondo en curva suave con un conector en cada punta."""
    n = 41
    tubo([(-14.0 + 28.0 * i / (n - 1), 0.8 * math.sin(3 * math.pi * i / (n - 1)), 0.5) for i in range(n)], 0.3, seg=10)
    for x in (-14.8, 14.8):
        caja((1.6, 1.0, 0.9), (x, 0, 0.5), "conector", bisel=0.05)
        caja((0.05, 0.6, 0.5), (x + (0.8 if x > 0 else -0.8), 0, 0.5), "contactos")
    return armar("cable@redondo")


def bisagra_puerta():
    """Bisagra de puerta de electrodoméstico: planchuela gruesa con agujeros y el perno hacia abajo."""
    placa_b = caja((7.0, 3.0, 0.5), (0, 0, 2.75), bisel=0.05)
    restar(placa_b, varios([("cil", (0.35, 1.0), (x, 0.3, 2.75)) for x in (-2.6, -0.6)]))
    cilindro(0.5, 2.5, (2.6, -0.4, 1.25), "metal", seg=16)
    cilindro(0.9, 0.15, (2.6, -0.4, 2.42), "metal", seg=20)
    return armar("bisagra@puerta")


def puerta():
    """Puerta de heladera (o de horno, microondas): panel con burlete magnético, contrapuerta con estantes y manija."""
    W, H = 60.0, 100.0
    caja((W, 2.0, H), (0, -1.5, H / 2), bisel=0.6)
    caja((W - 4.0, 2.0, H - 4.0), (0, 0.5, H / 2), "conector")
    for dim, pos in [((W - 1.0, 0.8, 0.8), (0, 1.6, 0.9)), ((W - 1.0, 0.8, 0.8), (0, 1.6, H - 0.9)),
                     ((0.8, 0.8, H - 1.0), (-W / 2 + 0.9, 1.6, H / 2)), ((0.8, 0.8, H - 1.0), (W / 2 - 0.9, 1.6, H / 2))]:
        caja(dim, pos, "goma")
    for z in (25.0, 50.0, 75.0):
        caja((W - 8.0, 4.0, 0.4), (0, 3.2, z), "conector")
        caja((W - 8.0, 0.3, 4.0), (0, 5.0, z + 2.0), "vidrio")
    caja((2.0, 2.5, 30.0), (W / 2 - 4.0, -3.8, H * 0.55), "metal", bisel=0.4)
    return armar("puerta")


def puerta_ojo_de_buey():
    """Puerta de lavarropas de carga frontal: aro con el vidrio abombado, la manija y la bisagra."""
    R = 22.0
    aro = cilindro(R, 4.0, (0, 0, R), seg=48, eje="y", bisel=0.5)
    restar(aro, cilindro(R - 5.0, 6.0, (0, 0, R), mat=None, seg=48, eje="y"))
    cilindro(R - 4.5, 1.0, (0, 0.5, R), "vidrio", seg=48, eje="y")
    esfera(R - 5.0, (0, 2.0, R), "vidrio", escala=(1, 0.35, 1), seg=32, anillos=12)
    caja((3.0, 2.5, 8.0), (R - 3.0, -2.8, R), "plastico", bisel=0.4)
    caja((3.0, 3.0, 9.0), (-R - 1.0, 0, R), "plastico", bisel=0.3)
    return armar("puerta@ojo_de_buey", EQUIPOS_LAVARROPAS)


# ---------- Electrodomésticos: carcasas por forma (variantes de `carcasa`) ----------
# Huecas y abiertas donde hace falta: en la app son translúcidas para ver lo de adentro.

def carcasa_heladera():
    """Gabinete de heladera: caja alta abierta adelante, divisor del freezer, estantes, compartimento del compresor y patas."""
    W, P, H, z0 = 60.0, 65.0, 170.0, 2.0
    gab = caja((W, P, H), (0, 0, z0 + H / 2), bisel=0.8)
    restar(gab, caja((W - 1.6, P, H - 1.6), (0, -1.0, z0 + H / 2), mat=None), caja((W - 4.0, 20.0, 25.0), (0, P / 2 - 9.0, z0 + 12.5), mat=None))
    caja((W - 1.6, P - 2.0, 4.0), (0, -1.0, z0 + H * 0.7), "conector")
    for z in (40.0, 70.0, 95.0):
        caja((W - 3.0, P - 8.0, 0.4), (0, -2.0, z0 + z), "vidrio")
    caja((W - 2.0, 0.5, 8.0), (0, -P / 2 + 0.5, z0 + 5.0), "plastico")
    for i in range(10):
        caja((4.0, 0.1, 0.6), (-W / 2 + 5.0 + i * 5.5, -P / 2 + 0.22, z0 + 5.0), "ranura")
    for sx in (-1, 1):
        for sy in (-1, 1):
            cilindro(1.2, z0, (sx * (W / 2 - 4.0), sy * (P / 2 - 4.0), z0 / 2), "plastico", seg=16)
        caja((6.0, 6.0, 1.0), (sx * (W / 2 - 3.0), -P / 2 + 3.0, z0 + H + 0.5), "plastico")
    return armar("carcasa@heladera", EQUIPOS_HELADERA)


def carcasa_split():
    """Unidad interior de aire split: gabinete redondeado con la boca de salida abajo, aleta, rejilla arriba, display y placa de pared."""
    W, P, H = 80.0, 20.0, 28.0
    gab = prisma(redondeado(W, P, 3.0, 6), H, (0, 0, H / 2), bisel=1.0)
    rejilla = [("caja", (W - 12.0, 0.5, 2.0), (0, -P / 2 + 3.0 + i * 1.3, H)) for i in range(8)]
    restar(gab, prisma(redondeado(W - 1.2, P - 1.2, 2.4, 6), H - 1.2, (0, 0, H / 2), mat=None),
           caja((W - 10.0, 7.0, 6.0), (0, -P / 2 + 3.0, 2.5), mat=None), varios(rejilla))
    girar(caja((W - 11.0, 4.5, 0.3), (0, -P / 2 + 3.0, 1.2), "plastico"), (math.radians(-25), 0, 0))
    caja((6.0, 0.1, 1.2), (W / 2 - 12.0, -P / 2 - 0.02, 8.0), "vidrio")
    caja((W - 10.0, 0.3, H - 6.0), (0, P / 2 + 0.2, H / 2), "metal")
    return armar("carcasa@split", EQUIPOS_SPLIT)


def carcasa_televisor():
    """Carcasa de televisor: marco frontal, tapa trasera con la joroba, rejillas, zona de puertos y patas."""
    W, P, H, z0 = 100.0, 6.0, 60.0, 6.0
    bisel_f = caja((W, 1.2, H), (0, -P / 2 + 0.6, z0 + H / 2), "plastico", bisel=0.2)
    restar(bisel_f, caja((W - 1.4, 2.0, H - 1.4), (0, -P / 2 + 0.6, z0 + H / 2), mat=None))
    caja((W - 0.4, 0.6, H - 0.4), (0, -P / 2 + 1.5, z0 + H / 2))
    caja((W - 20.0, P - 1.8, H - 20.0), (0, 0.9, z0 + H / 2), bisel=1.5)
    for i in range(12):
        caja((0.6, 0.1, 8.0), (-20.0 + i * 1.5, P / 2 + 0.01, z0 + H - 18.0), "ranura")
    caja((12.0, 0.3, 8.0), (W / 2 - 18.0, P / 2 - 0.1, z0 + 16.0), "ranura")
    for sx in (-1, 1):
        caja((2.5, 18.0, 0.8), (sx * 35.0, -1.0, 0.4), "plastico", bisel=0.2)
        caja((2.5, 2.0, z0), (sx * 35.0, -1.0, z0 / 2 + 0.4), "plastico")
    return armar("carcasa@televisor", EQUIPOS_TV)


def carcasa_lavarropas():
    """Gabinete de lavarropas de carga frontal: caja hueca con la boca redonda, panel de control, cajón de jabón y patas."""
    W, P, H, z0 = 60.0, 58.0, 85.0, 1.5
    zb = z0 + H * 0.42
    gab = caja((W, P, H), (0, 0, z0 + H / 2), bisel=0.8)
    restar(gab, caja((W - 1.6, P - 1.6, H - 1.6), (0, 0, z0 + H / 2), mat=None), cilindro(17.0, 4.0, (0, -P / 2, zb), mat=None, seg=48, eje="y"))
    anillo = cilindro(19.0, 0.8, (0, -P / 2 - 0.3, zb), "metal", seg=48, eje="y")
    restar(anillo, cilindro(17.0, 2.0, (0, -P / 2 - 0.3, zb), mat=None, seg=48, eje="y"))
    caja((W - 1.0, 1.0, 11.0), (0, -P / 2 - 0.3, z0 + H - 6.0), "conector")
    cilindro(2.5, 1.4, (W / 2 - 9.0, -P / 2 - 1.4, z0 + H - 6.0), "metal", seg=32, eje="y", bisel=0.2)
    caja((14.0, 1.2, 8.0), (-W / 2 + 9.0, -P / 2 - 0.5, z0 + H - 6.0), "plastico", bisel=0.2)
    caja((10.0, 0.3, 8.0), (W / 2 - 8.0, -P / 2 - 0.1, z0 + 6.0), "plastico")
    for sx in (-1, 1):
        for sy in (-1, 1):
            cilindro(1.5, z0, (sx * (W / 2 - 4.0), sy * (P / 2 - 4.0), z0 / 2), "goma", seg=16)
    return armar("carcasa@lavarropas", EQUIPOS_LAVARROPAS)


def carcasa_microondas():
    """Gabinete de microondas: caja con la cavidad abierta adelante, columna de control, plato giratorio, rejillas y patas."""
    W, P, H, z0 = 48.0, 36.0, 28.0, 0.8
    gab = caja((W, P, H), (0, 0, z0 + H / 2), bisel=0.5)
    restar(gab, caja((W - 14.0, P - 2.0, H - 4.0), (-5.0, -2.0, z0 + H / 2), mat=None))
    caja((11.0, 0.6, H - 2.0), (W / 2 - 6.5, -P / 2 - 0.2, z0 + H / 2), "plastico")
    caja((7.0, 0.1, 2.0), (W / 2 - 6.5, -P / 2 - 0.52, z0 + H - 5.0), "vidrio")
    for i in range(3):
        for j in range(4):
            cilindro(0.6, 0.3, (W / 2 - 9.0 + i * 2.5, -P / 2 - 0.6, z0 + H - 9.0 - j * 2.3), "conector", seg=16, eje="y")
    cilindro(1.8, 1.2, (W / 2 - 6.5, -P / 2 - 1.0, z0 + 5.0), "metal", seg=28, eje="y", bisel=0.15)
    cilindro(12.0, 0.4, (-5.0, -2.0, z0 + 2.4), "vidrio", seg=40)
    for i in range(10):
        caja((0.1, 6.0, 0.6), (W / 2 + 0.01, 4.0, z0 + 6.0 + i * 1.6), "ranura")
    for sx in (-1, 1):
        for sy in (-1, 1):
            cilindro(1.0, z0, (sx * (W / 2 - 3.0), sy * (P / 2 - 3.0), z0 / 2), "goma", seg=12)
    return armar("carcasa@microondas", EQUIPOS_MICROONDAS)


# Cada familia es un GLB aparte (public/models/piezas/<familia>.glb): el visor baja solo las que usa el plano.
FAMILIAS = {
    "computo": [
        base, tapa_inferior, placa_madre, disipador, heatpipe, ram, ssd, wifi, pila, bateria, disco_duro, soporte,
        pantalla, bateria_celular, camara, camara_modulo, marco, tapa_trasera,
    ],
    "electronica": [
        placa_compacta, placa_control, fuente, capacitor, capacitor_motor, transformador, panel,
        parlante, parlante_celular, conector, conector_usb_c, conector_terminal, pantalla_panel, retroiluminacion, tira_led,
    ],
    "movimiento": [ventilador, ventilador_axial, ventilador_tangencial, turbina_centrifuga, motor, bomba, correa, tambor, compresor],
    "frio_calor": [serpentin, condensador_heladera, evaporador, termostato, resistencia, valvula],
    "estructura": [
        tornillo, manguera, filtro, filtro_cartucho, cable, cable_redondo, bisagra, bisagra_puerta, puerta, puerta_ojo_de_buey,
        bandeja, bandeja_goteo, bandeja_estante,
    ],
    "carcasas": [carcasa_heladera, carcasa_split, carcasa_televisor, carcasa_lavarropas, carcasa_microondas],
}

# Cómo se ajusta cada forma a las medidas del plano (va al GLB como `extras.ajuste` y a indice.json).
# La forma es de acá; dónde va y cuánto lugar ocupa lo dice el plano. Ejes del modelo en el GLB:
# x derecha, y arriba, z hacia el frente (Blender X, Z y -Y). Reglas (lib/planogenerator/biblioteca.ts):
#   libre          se estira por eje (cajas que de verdad cambian de proporción: placas, baterías, carcasas)
#   proporcional   escala igual en los tres ejes y se centra en el lugar del plano (no se deforma nada)
#   redondo:ab     los ejes a y b escalan igual (lo redondo sigue redondo); el tercero, libre
#   tramo:a        se estira solo el medio a lo largo del eje a (las puntas no se deforman);
#                  `tramo:a:redondo`: además, la sección (los otros dos ejes) escala igual
# Se busca por nombre exacto (variante), después por el tipo; un alias usa la regla de su forma.
AJUSTES = {
    "ventilador": "redondo:xz",
    "ventilador@axial": "redondo:xz",
    "ventilador@tangencial": "tramo:x:redondo",
    "turbina@centrifuga": "redondo:yz",  # jaula de ardilla: redonda vista de costado, el ancho es libre
    "tornillo": "redondo:xz",
    "pila": "redondo:xz",
    "disipador": "redondo:xz",
    "capacitor": "redondo:xz",
    "compresor": "redondo:xz",
    "filtro@cartucho": "redondo:xz",
    "tambor": "redondo:xy",
    "puerta@ojo_de_buey": "redondo:xy",
    "camara": "proporcional",
    "conector": "proporcional",
    "motor": "proporcional",
    "bomba": "proporcional",
    "termostato": "proporcional",
    "valvula": "proporcional",
    "transformador": "proporcional",
    "bisagra@puerta": "proporcional",
    "cable": "tramo:x",
    "heatpipe": "tramo:x",
    "manguera": "tramo:x",
    "resistencia": "tramo:x",
    "bisagra": "tramo:x",
    "tira_led": "tramo:x",  # la barra se alarga; las lentes se mueven enteras (no se estiran)
}


def ajuste_de(nombre, de=None):
    """La regla de ajuste de un tipo o variante (ver AJUSTES)."""
    if nombre in AJUSTES:
        return AJUSTES[nombre]
    if de:
        return ajuste_de(de)
    return AJUSTES.get(nombre.split("@")[0], "libre")


# Variantes que son la misma forma que otro tipo (comparten mallas): (nombre, de, familia, equipos, descripción).
ALIAS = [
    ("placa_madre@celular", "placa", "computo", EQUIPOS_CELULAR, "Placa madre de celular: la misma placa compacta en L."),
    ("condensador@aletas", "serpentin", "frio_calor", EQUIPOS_SPLIT, "Condensador de aletas (unidad exterior de aire): la forma del serpentín."),
    ("condensador@electrolitico", "capacitor", "frio_calor", None, "Condensador electrónico (capacitor): la forma del capacitor electrolítico."),
    ("evaporador@aletas", "serpentin", "frio_calor", None, "Evaporador de aletas (heladera no frost, aire split): la forma del serpentín."),
    ("turbina", "ventilador@tangencial", "movimiento", EQUIPOS_SPLIT, "Turbina tangencial (unidad interior de aire split): la misma jaula larga de álabes."),
    ("estante", "bandeja@estante", "estructura", None, "Estante de heladera: vidrio templado con perfil de plástico adelante y atrás."),
]


# ---------- Exportar y renders de revisión ----------

def exportar(archivo, vacios):
    """Exporta solo esos tipos (y sus mallas) a un GLB."""
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for v in vacios:
        v.select_set(True)
        for c in v.children:
            c.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=archivo,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_materials="EXPORT",
        export_texcoords=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,  # solo los nodos de tipo llevan propiedades (`equipos`, `ajuste`)
    )


def descripcion(texto):
    return " ".join((texto or "").split())


def caja_mundo(vacio):
    pts = [o.matrix_world @ v.co for o in vacio.children for v in o.data.vertices]
    mn = [min(p[i] for p in pts) for i in range(3)]
    mx = [max(p[i] for p in pts) for i in range(3)]
    return mn, mx


def renders(carpeta, grupos):
    """Un render por pieza + una hoja por familia (cada pieza escalada a su celda de la grilla)."""
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

    def encuadrar(centro, escala, ancho, alto, elevacion=38, azimut=-35):
        cam_d.type = "ORTHO"
        cam_d.ortho_scale = escala
        el, az = math.radians(elevacion), math.radians(azimut)
        dirx, diry, dirz = math.cos(el) * math.sin(az), -math.cos(el) * math.cos(az), math.sin(el)
        cam.location = (centro[0] + dirx * 400, centro[1] + diry * 400, centro[2] + dirz * 400)
        direccion = Vector((-dirx, -diry, -dirz))
        cam.rotation_euler = direccion.to_track_quat("-Z", "Y").to_euler()
        cam_d.clip_end = 2000
        escena.render.resolution_x, escena.render.resolution_y = ancho, alto

    todos = [v for vs in grupos.values() for v in vs]

    def mostrar(visibles):
        for v in todos:
            for o in [v] + list(v.children):
                o.hide_render = v not in visibles

    for v in todos:
        mostrar([v])
        mn, mx = caja_mundo(v)
        centro = [(a + b) / 2 for a, b in zip(mn, mx)]
        encuadrar(centro, max(mx[i] - mn[i] for i in range(3)) * 1.15, 900, 700)
        escena.render.filepath = os.path.join(carpeta, f"{v.name}.png")
        bpy.ops.render.render(write_still=True)

    # Hojas: cada pieza escalada para que su lado mayor mida 7, en una celda de 10.
    textos = []
    for familia, vacios in grupos.items():
        mostrar(vacios)
        for t in textos:
            t.hide_render = True
        columnas = min(5, len(vacios))
        for i, v in enumerate(vacios):
            v.scale = (1, 1, 1)
            v.location = (0, 0, 0)
            bpy.context.view_layer.update()
            mn, mx = caja_mundo(v)
            s = 7.0 / max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2])
            centro = [(a + b) / 2 for a, b in zip(mn, mx)]
            fila, col = divmod(i, columnas)
            v.scale = (s, s, s)
            v.location = (col * 10 - centro[0] * s, -fila * 10 - centro[1] * s, -mn[2] * s)
            c = bpy.data.curves.new(f"t_{v.name}", "FONT")
            c.body = v.name
            c.size = 0.9
            c.align_x = "CENTER"
            t = bpy.data.objects.new(f"t_{v.name}", c)
            t.location = (col * 10, -fila * 10 - 4.6, 0)
            t.data.materials.append(material("etiqueta"))
            escena.collection.objects.link(t)
            textos.append(t)
        bpy.context.view_layer.update()
        filas = math.ceil(len(vacios) / columnas)
        centro = ((columnas - 1) * 5, -(filas - 1) * 5 - 1.5, 0)
        encuadrar(centro, max(columnas * 10.5, filas * 16.0), 2400, 1500, elevacion=55, azimut=0)
        escena.render.filepath = os.path.join(carpeta, f"hoja_{familia}.png")
        bpy.ops.render.render(write_still=True)


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--salida", default="public/models/piezas", help="carpeta: un GLB por familia + indice.json")
    p.add_argument("--renders")
    args = p.parse_args(argv)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    grupos, tipos = {}, {}
    for familia, hacer in FAMILIAS.items():
        grupos[familia] = []
        for f in hacer:
            v = f()
            v["ajuste"] = ajuste_de(v.name)
            grupos[familia].append(v)
            tipos[v.name] = {"familia": familia, "descripcion": descripcion(f.__doc__), "equipos": v.get("equipos", ""), "ajuste": v["ajuste"]}
    por_nombre = {v.name: v for vs in grupos.values() for v in vs}
    for nombre, de, familia, equipos, texto in ALIAS:
        v = alias(nombre, por_nombre[de], equipos)
        v["ajuste"] = ajuste_de(nombre, de)
        grupos[familia].append(v)
        tipos[nombre] = {"familia": familia, "descripcion": texto, "equipos": equipos or "", "ajuste": v["ajuste"]}

    os.makedirs(args.salida, exist_ok=True)
    familias = {}
    for familia, vacios in grupos.items():
        archivo = os.path.join(args.salida, f"{familia}.glb")
        exportar(archivo, vacios)
        familias[familia] = f"{familia}.glb"
        print(f"Exportado {archivo}: {os.path.getsize(archivo) / 1024:.0f} KB, {len(vacios)} tipos")
    with open(os.path.join(args.salida, "indice.json"), "w", encoding="utf-8") as f:
        json.dump({"familias": familias, "tipos": tipos}, f, ensure_ascii=False, indent=1)
        f.write("\n")
    if args.renders:
        renders(args.renders, grupos)


main()
