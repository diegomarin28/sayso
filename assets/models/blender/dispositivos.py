"""Familia independiente para aspiradora, secador, impresora, consola, router y cafetera.

Reutiliza las primitivas del script del repo sin ejecutar ni reexportar sus familias.
    blender -b --factory-startup --python assets/models/blender/dispositivos.py -- \
      --salida public/models/piezas --renders /ruta/renders

Solo escribe dispositivos.glb y su sección de indice.json. IDs genéricos, cm reales,
materiales por pieza, sin información de modelos comerciales ni procedimientos de reparación.
"""
import argparse
import json
import math
import os
from pathlib import Path
import runpy
import sys

CORE = runpy.run_path(str(Path(__file__).with_name("piezas.py")), run_name="biblioteca_blender")
bpy = CORE["bpy"]
caja, cilindro, prisma = (CORE[n] for n in ("caja", "cilindro", "prisma"))
restar, varios, tubo = (CORE[n] for n in ("restar", "varios", "tubo"))
esfera, girar, redondeado = (CORE[n] for n in ("esfera", "girar", "redondeado"))
armar = CORE["armar"]
ASP = "aspiradora aspirador vacuum"
SEC = "secador secadora pelo cabello"
IMP = "impresora printer multifuncion plotter"
CON = "consola videojuegos playstation xbox nintendo"
RED = "router modem wifi enrutador ont"
CAF = "cafetera espresso cafe expreso"
FAMILIA = "dispositivos"

# Cuerpo de cada tipo. Los detalles usan las recetas ya existentes del repo.
PALETA = {}
PIEZAS = []


def pieza(nombre, equipos, color="#454d55", metal=0.1, rug=0.5):
    """Registro explícito: IDs estables; el orden también es estable para regenerar el índice."""
    def registrar(fn):
        PALETA["cuerpo." + nombre.split("@")[0]] = (color, metal, rug)
        def crear():
            fn()
            return armar(nombre, equipos)
        crear.__name__ = fn.__name__
        crear.__doc__ = fn.__doc__
        PIEZAS.append((nombre, equipos, crear))
        return crear
    return registrar


@pieza("deposito_polvo", ASP, "#a3b7c1", 0.1, 0.3)
def deposito_polvo():
    """Depósito desmontable de polvo: recipiente abierto, fondo, borde y manija lateral."""
    c = cilindro(6, 16, (0, 0, 8), seg=32)
    restar(c, cilindro(5.6, 17, (0, 0, 9), mat=None, seg=32))
    caja((1, 3, 7), (6, 0, 9), "plastico", bisel=0.3)
    aro = cilindro(6.3, 0.4, (0, 0, 16), seg=32)
    restar(aro, cilindro(5.6, 0.9, (0, 0, 16), mat=None, seg=32))


@pieza("filtro_hepa", ASP, "#e4dfcd", 0, 0.8)
def filtro_hepa():
    """Filtro HEPA rectangular: marco, pliegues de papel y lengüeta de extracción."""
    c = caja((12, 8, 2), (0, 0, 1), "plastico", bisel=0.25)
    restar(c, caja((10.5, 6.5, 3), (0, 0, 1), mat=None))
    for i in range(22):
        p = caja((0.12, 6.3, 1.5), (-5 + i * 10 / 21, 0, 1))
        girar(p, (0, (-1 if i % 2 else 1) * 0.25, 0))
    caja((2, 1, 0.3), (0, -4.3, 1), "plastico")


@pieza("cepillo_rotativo", ASP, "#333940", 0.1, 0.65)
def cepillo_rotativo():
    """Cepillo de piso: rodillo, dos hileras helicoidales de cerdas y apoyos del eje."""
    cilindro(1.7, 22, (0, 0, 2), seg=28, eje="x")
    cilindro(0.35, 26, (0, 0, 2), "metal", seg=12, eje="x")
    for k in range(2):
        for i in range(36):
            a = i * 0.22 + k * math.pi
            c = caja((0.3, 0.15, 0.9), (-10.5 + i * 0.6, 2 * math.sin(a), 2 + 2 * math.cos(a)), "goma")
            girar(c, (-a, 0, 0))


