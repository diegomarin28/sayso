"""Nombres canónicos de las plantillas, sin condiciones de marca ni modelo."""
from pathlib import Path
import runpy
H = runpy.run_path(str(Path(__file__).with_name('estudio_demo.py')))
CORE = H['CORE']
F = runpy.run_path(str(Path(__file__).with_name('facultad.py')))
F['CORE']['COLORES'].update(F['PALETA'])
D = []
def alias(nombre, fn, equipos):
    def construir():
        grupo = fn()
        for obj in list(grupo.children):
            obj.parent = None
            mat = obj.active_material.name.split('.')[0] if obj.active_material else 'cuerpo'
            obj['mat'] = mat
            CORE['_partes'].append(obj)
        H['bpy'].data.objects.remove(grupo)
    construir.__doc__ = fn.__doc__
    D.append((nombre, 'libre', equipos, construir))
alias('carcasa_televisor', CORE['carcasa_televisor'], 'televisor tv')
alias('pantalla_panel', CORE['pantalla_panel'], 'televisor tv monitor')
alias('placa@televisor', F['placa_principal_av'], 'televisor tv')
alias('placa_carga', CORE['placa_compacta'], 'celular smartphone')
M = {}
for escala in (1, 32/46):
    M[f'tv_{46 if escala == 1 else 32}_pulgadas'] = [
        {'tipo':'carcasa_televisor','pos':[0,0,0],'escala':escala},
        {'tipo':'pantalla_panel','pos':[0,-18*escala,0],'escala':escala},
        {'tipo':'placa@televisor','pos':[70*escala,-18*escala,0],'escala':escala},
    ]
for escala in (1, 1.12):
    M[f'celular_carga_{escala}'] = [{'tipo':'placa_carga','pos':[0,0,0],'escala':escala}]

REUSO = []
if __name__ == '__main__': H['ejecutar']('alineacion_demo', D, M)
