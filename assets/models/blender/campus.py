"""Faltantes cercanos al jurado: baño, reloj de pared, iluminación y aula.
Formas genéricas en cm, sin especificaciones de repuestos ni instrucciones de intervención.
"""
import argparse
import math
from pathlib import Path
import runpy
import sys

BASE = runpy.run_path(str(Path(__file__).with_name("cotidianos.py")), run_name="herramientas_campus")
CORE, bpy = BASE["CORE"], BASE["bpy"]
caja, cilindro, prisma, restar, varios, tubo, esfera, girar, redondeado = (
    CORE[n] for n in ("caja", "cilindro", "prisma", "restar", "varios", "tubo", "esfera", "girar", "redondeado"))
FAMILIA = "campus"
EQUIPOS = {
    "canilla": "canilla grifo lavabo lavatorio mezcladora bano",
    "lavatorio": "lavatorio lavabo pileta desague sifon bano",
    "cisterna": "cisterna mochila inodoro descarga bano",
    "reloj_pared": "reloj_pared reloj pared analogico aula",
    "pared": "pared toma enchufe interruptor red aula",
    "luminaria": "luminaria lampara iluminacion aula led",
    "calculadora": "calculadora calculadora_cientifica bolsillo aula",
    "proyector": "proyector datashow aula",
}
PIEZAS, PALETA = [], {}


def pieza(nombre, equipos, color="#99aebb", metal=0.15, rug=0.45):
    def registrar(fn):
        PALETA["cuerpo." + nombre.split("@")[0]] = (color, metal, rug)
        def crear():
            fn()
            return CORE["armar"](nombre, " ".join(EQUIPOS[e] for e in equipos.split()))
        crear.__doc__ = fn.__doc__
        PIEZAS.append((nombre, equipos.split(), crear))
        return crear
    return registrar


def aro(r, interior, h, pos=(0, 0, 0), mat="cuerpo", eje="z"):
    o = cilindro(r, h, pos, mat, seg=28, eje=eje)
    restar(o, cilindro(interior, h + 1, pos, mat=None, seg=28, eje=eje))
    return o


@pieza("canilla", "canilla", "#b4c2cc", 0.6, 0.4)
def canilla():
    """Cuerpo genérico de canilla monocomando: base, cuerpo, pico curvo y alojamiento de cartucho. No identifica una marca ni el circuito de agua."""
    cilindro(3.3, 0.7, (0, 0, 0.35), seg=28)
    cilindro(2.5, 10, (0, 0, 5.5), seg=32, bisel=0.3)
    aro(2.6, 1.9, 0.6, (0, 0, 10.8))
    tubo([(0, 0, 8), (0, -3, 9), (0, -7, 10), (0, -10, 10), (0, -11, 8.5)], 1.2, seg=16)
    aro(1.3, 0.8, 0.5, (0, -11, 8.3), "metal")
    for x in (-1, 1):
        cilindro(0.45, 2, (x, 0, -1), "cobre", seg=16)


@pieza("manija_canilla", "canilla", "#b3c3ce", 0.6, 0.4)
def manija_canilla():
    """Manija de monocomando separada: copa inferior y palanca. No asigna sentido de apertura ni temperatura."""
    o = cilindro(2.7, 2, (0, 0, 1), seg=28, bisel=0.2)
    restar(o, cilindro(2.2, 2, (0, 0, 0.5), mat=None, seg=24))
    caja((1.4, 8, 0.8), (0, -3, 1.8), bisel=0.35)


@pieza("cartucho_canilla", "canilla", "#6d95a8", 0.05)
def cartucho_canilla():
    """Cartucho cerámico de mezcladora: cuerpo cilíndrico, vástago y juntas. Sin diámetro, caudal ni compatibilidad."""
    cilindro(1.8, 4, (0, 0, 2), seg=28)
    cilindro(1.9, 0.4, (0, 0, 3.8), "metal", seg=28)
    caja((0.8, 0.8, 2.3), (0, 0, 5), "plastico", bisel=0.1)
    for z in (0.3, 0.8):
        aro(1.85, 1.6, 0.15, (0, 0, z), "goma")
    for x in (-0.7, 0.7):
        cilindro(0.25, 0.3, (x, 0, -0.15), "goma", seg=16)