@pieza("boquilla_suelo", ASP, "#363e45", 0.05, 0.6)
def boquilla_suelo():
    """Boquilla de aspiración de piso: cuerpo ancho, abertura inferior y conexión articulada."""
    c = caja((26, 10, 4), (0, 0, 2), bisel=0.8)
    restar(c, caja((23, 3, 2), (0, 0, 0), mat=None))
    girar(cilindro(1.8, 8, (0, 2.5, 6), "plastico", seg=24), (-0.5, 0, 0))
    for x in (-11, 11):
        cilindro(1.7, 1.5, (x, 3, 1.7), "goma", seg=20, eje="x")


@pieza("separador_ciclon", ASP, "#899ba8", 0.15, 0.45)
def separador_ciclon():
    """Separador ciclónico: cono hueco, aro superior y entrada tangencial simplificada."""
    c = cilindro(1.2, 13, (0, 0, 6.5), r_arriba=4.5, seg=32)
    restar(c, cilindro(0.9, 13.6, (0, 0, 6.5), r_arriba=4.1, mat=None, seg=32))
    cilindro(4.8, 0.5, (0, 0, 13), "plastico", seg=32)
    caja((4, 2.5, 2), (4.8, 0, 2.3), "plastico", bisel=0.3)


@pieza("rueda_goma", ASP, "#34383c", 0, 0.8)
def rueda_goma():
    """Rueda con banda de goma, cubo y eje: base móvil o aspiradora."""
    cilindro(4, 2, (0, 0, 4), seg=32, eje="x")
    cilindro(2.6, 2.2, (0, 0, 4), "plastico", seg=28, eje="x")
    cilindro(0.5, 3.5, (0, 0, 4), "metal", seg=16, eje="x")
    for i in range(24):
        a = i * 2 * math.pi / 24
        c = caja((1.9, 0.18, 0.15), (0, 4 * math.sin(a), 4 + 4 * math.cos(a)), "goma")
        girar(c, (-a, 0, 0))


@pieza("carcasa_secador", SEC, "#606c79", 0.15, 0.35)
def carcasa_secador():
    """Carcasa esquemática de secador: barril hueco, mango inclinado y boca de salida."""
    c = cilindro(4.2, 16, (0, 0, 15), seg=36, eje="x", bisel=0.3)
    restar(c, cilindro(3.7, 18, (0, 0, 15), mat=None, seg=36, eje="x"))
    girar(caja((3.5, 4, 11), (-3, 0, 7), bisel=0.8), (0, -0.25, 0))
    for x in (-6.5, 6.5):
        c = cilindro(4.4, 0.4, (x, 0, 15), "plastico", seg=36, eje="x")
        restar(c, cilindro(3.7, 0.9, (x, 0, 15), mat=None, seg=36, eje="x"))


@pieza("boquilla_concentradora", SEC, "#31383e", 0.05, 0.5)
def boquilla_concentradora():
    """Boquilla concentradora de secador: entrada circular y salida achatada abierta."""
    c = cilindro(3.8, 3, (-3, 0, 4), seg=32, eje="x")
    restar(c, cilindro(3.4, 4, (-3, 0, 4), mat=None, seg=32, eje="x"))
    c = caja((6, 2.8, 5.8), (0.5, 0, 4), bisel=0.3)
    restar(c, caja((7, 2.1, 5.1), (0.5, 0, 4), mat=None))


