"""Frentes de tablet activados solo por dato del pack; no reemplazan el frente actual."""
from pathlib import Path
import runpy
H=runpy.run_path(str(Path(__file__).with_name('estudio_demo.py')))
globals().update({k:H[k] for k in ('CORE','prisma','redondeado','cilindro','caja')})
D=[]
for boton in (False,True):
    def crear(boton=boton):
        """Frente de tablet con cámara y botón frontal opcional; vidrio hacia +Y GLB."""
        prisma(redondeado(17.3,24.8,1),.16,(0,0,0),'plastico')
        prisma(redondeado(15.9,21.8 if boton else 23.3,.45),.025,(0,.3 if boton else 0,.095),'vidrio')
        cilindro(.09,.015,(0,12,.105),'lente',seg=20)
        if boton:
            cilindro(.53,.025,(0,-11.4,.105),'metal',seg=40)
            cilindro(.44,.03,(0,-11.4,.12),'plastico',seg=40)
        else:
            caja((3,.06,.008),(0,-11.2,.113),'etiqueta',bisel=.02)
    D.append(('pantalla_tablet_dato@'+('con_boton' if boton else 'sin_boton'),'libre','tablet tableta',crear))
M={n:[{'tipo':n,'pos':[0,0,0]}] for n,_,_,_ in D}
REUSO=[]
if __name__=='__main__':H['ejecutar']('tablet_variantes',D,M)
