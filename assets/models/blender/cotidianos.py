"""Pequeños electrodomésticos y wearables: familia independiente en centímetros.

blender -b --factory-startup --python assets/models/blender/cotidianos.py -- \
  --salida public/models/piezas --renders assets/models/blender/renders/cotidianos
Solo exporta cotidianos.glb y sus entradas del índice. Sin APIs ni claves.
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
FAMILIA = "cotidianos"
EQUIPOS = {
    "air_fryer": "air_fryer airfryer freidora aire",
    "licuadora": "licuadora batidora blender",
    "tostadora": "tostadora toaster",
    "pava": "pava hervidor kettle electrica",
    "microondas": "microondas microwave",
    "plancha": "plancha iron vapor",
    "ventilador_pie": "ventilador_pie ventilador pedestal",
    "smartwatch": "smartwatch reloj_inteligente wearable",
    "reloj": "reloj reloj_pulsera analogico cuarzo",
    "auriculares": "auriculares inalambricos earbuds tws",
    "parlante_bluetooth": "parlante_bluetooth parlante altavoz bluetooth",
    "control_remoto": "control_remoto control remoto mando",
    "cargador": "cargador celular telefono adaptador",
}
PIEZAS = []
PALETA = {}


def pieza(nombre, equipos, color="#626d79", metal=0.15, rug=0.45):
    def registrar(fn):
        PALETA["cuerpo." + nombre.split("@")[0]] = (color, metal, rug)
        def crear():
            fn()
            return CORE["armar"](nombre, " ".join(EQUIPOS[e] for e in equipos.split()))
        crear.__doc__ = fn.__doc__
        PIEZAS.append((nombre, equipos.split(), crear))
        return crear
    return registrar


def aro(r, interior, h, z=0, mat="cuerpo", eje="z", pos=None):
    p = pos or (0, 0, z)
    o = cilindro(r, h, p, mat, seg=32, eje=eje)
    restar(o, cilindro(interior, h + 1, p, mat=None, seg=32, eje=eje))
    return o


def recipiente(w, d, h, esp=0.3, mat="cuerpo"):
    o = caja((w, d, h), (0, 0, h / 2), mat, bisel=min(0.7, h / 5))
    restar(o, caja((w - 2 * esp, d - 2 * esp, h + 1), (0, 0, h / 2 + esp + 0.5), mat=None, bisel=0.4))
    return o


@pieza("canasta_freidora", "air_fryer", "#42484e", 0.5)
def canasta_freidora():
    """Canasta de freidora de aire: cuba abierta, ranuras laterales y mango aislante."""
    o = recipiente(22, 21, 10)
    restar(o, varios([("caja", (0.8, 24, 4), (x, 0, 5)) for x in range(-8, 9, 2)]))
    caja((4, 9, 3), (0, -14, 6), "plastico", bisel=0.7)
    caja((2, 3, 0.5), (0, -13, 7.6), "goma", bisel=0.2)


@pieza("rejilla_crujiente", "air_fryer", "#565e65", 0.6)
def rejilla_crujiente():
    """Inserto perforado de canasta: placa extraíble con ranuras y cuatro patas de silicona."""
    o = caja((20, 19, 0.4), (0, 0, 1), bisel=0.7)
    restar(o, varios([("caja", (0.6, 13, 1), (x, 0, 1)) for x in range(-8, 9, 2)]))
    for x in (-8, 8):
        for y in (-7, 7):
            cilindro(0.7, 1, (x, y, 0.5), "goma", seg=16)


@pieza("jarra_licuadora", "licuadora", "#a7c3cf", 0.05, 0.25)
def jarra_licuadora():
    """Jarra cónica abierta con pico, nervaduras y asa lateral; recipiente ilustrativo."""
    o = cilindro(5.5, 20, (0, 0, 10), r_arriba=7, seg=32)
    restar(o, cilindro(5.1, 21, (0, 0, 11), r_arriba=6.6, mat=None, seg=32))
    tubo([(6.7, 0, 17), (10, 0, 17), (10, 0, 5), (6, 0, 5)], 0.8, "plastico")
    prisma([(-1, -6), (1, -6), (0, -8)], 0.7, (0, 0, 19.5))
    for z in (5, 10, 15):
        caja((1.5, 0.1, 0.15), (0, -6, z), "etiqueta")


@pieza("tapa_jarra", "licuadora", "#3d4851", 0.05)
def tapa_jarra():
    """Tapa circular de jarra con tapón central extraíble y reborde inferior."""
    cilindro(7.2, 1.2, (0, 0, 0.6), seg=32, bisel=0.2)
    aro(6.5, 6, 1, -0.4, "goma")
    cilindro(2, 1.8, (0, 0, 1.7), "vidrio", seg=24)


@pieza("cuchillas_licuadora", "licuadora", "#b7c3ca", 0.85, 0.25)
def cuchillas_licuadora():
    """Conjunto de cuatro cuchillas inclinadas y cubo central; sin filo funcional."""
    cilindro(1.2, 2, (0, 0, 1), seg=20)
    for i in range(4):
        a = i * math.pi / 2
        o = prisma([(0, -0.6), (4.5, -0.9), (5.2, 0), (0, 0.6)], 0.15, (0, 0, 1.7))
        girar(o, (0, 0.2 if i % 2 else -0.2, a))
    cilindro(0.45, 0.4, (0, 0, 2.2), "metal", seg=6)


@pieza("acople_transmision", "licuadora", "#414950", 0.05)
def acople_transmision():
    """Acople de transmisión dentado de licuadora: disco, seis dientes y alojamiento central."""
    o = cilindro(2.5, 1, (0, 0, 0.5), seg=32)
    restar(o, cilindro(0.5, 3, (0, 0, 0.5), mat=None, seg=6))
    for i in range(6):
        a = i * math.pi / 3
        caja((0.9, 0.7, 1), (1.8 * math.cos(a), 1.8 * math.sin(a), 1.4), rot_z=a)


@pieza("junta_jarra", "licuadora", "#353d43", 0, 0.85)
def junta_jarra():
    """Junta anular de jarra de licuadora, con labio interior; sin medidas de compatibilidad."""
    aro(5, 4.3, 0.5, 0.25)


@pieza("soporte_pan", "tostadora", "#a6b0b8", 0.8)
def soporte_pan():
    """Jaula de soporte para tostada: dos marcos de alambre y travesaños separados."""
    for y in (-1.5, 1.5):
        tubo([(-7, y, 0), (-7, y, 12), (7, y, 12), (7, y, 0), (-7, y, 0)], 0.15)
        for x in (-5, -2.5, 0, 2.5, 5):
            tubo([(x, y, 0), (x, y, 12)], 0.1, "metal")
    for x in (-7, 7):
        tubo([(x, -1.5, 0), (x, 1.5, 0)], 0.15)


@pieza("elevador_tostadora", "tostadora", "#9faab3", 0.75)
def elevador_tostadora():
    """Elevador de tostadora: carro, guía vertical, resorte y palanca aislante."""
    caja((14, 3, 0.5), (0, 0, 2), bisel=0.15)
    cilindro(0.3, 16, (-8, 0, 8), "metal", seg=16)
    tubo([(-8 + 0.55 * math.cos(i * 0.4), 0.55 * math.sin(i * 0.4), 1 + i * 0.025) for i in range(240)], 0.08, "metal", seg=6)
    caja((3, 2, 2), (-10, 0, 4), "plastico", bisel=0.3)


@pieza("jarra_pava", "pava", "#a6b8c1", 0.65)
def jarra_pava():
    """Cuerpo abierto de pava eléctrica con pico y asa aislante, sin contenido."""
    o = cilindro(7, 20, (0, 0, 10), r_arriba=6, seg=32)
    restar(o, cilindro(6.6, 21, (0, 0, 11), r_arriba=5.6, mat=None, seg=32))
    tubo([(6, 0, 17), (10, 0, 17), (11, 0, 5), (6.5, 0, 4)], 1, "plastico")
    prisma([(-2, -5), (2, -5), (0, -9)], 3, (0, 0, 17))


@pieza("base_contactos", "pava", "#3c464f", 0.05)
def base_contactos():
    """Base de alimentación de pava: disco y contactos concéntricos, sin circuito eléctrico."""
    cilindro(8, 2, (0, 0, 1), seg=32, bisel=0.3)
    cilindro(2, 1.5, (0, 0, 2.3), "plastico", seg=24)
    aro(1.5, 1.1, 0.3, 3, "contactos")
    cilindro(0.4, 0.5, (0, 0, 3.1), "contactos", seg=16)


@pieza("interruptor_basculante", "pava plancha air_fryer", "#4d5863", 0.05)
def interruptor_basculante():
    """Interruptor basculante: marco, tecla inclinada y terminales inferiores."""
    caja((2, 3.2, 1), (0, 0, 0.5), bisel=0.2)
    girar(caja((1.7, 2.8, 0.5), (0, 0, 1.1), "plastico", bisel=0.2), (0.15, 0, 0))
    for y in (-0.7, 0.7):
        caja((0.5, 0.15, 1), (0, y, -0.5), "contactos")


@pieza("tapa_pava", "pava", "#788590", 0.5)
def tapa_pava():
    """Tapa de pava eléctrica: disco con reborde y pomo aislante."""
    cilindro(6.3, 0.6, (0, 0, 0.3), seg=32)
    aro(5.6, 5.2, 0.7, -0.2, "goma")
    cilindro(1.7, 1.8, (0, 0, 1.4), "plastico", seg=24, bisel=0.3)


@pieza("filtro_pico", "pava", "#a6b0b6", 0.7)
def filtro_pico():
    """Filtro antisarro del pico: marco trapezoidal y malla de alambre."""
    o = prisma([(-2.5, -0.2), (2.5, -0.2), (1.8, 0.3), (-1.8, 0.3)], 5, (0, 0, 2.5))
    restar(o, caja((3.3, 2, 3.6), (0, 0, 2.7), mat=None))
    for x in (-1.5, -1, -0.5, 0, 0.5, 1, 1.5):
        tubo([(x, 0, 1), (x, 0, 4.4)], 0.04, "metal", seg=6)
    for z in (1, 1.5, 2, 2.5, 3, 3.5, 4):
        tubo([(-1.6, 0, z), (1.6, 0, z)], 0.04, "metal", seg=6)


@pieza("magnetron", "microondas", "#a5afb6", 0.8)
def magnetron():
    """Magnetrón ilustrativo: bloque de aletas, brida, antena cerámica y terminales. Sin interior funcional."""
    caja((7, 7, 6), (0, 0, 4), bisel=0.2)
    for z in range(1, 8):
        caja((10, 9, 0.25), (0, 0, z), "metal")
    caja((11, 11, 0.5), (0, 0, 8), "metal")
    cilindro(1.3, 3, (0, 0, 9.5), "etiqueta", seg=24)
    cilindro(0.8, 1, (0, 0, 11.3), "cobre", seg=20)
    caja((4, 3, 2), (0, -5, 2), "conector")


@pieza("guia_ondas", "microondas", "#b3bcc3", 0.8)
def guia_ondas():
    """Guía de ondas esquemática: conducto metálico rectangular con bridas abiertas."""
    o = caja((5, 9, 3), (0, 0, 1.5))
    restar(o, caja((4.2, 11, 2.2), (0, 0, 1.5), mat=None))
    for y in (-4.5, 4.5):
        o = caja((7, 0.4, 5), (0, y, 1.5), "metal")
        restar(o, caja((4.2, 1, 2.2), (0, y, 1.5), mat=None))


@pieza("plato_microondas", "microondas", "#a4c1cc", 0.05, 0.2)
def plato_microondas():
    """Plato giratorio de microondas: disco de vidrio con borde y tres apoyos inferiores."""
    cilindro(13, 0.6, (0, 0, 0.6), seg=48)
    aro(13.1, 12.5, 0.3, 1)
    for i in range(3):
        a = i * 2 * math.pi / 3
        caja((2, 0.8, 0.6), (3 * math.cos(a), 3 * math.sin(a), 0.1), rot_z=a)


@pieza("aro_rodillos", "microondas", "#7d8992", 0.05)
def aro_rodillos():
    """Soporte del plato de microondas: anillo y tres ruedas radiales."""
    aro(10, 9.4, 0.4, 0.8)
    for i in range(3):
        a = i * 2 * math.pi / 3
        o = cilindro(0.9, 0.6, (10 * math.cos(a), 10 * math.sin(a), 0.8), "plastico", seg=20, eje="x")
        girar(o, (0, 0, a))


@pieza("acople_plato", "microondas", "#c3b7a0", 0.05)
def acople_plato():
    """Acople de plato giratorio: cubo y tres brazos de arrastre."""
    cilindro(1, 2, (0, 0, 1), seg=24)
    for i in range(3):
        a = i * 2 * math.pi / 3
        caja((2.2, 0.8, 0.7), (1.4 * math.cos(a), 1.4 * math.sin(a), 1.7), rot_z=a)


@pieza("fusible_cartucho", "microondas cargador", "#d8d8ca", 0.05)
def fusible_cartucho():
    """Fusible de cartucho: tubo cerámico y casquillos metálicos, sin valor eléctrico asignado."""
    cilindro(0.35, 3, (0, 0, 0.35), seg=20, eje="x")
    for x in (-1.3, 1.3):
        cilindro(0.38, 0.5, (x, 0, 0.35), "metal", seg=20, eje="x")


@pieza("suela_plancha", "plancha", "#b3bdc5", 0.85, 0.25)
def suela_plancha():
    """Suela de plancha con punta redondeada y orificios de vapor ilustrativos."""
    o = prisma([(-5, -9), (5, -9), (5, 2), (2, 9), (0, 12), (-2, 9), (-5, 2)], 0.8, (0, 0, 0.4), bisel=0.5)
    restar(o, varios([("cil", (0.3, 2), (x, y, 0.4)) for x in (-3, 0, 3) for y in (-6, -2, 2)]))


@pieza("deposito_plancha", "plancha", "#9bb7c6", 0.05, 0.25)
def deposito_plancha():
    """Depósito de agua de plancha: cuerpo afilado, boca de carga y conexión inferior."""
    prisma([(-4, -7), (4, -7), (4, 1), (0, 9), (-4, 1)], 4, (0, 0, 2), bisel=0.5)
    aro(1, 0.7, 1, 4.5, "plastico", pos=(0, -3, 4.5))
    cilindro(0.4, 1, (0, 0, -0.5), "goma", seg=16)


@pieza("boton_pulverizador", "plancha", "#596978", 0.05)
def boton_pulverizador():
    """Botón mecánico pulverizador de plancha: cabezal, vástago y tubo de entrada."""
    caja((2.5, 3, 1), (0, 0, 4), bisel=0.5)
    cilindro(0.5, 3, (0, 0, 2), "plastico", seg=20)
    tubo([(0, 0, 0.5), (0, 0, -1), (0.7, 0, -2)], 0.15, "goma")


@pieza("helice_ventilador", "ventilador_pie", "#7f9ba9", 0.05)
def helice_ventilador():
    """Hélice de ventilador de pie: cubo y tres palas curvas de espesor uniforme."""
    cilindro(3, 3, (0, 0, 1.5), seg=32, bisel=0.3)
    for i in range(3):
        a = i * 2 * math.pi / 3
        o = prisma([(1, -1), (7, -3), (14, -1), (15, 3), (9, 5), (3, 2)], 0.4, (0, 0, 1.5), bisel=0.3)
        girar(o, (0, 0, a))
    cilindro(1, 0.3, (0, 0, 3.2), "metal", seg=20)


@pieza("rejilla_ventilador", "ventilador_pie", "#9aa8b2", 0.8)
def rejilla_ventilador():
    """Rejilla circular de ventilador: aros concéntricos y alambres radiales, separada de la hélice."""
    for r in (4, 8, 12, 16):
        tubo([(r * math.cos(i * math.pi / 32), r * math.sin(i * math.pi / 32), 0.6 * (1 - r / 16)) for i in range(65)], 0.08, seg=6)
    for i in range(24):
        a = i * math.pi / 12
        tubo([(2 * math.cos(a), 2 * math.sin(a), 0.6), (16 * math.cos(a), 16 * math.sin(a), 0)], 0.08, "metal", seg=6)
    cilindro(2.2, 0.25, (0, 0, 0.6), "plastico", seg=24)


@pieza("pedestal_ventilador", "ventilador_pie", "#424f5b", 0.3)
def pedestal_ventilador():
    """Base de ventilador de pie: disco lastrado, cuatro apoyos y zócalo central."""
    cilindro(17, 2, (0, 0, 1), seg=40, bisel=0.5)
    cilindro(3, 4, (0, 0, 3), "plastico", seg=28)
    for x in (-10, 10):
        for y in (-10, 10):
            cilindro(1, 0.7, (x, y, -0.2), "goma", seg=16)


@pieza("tubo_telescopico", "ventilador_pie", "#aebdc7", 0.85)
def tubo_telescopico():
    """Columna telescópica de ventilador: tubos concéntricos y collar de altura."""
    cilindro(1.5, 30, (0, 0, 15), seg=24)
    cilindro(1.1, 25, (0, 0, 39), "metal", seg=24)
    cilindro(2.2, 3, (0, 0, 29), "plastico", seg=28)


@pieza("perilla_mando", "ventilador_pie air_fryer plancha tostadora", "#465968", 0.05)
def perilla_mando():
    """Perilla circular de mando con estrías, indicador y eje inferior."""
    cilindro(2, 1.5, (0, 0, 1), seg=32, bisel=0.2)
    for i in range(24):
        a = i * math.pi / 12
        caja((0.1, 0.2, 1), (2 * math.cos(a), 2 * math.sin(a), 1), "plastico", rot_z=a)
    caja((0.2, 0.8, 0.05), (0, -0.8, 1.8), "etiqueta")
    cilindro(0.4, 1, (0, 0, -0.5), "plastico", seg=16)


@pieza("caja_reloj", "smartwatch reloj", "#aab9c5", 0.8)
def caja_reloj():
    """Caja circular de reloj: anillo abierto con asas para pasadores de correa."""
    aro(2.2, 1.9, 0.8, 0.4)
    for x in (-1.2, 1.2):
        for y in (-2.3, 2.3):
            caja((0.4, 0.9, 0.5), (x, y, 0.4), bisel=0.15)


@pieza("correa_reloj", "smartwatch reloj", "#3b586c", 0, 0.8)
def correa_reloj():
    """Dos mitades de correa de pulsera con perforaciones, hebilla y pasadores; distinta de una correa de transmisión."""
    for y, largo in ((-6, 8), (5, 6)):
        o = caja((2, largo, 0.25), (0, y, 0.2), bisel=0.25)
        if y < 0:
            restar(o, varios([("cil", (0.12, 1), (0, yy, 0.2)) for yy in (-4, -5, -6, -7, -8)]))
        cilindro(0.08, 2.3, (0, -2 if y < 0 else 2, 0.2), "metal", seg=12, eje="x")
    o = caja((2.6, 2, 0.25), (0, 8, 0.25), "metal", bisel=0.2)
    restar(o, caja((1.9, 1.4, 1), (0, 8, 0.25), mat=None))
    tubo([(0, 7.4, 0.4), (0, 8.8, 0.4)], 0.08, "metal")


@pieza("corona_reloj", "reloj smartwatch", "#b9c3cb", 0.85)
def corona_reloj():
    """Corona de ajuste de reloj: cilindro estriado con tija, separado de la caja."""
    cilindro(0.35, 0.4, (0, 0, 0.3), seg=24)
    for i in range(20):
        a = i * math.pi / 10
        caja((0.05, 0.05, 0.3), (0.35 * math.cos(a), 0.35 * math.sin(a), 0.3), rot_z=a)
    cilindro(0.07, 1, (0, 0, -0.4), "metal", seg=12)


@pieza("mecanismo_reloj", "reloj", "#b6a674", 0.75)
def mecanismo_reloj():
    """Movimiento ilustrativo de reloj de cuarzo: platina, ruedas y bobina, sin engrane calibrado."""
    cilindro(1.7, 0.3, (0, 0, 0.15), seg=32)
    for x, y, r in [(-0.7, 0.3, 0.5), (0.2, 0, 0.65), (0.8, 0.6, 0.4)]:
        cilindro(r, 0.1, (x, y, 0.4), "metal", seg=24)
        for i in range(12):
            a = i * math.pi / 6
            caja((0.1, 0.1, 0.1), (x + r * math.cos(a), y + r * math.sin(a), 0.4), "metal", rot_z=a)
    caja((1, 0.4, 0.3), (0, -0.9, 0.4), "cobre")
    cilindro(0.1, 0.3, (0, 0, 0.6), "metal", seg=12)


@pieza("agujas_reloj", "reloj", "#b9cbd7", 0.8)
def agujas_reloj():
    """Conjunto de agujas analógicas con eje central; orientación meramente ilustrativa."""
    prisma([(-0.1, -0.3), (0.1, -0.3), (0.06, 1.5), (0, 1.8), (-0.06, 1.5)], 0.03, (0, 0, 0.1))
    o = prisma([(-0.12, -0.2), (0.12, -0.2), (0.08, 1), (0, 1.3), (-0.08, 1)], 0.04, (0, 0, 0.2), "metal")
    girar(o, (0, 0, -1.1))
    cilindro(0.16, 0.2, (0, 0, 0.2), "metal", seg=20)


@pieza("esfera_reloj", "reloj", "#253d51", 0.25)
def esfera_reloj():
    """Esfera de reloj analógico con doce índices y alojamiento central."""
    o = cilindro(1.9, 0.1, (0, 0, 0.05), seg=40)
    restar(o, cilindro(0.12, 0.5, (0, 0, 0.05), mat=None, seg=16))
    for i in range(12):
        a = i * math.pi / 6
        caja((0.08, 0.25, 0.03), (1.6 * math.sin(a), 1.6 * math.cos(a), 0.12), "etiqueta", rot_z=-a)


@pieza("pantalla@reloj", "smartwatch", "#132c3f", 0.2, 0.2)
def pantalla_reloj():
    """Display circular de reloj inteligente con vidrio, marco y flex lateral."""
    cilindro(1.9, 0.15, (0, 0, 0.1), seg=40)
    aro(2, 1.9, 0.2, 0.1, "metal")
    caja((0.8, 1.5, 0.05), (0, 2, 0.05), "cobre")
    caja((0.8, 0.2, 0.08), (0, 2.7, 0.05), "contactos")


@pieza("tapa_reloj", "reloj smartwatch", "#a7b7c4", 0.85)
def tapa_reloj():
    """Tapa trasera circular de reloj con junta anular y cuatro alojamientos de tornillo."""
    cilindro(2.1, 0.2, (0, 0, 0.1), seg=32)
    aro(1.9, 1.8, 0.1, 0.25, "goma")
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        cilindro(0.1, 0.05, (1.7 * math.cos(a), 1.7 * math.sin(a), 0.25), "ranura", seg=12)


@pieza("sensor_optico", "smartwatch", "#273d4c", 0.1)
def sensor_optico():
    """Módulo óptico trasero de smartwatch: ventana, dos emisores y receptor; sin medición médica."""
    cilindro(1.2, 0.3, (0, 0, 0.15), seg=28)
    for x in (-0.5, 0.5):
        cilindro(0.2, 0.1, (x, 0, 0.35), "etiqueta", seg=16)
    caja((0.4, 0.6, 0.1), (0, 0, 0.35), "vidrio")
    caja((0.6, 1, 0.05), (0, 1.3, 0.1), "cobre")


@pieza("bobina_carga", "smartwatch auriculares cargador", "#bc7c4c", 0.75)
def bobina_carga():
    """Bobina plana de carga inductiva: espiral de cobre, respaldo de ferrita y terminales."""
    cilindro(2.5, 0.1, (0, 0, 0.05), "chip", seg=40)
    tubo([((0.5 + i * 0.008) * math.cos(i * math.pi / 16), (0.5 + i * 0.008) * math.sin(i * math.pi / 16), 0.18) for i in range(225)], 0.05, seg=6)
    for x in (-0.3, 0.3):
        caja((0.15, 0.5, 0.05), (x, -2.6, 0.1), "contactos")


@pieza("carcasa_auricular", "auriculares", "#a8bac8", 0.05)
def carcasa_auricular():
    """Carcasa genérica de auricular inalámbrico: cápsula hueca y tallo con contactos."""
    o = esfera(0.9, (0, 0, 1.3), escala=(1, 0.8, 1), seg=24)
    restar(o, esfera(0.72, (0, 0, 1.3), mat=None, escala=(1, 0.8, 1), seg=24))
    restar(o, caja((3, 3, 1.8), (0, 0, 2.2), mat=None))
    cilindro(0.3, 2, (0.5, 0, 0.1), "plastico", seg=20)
    for x in (0.35, 0.65):
        cilindro(0.08, 0.08, (x, 0, -0.95), "contactos", seg=12)


@pieza("almohadilla_silicona", "auriculares", "#7e98aa", 0, 0.85)
def almohadilla_silicona():
    """Almohadilla in-ear de silicona: campana abierta y conducto central."""
    o = cilindro(0.65, 0.8, (0, 0, 0.4), r_arriba=0.4, seg=32)
    restar(o, cilindro(0.25, 1.5, (0, 0, 0.4), mat=None, seg=24))
    aro(0.42, 0.25, 0.3, 0.95)


@pieza("estuche_auriculares", "auriculares", "#9dabb6", 0.05)
def estuche_auriculares():
    """Estuche abierto de auriculares con dos alojamientos y bisagra trasera, sin baterías modeladas dentro."""
    o = caja((6, 3, 2.8), (0, 0, 1.4), bisel=0.8, seg=4)
    restar(o, varios([("cil", (0.9, 3), (x, 0, 2.3)) for x in (-1.4, 1.4)]))
    caja((5.8, 0.4, 2.7), (0, 1.8, 3.4), "plastico", bisel=0.5)
    cilindro(0.25, 4, (0, 1.4, 2.6), "metal", seg=16, eje="x")
    caja((0.6, 0.1, 0.2), (0, -1.5, 1), "etiqueta")


@pieza("contacto_resorte", "auriculares smartwatch cargador", "#c7ae69", 0.8)
def contacto_resorte():
    """Contacto de carga de resorte (pogo): camisa, vástago y base; ampliable por el plano."""
    cilindro(0.12, 0.6, (0, 0, 0.3), seg=20)
    cilindro(0.06, 0.3, (0, 0, 0.75), "contactos", seg=16)
    cilindro(0.18, 0.1, (0, 0, -0.05), "contactos", seg=20)


@pieza("microfono_mems", "auriculares smartwatch parlante_bluetooth", "#b8c3cb", 0.8)
def microfono_mems():
    """Micrófono MEMS genérico: cápsula rectangular, puerto acústico y contactos inferiores."""
    o = caja((0.5, 0.35, 0.18), (0, 0, 0.15), bisel=0.02)
    restar(o, cilindro(0.04, 0.5, (0.12, 0, 0.15), mat=None, seg=12))
    caja((0.55, 0.4, 0.05), (0, 0, 0.025), "pcb")
    for x in (-0.18, 0, 0.18):
        caja((0.08, 0.1, 0.03), (x, -0.14, -0.02), "contactos")


@pieza("radiador_pasivo", "parlante_bluetooth", "#465966", 0.05, 0.7)
def radiador_pasivo():
    """Radiador acústico pasivo: membrana central y suspensión anular; sin bobina ni respuesta calibrada."""
    cilindro(4, 0.3, (0, 0, 0.15), seg=40)
    aro(5, 4, 0.5, 0.25, "goma")
    aro(5.4, 5, 0.3, 0.15, "metal")


@pieza("malla_acustica", "parlante_bluetooth auriculares", "#7b8c99", 0.6)
def malla_acustica():
    """Malla protectora acústica: marco y tejido de alambres cruzados; ajustable por eje."""
    o = caja((12, 6, 0.3), (0, 0, 0.15), bisel=0.3)
    restar(o, caja((11, 5, 1), (0, 0, 0.15), mat=None))
    for x in range(-5, 6):
        tubo([(x, -2.5, 0.15), (x, 2.5, 0.15)], 0.04, "metal", seg=6)
    for y in (-2, -1, 0, 1, 2):
        tubo([(-5.5, y, 0.15), (5.5, y, 0.15)], 0.04, "metal", seg=6)


@pieza("membrana_botones", "control_remoto", "#6e8797", 0, 0.85)
def membrana_botones():
    """Membrana elastomérica de control remoto con teclas y pastillas conductoras inferiores."""
    caja((4, 12, 0.15), (0, 0, 0.1), bisel=0.4)
    for x in (-1.1, 0, 1.1):
        for y in (-4.5, -2.7, -0.9, 0.9, 2.7, 4.5):
            caja((0.8, 1.2, 0.6), (x, y, 0.45), "plastico", bisel=0.2)
            cilindro(0.22, 0.05, (x, y, -0.03), "goma", seg=12)


@pieza("portapilas", "control_remoto", "#49545e", 0.05)
def portapilas():
    """Portapilas doble AA vacío: separador, contactos y resortes de compresión."""
    recipiente(3.5, 5.7, 1.5, esp=0.2)
    caja((0.15, 5.3, 1), (0, 0, 0.6), "plastico")
    for x in (-0.8, 0.8):
        caja((0.9, 0.1, 1), (x, 2.6, 0.7), "contactos")
        tubo([(x + 0.4 * math.cos(i * 0.4), -2.4 + i * 0.006, 0.7 + 0.4 * math.sin(i * 0.4)) for i in range(100)], 0.04, "contactos", seg=6)


@pieza("pila_aa", "control_remoto", "#9caebc", 0.7)
def pila_aa():
    """Pila cilíndrica AA esquemática con terminal positivo saliente; sin química ni voltaje asignados."""
    cilindro(0.7, 4.8, (0, 0, 2.5), seg=28)
    for z in (0.1, 4.9):
        cilindro(0.72, 0.1, (0, 0, z), "metal", seg=28)
    cilindro(0.25, 0.2, (0, 0, 5.05), "contactos", seg=20)
    aro(0.62, 0.4, 0.05, 4.98, "goma")


@pieza("led_infrarrojo", "control_remoto", "#899aaf", 0.05, 0.25)
def led_infrarrojo():
    """Emisor infrarrojo de control: cápsula redondeada y dos terminales, sin longitud de onda especificada."""
    cilindro(0.25, 0.6, (0, 0, 0.6), seg=24)
    esfera(0.25, (0, 0, 0.9), seg=20, anillos=10)
    cilindro(0.3, 0.1, (0, 0, 0.25), "plastico", seg=20)
    for x in (-0.12, 0.12):
        cilindro(0.03, 1, (x, 0, -0.3), "contactos", seg=8)


@pieza("carcasa_cargador", "cargador", "#a2b3c1", 0.05)
def carcasa_cargador():
    """Carcasa vacía de cargador de celular con alojamiento USB; sin clavija ni circuito dentro."""
    o = caja((3.5, 3, 4.5), (0, 0, 2.25), bisel=0.5)
    restar(o, caja((2.9, 2.4, 5), (0, 0, 1.8), mat=None, bisel=0.3))
    restar(o, caja((1.3, 1, 0.6), (0, -1.4, 3.6), mat=None, bisel=0.1))


@pieza("clavija_red", "cargador", "#b6c3ce", 0.8)
def clavija_red():
    """Clavija ilustrativa de dos espigas con soporte aislante; no declara norma ni compatibilidad local."""
    caja((3, 1.6, 0.5), (0, 0, 0.25), "plastico", bisel=0.2)
    for x in (-0.9, 0.9):
        cilindro(0.2, 1.8, (x, 0, 1.4), seg=20)


@pieza("nucleo_ferrita", "cargador", "#4c535d", 0.1, 0.65)
def nucleo_ferrita():
    """Núcleo toroidal de ferrita con bobinado de cobre simplificado, sin valor de inductancia."""
    aro(1.3, 0.7, 0.8, 0.4)
    for i in range(12):
        a = i * math.pi / 6
        pts = []
        for j in range(13):
            b = j * math.pi / 6
            r = 1 + 0.4 * math.cos(b)
            pts.append((r * math.cos(a), r * math.sin(a), 0.4 + 0.55 * math.sin(b)))
        tubo(pts, 0.07, "cobre", seg=6)


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
    mundo = bpy.data.worlds.new("estudio_cotidianos")
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
    datos = bpy.data.cameras.new("camara_cotidianos")
    datos.type = "ORTHO"
    datos.clip_start = 0.01
    datos.clip_end = 4000
    cam = bpy.data.objects.new("camara_cotidianos", datos)
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