@pieza("difusor_secador", SEC, "#363f47", 0.05, 0.5)
def difusor_secador():
    """Difusor de secador: copa perforada y dedos redondeados para distribuir el aire."""
    disco = cilindro(7, 0.5, (0, 0, 2.8), seg=36)
    huecos = [("cilindro", (0.35, 1.1), (2.5 * math.cos(i * math.pi / 6), 2.5 * math.sin(i * math.pi / 6), 2.8)) for i in range(12)]
    restar(disco, varios(huecos))
    c = cilindro(7.3, 2.8, (0, 0, 1.4), seg=36)
    restar(c, cilindro(6.8, 3.4, (0, 0, 1.4), mat=None, seg=36))
    for i in range(9):
        a = i * 2 * math.pi / 9
        x, y = 4.5 * math.cos(a), 4.5 * math.sin(a)
        cilindro(0.45, 3, (x, y, 4.3), seg=12)
        esfera(0.45, (x, y, 5.8), seg=12, anillos=6)
    cilindro(2.8, 2.5, (0, 0, -1.1), "plastico", seg=28)


@pieza("selector_deslizante", SEC, "#394149", 0.05, 0.55)
def selector_deslizante():
    """Selector deslizante genérico con carril, corredera estriada y terminales, sin pinout."""
    caja((4.5, 1.7, 1), (0, 0, 0.5), bisel=0.15)
    caja((2.8, 0.7, 0.1), (0, 0, 1.05), "ranura")
    caja((1, 1, 0.5), (0.5, 0, 1.3), "plastico")
    for i in range(4):
        caja((0.12, 0.8, 0.1), (0.2 + i * 0.2, 0, 1.6), "metal")
    for x in (-1.3, 0, 1.3):
        caja((0.3, 0.1, 0.6), (x, 0, -0.3), "contactos")


@pieza("soporte_mica", SEC, "#c2b59d", 0, 0.85)
def soporte_mica():
    """Soporte aislante de mica en cruz para secador: placas y ranuras ilustrativas, sin alambre calefactor."""
    for a in (0, math.pi / 2):
        p = caja((10, 0.12, 5), (0, 0, 3))
        girar(p, (0, 0, a))
    for x in (-3, 0, 3):
        caja((0.3, 5, 0.2), (x, 0, 3), "conector")


@pieza("cartucho_tinta", IMP, "#30383f", 0.05, 0.45)
def cartucho_tinta():
    """Cartucho de tinta: cuerpo, etiqueta, contactos y salida inferior, sin compatibilidad de marca."""
    caja((4, 3.5, 5), (0, 0, 2.5), bisel=0.3)
    caja((3, 2.5, 0.03), (0, 0, 5.02), "etiqueta")
    for i in range(8):
        caja((0.25, 0.05, 0.5), (-1.3 + i * 0.36, -1.78, 2.7), "contactos")
    cilindro(0.5, 0.3, (0, 0, -0.1), "goma", seg=16)


@pieza("cartucho_toner", IMP, "#3d464e", 0.05, 0.5)
def cartucho_toner():
    """Cartucho de tóner: depósito alargado, asa, extremos y rodillo visible."""
    caja((25, 7, 7), (0, 0, 3.5), bisel=0.7)
    cilindro(1.2, 23, (0, -4, 3), "goma", seg=28, eje="x")
    for x in (-13, 13):
        caja((1, 8, 8), (x, 0, 4), "plastico")
    caja((10, 1, 1.3), (0, 0, 8.5), "plastico", bisel=0.3)
    caja((2, 5, 1.5), (-4, 0, 7.7), "plastico")
    caja((2, 5, 1.5), (4, 0, 7.7), "plastico")


@pieza("cabezal_impresion", IMP, "#4c5760", 0.35, 0.4)
def cabezal_impresion():
    """Cabezal de inyección: bloque, conexiones de tinta y placa de boquillas inferior."""
    caja((7, 5, 4), (0, 0, 2), bisel=0.2)
    caja((5, 3, 0.2), (0, 0, -0.1), "metal")
    for i in range(4):
        cilindro(0.4, 0.8, (-2.3 + i * 1.5, 0, 4.4), "conector", seg=12)
    caja((5, 0.2, 2.5), (0, 2.6, 2.4), "pcb")


