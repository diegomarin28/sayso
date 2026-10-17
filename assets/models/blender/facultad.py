"""Formas genéricas faltantes de equipos de facultad. No son planos de un modelo comercial.

blender -b --factory-startup --python assets/models/blender/facultad.py -- \
  --salida public/models/piezas --renders assets/models/blender/renders/facultad
Solo escribe facultad.glb y su sección del índice. Sin APIs ni claves.
"""
import argparse
import math
from pathlib import Path
import runpy
import sys

BASE = runpy.run_path(str(Path(__file__).with_name("dispositivos.py")), run_name="biblioteca_dispositivos")
CORE = BASE["CORE"]
bpy = CORE["bpy"]
caja, cilindro, prisma, restar, varios, tubo, esfera, girar, redondeado = (
    CORE[n] for n in ("caja", "cilindro", "prisma", "restar", "varios", "tubo", "esfera", "girar", "redondeado"))
FAMILIA = "facultad"
EQUIPOS = {
    "macbook_air": "macbook_air macbook air apple silicon notebook laptop portatil",
    "macbook_pro": "macbook_pro macbook pro apple silicon notebook laptop portatil",
    "imac": "imac apple aio escritorio",
    "monitor": "monitor display pantalla",
    "iphone": "iphone apple celular telefono smartphone movil",
    "samsung": "samsung galaxy celular telefono smartphone movil",
    "televisor": "televisor tv led",
    "proyector": "proyector projector datashow beamer",
    "impresora": "impresora printer multifuncion laser",
    "mouse": "mouse raton periferico",
    "teclado": "teclado keyboard periferico",
    "joystick": "joystick mando gamepad controlador",
    "parlante_pc": "parlante_pc parlante altavoz bocina pc computadora",
    "cargador_notebook": "cargador_notebook cargador notebook laptop adaptador",
    "zapatilla": "zapatilla regleta alargue extension electrica",
}
PIEZAS, PALETA = [], {}


def pieza(nombre, equipos, color="#677b8a", metal=0.2, rug=0.45):
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
    o = cilindro(r, h, pos, mat, seg=32, eje=eje)
    restar(o, cilindro(interior, h + 1, pos, mat=None, seg=32, eje=eje))
    return o


def flex(ancho, largo, pos):
    x, y, z = pos
    caja((ancho, largo, 0.035), pos, "cobre")
    caja((ancho, 0.3, 0.05), (x, y + largo / 2, z + 0.02), "contactos")


def placa(w, d, z=0.1, mat="cuerpo"):
    o = caja((w, d, 0.12), (0, 0, z), mat, bisel=0.15)
    pts = [(x, y, z) for x in (-w / 2 + 0.35, w / 2 - 0.35) for y in (-d / 2 + 0.35, d / 2 - 0.35)]
    restar(o, varios([("cil", (0.12, 0.8), p) for p in pts]))
    return o


@pieza("bateria@celdas_pegadas", "macbook_air macbook_pro", "#3c454d", 0.1)
def bateria_celdas_pegadas():
    """Conjunto genérico de seis celdas pouch adheridas, con lengüetas de adhesivo y placa de protección. No representa una batería exacta de Air o Pro."""
    for x in (-8.5, 0, 8.5):
        for y in (-3.5, 3.5):
            prisma(redondeado(7.5, 6, 0.35), 0.45, (x, y, 0.25), bisel=0.05)
            caja((5, 3.8, 0.01), (x, y, 0.48), "etiqueta", bisel=0.1)
            caja((0.65, 1.2, 0.03), (x, y - 3.5, 0.03), "goma")
    caja((24, 0.8, 0.15), (0, 0, 0.3), "pcb")
    flex(1.3, 2, (11, 1.3, 0.35))


