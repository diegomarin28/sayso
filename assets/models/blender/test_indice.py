"""Pruebas del índice sin instalar Blender: python3 assets/models/blender/test_indice.py."""
import ast
import json
import os
from pathlib import Path
import tempfile
import unittest

# Aislar la función pura para que estas pruebas no importen bpy ni ejecuten el modelado.
arbol = ast.parse(Path(__file__).with_name('piezas.py').read_text())
funcion = next(n for n in arbol.body if isinstance(n, ast.FunctionDef) and n.name == 'actualizar_indice')
espacio = {'json': json, 'os': os}
exec(compile(ast.Module(body=[funcion], type_ignores=[]), '<actualizar_indice>', 'exec'), espacio)
actualizar = espacio['actualizar_indice']


class IndiceIndependiente(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.archivo = Path(self.tmp.name) / 'indice.json'

    def test_conserva_otras_familias_en_ambos_ordenes(self):
        for orden in [('computo', 'dispositivos'), ('dispositivos', 'computo')]:
            self.archivo.unlink(missing_ok=True)
            for f in orden:
                actualizar(str(self.archivo), {f: f + '.glb'}, {f + '_pieza': {'familia': f}})
            datos = json.loads(self.archivo.read_text())
            self.assertEqual(set(datos['familias']), {'computo', 'dispositivos'})
            self.assertEqual(set(datos['tipos']), {'computo_pieza', 'dispositivos_pieza'})

    def test_no_reasigna_tipo_de_otro_agente(self):
        actualizar(str(self.archivo), {'movimiento': 'movimiento.glb'}, {'bomba': {'familia': 'movimiento'}})
        antes = self.archivo.read_bytes()
        with self.assertRaises(ValueError):
            actualizar(str(self.archivo), {'dispositivos': 'dispositivos.glb'}, {'bomba': {'familia': 'dispositivos'}})
        self.assertEqual(antes, self.archivo.read_bytes())

    def test_regenerar_es_idempotente_y_retira_solo_sus_tipos_obsoletos(self):
        actualizar(str(self.archivo), {'computo': 'computo.glb'}, {'ram': {'familia': 'computo'}})
        actualizar(str(self.archivo), {'dispositivos': 'dispositivos.glb'}, {'viejo': {'familia': 'dispositivos'}})
        nuevos = {'puerto_rj45': {'familia': 'dispositivos'}}
        actualizar(str(self.archivo), {'dispositivos': 'dispositivos.glb'}, nuevos)
        antes = self.archivo.read_bytes()
        actualizar(str(self.archivo), {'dispositivos': 'dispositivos.glb'}, nuevos)
        self.assertEqual(antes, self.archivo.read_bytes())
        self.assertEqual(set(json.loads(antes)['tipos']), {'ram', 'puerto_rj45'})


if __name__ == '__main__':
    unittest.main()
