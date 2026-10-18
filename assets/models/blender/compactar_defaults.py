"""Compacta defaults JSON de GLB sin tocar su bloque binario ni su apariencia.
Uso: python3 assets/models/blender/compactar_defaults.py public/models/piezas/cotidianos.glb
"""
import json
from pathlib import Path
import struct
import sys

def compactar(ruta):
    original = ruta.read_bytes()
    magic, version, total = struct.unpack_from('<4sII', original)
    assert magic == b'glTF' and version == 2 and total == len(original)
    largo, tipo = struct.unpack_from('<I4s', original, 12)
    assert tipo == b'JSON'
    datos = json.loads(original[20:20+largo])
    # Estos valores son defaults de glTF 2.0; se omiten, no se redondean números.
    for a in datos.get('accessors', []):
        if a.get('normalized') is False:
            del a['normalized']
        if a.get('byteOffset') == 0:
            del a['byteOffset']
    for vista in datos.get('bufferViews', []):
        if vista.get('byteOffset') == 0:
            del vista['byteOffset']
    texto = json.dumps(datos, ensure_ascii=False, separators=(',', ':')).encode()
    texto += b' ' * (-len(texto) % 4)
    resto = original[20+largo:]
    nuevo = struct.pack('<4sII', magic, version, 20+len(texto)+len(resto))
    nuevo += struct.pack('<I4s', len(texto), b'JSON') + texto + resto
    assert nuevo[20+len(texto):] == resto  # índices, vértices y recetas idénticos.
    if len(nuevo) < len(original):
        ruta.write_bytes(nuevo)
    print(f'{ruta.name}: {len(original)} -> {min(len(nuevo),len(original))} bytes')

if __name__ == '__main__':
    for nombre in sys.argv[1:]:
        compactar(Path(nombre))