@pieza("placa_logica_integrada", "macbook_air macbook_pro imac", "#275e53", 0.15)
def placa_logica_integrada():
    """Placa lógica compacta con SoC, memorias soldadas y puertos; sin zócalos de RAM ni módulos SSD removibles. Disposición ilustrativa, no de un Mac específico."""
    contorno = [(-9, -2.8), (9, -2.8), (9, 2.8), (3, 2.8), (3, 1.2), (-2, 1.2), (-2, 2.8), (-9, 2.8)]
    o = prisma(contorno, 0.12, (0, 0, 0.1))
    restar(o, varios([("cil", (0.14, 1), (x, y, 0.1)) for x, y in [(-8.4, -2.2), (8.4, -2.2), (-8.4, 2.2), (8.4, 2.2)]]))
    caja((3.3, 3, 0.25), (-3, -0.5, 0.3), "chip", bisel=0.1)
    for x in (1, 3, 5, 7):
        caja((1.4, 1.4, 0.15), (x, -0.8, 0.25), "chip", bisel=0.03)
    for x in (-7.5, -5, 6.5):
        caja((1.3, 0.7, 0.3), (x, 2.3, 0.3), "metal", bisel=0.1)
    for x in range(-7, 8):
        caja((0.3, 0.15, 0.08), (x, -2.1, 0.23), "metal")
    flex(2, 1.3, (-5.5, -3, 0.2))


@pieza("trackpad", "macbook_air macbook_pro", "#9cabb8", 0.65, 0.3)
def trackpad():
    """Trackpad independiente: superficie lisa, soporte metálico posterior, cuatro orejas y flex."""
    prisma(redondeado(13, 8.5, 0.7), 0.22, (0, 0, 0.2))
    caja((11.8, 7.3, 0.12), (0, 0, -0.02), "metal", bisel=0.4)
    for x in (-6.1, 6.1):
        for y in (-3, 3):
            o = caja((1.3, 1, 0.1), (x, y, -0.05), "metal")
            restar(o, cilindro(0.13, 0.5, (x, y, -0.05), mat=None, seg=12))
    flex(1.8, 2.3, (0, 4.7, 0.05))


@pieza("teclado", "teclado", "#526778", 0.2)
def teclado():
    """Teclado externo genérico con matriz de teclas y barra espaciadora. No impone distribución regional."""
    caja((42, 14, 1.2), (0, 0, 0.6), bisel=0.6)
    for fila in range(5):
        for col in range(15):
            if fila == 4 and 3 <= col <= 8:
                continue
            caja((1.8, 1.8, 0.6), (-19 + col * 2.6, 5 - fila * 2.5, 1.5), "plastico", bisel=0.25)
    caja((14.8, 1.8, 0.6), (-4.7, -5, 1.5), "plastico", bisel=0.25)
    caja((0.8, 0.15, 0.12), (17, 6.9, 1), "etiqueta")


@pieza("teclado@notebook", "macbook_air macbook_pro", "#485967", 0.2)
def teclado_notebook():
    """Módulo de teclado fino de notebook con matriz de teclas y flex. Forma genérica de perfil bajo, sin marca ni distribución exacta."""
    caja((28, 10.5, 0.15), (0, 0, 0.1), "metal", bisel=0.35)
    for fila in range(5):
        for col in range(14):
            if fila == 4 and 3 <= col <= 8:
                continue
            caja((1.6, 1.45, 0.16), (-12.9 + col * 1.98, 4 - fila * 1.9, 0.28), bisel=0.18)
    caja((11.5, 1.45, 0.16), (-2, -3.6, 0.28), bisel=0.18)
    flex(2.4, 2, (0, -6, 0.1))


@pieza("soporte_monitor", "imac monitor", "#b7c2cb", 0.8, 0.3)
def soporte_monitor():
    """Pie de monitor o equipo all-in-one: base, cuello inclinado, bisagra y placa de anclaje; no implica compatibilidad VESA."""
    caja((20, 16, 0.7), (0, 0, 0.5), bisel=0.5)
    girar(caja((5, 1.4, 17), (0, 3, 9), bisel=0.5), (-0.15, 0, 0))
    cilindro(1.2, 7, (0, 4.2, 17), "metal", seg=24, eje="x")
    o = caja((8, 0.7, 8), (0, 4.5, 19), "metal", bisel=0.4)
    restar(o, varios([("caja", (0.8, 2, 0.8), (x, 4.5, z)) for x in (-2.7, 2.7) for z in (16.3, 21.7)]))


@pieza("modulo_biometrico", "iphone", "#425563", 0.35)
def modulo_biometrico():
    """Módulo frontal de profundidad/biometría ilustrativo: cámara IR, emisor y soporte con flex. No reproduce el sistema Face ID ni asegura compatibilidad."""
    caja((3.5, 0.85, 0.25), (0, 0, 0.2), "metal", bisel=0.15)
    for x, r in ((-1.15, 0.27), (0, 0.22), (1.1, 0.32)):
        cilindro(r, 0.25, (x, 0, 0.45), seg=20)
        cilindro(r * 0.7, 0.05, (x, 0, 0.6), "vidrio", seg=20)
    flex(0.7, 1.2, (0, -0.8, 0.25))


