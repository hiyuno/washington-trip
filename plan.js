/* Plan sugerido: 5–10 de agosto de 2026, en coche, saliendo y volviendo a Seattle.
 * Coordenadas verificadas contra OpenStreetMap.
 * Es solo un punto de partida: todo se puede reordenar, cambiar o borrar dentro de la app.
 */
window.WA_PLAN = function () {
  const uid = () => Math.random().toString(36).slice(2, 10);
  const P = (name, address, lat, lon, duration, notes = '', best = '') =>
    ({ id: uid(), name, address, lat, lon, duration, notes, star: false, best });
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
            'El agua turquesa que buscas. Mejor luz al mediodía, cuando el sol pega en el glaciar.',
            'Entre 11:00 y 14:00, con el sol alto: el agua se ve más turquesa. Nublado o de mañana, el color sale apagado.'),
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
            'Carretera de 27 km desde Port Angeles, muy revirada. Comprueba que esté abierta antes de subir. ' +
            'El centro de visitantes se quemó en 2023 y sigue sin reconstruir: solo hay baños en tráileres, sin cafetería ni tienda.',
            'Entre 9:30 y 10:30. Antes suele haber niebla que tapa la vista; después de las 10:00 el aparcamiento se llena los fines de semana de verano.'),
          S('Lake Crescent · Marymere Falls', 'Olympic NP, Clallam County, WA', 48.05030, -123.78834, 120,
            'Sendero fácil de 3 km ida y vuelta desde el Storm King Ranger Station.',
            'Por la mañana, antes de las 11:00: el lago está más en calma para fotos y el aparcamiento de Storm King aún no se llena.'),
        ],
      },
      {
        id: uid(), date: '2026-08-08', startTime: '08:00',
        start: PORT_ANG(), end: FORKS(),
        stops: [
          S('Cape Flattery', 'Makah Reservation, Clallam County, WA', 48.38552, -124.72580, 120,
            'La punta noroeste de EE. UU. continental. Sendero entablado de 1,2 km ida y vuelta hasta los miradores. ' +
            'Hace falta el Makah Recreation Pass (unos $20): se compra al llegar a Neah Bay, en el museo o en las tiendas del pueblo. ' +
            'Las 2 h de ida por la SR-112 van pegadas al estrecho y son parte del plan.',
            'A media mañana, con el sol ya alto: la vista mira al oeste y hay menos contraluz. El aparcamiento es chico y se llena los fines de semana.'),
          S('Second Beach (La Push)', 'Quileute Reservation, Clallam County, WA', 47.89502, -124.62488, 120,
            'CAMBIO: Rialto Beach está cerrada por obras del 8 jul al 15 oct de 2026 (Mora Road, reparación de socavón). ' +
            'Second Beach es la alternativa a 10 min por otra carretera, con la misma pinta de troncos y farallones. ' +
            'Sendero de 1,1 km entre bosque hasta la arena. Hace falta permiso de la reserva Quileute (~$10): se compra en ' +
            'Lonesome Creek Store, en La Push. Revisa nps.gov/olym antes de salir por si la obra termina antes.',
            'Con marea baja se camina más playa y se ven mejor los farallones — consulta la tabla de mareas antes de salir. De poder elegir, al atardecer: la playa mira al oeste.'),
        ],
      },
      {
        id: uid(), date: '2026-08-09', startTime: '07:30',
        start: FORKS(), end: ASHFORD(),
        stops: [
          S('Hoh Rain Forest', 'Olympic NP, Jefferson County, WA', 47.86088, -123.93479, 150,
            'Hall of Mosses: 1,3 km en bucle, es lo que has visto en fotos. La carretera de acceso son 30 km sin cobertura. ' +
            'Sal temprano: el aparcamiento se llena y cierran la entrada. ' +
            'Hay un incendio (Mount Tom Creek) lejos, al oeste del monte Olympus: no afecta este bucle corto, es aviso solo para mochileros del Hoh River Trail.',
            'Antes de las 9:00. En verano, entre las 9:00 y las 17:00 el aparcamiento se llena y puede haber 1-2 h de espera en la entrada; fuera de esa franja se entra directo.'),
          S('Ruby Beach', 'Olympic NP, Jefferson County, WA', 47.71945, -124.41919, 75,
            'Bajada corta desde el aparcamiento. Los farallones más fotogénicos de la costa.',
            'Con marea baja se llega hasta los farallones grandes — consulta la tabla de mareas. También muy bonito al atardecer, mirando al oeste.'),
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
            'El sitio del parque. Skyline Trail hasta Myrtle Falls es corto; el bucle completo son 4 h.',
            'Antes de las 8:00. En 2026 no hace falta reserva, pero de julio a agosto entre las 8:00 y las 16:00 hay colas de más de 1 h en la caseta y el aparcamiento se llena. Además el volcán se nubla más por la tarde: se ve mejor temprano.'),
          P('Reflection Lakes', 'Mount Rainier NP, WA', 46.76900, -121.73000, 30,
            'El reflejo del volcán en el agua. Sale mejor sin viento.'),
        ],
      },
    ],
  };
};
