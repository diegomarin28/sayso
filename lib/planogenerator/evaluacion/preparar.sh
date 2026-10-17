#!/bin/bash
# Baja los manuales (no se suben: copyright) y arma las imágenes que usa la evaluación.
# Requiere: curl, gs (Ghostscript), magick (ImageMagick). Uso: bash lib/planogenerator/evaluacion/preparar.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
# modelo | url | página explosionada | página interior | recorte del interior (a 220 dpi)
CASOS=(
  "t480|https://download.lenovo.com/pccbbs/mobiles_pdf/t480_hmm_en.pdf|57|89|1000x620+520+380"
  "e14-gen4|https://download.lenovo.com/pccbbs/mobiles_pdf/e14_e15_gen4_hmm_en.pdf|55|78|900x640+470+560"
  "l14-gen2|https://download.lenovo.com/pccbbs/mobiles_pdf/l14_l15_gen2_hmm_en.pdf|57|88|820x560+510+1210"
)
for caso in "${CASOS[@]}"; do
  IFS="|" read -r modelo url explosionada interior recorte <<< "$caso"
  dir="manuales/$modelo"
  mkdir -p "$dir/paginas"
  pdf="$dir/$(basename "$url")"
  [ -f "$pdf" ] || curl -fsSL --max-time 300 -o "$pdf" "$url"
  gs -q -dSAFER -dBATCH -dNOPAUSE -sDEVICE=png16m -r130 -dFirstPage="$explosionada" -dLastPage="$explosionada" -sOutputFile="$dir/paginas/explosionada.png" "$pdf"
  gs -q -dSAFER -dBATCH -dNOPAUSE -sDEVICE=png16m -r220 -dFirstPage="$interior" -dLastPage="$interior" -sOutputFile="$dir/paginas/interior-pagina.png" "$pdf"
  magick "$dir/paginas/interior-pagina.png" -crop "$recorte" +repage "$dir/paginas/interior.png"
  echo "$modelo: listo"
done
