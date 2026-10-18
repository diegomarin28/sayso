import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/**
 * GLTFLoader que lee los GLB de la biblioteca: vienen comprimidos con EXT_meshopt_compression
 * (`npm run modelos:comprimir`). El decodificador viene dentro de three: no hay archivos aparte que servir.
 * Las posiciones llegan cuantizadas: `bibliotecaDesdeEscena` las pasa a Float32 antes de usarlas.
 */
export function cargadorGlb(): GLTFLoader {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}