@pieza("aireador_canilla", "canilla", "#b7c5ce", 0.85)
def aireador_canilla():
    """Aireador desmontable: aro, junta y rejilla cruzada; sin rosca o caudal especificados."""
    aro(1.4, 1.05, 1.1, (0, 0, 0.55))
    aro(1.15, 0.95, 0.15, (0, 0, 1.1), "goma")
    for x in (-0.6, -0.3, 0, 0.3, 0.6):
        tubo([(x, -0.7, 0.5), (x, 0.7, 0.5)], 0.035, "metal", seg=6)
        tubo([(-0.7, x, 0.5), (0.7, x, 0.5)], 0.035, "metal", seg=6)


@pieza("valvula_cierre", "canilla lavatorio cisterna", "#a8bac8", 0.8)
def valvula_cierre():
    """Llave de paso manual en escuadra: cuerpo, dos racores y mando. Distinta de una electroválvula; sin conexión funcional."""
    cilindro(1.4, 5, (0, 0, 2.5), seg=24)
    cilindro(1, 3, (0, -2, 2.5), "metal", seg=24, eje="y")
    cilindro(1.6, 0.5, (0, 0, 5.2), "plastico", seg=24)
    caja((3.5, 0.8, 0.6), (0, 0, 5.7), "plastico", bisel=0.2)
    for z in (0.3, 0.7):
        aro(1.5, 1.15, 0.15, (0, 0, z), "metal")


@pieza("flexible_agua", "canilla lavatorio cisterna", "#a5b6c2", 0.75)
def flexible_agua():
    """Flexible de alimentación de agua: manguera en curva con dos tuercas. No indica presión, rosca o montaje."""
    tubo([(-7, 0, 1), (-6, 0, 6), (-2, 0, 9), (3, 0, 8), (6, 0, 4), (7, 0, 1)], 0.45, seg=12)
    for x in (-7, 7):
        cilindro(0.85, 1.3, (x, 0, 0.5), "metal", seg=6)
        aro(0.65, 0.35, 0.2, (x, 0, -0.2), "goma")


@pieza("desague_lavatorio", "lavatorio", "#b5c4cd", 0.85)
def desague_lavatorio():
    """Desagüe de lavatorio: brida, cuello, junta y tuerca. Sin dimensiones ni compatibilidad de instalación."""
    aro(3.2, 1.7, 0.5, (0, 0, 3.5))
    aro(1.9, 1.5, 7, (0, 0, 0))
    aro(2.6, 1.6, 0.3, (0, 0, 1.7), "goma")
    aro(2.8, 1.8, 0.9, (0, 0, 1), "metal")
    for a in range(4):
        giro = a * math.pi / 2
        caja((3, 0.15, 0.15), (0, 0, 3.5), "metal", rot_z=giro)


@pieza("sifon_lavatorio", "lavatorio", "#c2cbd1", 0.05)
def sifon_lavatorio():
    """Sifón tipo botella: vaso, cuello de entrada, salida lateral y tapa inferior. Esquema exterior, sin instrucciones de apertura."""
    cilindro(3.2, 7, (0, 0, 3.5), seg=28, bisel=0.3)
    cilindro(1.7, 5, (0, 0, 9), seg=24)
    cilindro(1.7, 8, (0, 5, 5), "plastico", seg=24, eje="y")
    cilindro(3.4, 1, (0, 0, 0.5), "plastico", seg=28)
    for z in (7.2, 11.4):
        cilindro(2.2, 0.8, (0, 0, z), "plastico", seg=12)


