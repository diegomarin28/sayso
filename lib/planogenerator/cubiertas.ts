/**
 * Qué tapa el interior de un equipo, por el id de la pieza (sin dependencias: lo usan el generador y el visor).
 * Una guía real nombra la tapa como la nombra el manual ("tapa_trasera", "cubierta_inferior",
 * "carcasa_trasera", "panel_posterior"): todas abren el equipo, y si el pack ya nombra una, no se agrega otra.
 */

/** Lo que tapa el interior: tapas, puertas, carcasas y cubiertas. El visor las muestra translúcidas al abrir. */
export const ES_CUBIERTA = /^(tapa|carcasa|puerta|cubierta)|^(panel|chapa)_(trasero|trasera|inferior|posterior)/;

/** La tapa que se saca para abrir (no la carcasa entera ni una puerta), con el nombre que sea. */
export const ES_TAPA = /^(tapa|cubierta)|^(carcasa|panel|chapa)_(trasero|trasera|inferior|posterior)/;

/** La tapa de pantalla con bisagra de una notebook (#232): no tapa el interior ni se saca, se abre (ver `conTapaDePantalla`). */
export const ES_TAPA_DE_PANTALLA = /^carcasa_pantalla/;
