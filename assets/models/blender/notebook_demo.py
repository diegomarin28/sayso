"""Notebook abierta genérica: tapa articulable, palmrest, teclado con teclas nombradas."""
from pathlib import Path
import math
import runpy
H = runpy.run_path(str(Path(__file__).with_name('estudio_demo.py')))
globals().update({k: H[k] for k in ('CORE', 'bpy', 'caja', 'cilindro', 'prisma', 'restar', 'varios', 'redondeado', 'anillo')})
D = []


def pieza(id, ajuste='libre'):
    def registrar(fn):
        D.append((id, ajuste, 'notebook laptop portatil ultrabook', fn))
        return fn
    return registrar


@pieza('base@notebook_abierta')
def base():
    """Cuba inferior hueca de notebook, piso fino y paredes continuas, sin bloque sólido interior."""
    prisma(redondeado(32, 23, 1.1), 0.12, (0, 0, -0.6))
    anillo(32, 23, 1.2, 0.24, radio=1.1)
    for x in (-15, 15):
        for y in (-9, 9):
            cilindro(0.35, 0.15, (x, y, -0.75), 'goma', seg=16)


@pieza('carcasa_superior@notebook')
def superior():
    """Palmrest con borde y aberturas reales para teclado y trackpad; malla independiente."""
    o = prisma(redondeado(32, 23, 1.1), 0.15, (0, 0, 0))
    restar(o, prisma(redondeado(27.6, 11.9, 0.25), 1, (0, 3.3, 0), mat=None))
    restar(o, prisma(redondeado(11, 6.5, 0.4), 1, (0, -6.3, 0), mat=None))
    for x in (-14.5, 14.5):
        for y in range(-5, 8):
            caja((0.5, 0.08, 0.015), (x, y * 0.7, 0.09), 'ranura')


@pieza('carcasa_pantalla@notebook')
def tapa():
    """Tapa de pantalla, bisel y dos bisagras en Y=+10,5 de Blender. Centro geométrico; giro en la bisagra mediante pivote del plano."""
    prisma(redondeado(31, 21, 0.9), 0.12, (0, 0, 0.22))
    anillo(31, 21, 0.45, 0.65, radio=0.9)
    for x in (-10, 10):
        cilindro(0.38, 4, (x, 10.5, 0), 'metal', seg=24, eje='x')
    cilindro(0.13, 0.025, (0, -9.8, -0.24), 'lente', seg=20)


@pieza('pantalla@notebook')
def pantalla():
    """Panel de notebook separado de la tapa, cara activa hacia -Z de Blender (interior al cerrar)."""
    prisma(redondeado(29.7, 19.6, 0.2), 0.1, (0, 0, 0), 'vidrio')
    # Reflejo discreto: el panel sigue apagado, pero se distingue del marco.
    prisma([(-14.3, -9.3), (-10, -9.3), (14.3, 4), (14.3, 8.5)], 0.008, (0, 0, -0.056), 'optica')


@pieza('teclado@bandeja_notebook')
def bandeja():
    """Bandeja de teclado independiente de sus teclas; no duplica las teclas al seleccionarlas."""
    CORE['COLORES']['cuerpo.teclado'] = ('#202731', 0.05, 0.55)
    prisma(redondeado(27.5, 11.8, 0.3), 0.1, (0, 0, 0), 'plastico')