@pieza("lector_huella", "samsung", "#4c697c", 0.15)
def lector_huella():
    """Módulo genérico de lectura de huella: ventana y placa con flex. No especifica tecnología, ubicación o presencia en un modelo."""
    caja((1.2, 1.5, 0.1), (0, 0, 0.1), "pcb", bisel=0.15)
    caja((0.9, 1.1, 0.12), (0, 0, 0.2), bisel=0.2)
    caja((0.6, 0.8, 0.03), (0, 0, 0.28), "vidrio", bisel=0.1)
    flex(0.5, 1.7, (0, -1.5, 0.1))


@pieza("sensor_proximidad", "iphone samsung", "#465966", 0.1)
def sensor_proximidad():
    """Sensor frontal de proximidad/luz: dos ventanas sobre una placa pequeña con flex, sin alcance especificado."""
    caja((1.1, 0.5, 0.1), (0, 0, 0.1), "pcb")
    for x in (-0.25, 0.25):
        caja((0.35, 0.35, 0.15), (x, 0, 0.22), bisel=0.06)
        cilindro(0.1, 0.03, (x, 0, 0.32), "vidrio", seg=16)
    flex(0.4, 1, (0, -0.7, 0.1))


@pieza("motor_vibracion", "iphone samsung joystick", "#a7b5c1", 0.8)
def motor_vibracion():
    """Actuador háptico lineal ilustrativo: cápsula rectangular, orejas y flex, sin parámetros de vibración."""
    caja((3.2, 1.1, 0.5), (0, 0, 0.3), bisel=0.15)
    for x in (-1.9, 1.9):
        o = caja((0.8, 0.9, 0.12), (x, 0, 0.12), "metal", bisel=0.1)
        restar(o, cilindro(0.12, 0.5, (x, 0, 0.12), mat=None, seg=12))
    flex(0.6, 1, (0, -0.9, 0.2))


@pieza("motor_vibracion@excentrico", "samsung joystick", "#9dabb6", 0.8)
def motor_vibracion_excentrico():
    """Motor vibrador rotativo pequeño con masa excéntrica en el eje, distinto del actuador lineal."""
    cilindro(0.6, 1.6, (0, 0, 0.7), seg=24, eje="x")
    cilindro(0.12, 1.4, (1.2, 0, 0.7), "metal", seg=12, eje="x")
    prisma([(0, -0.6), (0.7, -0.6), (0.9, 0), (0.7, 0.6), (0, 0.6)], 0.8, (1.6, 0, 0.7), "metal")
    for y in (-0.2, 0.2):
        tubo([(-0.8, y, 0.7), (-1.5, y, 0.2)], 0.04, "cobre", seg=6)


@pieza("bandeja_sim", "iphone samsung", "#a7b6c2", 0.8)
def bandeja_sim():
    """Bandeja SIM extraíble: marco de una tarjeta, junta y frente con orificio de extracción. Solo para equipos que tengan bandeja física."""
    o = caja((1.6, 2.3, 0.15), (0, 0, 0.1), bisel=0.1)
    restar(o, prisma([(-0.5, -0.7), (0.3, -0.7), (0.5, -0.5), (0.5, 0.7), (-0.5, 0.7)], 0.5, (0, 0, 0.1), mat=None))
    caja((2.1, 0.2, 0.4), (0, -1.3, 0.15), "metal", bisel=0.1)
    caja((1.9, 0.1, 0.3), (0, -1.13, 0.15), "goma")
    o = caja((0.4, 0.15, 0.3), (0.75, -1.4, 0.15), "metal")
    restar(o, cilindro(0.05, 0.5, (0.75, -1.4, 0.15), mat=None, eje="y", seg=12))


@pieza("conector@lightning", "iphone", "#aabac6", 0.85)
def conector_lightning():
    """Puerto de carga de formato Lightning ilustrativo, abierto al frente con lengüeta y anclajes; no representa pinout ni compatibilidad."""
    o = caja((0.9, 0.65, 0.3), (0, 0, 0.2), bisel=0.1)
    restar(o, caja((0.68, 0.9, 0.16), (0, -0.1, 0.2), mat=None, bisel=0.05))
    caja((0.55, 0.4, 0.04), (0, 0, 0.18), "plastico")
    for x in (-0.19, -0.06, 0.06, 0.19):
        caja((0.06, 0.25, 0.02), (x, -0.1, 0.21), "contactos")
    for x in (-0.6, 0.6):
        caja((0.3, 0.5, 0.08), (x, 0, 0.06), "metal")