@pieza("carro_impresion", IMP, "#47515a", 0.05, 0.55)
def carro_impresion():
    """Carro de impresión: bastidor abierto, apoyos del riel y pestañas de retención."""
    c = caja((13, 8, 6), (0, 0, 3), bisel=0.2)
    restar(c, caja((11, 7, 7), (0, -0.5, 4), mat=None))
    for x in (-5, 5):
        c = cilindro(1.3, 2, (x, 4, 3.8), "plastico", seg=20, eje="x")
        restar(c, cilindro(0.8, 3, (x, 4, 3.8), mat=None, seg=20, eje="x"))
    caja((3, 0.4, 1), (0, -4.2, 5.2), "conector")


@pieza("rodillo_arrastre", IMP, "#43494f", 0, 0.85)
def rodillo_arrastre():
    """Rodillo de papel segmentado: tres camisas de goma sobre un eje metálico."""
    cilindro(0.35, 28, (0, 0, 1), "metal", seg=12, eje="x")
    for x in (-9, 0, 9):
        cilindro(1, 5, (x, 0, 1), seg=24, eje="x")


@pieza("riel_lineal", IMP, "#b8c1c8", 0.85, 0.25)
def riel_lineal():
    """Guía lineal de carro: barra rectificada y dos apoyos desmontables."""
    cilindro(0.6, 32, (0, 0, 2), seg=20, eje="x")
    for x in (-15, 15):
        caja((2, 3, 3), (x, 0, 1.5), "plastico", bisel=0.2)


@pieza("cinta_encoder", IMP, "#a7b9c6", 0.1, 0.4)
def cinta_encoder():
    """Cinta codificadora óptica: banda con marcas y ojales de sujeción, sin resolución calibrada."""
    caja((30, 0.08, 1.2), (0, 0, 0.8))
    for i in range(64):
        caja((0.05, 0.02, 0.8), (-14 + i * 28 / 63, -0.05, 0.8), "ranura")
    for x in (-15.4, 15.4):
        caja((0.8, 0.2, 0.8), (x, 0, 0.8), "metal")


@pieza("engranaje_arrastre", IMP, "#d6d7ca", 0, 0.55)
def engranaje_arrastre():
    """Engranaje de arrastre de papel: rueda dentada, cubo y agujero central, no apto para fabricación."""
    c = cilindro(2.7, 0.7, (0, 0, 0.35), seg=32)
    restar(c, cilindro(0.45, 2, (0, 0, 0.35), mat=None, seg=16))
    for i in range(24):
        a = i * 2 * math.pi / 24
        caja((0.4, 0.35, 0.7), (2.8 * math.cos(a), 2.8 * math.sin(a), 0.35), rot_z=a)


@pieza("unidad_optica", CON, "#a8b2bc", 0.75, 0.4)
def unidad_optica():
    """Unidad óptica de consola: carcasa metálica, abertura de disco y conectores traseros."""
    caja((14, 14, 2.2), (0, 0, 1.1), bisel=0.2)
    caja((12, 0.2, 0.45), (0, -7.1, 1.2), "ranura")
    cilindro(4.8, 0.12, (0, 0, 2.25), "metal", seg=40)
    for x in (-3, 3):
        caja((3, 0.6, 0.7), (x, 7.2, 0.7), "conector")


@pieza("blindaje_metalico", CON, "#a7b0b8", 0.8, 0.35)
def blindaje_metalico():
    """Blindaje electrónico: chapa plegada con ventanas de ventilación y orejas de montaje."""
    c = caja((22, 18, 0.2), (0, 0, 0.1))
    cortes = [("caja", (1.4, 8, 0.6), (-8 + i * 2, 0, 0.1)) for i in range(9)]
    restar(c, varios(cortes))
    for y in (-9, 9):
        caja((22, 0.2, 1.2), (0, y, 0.6), "metal")
    for x in (-10, 10):
        caja((1, 2, 0.2), (x, -10, 0.1), "metal")


