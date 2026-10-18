"""Auriculares de diadema: arco, copas huecas y almohadillas, solo por forma explícita."""
from pathlib import Path
import runpy,math
H=runpy.run_path(str(Path(__file__).with_name('estudio_demo.py')))
CORE=H['CORE'];D=[]
def diadema():
    """Diadema curva acolchada que une ambas copas."""
    puntos=[(9.5*math.cos(i*math.pi/32),10*math.sin(i*math.pi/32),0) for i in range(33)]
    H['tubo'](puntos,.5,'cuerpo',seg=12)
    H['tubo']([(x,y,z-.35) for x,y,z in puntos],.27,'goma',seg=12)
def copa():
    """Copa ovalada hueca, con borde y cubierta trasera; no cápsula in-ear estirada."""
    H['anillo'](7,8.6,2.9,.35,radio=3.1)
    H['prisma'](H['redondeado'](6.9,8.5,3),.14,(0,0,1.37),'plastico')
def almohadilla():
    """Almohadilla ovalada con abertura central para la oreja."""
    H['anillo'](6.8,8.4,1.6,1.1,radio=3)
    H['anillo'](6.9,8.5,.15,.35,z=-.7,radio=3)
for nombre,fn in [('diadema',diadema),('copa',copa),('almohadilla',almohadilla)]:D.append(('carcasa_auricular_dato@'+nombre,'libre','auriculares diadema over ear',fn))
REUSO=[]
M={n:[{'tipo':n,'pos':[0,0,0]}]for n,_,_,_ in D}
if __name__=='__main__':H['ejecutar']('auriculares_variantes',D,M)