@pieza("pulsador_descarga", "cisterna", "#b8c8d3", 0.8)
def pulsador_descarga():
    """Pulsador doble de cisterna: aro, dos sectores y varillas. No representa una marca ni un volumen de descarga."""
    aro(3.2, 2.8, 0.8, (0, 0, 0.4))
    cilindro(2.7, 0.6, (0, 0, 0.5), "plastico", seg=28)
    caja((0.08, 5.2, 0.05), (0, 0, 0.83), "ranura")
    for x in (-1, 1):
        cilindro(0.2, 6, (x, 0, -3), "plastico", seg=12)


@pieza("flotante_cisterna", "cisterna", "#7b9eaf", 0.05)
def flotante_cisterna():
    """Válvula de llenado con flotante de copa y poste vertical; mecanismo genérico exterior, sin regulación indicada."""
    cilindro(0.9, 18, (0, 0, 9), "plastico", seg=20)
    cilindro(3, 5, (0, 0, 11), seg=28)
    caja((5, 3, 2), (0, 0, 18), "plastico", bisel=0.4)
    tubo([(2, 0, 18), (4, 0, 18), (4, 0, 15)], 0.35, "plastico")
    cilindro(1.6, 0.7, (0, 0, 0.3), "goma", seg=24)


@pieza("valvula_descarga", "cisterna", "#a6bac6", 0.05)
def valvula_descarga():
    """Mecanismo de descarga de cisterna: torre, aro de asiento y sello inferior. No especifica montaje ni compatibilidad."""
    aro(4, 2.7, 0.8, (0, 0, 0.4))
    aro(3.6, 2.7, 0.3, (0, 0, -0.1), "goma")
    for x in (-2, 2):
        caja((0.7, 1, 15), (x, 0, 8), "plastico", bisel=0.2)
    cilindro(2.6, 0.8, (0, 0, 3), "goma", seg=28)
    cilindro(0.4, 15, (0, 0, 10), seg=16)
    caja((5.5, 2, 1), (0, 0, 16), "plastico", bisel=0.3)


@pieza("carcasa_reloj_pared", "reloj_pared", "#7293a8", 0.1)
def carcasa_reloj_pared():
    """Caja de reloj de pared: aro frontal, tapa trasera, apoyos y abertura para mecanismo. Esfera, agujas y pila reutilizan sus tipos existentes."""
    aro(15, 13.8, 3, (0, 0, 1.5))
    o = cilindro(14.3, 0.3, (0, 0, 0.2), "plastico", seg=40)
    restar(o, caja((6, 6, 2), (0, 0, 0.2), mat=None))
    aro(14.5, 13.9, 0.3, (0, 0, 3), "metal")


@pieza("mecanismo_reloj_pared", "reloj_pared", "#566c7b", 0.1)
def mecanismo_reloj_pared():
    """Movimiento genérico de cuarzo de reloj de pared: caja, eje de agujas y alojamiento vacío para una AA. Sin engranajes calibrados."""
    caja((5.5, 5.5, 1.6), (0, 0, 0.8), bisel=0.3)
    o = caja((5.7, 1.8, 1.7), (0, -3, 0.8), "plastico", bisel=0.2)
    restar(o, caja((5, 1.4, 2), (0, -3, 1.2), mat=None))
    cilindro(0.35, 2.7, (0, 0, 2.8), "metal", seg=16)
    cilindro(0.8, 0.4, (0, 0, 1.8), "metal", seg=6)
    for x in (-2.5, 2.5):
        caja((0.15, 1, 0.6), (x, -3, 0.7), "contactos")


@pieza("placa_pared", "pared", "#c3cdd4", 0.05)
def placa_pared():
    """Marco de módulo de pared con ventana central y dos tornillos; para toma, interruptor o red, sin declarar norma."""
    o = caja((8, 12, 0.7), (0, 0, 0.35), bisel=0.5)
    restar(o, caja((4.8, 5.2, 2), (0, 0, 0.35), mat=None, bisel=0.3))
    for y in (-4.5, 4.5):
        restar(o, cilindro(0.2, 2, (0, y, 0.35), mat=None, seg=16))


