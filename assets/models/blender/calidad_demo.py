"""Renders comparables de GLB crudos, con idéntico estudio y encuadre por tipo."""
import argparse
from pathlib import Path
import runpy
import sys
import math
BASE = runpy.run_path(str(Path(__file__).with_name("dispositivos.py")), run_name="herramientas_render")
CORE = BASE["CORE"]
bpy = CORE["bpy"]
EQUIPOS = {
 "relojes": ["caja_reloj", "correa_reloj", "corona_reloj", "mecanismo_reloj", "agujas_reloj", "esfera_reloj", "pantalla@reloj", "sensor_optico", "bobina_carga"],
 "notebook": ["ventilador", "bateria", "bateria@celdas_pegadas", "placa_madre", "placa_logica_integrada", "trackpad", "teclado@notebook", "pantalla"],
 "celular": ["bateria@celular", "pantalla", "placa", "camara", "camara@modulo", "modulo_biometrico"],
 "televisor": ["pantalla@panel", "retroiluminacion", "tira_led", "fuente", "placa_principal_av", "placa_tcon"],
 "heladera": ["compresor", "evaporador", "serpentin", "ventilador@axial"],
 "aire": ["ventilador@tangencial", "serpentin", "compresor", "ventilador@axial"],
 "lavarropas": ["tambor", "bomba", "motor"],
}
def renderizar(carpeta, vacios, seleccion=None):
    """Renders encuadrados por límites proyectados, incluidos componentes muy pequeños."""
    carpeta = Path(carpeta)
    carpeta.mkdir(parents=True, exist_ok=True)
    escena = bpy.context.scene
    escena.render.engine = "BLENDER_EEVEE"
    escena.render.image_settings.file_format = "JPEG"
    escena.render.image_settings.color_mode = "RGB"
    escena.render.image_settings.quality = 88
    escena.view_settings.view_transform = "AgX"
    mundo = bpy.data.worlds.new("estudio_cotidianos")
    mundo.use_nodes = True
    mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (0.02, 0.025, 0.03, 1)
    mundo.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
    escena.world = mundo
    for nombre, energia, rot in [("principal", 3, (0.55, -0.4, -0.5)), ("relleno", 1.7, (0.9, 0.5, 2.1)), ("borde", 1.2, (-0.5, 0.2, 0))]:
        luz = bpy.data.lights.new(nombre, "SUN")
        luz.energy = energia
        luz.angle = 0.12
        obj = bpy.data.objects.new(nombre, luz)
        obj.rotation_euler = rot
        escena.collection.objects.link(obj)
    datos = bpy.data.cameras.new("camara_cotidianos")
    datos.type = "ORTHO"
    datos.clip_start = 0.01
    datos.clip_end = 4000
    cam = bpy.data.objects.new("camara_cotidianos", datos)
    escena.collection.objects.link(cam)
    escena.camera = cam
    Vector = CORE["Vector"]
    etiquetas = []

    def visibles(grupo):
        for v in vacios:
            for obj in [v] + list(v.children):
                obj.hide_render = v not in grupo
        for t in etiquetas:
            t.hide_render = True

    def puntos(objetos):
        return [o.matrix_world @ Vector(p) for o in objetos for p in o.bound_box if o.type in ("MESH", "FONT")]

    def encuadrar(objetos, ancho=900, alto=700, elevacion=35, azimut=-35):
        bpy.context.view_layer.update()
        pts = puntos(objetos)
        mn = Vector(tuple(min(p[i] for p in pts) for i in range(3)))
        mx = Vector(tuple(max(p[i] for p in pts) for i in range(3)))
        centro = (mn + mx) / 2
        if mx.z - mn.z > 3 * (mx.y - mn.y):
            elevacion = 18
        el, az = math.radians(elevacion), math.radians(azimut)
        direccion = Vector((math.cos(el) * math.sin(az), -math.cos(el) * math.cos(az), math.sin(el)))
        cam.location = centro + direccion * (max(mx - mn) * 4 + 20)
        cam.rotation_euler = (-direccion).to_track_quat("-Z", "Y").to_euler()
        bpy.context.view_layer.update()
        inv = cam.matrix_world.inverted()
        locales = [inv @ p for p in pts]
        W = max(p.x for p in locales) - min(p.x for p in locales)
        H = max(p.y for p in locales) - min(p.y for p in locales)
        datos.ortho_scale = max(W, H * ancho / alto) / min(1, ancho / alto) * 1.22
        cx = (max(p.x for p in locales) + min(p.x for p in locales)) / 2
        cy = (max(p.y for p in locales) + min(p.y for p in locales)) / 2
        cam.location += cam.rotation_euler.to_quaternion() @ Vector((cx, cy, 0))
        escena.render.resolution_x, escena.render.resolution_y = ancho, alto
        escena.render.resolution_percentage = 100

    for v in vacios:
        if seleccion is not None and v.name not in seleccion:
            continue
        visibles([v])
        encuadrar(list(v.children))
        escena.render.filepath = str(carpeta / (v.name + ".jpg"))
        bpy.ops.render.render(write_still=True)
        if v.name == "pantalla@panel":
            encuadrar(list(v.children), elevacion=18, azimut=145)
            escena.render.filepath = str(carpeta / (v.name + "_dorso.jpg"))
            bpy.ops.render.render(write_still=True)

    # Una hoja por equipo: las piezas compartidas aparecen en los equipos aplicables.
    for clave in list(EQUIPOS):
        grupo = [v for v in vacios if clave in v.get("equipos", "").split()]
        visibles(grupo)
        hojas = []
        rotaciones = {v: v.rotation_euler.copy() for v in grupo}
        for i, v in enumerate(grupo):
            mn0, mx0 = CORE["caja_mundo"](v)
            if mx0[2] - mn0[2] > 3 * (mx0[1] - mn0[1]):
                v.rotation_euler.rotate_axis("X", math.pi / 2)
            v.location = (0, 0, 0)
            v.scale = (1, 1, 1)
            bpy.context.view_layer.update()
            mn, mx = CORE["caja_mundo"](v)
            escala = 5.5 / max(mx[j] - mn[j] for j in range(3))
            centro = [(a + b) / 2 for a, b in zip(mn, mx)]
            fila, col = divmod(i, 3)
            v.scale = (escala, escala, escala)
            v.location = (col * 10 - centro[0] * escala, -fila * 11 - centro[1] * escala, -mn[2] * escala)
            texto = bpy.data.curves.new("nombre_" + v.name, "FONT")
            texto.body = v.name.replace("_", " ")
            texto.size = min(0.6, 8 / len(texto.body))
            texto.align_x = "CENTER"
            obj = bpy.data.objects.new(texto.name, texto)
            obj.location = (col * 10, -fila * 11 - 4, 0)
            texto.materials.append(CORE["material"]("etiqueta"))
            escena.collection.objects.link(obj)
            etiquetas.append(obj)
            hojas.append(obj)
        ancho, alto = 1500, max(700, math.ceil(len(grupo) / 3) * 470)
        encuadrar([o for v in grupo for o in v.children] + hojas, ancho, alto, elevacion=65, azimut=0)
        escena.render.filepath = str(carpeta / ("hoja_" + clave + ".jpg"))
        bpy.ops.render.render(write_still=True)
        # Deshacer la exposición para el siguiente equipo compartido.
        for v in grupo:
            v.rotation_euler = rotaciones[v]
            v.location = (0, 0, 0)
            v.scale = (1, 1, 1)
        bpy.context.view_layer.update()




