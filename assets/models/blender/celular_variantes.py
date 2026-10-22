"""Rasgos visuales genéricos de celular. Solo se usan con forma explícita del pack."""
from pathlib import Path
import runpy
H=runpy.run_path(str(Path(__file__).with_name('estudio_demo.py')))
globals().update({k:H[k] for k in ('CORE','caja','cilindro','prisma','redondeado','restar','anillo')})
D=[]
for cantidad in (1,2,3):
    def crear(cantidad=cantidad):
        """Módulo trasero con cantidad explícita de lentes, aro óptico y flex de conexión."""
        caja((2.6,2.6,.12),(0,0,0),'metal',bisel=.15)
        posiciones={1:[(0,0)],2:[(-.6,0),(.6,0)],3:[(-.6,.6),(-.6,-.6),(.6,.6)]}[cantidad]
        for x,y in posiciones:
            cilindro(.5,.45,(x,y,.25),'cuerpo',seg=32,bisel=.03)
            cilindro(.4,.025,(x,y,.49),'metal',seg=32)
            cilindro(.34,.025,(x,y,.515),'optica',seg=32)
            cilindro(.13,.01,(x-.08,y+.08,.535),'vidrio',seg=20)
        caja((.8,1.2,.035),(0,-1.8,0),'cobre')
    D.append(('camara_celular_dato@'+str(cantidad),'proporcional','celular smartphone',crear))
for muesca in (False,True):
    def crear(muesca=muesca):
        """Módulo de pantalla completo: vidrio frontal hacia -Y GLB y chapa con flex hacia el interior."""
        # Activo hacia -Z Blender, como pantalla de celular actual, sin invertir el equipo.
        prisma(redondeado(7.2,15.6,.9),.12,(0,0,.08),'cuerpo')
        g=prisma(redondeado(6.9,15.3,.8),.04,(0,0,-.01),'vidrio')
        if muesca:
            restar(g,caja((2.5,1,.3),(0,7.5,0),mat=None,bisel=.2))
            caja((1.2,.09,.02),(0,7.1,-.045),'metal',bisel=.04)
            cilindro(.1,.025,(.9,7.05,-.04),'lente',seg=20)
        else:
            cilindro(.12,.025,(0,7.1,-.045),'lente',seg=20)
        caja((5.5,11,.03),(0,.4,.16),'goma',bisel=.3)
        caja((1.2,2.2,.03),(0,-6.3,.2),'cobre')
        caja((.9,.4,.1),(0,-5.3,.25),'plastico',bisel=.04)
    D.append(('pantalla_celular_dato@'+('con_muesca' if muesca else 'sin_muesca'),'libre','celular smartphone',crear))
for borde in ('redondeados','rectos'):
    def crear(borde=borde):
        """Marco hueco de celular, esquinas redondeadas y perfil del borde según dato del pack."""
        o=prisma(redondeado(7.4,15.8,.9),.8,(0,0,0),'cuerpo',bisel=.16 if borde=='redondeados' else .025)
        restar(o,prisma(redondeado(6.9,15.3,.65),2,(0,0,0),mat=None))
        restar(o,caja((1.1,1,.35),(0,-7.9,0),mat=None,bisel=.12))
        for x in (-2.5,2.5):
            for i in range(4): cilindro(.07,.12,(x+i*.18,-7.9,0),'ranura',seg=10,eje='y')
    D.append(('marco_celular_dato@'+borde,'libre','celular smartphone',crear))
REUSO=[]
M={nombre:[{'tipo':nombre,'pos':[0,0,0],'giro_x':180 if nombre.startswith('pantalla_') else 0}] for nombre,_,_,_ in D}
if __name__=='__main__':H['ejecutar']('celular_variantes',D,M)
