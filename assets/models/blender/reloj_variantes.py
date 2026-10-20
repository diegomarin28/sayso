"""Caja de reloj con o sin corona y 1-2 botones laterales, exclusivamente por dato explícito del pack."""
from pathlib import Path
import runpy,inspect,math
# Reutiliza exactamente las cajas actuales (y su mismo estudio); la redonda sin corona corta antes del puerto.
R=runpy.run_path(str(Path(__file__).with_name('relojes_demo.py')),run_name='formas_reutilizadas')
H=R['H'];caja=R['caja']
src=inspect.getsource(R['caja_redonda'])
assert '    restar(c, cilindro(0.2' in src
entorno=dict(R)
exec(src[:src.index('    restar(c, cilindro(0.2')].split('\n',1)[1],entorno)
CUERPO={('redonda',True):R['caja_redonda'],('redonda',False):entorno['caja_redonda'],('cuadrada',True):R['caja_cuadrada'],('cuadrada',False):R['caja_cuadrada']}
# Lado derecho (+X), como la corona del plano; con corona, los botones van debajo de ella.
# Cuadrada: posición a lo largo del lado (cm). Redonda: ángulo sobre el borde (grados).
LUGARES={'cuadrada':{True:{1:[-.8],2:[-.35,-1.15]},False:{1:[0],2:[-.45,.45]}},
         'redonda':{True:{1:[-35],2:[-30,-55]},False:{1:[0],2:[-18,18]}}}
D=[]
for forma in ('cuadrada','redonda'):
    for corona in (True,False):
        for botones in (0,1,2):
            # Con corona y sin botones es la caja de hoy; la cuadrada no tiene puerto de corona.
            if botones==0 and (corona or forma=='cuadrada'):continue
            def crear(forma=forma,corona=corona,botones=botones):
                """Caja de reloj genérica con pulsadores laterales del lado de la corona."""
                CUERPO[(forma,corona)]()
                for v in LUGARES[forma][corona].get(botones,[]):
                    if forma=='cuadrada':caja((.3,.6,.42),(2.28,v,0),'metal',bisel=.1)
                    else:
                        a=math.radians(v)
                        caja((.3,.6,.42),(2.38*math.cos(a),2.38*math.sin(a),0),'metal',bisel=.1,rot_z=a)
            nombre=f"caja_reloj_dato@{forma}_{'c' if corona else 's'}{botones}"
            D.append((nombre,'redondo:xz' if forma=='redonda' else 'proporcional','smartwatch reloj inteligente wearable',crear))
REUSO=[]
M={nombre:[{'tipo':nombre,'pos':[0,0,0]}] for nombre,_,_,_ in D}
if __name__=='__main__':H['ejecutar']('reloj_variantes',D,M)