@pieza("bombilla_led", "luminaria", "#d6ddd9", 0.05)
def bombilla_led():
    """Bombilla LED genérica: difusor, cuerpo de disipación y base roscada ilustrativa. Sin potencia, tensión o norma de rosca."""
    esfera(3, (0, 0, 6.5), escala=(1, 1, 1.1), seg=28)
    cilindro(1.5, 3, (0, 0, 3.5), r_arriba=2.9, seg=28)
    cilindro(1.3, 2, (0, 0, 1), "metal", seg=24)
    for z in (0.3, 0.7, 1.1, 1.5):
        cilindro(1.4, 0.12, (0, 0, z), "metal", seg=24)
    cilindro(0.5, 0.2, (0, 0, -0.15), "contactos", seg=16)


@pieza("difusor_luminaria", "luminaria", "#c5d6df", 0.05)
def difusor_luminaria():
    """Difusor rectangular de luminaria de aula con marco y pestañas. La fuente y las tiras LED se reutilizan por nombre."""
    caja((60, 30, 0.6), (0, 0, 0.3), bisel=0.7)
    o = caja((61, 31, 1), (0, 0, 0.2), "metal", bisel=0.5)
    restar(o, caja((59, 29, 2), (0, 0, 0.2), mat=None, bisel=0.4))
    for x in (-27, 27):
        caja((2, 1.5, 0.2), (x, 16, 0), "plastico")


@pieza("carcasa_calculadora", "calculadora", "#66869a", 0.1)
def carcasa_calculadora():
    """Carcasa genérica de calculadora con ventana LCD y alojamiento de teclado. Sin marca ni distribución de un modelo."""
    o = caja((8, 15, 1.2), (0, 0, 0.6), bisel=0.7)
    restar(o, caja((6.5, 3.2, 2), (0, 4.8, 0.6), mat=None, bisel=0.2))
    restar(o, caja((6.5, 8.5, 2), (0, -2.2, 0.6), mat=None, bisel=0.2))
    caja((7, 14, 0.2), (0, 0, 0.1), "plastico", bisel=0.5)


@pieza("teclado_calculadora", "calculadora", "#a7bbc8", 0.05)
def teclado_calculadora():
    """Matriz de botones de calculadora con membrana inferior, sin leyendas ni funciones asignadas."""
    caja((6.5, 8.5, 0.1), (0, 0, 0.1), "goma", bisel=0.3)
    for x in (-2.4, -0.8, 0.8, 2.4):
        for y in (-3.3, -1.65, 0, 1.65, 3.3):
            caja((1.2, 1.1, 0.5), (x, y, 0.4), bisel=0.15)


@pieza("pantalla@segmentos", "calculadora", "#8daba5", 0.05)
def pantalla_segmentos():
    """Módulo LCD rectangular de calculadora con marco y banda de contacto. Sin cifras, mediciones o funciones de un equipo real."""
    caja((6.5, 3, 0.3), (0, 0, 0.2), "metal", bisel=0.2)
    caja((5.8, 2.4, 0.05), (0, 0, 0.38), bisel=0.1)
    caja((5.5, 0.3, 0.2), (0, -1.6, 0.15), "goma")
    for x in range(16):
        caja((0.12, 0.25, 0.02), (-2.3 + x * 0.3, -1.65, 0.28), "contactos")


@pieza("carcasa_proyector", "proyector", "#a9bdca", 0.1)
def carcasa_proyector():
    """Gabinete genérico de proyector de aula: abertura de lente, ventilaciones, patas y tapa superior. Lente, placa, luz y ventilador se reutilizan."""
    o = caja((28, 22, 9), (0, 0, 4.5), bisel=1)
    restar(o, caja((26, 20, 10), (0, 0, 3), mat=None, bisel=0.8))
    restar(o, cilindro(3.7, 5, (-6, -10, 4.5), mat=None, seg=28, eje="y"))
    restar(o, varios([("caja", (3, 0.5, 4), (13, y, 4.5)) for y in range(-7, 8, 2)]))
    for x in (-10, 10):
        for y in (-7, 7):
            cilindro(1, 0.7, (x, y, -0.2), "goma", seg=16)
    caja((7, 3, 0.1), (4, 2, 9.05), "plastico", bisel=0.4)