@pieza("placa_consola", CON, "#285b4e", 0.1, 0.5)
def placa_consola():
    """Placa genérica de consola: procesador, memorias, conectores y reguladores sin distribución de marca."""
    caja((20, 16, 0.18), (0, 0, 0.1))
    caja((4, 4, 0.4), (0, 0, 0.4), "chip")
    caja((3.6, 3.6, 0.05), (0, 0, 0.63), "metal")
    for x in (-5, 5):
        for y in (-4, 0, 4):
            caja((2.5, 1.5, 0.25), (x, y, 0.32), "chip")
    for x in (-6, 0, 6):
        caja((3, 1.7, 1), (x, 7.5, 0.7), "metal")


@pieza("puerto_hdmi", CON, "#abb6bf", 0.85, 0.3)
def puerto_hdmi():
    """Puerto HDMI esquemático: carcasa trapezoidal abierta, lengüeta y contactos, sin pinout."""
    c = prisma([(-0.8, -0.6), (0.8, -0.6), (1, 0.6), (-1, 0.6)], 0.8, (0, 0, 0.4))
    restar(c, caja((1.4, 2, 0.45), (0, 0, 0.4), mat=None))
    caja((1.3, 0.8, 0.12), (0, 0.1, 0.25), "conector")
    for i in range(9):
        caja((0.05, 0.45, 0.03), (-0.55 + i * 0.14, -0.1, 0.33), "contactos")


@pieza("conector_usb_a", CON + " " + RED + " " + IMP, "#aab6bf", 0.85, 0.3)
def conector_usb_a():
    """Conector USB-A: caja metálica abierta y lengüeta con cuatro contactos."""
    c = caja((1.6, 1.6, 0.75), (0, 0, 0.4))
    restar(c, caja((1.35, 2, 0.5), (0, 0, 0.4), mat=None))
    caja((1.25, 1, 0.15), (0, 0.2, 0.3), "plastico")
    for x in (-0.45, -0.15, 0.15, 0.45):
        caja((0.12, 0.6, 0.03), (x, 0, 0.4), "contactos")


@pieza("joystick_analogico", CON, "#424a52", 0.2, 0.5)
def joystick_analogico():
    """Módulo de joystick analógico: caja, sensores laterales, eje y capuchón cóncavo simplificado."""
    caja((2, 2, 1.4), (0, 0, 0.7), "metal", bisel=0.1)
    for x in (-1.1, 1.1):
        caja((0.3, 1.5, 0.8), (x, 0, 0.7))
    cilindro(0.3, 1.2, (0, 0, 1.8), "metal", seg=12)
    cilindro(0.9, 0.35, (0, 0, 2.5), "goma", seg=24, bisel=0.1)
    caja((1.7, 1.7, 0.2), (0, 0, 0.05))


@pieza("boton_gatillo", CON, "#394149", 0.05, 0.45)
def boton_gatillo():
    """Gatillo genérico de mando: palanca curva con pivote y apoyo del resorte."""
    prisma([(-1.5, -1), (1.5, -1), (1.8, 0.2), (1, 1.5), (-1, 1.5)], 0.7, (0, 0, 0.6))
    cilindro(0.3, 4, (0, -0.6, 0.7), "metal", seg=12, eje="x")
    caja((0.8, 0.8, 0.8), (0, 0.8, 0.2), "plastico")


@pieza("antena_wifi", RED, "#555e67", 0.05, 0.5)
def antena_wifi():
    """Antena externa articulada: cuerpo, bisagra y base roscada, sin frecuencia ni ganancia especificadas."""
    cilindro(0.65, 16, (0, 0, 9), seg=20, bisel=0.2)
    esfera(0.65, (0, 0, 17), seg=16, anillos=8)
    cilindro(0.9, 2, (0, 0, 1.1), "plastico", seg=20)
    cilindro(0.5, 1.2, (0, 0, -0.4), "contactos", seg=16)