def main():
    global EQUIPOS
    parser = argparse.ArgumentParser()
    parser.add_argument("--campus", action="store_true")
    parser.add_argument("--modelos", required=True)
    parser.add_argument("--renders", required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    if args.campus:
        c = runpy.run_path(str(Path(__file__).with_name("campus.py")), run_name="formas_campus")
        EQUIPOS = {e: [nombre for nombre, grupos, _ in c["PIEZAS"] if e in grupos] for e in c["EQUIPOS"]}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for archivo in sorted(Path(args.modelos).glob("*.glb")):
        bpy.ops.import_scene.gltf(filepath=str(archivo.resolve()))
    nombres = list(dict.fromkeys(n for grupo in EQUIPOS.values() for n in grupo))
    vacios = []
    for nombre in nombres:
        v = bpy.data.objects.get(nombre)
        if v is None:
            raise ValueError("No se encontró la pieza: " + nombre)
        if v.type == "MESH":
            v.name = nombre + "__malla"
            contenedor = bpy.data.objects.new(nombre, None)
            bpy.context.scene.collection.objects.link(contenedor)
            mundo = v.matrix_world.copy()
            v.parent = contenedor
            v.matrix_world = mundo
            v = contenedor
        mallas = [o for o in v.children_recursive if o.type == "MESH"]
        for o in mallas:
            mundo = o.matrix_world.copy()
            o.parent = v
            o.matrix_world = mundo
        for o in list(v.children):
            if o.type != "MESH":
                bpy.data.objects.remove(o, do_unlink=True)
        v["equipos"] = " ".join(e for e, ns in EQUIPOS.items() if nombre in ns)
        vacios.append(v)
    elegidos = {o for v in vacios for o in [v] + list(v.children)}
    for o in bpy.context.scene.objects:
        o.hide_render = o not in elegidos
    renderizar(args.renders, vacios)


if __name__ == "__main__":
    main()