@pieza("agujas_reloj@pared", "reloj_pared", "#b9cbd7", 0.8)
def agujas_reloj_pared():
    """Agujas delgadas de reloj de pared: mayor longitud respecto del eje que las de pulsera. Forma genérica, sin hora o precisión asignada."""
    prisma([(-0.15, -0.5), (0.15, -0.5), (0.12, 10.5), (0, 12), (-0.12, 10.5)], 0.05, (0, 0, 0.1))
    corta = prisma([(-0.22, -0.4), (0.22, -0.4), (0.15, 7), (0, 8), (-0.15, 7)], 0.06, (0, 0, 0.15), "metal")
    girar(corta, (0, 0, -1.1))
    cilindro(0.3, 0.2, (0, 0, 0.12), "metal", seg=20)


def renderizar(carpeta, vacios, seleccion=None):
    """Renders encuadrados por límites proyectados, incluidos componentes muy pequeños."""
    carpeta = Path(carpeta)
    carpeta.mkdir(parents=True, exist_ok=True)
    escena = bpy.context.scene
    escena.render.engine = "BLENDER_EEVEE"
    escena.render.image_settings.file_format = "JPEG"
    escena.render.image_settings.color_mode = "RGB"
    escena.render.image_settings.quality = 88
    escena.view_settings.view_transform = "AgX"
    mundo = bpy.data.worlds.new("estudio_campus")
    mundo.use_nodes = True
    mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (0.02, 0.025, 0.03, 1)
    mundo.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
    escena.world = mundo
    for nombre, energia, rot in [("principal", 3, (0.55, -0.4, -0.5)), ("relleno", 1.7, (0.9, 0.5, 2.1)), ("borde", 1.2, (-0.5, 0.2, 0))]:
        luz = bpy.data.lights.new(nombre, "SUN")
        luz.energy = energia
        luz.angle = 0.12
        obj = bpy.data.objects.new(nombre, luz)
        obj.rotation_euler = rot
        escena.collection.objects.link(obj)
    datos = bpy.data.cameras.new("camara_campus")
    datos.type = "ORTHO"
    datos.clip_start = 0.01
    datos.clip_end = 4000
    cam = bpy.data.objects.new("camara_campus", datos)
    escena.collection.objects.link(cam)
    escena.camera = cam
    Vector = CORE["Vector"]
    etiquetas = []

    def visibles(grupo):
        for v in vacios:
            for obj in [v] + list(v.children):
                obj.hide_render = v not in grupo
        for t in etiquetas:
            t.hide_render = True

    def puntos(objetos):
        return [o.matrix_world @ Vector(p) for o in objetos for p in o.bound_box if o.type in ("MESH", "FONT")]

    def encuadrar(objetos, ancho=900, alto=700, elevacion=35, azimut=-35):
        bpy.context.view_layer.update()
        pts = puntos(objetos)
        mn = Vector(tuple(min(p[i] for p in pts) for i in range(3)))
        mx = Vector(tuple(max(p[i] for p in pts) for i in range(3)))
        centro = (mn + mx) / 2
        el, az = math.radians(elevacion), math.radians(azimut)
        direccion = Vector((math.cos(el) * math.sin(az), -math.cos(el) * math.cos(az), math.sin(el)))
        cam.location = centro + direccion * (max(mx - mn) * 4 + 20)
        cam.rotation_euler = (-direccion).to_track_quat("-Z", "Y").to_euler()
        bpy.context.view_layer.update()
        inv = cam.matrix_world.inverted()
        locales = [inv @ p for p in pts]
        W = max(p.x for p in locales) - min(p.x for p in locales)
        H = max(p.y for p in locales) - min(p.y for p in locales)
        datos.ortho_scale = max(W, H * ancho / alto) / min(1, ancho / alto) * 1.22
        cx = (max(p.x for p in locales) + min(p.x for p in locales)) / 2
        cy = (max(p.y for p in locales) + min(p.y for p in locales)) / 2
        cam.location += cam.rotation_euler.to_quaternion() @ Vector((cx, cy, 0))
        escena.render.resolution_x, escena.render.resolution_y = ancho, alto
        escena.render.resolution_percentage = 100

    for v in vacios:
        if seleccion is not None and v.name not in seleccion:
            continue
        visibles([v])
        encuadrar(list(v.children))
        escena.render.filepath = str(carpeta / (v.name + ".jpg"))
        bpy.ops.render.render(write_still=True)

    # Una hoja por equipo: las piezas compartidas aparecen en los equipos aplicables.
    for clave in list(EQUIPOS):
        grupo = [v for v in vacios if clave in v.get("equipos", "").split()]
        visibles(grupo)
        hojas = []
        for i, v in enumerate(grupo):
            v.location = (0, 0, 0)
            v.scale = (1, 1, 1)
            bpy.context.view_layer.update()
            mn, mx = CORE["caja_mundo"](v)
            escala = 5.5 / max(mx[j] - mn[j] for j in range(3))
            centro = [(a + b) / 2 for a, b in zip(mn, mx)]
            fila, col = divmod(i, 3)
            v.scale = (escala, escala, escala)
            v.location = (col * 10 - centro[0] * escala, -fila * 11 - centro[1] * escala, -mn[2] * escala)
            texto = bpy.data.curves.new("nombre_" + v.name, "FONT")
            texto.body = v.name.replace("_", " ")
            texto.size = min(0.6, 8 / len(texto.body))
            texto.align_x = "CENTER"
            obj = bpy.data.objects.new(texto.name, texto)
            obj.location = (col * 10, -fila * 11 - 4, 0)
            texto.materials.append(CORE["material"]("etiqueta"))
            escena.collection.objects.link(obj)
            etiquetas.append(obj)
            hojas.append(obj)
        ancho, alto = 1500, max(700, math.ceil(len(grupo) / 3) * 470)
        encuadrar([o for v in grupo for o in v.children] + hojas, ancho, alto, elevacion=65, azimut=0)
        escena.render.filepath = str(carpeta / ("hoja_" + clave + ".jpg"))
        bpy.ops.render.render(write_still=True)
        # Deshacer la exposición para el siguiente equipo compartido.
        for v in grupo:
            v.location = (0, 0, 0)
            v.scale = (1, 1, 1)
        bpy.context.view_layer.update()



