/* Plan sugerido: 5–10 de agosto de 2026, en coche, saliendo y volviendo a Seattle.
 * Coordenadas verificadas contra OpenStreetMap.
 * Es solo un punto de partida: todo se puede reordenar, cambiar o borrar dentro de la app.
 */
window.WA_PLAN = function () {
  const uid = () => Math.random().toString(36).slice(2, 10);
  const P = (name, address, lat, lon, duration, notes = '') =>
    ({ id: uid(), name, address, lat, lon, duration, notes, star: false });
  // S = los lugares que pediste tú. Salen con ⭐ en la lista y con el pin dorado en el mapa.
  const S = (...args) => ({ ...P(...args), star: true });

  // Lugares que se repiten como inicio/dormida de varios días.
  const SEA      = () => P('Aeropuerto SEA', 'SeaTac, King County, WA', 47.44757, -122.30802, 0);
  const SEATTLE  = () => P('Seattle · cambia por tu hotel', 'Downtown Seattle, WA', 47.60810, -122.33212, 0);
  const PORT_ANG = () => P('Port Angeles · cambia por tu hotel', 'Port Angeles, Clallam County, WA', 48.11815, -123.43074, 0);
  const FORKS    = () => P('Forks · cambia por tu hotel', 'Forks, Clallam County, WA', 47.95022, -124.38617, 0);
  const ASHFORD  = () => P('Ashford · cambia por tu hotel', 'Ashford, Pierce County, WA', 46.75441, -122.01093, 0);

  return {
    version: 1,
    name: 'Washington Trip',
    days: [
      {
        id: uid(), date: '2026-08-05', startTime: '13:00',
        start: SEA(), end: SEATTLE(),
        stops: [
          P('Pike Place Market', 'Seattle, King County, WA', 47.60940, -122.34141, 90,
            'Primer contacto con la ciudad. Aparcar en el centro es caro y difícil.'),
          P('Kerry Park', 'Seattle, King County, WA', 47.62936, -122.35990, 30,
            'La vista clásica del skyline con el Rainier detrás. Mejor con luz de tarde.'),
          S('Alki Beach', 'West Seattle, King County, WA', 47.58669, -122.39764, 150,
            'Atardecer sobre la bahía con Seattle enfrente. En agosto el sol se pone cerca de las 20:45.'),
        ],
      },
      {
        id: uid(), date: '2026-08-06', startTime: '07:30',
        start: SEATTLE(), end: SEATTLE(),
        stops: [
          P('Newhalem', 'Whatcom County, WA', 48.67374, -121.24735, 30,
            'Última gasolina y último baño antes del tramo bonito de la SR-20.'),
          P('Gorge Creek Falls', 'North Cascades NP, Whatcom County, WA', 48.70430, -121.19930, 20,
            'Mirador desde el propio puente de la carretera. Parada rápida.'),
          S('Diablo Lake Overlook', 'North Cascades NP, Whatcom County, WA', 48.70981, -121.09715, 60,
            'El agua turquesa que buscas. Mejor luz al mediodía, cuando el sol pega en el glaciar.'),
        ],
      },
      {
        id: uid(), date: '2026-08-07', startTime: '07:00',
        start: SEATTLE(), end: PORT_ANG(),
        stops: [
          P('Madison Falls', 'Elwha, Clallam County, WA', 48.04221, -123.58912, 20,
            'Cascada a 60 m del aparcamiento. OJO: el cálculo de hoy va por carretera rodeando por Tacoma. ' +
            'Si tomas el ferry Edmonds–Kingston te ahorras cerca de 1 h, pero no admite reserva: llega temprano.'),
          S('Hurricane Ridge', 'Olympic NP, Clallam County, WA', 47.96940, -123.49800, 120,
            'Carretera de 27 km desde Port Angeles, muy revirada. Comprueba que esté abierta antes de subir.'),
          S('Lake Crescent · Marymere Falls', 'Olympic NP, Clallam County, WA', 48.05030, -123.78834, 120,
            'Sendero fácil de 3 km ida y vuelta desde el Storm King Ranger Station.'),
        ],
      },
      {
        id: uid(), date: '2026-08-08', startTime: '08:00',
        start: PORT_ANG(), end: FORKS(),
        stops: [
          S('Cape Flattery', 'Makah Reservation, Clallam County, WA', 48.38552, -124.72580, 120,
            'La punta noroeste de EE. UU. continental. Sendero entablado de 1,2 km ida y vuelta hasta los miradores. ' +
            'Hace falta el Makah Recreation Pass (unos $20): se compra al llegar a Neah Bay, en el museo o en las tiendas del pueblo. ' +
            'Las 2 h de ida por la SR-112 van pegadas al estrecho y son parte del plan.'),
          S('Rialto Beach', 'Olympic NP, Clallam County, WA', 47.92891, -124.64108, 120,
            'Troncos gigantes y farallones. Para llegar a Hole-in-the-Wall necesitas marea baja: consulta la tabla antes.'),
        ],
      },
      {
        id: uid(), date: '2026-08-09', startTime: '07:30',
        start: FORKS(), end: ASHFORD(),
        stops: [
          S('Hoh Rain Forest', 'Olympic NP, Jefferson County, WA', 47.86088, -123.93479, 150,
            'Hall of Mosses: 1,3 km en bucle, es lo que has visto en fotos. La carretera de acceso son 30 km sin cobertura. ' +
            'Sal temprano: el aparcamiento se llena y cierran la entrada.'),
          S('Ruby Beach', 'Olympic NP, Jefferson County, WA', 47.71945, -124.41919, 75,
            'Bajada corta desde el aparcamiento. Los farallones más fotogénicos de la costa.'),
          P('Kalaloch · Tree of Life', 'Olympic NP, Jefferson County, WA', 47.60467, -124.37299, 30,
            'El árbol que sigue vivo colgando sobre el vacío, junto al camping de Kalaloch. ' +
            'Después empieza el tramo largo hacia el Rainier: llena el depósito aquí.'),
        ],
      },
      {
        id: uid(), date: '2026-08-10', startTime: '07:30',
        start: ASHFORD(), end: SEA(),
        stops: [
          P('Christine Falls', 'Mount Rainier NP, Pierce County, WA', 46.78093, -121.77963, 15,
            'La cascada enmarcada por el arco del puente. Apartadero pequeño, se llena rápido.'),
          P('Narada Falls', 'Mount Rainier NP, WA', 46.77500, -121.74700, 20,
            'Sendero corto y empinado hasta la base.'),
          S('Paradise · Mount Rainier', 'Mount Rainier NP, Pierce County, WA', 46.78600, -121.73500, 180,
            'El sitio del parque. Skyline Trail hasta Myrtle Falls es corto; el bucle completo son 4 h.'),
          P('Reflection Lakes', 'Mount Rainier NP, WA', 46.76900, -121.73000, 30,
            'El reflejo del volcán en el agua. Sale mejor sin viento.'),
        ],
      },
    ],
  };
};
