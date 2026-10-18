"""Interior genérico de impresoras láser y tinta. Selección por tecnología, sin marcas."""
from pathlib import Path
import runpy
H = runpy.run_path(str(Path(__file__).with_name('estudio_demo.py')))
globals().update({k:H[k] for k in ('CORE','caja','cilindro','restar','anillo')})
D=[]
def pieza(nombre,equipos,ajuste='libre'):
    def reg(fn):
        D.append((nombre,ajuste,equipos,fn))
        return fn
    return reg

@pieza('bandeja_papel@laser','impresora laser')
def bandeja_laser():
    """Cassette extraíble de papel: piso, paredes, guías laterales y asa frontal."""
    caja((33,30,0.35),(0,0,0),'plastico',bisel=.18)
    for x in (-16,16): caja((.5,29,4),(x,0,2),'plastico',bisel=.15)
    caja((32, .6,4),(0,14.7,2),'plastico',bisel=.15)
    caja((33, .8,4.7),(0,-14.7,2),'cuerpo',bisel=.3)
    caja((9,.7,1),(0,-15.2,2),'goma',bisel=.2)
    caja((21,27,1.1),(0,0,.8),'etiqueta',bisel=.04)
    for x in (-10.8,10.8): caja((.35,8,2),(x,2,1.4),'plastico_claro',bisel=.1)
    for z in (.45,.65,.85,1.05): caja((20.9,.015,.025),(0,-13.52,z),'tinta')

@pieza('bandeja_papel@tinta','impresora tinta inkjet')
def bandeja_tinta():
    """Bandeja abierta para alimentación de tinta: papel, guías ajustables y extensión."""
    caja((30,18,.3),(0,0,0),'plastico',bisel=.2)
    for x in (-14.7,14.7): caja((.5,17,1.6),(x,0,.8),'plastico',bisel=.1)
    caja((22,14,.5),(0,0,.42),'etiqueta',bisel=.04)
    for x in (-11.4,11.4): caja((.5,6,1.5),(x,2,.9),'plastico_claro',bisel=.1)
    caja((18,3,.2),(0,-10,.1),'plastico',bisel=.2)

@pieza('placa@impresora','impresora laser tinta inkjet')
def placa():
    """Placa digital de control: procesador, memoria, USB, flex y agujeros de montaje."""
    o=caja((12,9,.12),(0,0,0),'cuerpo',bisel=.12)
    for x in (-5.5,5.5):
        for y in (-4,4): restar(o,cilindro(.15,.6,(x,y,0),mat=None,seg=12))
    caja((2.4,2.4,.25),(-1,0,.18),'chip',bisel=.08)
    for y in (-2,2): caja((1.3,2,.15),(2,y,.15),'chip',bisel=.03)
    for x in (-4,-1,2,4):
        caja((1.2,.6,.3),(x,3.8,.22),'conector',bisel=.06)
        for j in range(4): caja((.08,.4,.03),(x-.3+j*.2,3.8,.39),'contactos')
    o=caja((1.8,1.5,1.1),(-4,-4,.6),'metal',bisel=.1)
    restar(o,caja((1.25,2,.6),(-4,-4,.6),mat=None))
    for x in range(-4,5): caja((.2,.35,.1),(x,-2,.12),'metal',bisel=.02)

@pieza('fuente@impresora','impresora laser tinta inkjet')
def fuente():
    """Fuente conmutada: PCB, transformador aislado, capacitores, disipador y conectores."""
    caja((12,7,.15),(0,0,0),'cuerpo',bisel=.1)
    caja((3,2.8,2.4),(-1,0,1.3),'plastico',bisel=.18)
    caja((2.5,2.9,1.6),(-1,0,1.3),'cobre',bisel=.1)
    for x in (-4.5,3.8):
        cilindro(.65,2.2,(x,1,1.2),'plastico',seg=20)
        cilindro(.6,.02,(x,1,2.31),'metal',seg=20)
    for x in (2.3,2.8,3.3): caja((.13,2.6,2.3),(x,-1.8,1.2),'metal',bisel=.02)
    for x in (-4,4): caja((1.5,.7,.6),(x,-3,.4),'conector',bisel=.06)

@pieza('ventilador_fuente@impresora','impresora laser tinta inkjet','redondo:xz')
def ventilador():
    """Ventilador axial de impresora: marco cuadrado, aspas, motor y fijaciones."""
    o=caja((6,6,1.6),(0,0,0),'plastico',bisel=.2)
    restar(o,cilindro(2.5,3,(0,0,0),mat=None,seg=32))
    for x in (-2.6,2.6):
        for y in (-2.6,2.6): restar(o,cilindro(.16,3,(x,y,0),mat=None,seg=12))
    cilindro(.8,1.5,(0,0,0),'plastico',seg=24)
    import math
    for i in range(7):
        a=i*math.tau/7
        o=caja((.8,1.7,.14),(1.55*math.cos(a),1.55*math.sin(a),.1),'plastico',bisel=.22)
        o.rotation_euler.z=a-.5

F=runpy.run_path(str(Path(__file__).with_name('facultad.py')))
F['CORE']['COLORES'].update(F['PALETA'])
H['BASE']['CORE']['COLORES'].update(H['BASE']['PALETA'])
REUSO=[F['unidad_fusora'],CORE['unidad_laser']]+[H['BASE'][n] for n in ('cartucho_toner','carro_impresion','cabezal_impresion','cartucho_tinta','riel_lineal','cinta_encoder')]
M={}
for tipo in ('laser','tinta'):
    items=[{'tipo':'bandeja_papel@'+tipo,'pos':[0,-20,0]},
           {'tipo':'placa@impresora','pos':[23,0,0]},
           {'tipo':'fuente@impresora','pos':[-23,0,0]}]
    if tipo=='laser': items += [
        {'tipo':'unidad_fusora','pos':[-24,18,0]},
        {'tipo':'unidad_laser','pos':[0,25,0]},
        {'tipo':'cartucho_toner','pos':[0,0,0]},
        {'tipo':'ventilador_fuente@impresora','pos':[24,14,0]}]
    else: items += [
        {'tipo':'riel_lineal','pos':[0,12,0]},
        {'tipo':'cinta_encoder','pos':[0,9,0]},
        {'tipo':'carro_impresion','pos':[-4,0,3]},
        {'tipo':'cabezal_impresion','pos':[-4,-1,0]},
        {'tipo':'cartucho_tinta','pos':[-7,0,8]},
        {'tipo':'cartucho_tinta','pos':[0,0,8]},
    ]
    M['interior_'+tipo]=items
if __name__=='__main__': H['ejecutar']('impresoras_demo',D,M,REUSO)