def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--salida", default="public/models/piezas")
    parser.add_argument("--renders")
    parser.add_argument("--render-piezas", help="IDs separados por comas; hojas por equipo siempre")
    args = parser.parse_args(argv)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    CORE["COLORES"].update(PALETA)
    vacios, tipos = [], {}
    for nombre, equipos, crear in PIEZAS:
        if nombre not in CORE["AJUSTES"]:
            raise ValueError("Falta regla explícita AJUSTES: " + nombre)
        v = crear()
        v["ajuste"] = CORE["ajuste_de"](nombre)
        vacios.append(v)
        tipos[nombre] = {"familia": FAMILIA, "descripcion": CORE["descripcion"](crear.__doc__),
                         "equipos": v["equipos"], "ajuste": v["ajuste"]}
    BASE["BASE"]["cerrar_cuerpos"](vacios)
    salida = Path(args.salida)
    salida.mkdir(parents=True, exist_ok=True)
    CORE["exportar"](str(salida / (FAMILIA + ".glb")), vacios)
    CORE["actualizar_indice"](str(salida / "indice.json"), {FAMILIA: FAMILIA + ".glb"}, tipos)
    print(f"Familia {FAMILIA}: {len(vacios)} tipos; {(salida / (FAMILIA + '.glb')).stat().st_size} bytes")
    if args.renders:
        renderizar(args.renders, vacios, args.render_piezas.split(",") if args.render_piezas is not None else None)


if __name__ == "__main__":
    main()