def tecla(nombre, ancho=1.55):
    """Tecla individual con leyenda legible; se publica con nombre propio, incluido tecla_p."""
    id = 'tecla_individual@' + nombre
    def crear():
        CORE['COLORES']['cuerpo.' + id] = ('#202731', 0.05, 0.55)
        prisma(redondeado(ancho, 1.45, 0.16, 4), 0.18, (0, 0, 0), bisel=0.03)
        texto = bpy.data.curves.new(id + '_leyenda', 'FONT')
        texto.body = nombre.upper() if len(nombre) == 1 else {'espacio': '', 'enter': 'ENTER', 'shift': 'SHIFT', 'retroceso': '<'}.get(nombre, nombre.upper())
        texto.align_x, texto.align_y = 'CENTER', 'CENTER'
        texto.size = 0.53 if len(texto.body) == 1 else 0.21
        texto.extrude = 0.003
        o = bpy.data.objects.new(id + '_texto', texto)
        bpy.context.scene.collection.objects.link(o)
        o.location.z = 0.101
        for obj in bpy.context.selected_objects:
            obj.select_set(False)
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.convert(target='MESH')
        o = bpy.context.object
        o['mat'] = 'etiqueta'
        CORE['_partes'].append(o)
    crear.__doc__ = 'Tecla ' + nombre.upper() + ' separada y nombrada; distribución QWERTY genérica.'
    pieza(id, 'proporcional')(crear)
    return id


TECLAS = []
for fila, letras in enumerate(('1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm')):
    for col, letra in enumerate(letras):
        id = tecla(letra)
        TECLAS.append((id, (col - (len(letras) - 1) / 2) * 1.95, 6.5 - fila * 1.95))
for nombre, ancho, x, y in [('espacio', 8, 0, -1.2), ('enter', 2.6, 11.5, 2.6), ('shift', 2.6, -11.5, 0.65), ('retroceso', 2.6, 11.5, 6.5)]:
    TECLAS.append((tecla(nombre, ancho), x, y))

for col, nombre in enumerate(['esc'] + ['f' + str(i) for i in range(1, 13)]):
    TECLAS.append((tecla(nombre, 1.35), (col - 6) * 1.95, 8.5))
for nombre, x, y in [('tab', -11.5, 4.55), ('caps', -11.5, 2.6), ('ctrl', -11.5, -1.2), ('alt', -9.55, -1.2), ('izq', 7.8, -1.2), ('abajo', 9.75, -1.2), ('der', 11.7, -1.2)]:
    TECLAS.append((tecla(nombre), x, y))

FAC = runpy.run_path(str(Path(__file__).with_name('facultad.py')), run_name='reusar_trackpad')
FAC['CORE']['COLORES'].update(FAC['PALETA'])
REUSO = [crear for id, _, crear in FAC['PIEZAS'] if id == 'trackpad']
M = {}
for escala in (1, 1.14):
    # Giro -110° de Blender sobre x: panel interior hacia la persona, borde trasero en +Y.
    ang = math.radians(-110)
    centro = [0, (10.5 - 10.31 * math.cos(ang)) * escala, (1 - 10.31 * math.sin(ang)) * escala]
    panel = [0, centro[1] + (-0.19 * math.cos(ang) + 0.3 * math.sin(ang)) * escala, centro[2] + (-0.19 * math.sin(ang) - 0.3 * math.cos(ang)) * escala]
    M[f'notebook_abierta_{escala}'] = [
        {'tipo': 'base@notebook_abierta', 'pos': [0, 0, 0], 'escala': escala},
        {'tipo': 'carcasa_superior@notebook', 'pos': [0, 0, 0.68 * escala], 'escala': escala},
        {'tipo': 'teclado@bandeja_notebook', 'pos': [0, 3.3 * escala, 0.55 * escala], 'escala': escala},
        {'tipo': 'trackpad', 'pos': [0, -6.3 * escala, 0.6 * escala], 'escala': 0.8 * escala},
        {'tipo': 'carcasa_pantalla@notebook', 'pos': centro, 'escala': escala, 'giro_x': -110},
        {'tipo': 'pantalla@notebook', 'pos': panel, 'escala': escala, 'giro_x': -110},
        *[{'tipo': id, 'pos': [x * escala, y * escala, 0.74 * escala], 'escala': escala} for id, x, y in TECLAS],
    ]

if __name__ == '__main__':
    H['ejecutar']('notebook_demo', D, M, REUSO)