@pieza("placa_router", RED, "#28654a", 0.1, 0.5)
def placa_router():
    """Placa de router o módem: chip central, memorias, alimentación y conectores de antena ilustrativos."""
    caja((12, 9, 0.16), (0, 0, 0.1))
    caja((2, 2, 0.35), (0, 0, 0.35), "chip")
    caja((1.8, 1, 0.25), (-3, 0, 0.3), "chip")
    for x in (-4, -1, 2):
        caja((2.3, 1.8, 1.6), (x, 3.4, 0.95), "metal")
    for x in (-5, 5):
        cilindro(0.2, 0.12, (x, -3.4, 0.24), "contactos", seg=12)


@pieza("puerto_rj45", RED, "#454d55", 0.1, 0.5)
def puerto_rj45():
    """Puerto de red RJ45: entrada abierta, guía de pestaña, ocho contactos e indicadores."""
    c = caja((1.8, 2, 1.6), (0, 0, 0.8), bisel=0.1)
    restar(c, caja((1.35, 2.3, 0.95), (0, -0.2, 0.85), mat=None))
    for i in range(8):
        caja((0.06, 0.9, 0.05), (-0.55 + i * 0.16, 0, 0.4), "contactos")
    for x in (-0.65, 0.65):
        caja((0.2, 0.15, 0.15), (x, -1.03, 1.45), "etiqueta")


@pieza("jaula_sfp", RED, "#aeb9c2", 0.85, 0.35)
def jaula_sfp():
    """Jaula metálica de transceptor SFP: alojamiento rectangular y pestañas de retención, sin óptica interna."""
    c = caja((1.7, 6, 1.2), (0, 0, 0.6))
    restar(c, caja((1.4, 6.5, 0.9), (0, 0, 0.6), mat=None))
    for i in range(5):
        caja((0.3, 0.4, 0.08), (0, -2 + i, 1.25), "ranura")


@pieza("conector_coaxial", RED, "#bac3cb", 0.85, 0.3)
def conector_coaxial():
    """Conector coaxial de módem: cuerpo roscado, tuerca y centro aislante."""
    cilindro(0.6, 1.5, (0, 0, 0.75), seg=24)
    cilindro(0.8, 0.35, (0, 0, 0.3), "metal", seg=6)
    for i in range(6):
        cilindro(0.64, 0.05, (0, 0, 0.5 + i * 0.16), "metal", seg=24)
    cilindro(0.38, 0.05, (0, 0, 1.52), "conector", seg=20)
    cilindro(0.08, 0.05, (0, 0, 1.56), "ranura", seg=12)


@pieza("boton_reset", RED, "#5c6670", 0.05, 0.5)
def boton_reset():
    """Pulsador de reset: cuerpo táctil, actuador y cuatro patas para placa."""
    caja((0.65, 0.65, 0.25), (0, 0, 0.2), "metal")
    cilindro(0.16, 0.35, (0, 0, 0.5), seg=12)
    for x in (-0.38, 0.38):
        for y in (-0.2, 0.2):
            caja((0.18, 0.08, 0.1), (x, y, 0.05), "contactos")


@pieza("deposito_agua", CAF, "#b2c8d3", 0.05, 0.3)
def deposito_agua():
    """Depósito desmontable de agua: recipiente abierto, borde, tapa y toma inferior."""
    c = caja((12, 8, 20), (0, 0, 10), bisel=0.5)
    restar(c, caja((11.2, 7.2, 21), (0, 0, 11), mat=None))
    caja((12.5, 8.5, 0.5), (0, 0, 20.5), "plastico", bisel=0.2)
    cilindro(0.6, 1, (0, 0, -0.5), "goma", seg=16)


