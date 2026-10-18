"""Reloj inteligente cuadrado y redondo: formas por dato geométrico, nunca por marca."""
from pathlib import Path
import runpy
H = runpy.run_path(str(Path(__file__).with_name('estudio_demo.py')))
globals().update({k: H[k] for k in ('CORE', 'caja', 'cilindro', 'prisma', 'restar', 'varios', 'redondeado', 'anillo')})
D = []


def pieza(id, ajuste):
    def registrar(fn):
        D.append((id, ajuste, 'smartwatch reloj inteligente wearable', fn))
        return fn
    return registrar


@pieza('caja_reloj@redonda', 'redondo:xz')
def caja_redonda():
    """Caja circular hueca de reloj; bisel, anclajes de correa, puerto de corona separado."""
    c = cilindro(2.3, 1.1, (0, 0, 0), seg=64, bisel=0.08)
    restar(c, cilindro(2.05, 1.8, (0, 0, 0), mat=None, seg=64))
    for y in (-2.05, 2.05):
        for x in (-0.9, 0.9):
            caja((0.3, 0.7, 0.65), (x, y, 0), 'metal', bisel=0.12)
    restar(c, cilindro(0.2, 1, (2.2, 0, 0), mat=None, seg=16, eje='x'))


@pieza('caja_reloj@cuadrada', 'proporcional')
def caja_cuadrada():
    """Caja cuadrada redondeada hueca de smartwatch, 4,4 × 5,2 cm, con anclajes."""
    anillo(4.4, 5.2, 1.1, 0.23, radio=1)
    for y in (-2.5, 2.5):
        caja((2.3, 0.35, 0.25), (0, y, -0.2), 'metal', bisel=0.12)


@pieza('pantalla@reloj_redonda', 'redondo:xz')
def pantalla_redonda():
    """Pantalla circular con bisel fino y vidrio, sin esfera ni agujas analógicas."""
    cilindro(2.1, 0.16, (0, 0, 0), 'metal', seg=64, bisel=0.04)
    cilindro(1.98, 0.07, (0, 0, 0.1), 'vidrio', seg=64, bisel=0.025)
    # Indicadores discretos para reconocer la cara activa.
    for x in (-0.5, 0, 0.5):
        caja((0.28, 0.07, 0.008), (x, -0.8, 0.139), 'etiqueta', bisel=0.02)


@pieza('pantalla@reloj_cuadrada', 'proporcional')
def pantalla_cuadrada():
    """Pantalla cuadrada redondeada, vidrio y bisel independiente de la caja."""
    prisma(redondeado(4.15, 4.95, 0.85, 10), 0.16, (0, 0, 0), 'metal')
    prisma(redondeado(3.95, 4.75, 0.8, 10), 0.06, (0, 0, 0.11), 'vidrio')
    for x in (-0.5, 0, 0.5):
        caja((0.28, 0.07, 0.008), (x, -1, 0.145), 'etiqueta', bisel=0.02)


@pieza('tapa_reloj@cuadrada', 'proporcional')
def tapa_cuadrada():
    """Dorso cuadrado redondeado con ventana para el sensor óptico y cuatro tornillos."""
    c = prisma(redondeado(4.2, 5, 0.9), 0.12, (0, 0, 0))
    restar(c, cilindro(1.03, 1, (0, 0, 0), mat=None, seg=40))
    for x in (-1.5, 1.5):
        for y in (-1.9, 1.9):
            cilindro(0.09, 0.03, (x, y, 0.08), 'metal', seg=12)


@pieza('base_carga_magnetica@reloj', 'proporcional')
def cargador():
    """Base de carga magnética circular con aro de alineación y salida del cable."""
    cilindro(1.8, 0.5, (0, 0, 0), 'plastico_claro', seg=48, bisel=0.12)
    cilindro(1.5, 0.08, (0, 0, 0.28), 'goma', seg=48)
    caja((0.32, 2.5, 0.25), (0, 2.3, -0.03), 'goma', bisel=0.1)


# Reutilización real de las funciones existentes, en el montaje, sin duplicar sus IDs publicados.
COT = runpy.run_path(str(Path(__file__).with_name('cotidianos.py')), run_name='formas_reutilizadas')
COT['CORE']['COLORES'].update(COT['PALETA'])
REUSO = [crear for id, _, crear in COT['PIEZAS'] if id in ('correa_reloj', 'corona_reloj', 'sensor_optico', 'tapa_reloj')]

M = {}
for forma in ('redonda', 'cuadrada'):
    for escala in (1, 0.86):
        M[f'montaje_{forma}_{escala}'] = [
            {'tipo': 'caja_reloj@' + forma, 'pos': [0, 0, 0], 'escala': escala},
            {'tipo': 'pantalla@reloj_' + forma, 'pos': [0, 0, 0.64 * escala], 'escala': escala},
            {'tipo': 'correa_reloj', 'pos': [0, 0, -0.2 * escala], 'escala': escala},
            {'tipo': 'corona_reloj', 'pos': [2.5 * escala, 0, 0], 'escala': escala, 'giro_x': 90},
            {'tipo': 'sensor_optico', 'pos': [0, 0, -0.6 * escala], 'escala': escala},
            {'tipo': 'tapa_reloj@cuadrada' if forma == 'cuadrada' else 'tapa_reloj', 'pos': [0, 0, -0.55 * escala], 'escala': escala},
            {'tipo': 'base_carga_magnetica@reloj', 'pos': [6 * escala, 0, -0.8 * escala], 'escala': escala},
        ]

if __name__ == '__main__':
    H['ejecutar']('relojes_demo', D, M, REUSO)
