# Washington Trip

Planificador de ruta para un viaje por el **estado de Washington** (5–10 de agosto de 2026):
Olympic, Mount Rainier, North Cascades y Seattle.
Web app de una sola página, sin build ni backend: se abre y funciona.

**En vivo:** https://hiyuno.github.io/washington-trip/

## Qué hace

- **Días del viaje** en pestañas. Cada día tiene su propio **punto de inicio** y su **dormida**, independientes, por si cambias de hotel.
- **Plan sugerido** precargado (6 días, coordenadas verificadas contra OSM). Se puede recargar desde Ajustes.
- **Paradas** buscadas por nombre (Nominatim/OpenStreetMap), con tiempo de visita y notas.
- **Reordenar** arrastrando desde el asa `⣿`, en teléfono y en compu. Una parada se puede mover a otro día desde su editor.
- **Ruta en coche** real (OSRM) dibujada sobre el mapa, con distancia y tiempo por tramo.
- **Horarios estimados**: pones la hora de salida y la app calcula a qué hora llegas a cada parada y a qué hora vuelves a dormir.
- **Optimizar**: reordena las paradas del día para minimizar el tiempo al volante, respetando el inicio y la dormida. Con deshacer.
- **Exportar / importar JSON** para pasar el itinerario entre dispositivos.

## Datos y privacidad

Todo vive en el `localStorage` del navegador. No hay servidor, no se sube nada.
Cada dispositivo tiene su propia copia: para pasar el itinerario del Mac al teléfono usa **Ajustes → Exportar** y luego **Importar**.

## Sin conexión

Un service worker cachea la app y los mosaicos de mapa que ya viste, y las rutas
calculadas se guardan. Sin datos móviles vas a poder ver el itinerario completo,
los horarios y las rutas ya calculadas; **no** vas a poder buscar lugares nuevos
ni calcular rutas que no hayas visto antes.

Esto importa de verdad en este viaje: en buena parte de Olympic (la carretera del Hoh,
la costa, Sol Duc) y en Mount Rainier no hay cobertura. Antes de salir del hotel, abre
cada día una vez con WiFi para dejar el mapa y la ruta cacheados.

## Instalar en el iPhone

Safari → compartir → **Añadir a pantalla de inicio**. Se abre a pantalla completa como una app.

## Correr en local

```bash
python3 -m http.server 8000
```

Y abre http://localhost:8000. (Hace falta un servidor: el service worker y `fetch`
no funcionan abriendo el archivo con `file://`.)

## Servicios usados

| Qué | Servicio | Notas |
|---|---|---|
| Mapa | OpenStreetMap tiles | sin API key |
| Búsqueda de lugares | Nominatim | sin API key, límite de 1 consulta/segundo |
| Rutas y matriz de tiempos | OSRM demo server | sin API key, perfil `driving` |

**Ferris:** OSRM calcula las rutas por carretera y no cuenta el ferry Edmonds–Kingston.
El día 3 el tiempo real es cerca de 1 h menor si lo tomas — pero no admite reserva de
vehículo, así que llega con margen.

Son servidores públicos y gratuitos, de uso comunitario: son suficientes para un
viaje personal, pero pueden ir lentos o fallar puntualmente.