@pieza("placa_tcon", "televisor monitor imac", "#34695b", 0.15)
def placa_tcon():
    """Placa T-con independiente: PCB alargada, chip, blindaje y salidas de flex hacia el panel. Solo si el equipo usa módulo separado."""
    placa(15, 4)
    caja((2, 2, 0.2), (0, 0, 0.25), "chip")
    for x in (-5, 5):
        caja((3, 0.6, 0.25), (x, 1.5, 0.23), "conector")
        flex(2.5, 2, (x, 2.8, 0.15))
    caja((1.5, 0.6, 0.2), (0, -1.5, 0.22), "conector")
    for x in range(-5, 6):
        caja((0.3, 0.2, 0.08), (x, -0.8, 0.22), "metal")


@pieza("placa_principal_av", "televisor monitor proyector", "#2c6555", 0.15)
def placa_principal_av():
    """Placa principal de audio/video: SoC, memorias, blindaje de sintonizador y puertos de señal. Genérica para distintas marcas, no de un televisor exacto."""
    placa(16, 10)
    caja((3, 3, 0.3), (-2, 0, 0.3), "chip")
    for y in (-2, 2):
        caja((1.2, 2, 0.15), (1, y, 0.22), "chip")
    caja((3, 3, 1), (5, 1, 0.7), "metal", bisel=0.15)
    for x in (-5, -2, 1):
        o = caja((2, 1.5, 0.8), (x, -4.5, 0.5), "metal", bisel=0.1)
        restar(o, caja((1.5, 2, 0.4), (x, -4.5, 0.5), mat=None))
    for x in (-5, 0, 5):
        caja((1.8, 0.6, 0.3), (x, 4.3, 0.28), "conector")


@pieza("lampara_proyector", "proyector", "#aebbc5", 0.8)
def lampara_proyector():
    """Módulo de lámpara de proyector: reflector cóncavo, cápsula central, soporte y terminales. Representación visual, sin potencia ni procedimiento de recambio."""
    o = esfera(3, (0, 0, 3), escala=(1, 1, 0.8), seg=32)
    restar(o, esfera(2.7, (0, 0, 3.2), mat=None, escala=(1, 1, 0.8), seg=32))
    restar(o, caja((8, 8, 5), (0, 0, 6.2), mat=None))
    cilindro(0.4, 3, (0, 0, 3), "vidrio", seg=20)
    caja((7.5, 7.5, 0.5), (0, 0, 0.5), "plastico", bisel=0.3)
    for x in (-3, 3):
        caja((0.5, 1, 1), (x, 0, 1), "conector")
    tubo([(0, 0, 1.5), (2, 0, 0.7), (3, 0, 1)], 0.1, "cobre")


@pieza("modulo_led_proyector", "proyector", "#b0bec7", 0.8)
def modulo_led_proyector():
    """Módulo de luz LED de proyector: emisor sobre sustrato, óptica primaria y disipador de aletas. Alternativa a lámpara, no obligatoria en todos los equipos."""
    caja((6, 6, 0.6), (0, 0, 0.4))
    for x in (-2.5, -1.5, -0.5, 0.5, 1.5, 2.5):
        caja((0.2, 6, 2), (x, 0, -0.8), "metal")
    caja((3, 3, 0.15), (0, 0, 0.8), "pcb")
    caja((1.5, 1.5, 0.1), (0, 0, 0.95), "etiqueta")
    esfera(0.8, (0, 0, 1.1), "vidrio", escala=(1, 1, 0.5), seg=24)
    for x in (-2, 2):
        caja((0.5, 0.5, 0.08), (x, 0, 0.85), "contactos")


@pieza("lente_proyector", "proyector", "#4a5d6c", 0.35)
def lente_proyector():
    """Objetivo de proyector: barril, anillos de foco y zoom, lentes y brida. Sin distancia focal asignada."""
    cilindro(3.4, 8, (0, 0, 4), seg=40)
    for z in (1, 5.5):
        cilindro(3.8, 1, (0, 0, z), "goma", seg=40)
        for i in range(32):
            a = i * math.pi / 16
            caja((0.12, 0.2, 0.9), (3.8 * math.cos(a), 3.8 * math.sin(a), z), "plastico", rot_z=a)
    aro(3.6, 3, 0.4, (0, 0, 8.1), "metal")
    esfera(3, (0, 0, 8), "vidrio", escala=(1, 1, 0.12), seg=32)
    cilindro(4.2, 0.4, (0, 0, -0.2), "metal", seg=40)


