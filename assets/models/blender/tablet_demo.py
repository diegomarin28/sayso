"""Tablet genérica, pantalla hacia arriba y piezas desmontables; sin selección por marca."""
from pathlib import Path
import runpy
H = runpy.run_path(str(Path(__file__).with_name('estudio_demo.py')))
globals().update({k: H[k] for k in ('CORE', 'caja', 'cilindro', 'prisma', 'restar', 'varios', 'redondeado', 'anillo')})
D = []


def pieza(id, ajuste='libre'):
    def registrar(fn):
        D.append((id, ajuste, 'tablet tableta ipad', fn))
        return fn
    return registrar


@pieza('marco@tablet')
def marco():
    """Marco perimetral hueco de tablet, perfil fino y aberturas de carga y botones."""
    c = anillo(17.5, 25, 0.75, 0.22, radio=1.1)
    restar(c, caja((1, 1, 0.3), (0, -12.5, 0), mat=None, bisel=0.1))
    for x in (-6, 6):
        for i in range(5):
            cilindro(0.07, 0.06, (x + i * 0.22, -12.51, 0), 'ranura', seg=8, eje='y')


@pieza('tapa_trasera@tablet')
def trasera():
    """Carcasa trasera desmontable: placa fina con labio perimetral y abertura de cámara."""
    c = prisma(redondeado(17.45, 24.95, 1.1), 0.1, (0, 0, 0))
    restar(c, cilindro(0.55, 1, (-6.8, 10.5, 0), mat=None, seg=32))
    anillo(17.35, 24.85, 0.2, 0.12, z=0.12, radio=1)


@pieza('pantalla@tablet')
def pantalla():
    """Frente completo de tablet con vidrio, bisel continuo y cámara frontal; cara activa +Y GLB."""
    prisma(redondeado(17.3, 24.8, 1), 0.16, (0, 0, 0), 'plastico')
    prisma(redondeado(15.9, 23.3, 0.45), 0.025, (0, 0, 0.095), 'vidrio')
    cilindro(0.09, 0.015, (0, 12, 0.105), 'lente', seg=20)
    caja((3, 0.06, 0.008), (0, -11.2, 0.113), 'etiqueta', bisel=0.02)


@pieza('bateria@tablet')
def bateria():
    """Batería plana de dos celdas pouch, lengüetas de adhesivo y flex; independiente del panel."""
    CORE['COLORES']['cuerpo.bateria'] = ('#303a43', 0.05, 0.7)
    for x in (-3.2, 3.2):
        prisma(redondeado(6, 17, 0.3), 0.35, (x, 0, 0))
        caja((4.8, 4, 0.01), (x, 2, 0.185), 'etiqueta', bisel=0.1)
        for i in range(5):
            caja((3.2, 0.08, 0.01), (x, 2.9 - i * 0.4, 0.195), 'tinta')
        caja((0.55, 1.2, 0.025), (x, -8.7, -0.18), 'goma')
    caja((1, 3, 0.04), (6.7, 3, 0), 'cobre')


# Se reutilizan la placa, cámara y tornillo existentes por nombre; no se duplican en el índice.
REUSO = [CORE[n] for n in ('placa_compacta', 'camara', 'tornillo') if n in CORE]
M = {}
for escala in (1, 1.22):
    for abierto in (False, True):
        piezas = [
            {'tipo': 'marco@tablet', 'pos': [0, 0, 0], 'escala': escala},
            {'tipo': 'tapa_trasera@tablet', 'pos': [(-22 if abierto else 0) * escala, 0, (-0.4 if not abierto else 2) * escala], 'escala': escala},
            {'tipo': 'bateria@tablet', 'pos': [-2 * escala, 0, 0.02 * escala], 'escala': 0.8 * escala},
            {'tipo': 'pantalla@tablet', 'pos': [(22 if abierto else 0) * escala, 0, (0.48 if not abierto else 5) * escala], 'escala': escala},
        ]
        for fn in REUSO:
            # Nombre del nodo registrado por las funciones existentes del repo.
            tipo = {'placa_compacta': 'placa', 'camara': 'camara', 'tornillo': 'tornillo'}[fn.__name__]
            if tipo == 'tornillo':
                for i, (x, y) in enumerate([(-7.8, -11.5), (7.8, -11.5), (-7.8, 11.5), (7.8, 11.5)]):
                    piezas.append({'tipo': tipo, 'pos': [x * escala, y * escala, (0.3 if not abierto else 5 + i * 0.35) * escala], 'escala': 0.4 * escala})
            else:
                piezas.append({'tipo': tipo, 'pos': [(5.7 if tipo.startswith('placa') else -6.8) * escala, (1 if tipo.startswith('placa') else 10.5) * escala, 0.05 * escala], 'escala': (0.75 if tipo.startswith('placa') else 1) * escala})
        M[f'tablet_{"abierta" if abierto else "cerrada"}_{escala}'] = piezas

if __name__ == '__main__':
    H['ejecutar']('tablet_demo', D, M, REUSO)
