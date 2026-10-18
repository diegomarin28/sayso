"""Mallas abiertas para el contorno de carcasas y paneles grandes; nunca un plano opaco."""
from pathlib import Path
import math
import runpy
H = runpy.run_path(str(Path(__file__).with_name('estudio_demo.py')))
globals().update({k: H[k] for k in ('CORE', 'caja', 'cilindro', 'prisma', 'restar', 'girar', 'redondeado', 'anillo')})
D, M = [], {}


def registrar(tipo, w, d, h, esp, equipo, parado):
    def crear():
        """Borde perimetral continuo con abertura central real; permite contorno sin cubrir el interior."""
        anillo(w, d, h, esp, radio=min(w, d) * 0.035)
        # Labio fino exterior: una segunda arista legible, sin cruces sobre el interior.
        anillo(w + esp * 0.2, d + esp * 0.2, min(h, esp * 0.35), esp * 0.35,
               z=h / 2, radio=min(w, d) * 0.035)
        if parado:
            for o in CORE['_partes']:
                o.matrix_world = CORE['Matrix'].Rotation(math.pi / 2, 4, 'X') @ o.matrix_world
    D.append((tipo, 'libre', equipo, crear))


registrar('carcasa_contorno@tablet', 17.5, 25, 0.75, 0.22, 'tablet tableta ipad', False)
registrar('panel_contorno@tablet', 17.3, 24.8, 0.16, 0.4, 'tablet tableta ipad', False)
registrar('carcasa_contorno@tv', 100, 60, 8, 1.2, 'televisor tv monitor', True)
registrar('panel_contorno@tv', 99, 59, 0.7, 1, 'televisor tv monitor', True)

REUSO = [CORE['placa_compacta']]
for tipo in ('tablet', 'tv'):
    for escala in (1, 1.2):
        M[f'interior_visible_{tipo}_{escala}'] = [
            {'tipo': 'carcasa_contorno@' + tipo, 'pos': [0, 0, 0], 'escala': escala},
            {'tipo': 'panel_contorno@' + tipo, 'pos': [0, -4.1 * escala, 0] if tipo == 'tv' else [0, 0, 0.4 * escala], 'escala': escala},
            {'tipo': 'placa', 'pos': [0, 0, 0], 'escala': (3 if tipo == 'tv' else 0.9) * escala, 'giro_x': 90 if tipo == 'tv' else 0},
        ]

if __name__ == '__main__':
    H['ejecutar']('contornos_demo', D, M, REUSO)