@pieza("rueda_color", "proyector", "#a8b8c5", 0.6)
def rueda_color():
    """Rueda de color de algunos proyectores DLP: disco segmentado con motor y soporte; no usada en todas las tecnologías."""
    cilindro(3.2, 0.12, (0, 0, 1.4), "vidrio", seg=40)
    for i, mat in enumerate(("pcb", "cobre", "chip")):
        a = i * 2 * math.pi / 3
        pts = [(0, 0)] + [(3.1 * math.cos(a + j * math.pi / 24), 3.1 * math.sin(a + j * math.pi / 24)) for j in range(17)]
        prisma(pts, 0.02, (0, 0, 1.48), mat)
    cilindro(0.7, 1.3, (0, 0, 0.65), seg=24)
    caja((3, 2, 0.3), (0, 0, -0.1), "metal")


@pieza("modulador_imagen", "proyector", "#647e8f", 0.35)
def modulador_imagen():
    """Módulo genérico de formación de imagen de proyector: ventana óptica y placa con conector. No especifica DLP, LCD o resolución."""
    placa(5, 4, mat="pcb")
    caja((2.5, 2, 0.2), (0, 0, 0.3), "metal", bisel=0.15)
    caja((1.8, 1.3, 0.06), (0, 0, 0.43), "vidrio")
    flex(1.6, 2, (0, -2.5, 0.15))


@pieza("unidad_fusora", "impresora", "#667b88", 0.3)
def unidad_fusora():
    """Unidad fusora de impresora láser: dos rodillos, soportes y cubierta superior; sin calefacción funcional."""
    for x in (-12, 12):
        caja((2, 6, 6), (x, 0, 3), "plastico", bisel=0.4)
    cilindro(1.3, 23, (0, 0, 4.3), "metal", seg=28, eje="x")
    cilindro(1.1, 23, (0, 0, 1.8), "goma", seg=28, eje="x")
    caja((24, 2, 0.4), (0, 2.3, 6), bisel=0.3)
    for x in (-12, 12):
        cilindro(0.8, 0.5, (x, 0, 4.3), "contactos", seg=16, eje="x")


@pieza("cilindro_fotoconductor", "impresora", "#337b74", 0.4, 0.25)
def cilindro_fotoconductor():
    """Cilindro fotoconductor de impresora láser: superficie, eje, tapas y engranaje. Distinto del tambor de lavarropas."""
    cilindro(1.4, 24, (0, 0, 1.4), seg=32, eje="x")
    cilindro(0.2, 28, (0, 0, 1.4), "metal", seg=16, eje="x")
    for x in (-12, 12):
        cilindro(1.5, 0.6, (x, 0, 1.4), "plastico", seg=24, eje="x")
    for i in range(20):
        a = i * math.pi / 10
        caja((0.5, 0.3, 0.3), (12.5, 1.5 * math.sin(a), 1.4 + 1.5 * math.cos(a)), "plastico")


@pieza("sensor_papel", "impresora", "#576b7b", 0.1)
def sensor_papel():
    """Sensor óptico de papel: horquilla emisora/receptora con palanca y tres terminales."""
    o = caja((1.6, 1.1, 1.2), (0, 0, 0.6), bisel=0.1)
    restar(o, caja((0.6, 2, 1), (0, 0, 1), mat=None))
    girar(caja((0.25, 0.2, 2), (0, 0, 1.8), "plastico"), (0, -0.3, 0))
    for x in (-0.5, 0, 0.5):
        caja((0.12, 0.12, 0.8), (x, 0, -0.4), "contactos")


@pieza("carcasa_mouse", "mouse", "#829cab", 0.1)
def carcasa_mouse():
    """Cubierta hueca de mouse con dos botones separados y abertura de rueda; sin placa dentro."""
    o = esfera(3.2, (0, 0, 1.1), escala=(1, 1.7, 0.6), seg=32)
    restar(o, esfera(2.9, (0, 0, 1), mat=None, escala=(1, 1.7, 0.6), seg=32))
    restar(o, caja((9, 14, 4), (0, 0, -1.5), mat=None))
    restar(o, caja((0.1, 5, 4), (0, -3.5, 1.5), mat=None))
    restar(o, caja((0.8, 1.8, 4), (0, -1.7, 1.5), mat=None, bisel=0.2))


