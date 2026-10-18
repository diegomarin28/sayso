"""Publicación aislada: python3 assets/models/blender/publicar_familia.py SCRIPT.py."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[3]
script = Path(sys.argv[1]).resolve()
with tempfile.TemporaryDirectory(prefix="sayso-familia-") as tmp:
    crudos, optimizados = Path(tmp) / "crudos", Path(tmp) / "optim"
    crudos.mkdir(); optimizados.mkdir()
    subprocess.run([os.environ.get("BLENDER_BIN", "/Applications/Blender.app/Contents/MacOS/Blender"), "-b", "--factory-startup", "--python", str(script), "--", "--salida", str(crudos)], check=True, cwd=root)
    subprocess.run(["node", str(Path(__file__).with_name("optimizar.mjs")), str(crudos), str(optimizados)], check=True, cwd=root)
    indice = json.loads((optimizados / "indice.json").read_text())
    destino = root / "public/models/piezas"
    anterior = json.loads((destino / "indice.json").read_text())
    for id, datos in indice["tipos"].items():
        if id in anterior["tipos"] and anterior["tipos"][id]["familia"] != datos["familia"]:
            raise ValueError("Tipo de otra familia: " + id)
    for archivo in indice["familias"].values():
        if (optimizados / archivo).stat().st_size > 200 * 1024:
            raise ValueError("Familia excede 200 KiB: " + archivo)
    for archivo in indice["familias"].values():
        shutil.copy2(optimizados / archivo, destino / archivo)
    propias = set(indice["familias"])
    anterior["tipos"] = {k:indice["tipos"].get(k, v) for k,v in anterior["tipos"].items()
                          if v["familia"] not in propias or k in indice["tipos"]}
    for k in ("familias", "tipos"):
        anterior[k].update(indice[k])
    (destino / "indice.json").write_text(json.dumps(anterior, ensure_ascii=False, indent=1) + "\n")
