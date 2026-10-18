"""Televisor con pie central o patas, exclusivamente por dato explícito del pack."""
from pathlib import Path
import runpy,inspect,math
H=runpy.run_path(str(Path(__file__).with_name('estudio_demo.py')))
CORE=H['CORE'];caja=H['caja'];girar=H['girar']
# Reutiliza exactamente el cuerpo actual, antes del bloque de patas, sin exportar la familia original.
src=inspect.getsource(CORE['carcasa_televisor'])
assert '    abre = 4.5' in src and 'return armar(' in src
entorno=dict(CORE)
exec(src[:src.index('    abre = 4.5')],entorno)
cuerpo=entorno['carcasa_televisor']
D=[]
for pie in ('central','laterales'):
    def crear(pie=pie):
        """Televisor genérico frontal; el cuerpo conserva sus materiales y el apoyo es el dato explícito."""
        cuerpo()
        if pie=='central':
            caja((6,3,6),(0,0,3),'metal',bisel=.25)
            caja((28,5,.65),(0,0,.325),'metal',bisel=.3)
        else:
            abre=4.5;largo=math.hypot(abre,6);angulo=math.atan2(abre,6)
            for sx in (-1,1):
                for lado in (-1,1):
                    p=caja((1.1,4.2,largo),(sx*36+lado*abre/2,0,3),'metal',bisel=.15)
                    girar(p,(0,-lado*angulo,0))
                    caja((2.4,4.8,.35),(sx*36+lado*abre,0,.175),'metal',bisel=.1)
    D.append(('carcasa_tv_dato@pie_'+pie,'libre','televisor tv',crear))
REUSO=[]
M={f'tv_{pie}_{tam}':[{'tipo':'carcasa_tv_dato@pie_'+pie,'pos':[0,0,0],'escala':tam/46,'giro_z':180}] for pie in ('central','laterales') for tam in (46,32)}
if __name__=='__main__':H['ejecutar']('tv_variantes',D,M)