@pieza("rueda_scroll", "mouse", "#526d7e", 0.1)
def rueda_scroll():
    """Rueda de desplazamiento de mouse: neumático estriado y eje, sin encoder integrado."""
    cilindro(1.1, 0.6, (0, 0, 1.1), "goma", seg=32, eje="x")
    cilindro(0.8, 0.65, (0, 0, 1.1), seg=28, eje="x")
    cilindro(0.12, 2.5, (0, 0, 1.1), "metal", seg=12, eje="x")
    for i in range(28):
        a = i * math.pi / 14
        caja((0.55, 0.12, 0.12), (0, 1.1 * math.sin(a), 1.1 + 1.1 * math.cos(a)), "goma")


@pieza("sensor_mouse", "mouse", "#3d606e", 0.1)
def sensor_mouse():
    """Sensor óptico de mouse con lente inferior y PCB; no especifica resolución ni iluminación láser."""
    placa(2.4, 2, mat="pcb")
    caja((1.2, 1.2, 0.25), (0, 0, 0.3), "chip", bisel=0.1)
    prisma(redondeado(1.8, 1.4, 0.3), 0.4, (0, 0, -0.2), "vidrio")
    for x in (-0.7, -0.3, 0.3, 0.7):
        caja((0.1, 0.4, 0.05), (x, -0.8, 0.22), "contactos")


@pieza("microswitch", "mouse joystick", "#50697b", 0.1)
def microswitch():
    """Microinterruptor de clic con actuador superior y tres terminales; sin especificación eléctrica."""
    caja((2, 0.7, 0.65), (0, 0, 0.4), bisel=0.1)
    caja((0.5, 0.5, 0.2), (-0.4, 0, 0.82), "plastico", bisel=0.1)
    for x in (-0.7, 0, 0.7):
        caja((0.15, 0.1, 0.6), (x, 0, -0.2), "contactos")


@pieza("tecla", "teclado macbook_air macbook_pro", "#506777", 0.1)
def tecla():
    """Tecla individual genérica: capuchón hueco con alojamiento inferior, sin leyenda ni distribución regional."""
    o = caja((1.8, 1.8, 0.65), (0, 0, 0.4), bisel=0.2)
    restar(o, caja((1.4, 1.4, 0.65), (0, 0, 0.08), mat=None, bisel=0.1))
    caja((0.5, 0.5, 0.3), (0, 0, 0.3), "plastico")


@pieza("switch_teclado", "teclado", "#8ba7b7", 0.1)
def switch_teclado():
    """Interruptor de teclado mecánico: carcasa, vástago en cruz y terminales. Alternativa al teclado de membrana, no presente en todos."""
    caja((1.5, 1.5, 1), (0, 0, 0.5), bisel=0.15)
    caja((0.9, 0.9, 0.3), (0, 0, 1.1), "plastico", bisel=0.1)
    caja((0.2, 0.7, 0.25), (0, 0, 1.35))
    caja((0.7, 0.2, 0.25), (0, 0, 1.35))
    for x in (-0.4, 0.4):
        cilindro(0.05, 0.7, (x, 0, -0.35), "contactos", seg=8)


@pieza("mecanismo_tijera", "macbook_air macbook_pro teclado", "#abb9c4", 0.3)
def mecanismo_tijera():
    """Mecanismo de tecla de perfil bajo: dos marcos cruzados con pivotes. No representa un mecanismo de marca exacto."""
    for a in (-0.25, 0.25):
        o = caja((1.3, 1.3, 0.12), (0, 0, 0.25), bisel=0.08)
        restar(o, caja((0.85, 0.85, 0.5), (0, 0, 0.25), mat=None))
        girar(o, (a, 0, 0))
    cilindro(0.1, 1.5, (0, 0, 0.25), "metal", seg=12, eje="x")