@pieza("portafiltro", CAF, "#aeb7bf", 0.8, 0.3)
def portafiltro():
    """Portafiltro de espresso: copa abierta, orejas, mango aislante y dos salidas."""
    c = cilindro(3.2, 2.7, (0, 0, 2), seg=32)
    restar(c, cilindro(2.8, 3, (0, 0, 2.6), mat=None, seg=32))
    cilindro(1, 11, (7.3, 0, 1.7), "plastico", seg=24, eje="x", bisel=0.25)
    for x in (-3.4, 3.4):
        caja((0.9, 1.5, 0.5), (x, 0, 2.7), "metal")
    for y in (-1.2, 1.2):
        cilindro(0.4, 1.5, (0, y, 0.2), "metal", seg=16)


@pieza("caldera_cafetera", CAF, "#aebac3", 0.85, 0.35)
def caldera_cafetera():
    """Caldera esquemática de cafetera: recipiente cerrado, tapas atornilladas y racores; sin interior presurizado funcional."""
    cilindro(5, 12, (0, 0, 6), seg=32)
    for z in (0.4, 11.6):
        cilindro(5.5, 0.6, (0, 0, z), "metal", seg=32)
        for i in range(6):
            a = i * 2 * math.pi / 6
            cilindro(0.3, 0.25, (4.8 * math.cos(a), 4.8 * math.sin(a), z + 0.4), "metal", seg=6)
    for x in (-2, 2):
        cilindro(0.65, 1.6, (x, 0, 12.6), "cobre", seg=6)


@pieza("bloque_termico", CAF, "#afb9c0", 0.8, 0.4)
def bloque_termico():
    """Bloque térmico de cafetera: bloque de aluminio con surcos, dos racores y soportes, sin circuito interno."""
    caja((10, 6, 4), (0, 0, 2), bisel=0.3)
    for i in range(5):
        caja((8.5, 0.15, 0.1), (0, -2 + i, 4.05), "ranura")
    for x in (-3, 3):
        cilindro(0.5, 1.2, (x, 0, 4.5), "cobre", seg=6)
    for x in (-5.7, 5.7):
        caja((1.4, 3, 0.5), (x, 0, 0.3), "metal")


@pieza("valvula_antirretorno", CAF, "#b29a61", 0.7, 0.35)
def valvula_antirretorno():
    """Válvula en línea: cuerpo hexagonal y racores en ambos extremos; no indica sentido de flujo real."""
    cilindro(1, 3, (0, 0, 1), seg=6, eje="x")
    for x in (-2.5, 2.5):
        cilindro(0.5, 2, (x, 0, 1), "cobre", seg=20, eje="x")
        for i in range(3):
            cilindro(0.57, 0.12, (x - 0.5 + i * 0.4, 0, 1), "cobre", seg=20, eje="x")


@pieza("molino_muelas", CAF, "#9da8b1", 0.8, 0.4)
def molino_muelas():
    """Par de muelas de molino: anillo dentado y cono central con dientes simplificados, sin ajuste de molienda."""
    c = cilindro(4.5, 1.5, (0, 0, 0.75), seg=36)
    restar(c, cilindro(3, 2, (0, 0, 0.75), mat=None, seg=32))
    cilindro(2.7, 3, (0, 0, 1.5), r_arriba=1, seg=28)
    for i in range(16):
        a = i * 2 * math.pi / 16
        caja((1, 0.2, 1), (3.3 * math.cos(a), 3.3 * math.sin(a), 1), "metal", rot_z=a + 0.2)


@pieza("tolva_cafe", CAF, "#b1c4cf", 0.05, 0.3)
def tolva_cafe():
    """Tolva de granos de café: recipiente cónico abierto, cuello inferior y borde."""
    c = cilindro(2, 10, (0, 0, 5), r_arriba=6, seg=32)
    restar(c, cilindro(1.6, 10.5, (0, 0, 5), r_arriba=5.6, mat=None, seg=32))
    cilindro(2, 2, (0, 0, -1), "plastico", seg=24)