@pieza("membrana_teclado", "teclado", "#91a8b7", 0.05)
def membrana_teclado():
    """Lámina de membrana de teclado: pistas impresas y matriz de contactos, sin circuito ni distribución funcional."""
    caja((38, 12, 0.06), (0, 0, 0.1), bisel=0.2)
    for fila in range(5):
        y = -4.5 + fila * 2.2
        caja((36, 0.08, 0.01), (0, y, 0.14), "cobre")
        for col in range(14):
            x = -17 + col * 2.6
            cilindro(0.32, 0.02, (x, y, 0.15), "goma", seg=12)
    flex(2.5, 3, (0, 7, 0.1))


@pieza("carcasa_mando", "joystick", "#607f94", 0.1)
def carcasa_mando():
    """Carcasa abierta de mando de videojuegos con dos empuñaduras y huecos para botones y sticks. No sigue una marca concreta."""
    o = prisma([(-8, -4), (-5, -5), (-3, -2), (3, -2), (5, -5), (8, -4), (6, 4), (-6, 4)], 2, (0, 0, 1), bisel=0.6)
    restar(o, caja((10, 5, 3), (0, 0, -0.8), mat=None, bisel=0.4))
    restar(o, varios([("cil", (1.1, 4), (x, -0.6, 1)) for x in (-2.5, 2.5)]))
    restar(o, varios([("cil", (0.4, 4), (x, y, 1)) for x, y in [(4.5, 0.8), (5.5, 1.8), (4.5, 2.8), (3.5, 1.8), (-4.5, 1.8)]]))


@pieza("cruceta_mando", "joystick", "#476579", 0.1)
def cruceta_mando():
    """Cruceta direccional de mando: cruz con pivote inferior y superficies de contacto."""
    prisma([(-0.5, -1.5), (0.5, -1.5), (0.5, -0.5), (1.5, -0.5), (1.5, 0.5), (0.5, 0.5), (0.5, 1.5), (-0.5, 1.5), (-0.5, 0.5), (-1.5, 0.5), (-1.5, -0.5), (-0.5, -0.5)], 0.4, (0, 0, 0.4), bisel=0.1)
    esfera(0.4, (0, 0, 0.15), "plastico", escala=(1, 1, 0.5), seg=20)
    for x, y in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        cilindro(0.2, 0.05, (x, y, 0.15), "goma", seg=12)


@pieza("boton_mando", "joystick", "#53758e", 0.1)
def boton_mando():
    """Botón de mando: capuchón redondeado, guía inferior y pestañas de retención, sin símbolo de marca."""
    cilindro(0.45, 0.65, (0, 0, 0.5), seg=24, bisel=0.1)
    cilindro(0.32, 0.5, (0, 0, 0.05), "plastico", seg=20)
    for x in (-0.4, 0.4):
        caja((0.2, 0.25, 0.1), (x, 0, 0.2), "plastico")


@pieza("potenciometro", "parlante_pc joystick", "#aab8c2", 0.8)
def potenciometro():
    """Potenciómetro rotativo de panel: cuerpo, eje estriado, tuerca y tres terminales; sin resistencia asignada."""
    cilindro(0.8, 0.7, (0, 0, 0.4), seg=24)
    cilindro(0.25, 1.5, (0, 0, 1.5), "metal", seg=16)
    cilindro(0.5, 0.2, (0, 0, 0.9), "metal", seg=6)
    for x in (-0.5, 0, 0.5):
        caja((0.1, 0.15, 0.6), (x, -0.7, 0.1), "contactos")


@pieza("adaptador_notebook", "cargador_notebook", "#718697", 0.1)
def adaptador_notebook():
    """Envolvente genérica de adaptador externo de notebook: dos mitades y alivios de tensión. Sin circuito ni potencia especificada."""
    caja((10, 5, 2.8), (0, 0, 1.4), bisel=0.7)
    caja((10.02, 5.02, 0.04), (0, 0, 1.4), "ranura", bisel=0.7)
    for x in (-5.7, 5.7):
        cilindro(0.45, 1.4, (x, 0, 1.4), "goma", seg=20, eje="x")
    caja((5, 3, 0.01), (0, 0, 2.81), "etiqueta", bisel=0.2)


@pieza("conector@jack_dc", "cargador_notebook", "#aebecb", 0.85)
def conector_jack_dc():
    """Conector cilíndrico DC de cable: barril hueco, aislante y alivio; sin polaridad ni diámetro de compatibilidad."""
    cilindro(0.5, 2.5, (0, 0, 1.25), "plastico", seg=24)
    aro(0.28, 0.15, 1.5, (0, 0, 3.15))
    cilindro(0.3, 0.5, (0, 0, -0.2), "goma", seg=20)