@pieza("lanza_vapor", CAF, "#b8c3cb", 0.85, 0.25)
def lanza_vapor():
    """Lanza de vapor de cafetera: tubo curvo, empuñadura aislante y punta, sin parámetros de presión."""
    tubo([(0, 0, 14), (0, 0, 11), (1, 0, 9), (4, 0, 2), (4, 0, 1)], 0.35, "metal", seg=12)
    cilindro(0.7, 3, (0, 0, 11), "goma", seg=20)
    cilindro(0.55, 1, (4, 0, 0.7), seg=16)
    caja((1.2, 1.2, 0.5), (0, 0, 14), "metal")


@pieza("junta_portafiltro", CAF, "#3a4147", 0, 0.85)
def junta_portafiltro():
    """Junta anular de grupo de café: sello de goma con labio interior, sin medidas de compatibilidad."""
    c = cilindro(3.5, 0.8, (0, 0, 0.4), seg=36)
    restar(c, cilindro(2.6, 1.4, (0, 0, 0.4), mat=None, seg=32))


@pieza("filtro_cafe", CAF, "#aebcc6", 0.85, 0.3)
def filtro_cafe():
    """Canastillo de café: copa metálica abierta con perforaciones ilustrativas en el fondo."""
    c = cilindro(3, 2.5, (0, 0, 1.25), seg=32)
    restar(c, cilindro(2.75, 2.5, (0, 0, 1.6), mat=None, seg=32))
    for x in (-1.5, -0.75, 0, 0.75, 1.5):
        for y in (-1.5, -0.75, 0, 0.75, 1.5):
            cilindro(0.07, 0.03, (x, y, 0.36), "ranura", seg=6)


def cerrar_cuerpos(vacios):
    """Todos los modelos tienen cuerpo explícito para el material y resaltado del visor."""
    for v in vacios:
        if any(o.data.materials[0].name.startswith("cuerpo.") for o in v.children):
            continue
        principal = max(v.children, key=lambda o: len(o.data.vertices))
        principal.data.materials[0] = CORE["material"]("cuerpo." + v.name.split("@")[0])


def guardar_indice(carpeta, tipos):
    CORE["actualizar_indice"](str(carpeta / "indice.json"), {FAMILIA: FAMILIA + ".glb"}, tipos)


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
    mundo = bpy.data.worlds.new("estudio_dispositivos")
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
    datos = bpy.data.cameras.new("camara_dispositivos")
    datos.type = "ORTHO"
    datos.clip_start = 0.01
    datos.clip_end = 4000
    cam = bpy.data.objects.new("camara_dispositivos", datos)
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
    for clave in ["aspiradora", "secador", "impresora", "consola", "router", "cafetera"]:
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
    parser.add_argument("--render-piezas", help="lista separada por comas; las hojas siempre se generan")
    args = parser.parse_args(argv)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    CORE["COLORES"].update(PALETA)
    vacios, tipos = [], {}
    for nombre, equipos, crear in PIEZAS:
        vacio = crear()
        vacios.append(vacio)
        tipos[nombre] = {"familia": FAMILIA, "descripcion": CORE["descripcion"](crear.__doc__), "equipos": equipos}
    cerrar_cuerpos(vacios)
    salida = Path(args.salida)
    salida.mkdir(parents=True, exist_ok=True)
    CORE["exportar"](str(salida / (FAMILIA + ".glb")), vacios)
    guardar_indice(salida, tipos)
    print(f"Familia {FAMILIA}: {len(vacios)} tipos; {(salida / (FAMILIA + '.glb')).stat().st_size} bytes")
    if args.renders:
        renderizar(args.renders, vacios, args.render_piezas.split(",") if args.render_piezas is not None else None)


if __name__ == "__main__":
    main()