@pieza("conector@magsafe", "cargador_notebook macbook_air macbook_pro", "#acbac6", 0.8)
def conector_magnetico():
    """Conector magnético de alimentación de formato MagSafe ilustrativo: cara con cinco contactos y alivio. La generación y compatibilidad dependen del equipo."""
    caja((1.8, 0.6, 0.5), (0, 0, 0.4), bisel=0.15)
    caja((1.5, 0.1, 0.3), (0, -0.34, 0.4), "plastico", bisel=0.1)
    for x in (-0.5, -0.25, 0, 0.25, 0.5):
        esfera(0.07, (x, -0.42, 0.4), "contactos", seg=12, anillos=6)
    cilindro(0.2, 1.3, (0, 0.8, 0.4), "goma", seg=16, eje="y")


@pieza("carcasa_zapatilla", "zapatilla", "#92a8b7", 0.05)
def carcasa_zapatilla():
    """Carcasa vacía de regleta eléctrica con cuatro alojamientos, tornillos y entrada de cable; sin norma ni cableado funcional."""
    o = caja((28, 6, 3), (0, 0, 1.5), bisel=0.7)
    restar(o, caja((26.8, 4.8, 3), (0, 0, 0.5), mat=None, bisel=0.5))
    restar(o, varios([("caja", (4.5, 4.5, 4), (x, 0, 1.5)) for x in (-9, -3, 3, 9)]))
    restar(o, cilindro(0.4, 2, (-14, 0, 1), mat=None, seg=16, eje="x"))


@pieza("toma_corriente", "zapatilla", "#a0b7c7", 0.05)
def toma_corriente():
    """Módulo de toma con dos alojamientos redondos y hueco de tierra ilustrativos. No declara norma, tensión ni compatibilidad de enchufe."""
    o = caja((4.6, 4.6, 1.3), (0, 0, 0.7), bisel=0.5)
    restar(o, varios([("cil", (0.3, 3), (x, 0, 0.7)) for x in (-0.9, 0.9)]))
    restar(o, caja((0.5, 0.8, 3), (0, 1.3, 0.7), mat=None))
    for x in (-0.9, 0.9):
        caja((0.4, 0.15, 1), (x, 0.3, 0), "contactos")


@pieza("contactos_zapatilla", "zapatilla", "#ba995a", 0.8)
def contactos_zapatilla():
    """Barras y contactos interiores ilustrativos de regleta, sin trazado eléctrico ni garantía de seguridad o norma."""
    for y in (-1.2, 0, 1.2):
        caja((25, 0.4, 0.1), (0, y, 0.2))
        for x in (-9, -3, 3, 9):
            tubo([(x - 0.25, y, 0.2), (x - 0.25, y, 0.9), (x, y, 1.1), (x + 0.25, y, 0.9), (x + 0.25, y, 0.2)], 0.06, "contactos", seg=6)


@pieza("protector_termico", "zapatilla cargador_notebook", "#557082", 0.1)
def protector_termico():
    """Protector térmico rearmable de panel: cuerpo, botón de rearme y dos terminales. Sin curva ni corriente nominal."""
    caja((2, 1.4, 2), (0, 0, 1), bisel=0.2)
    cilindro(0.5, 0.8, (0, 0, 2.4), "plastico", seg=20)
    for x in (-0.5, 0.5):
        caja((0.4, 0.15, 1), (x, 0, -0.5), "contactos")


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
    mundo = bpy.data.worlds.new("estudio_facultad")
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
    datos = bpy.data.cameras.new("camara_facultad")
    datos.type = "ORTHO"
    datos.clip_start = 0.01
    datos.clip_end = 4000
    cam = bpy.data.objects.new("camara_facultad", datos)
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
    BASE["cerrar_cuerpos"](vacios)
    salida = Path(args.salida)
    salida.mkdir(parents=True, exist_ok=True)
    CORE["exportar"](str(salida / (FAMILIA + ".glb")), vacios)
    CORE["actualizar_indice"](str(salida / "indice.json"), {FAMILIA: FAMILIA + ".glb"}, tipos)
    print(f"Familia {FAMILIA}: {len(vacios)} tipos; {(salida / (FAMILIA + '.glb')).stat().st_size} bytes")
    if args.renders:
        renderizar(args.renders, vacios, args.render_piezas.split(",") if args.render_piezas is not None else None)


if __name__ == "__main__":
    main()
