# DC Trip

Planificador de ruta para un viaje a Washington DC (5–10 de agosto).
Web app de una sola página, sin build ni backend: se abre y funciona.

**En vivo:** https://hiyuno.github.io/washington-trip/

## Qué hace

- **Días del viaje** en pestañas. Cada día tiene su propio **punto de inicio** y su **dormida**, independientes, por si cambias de hotel.
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

Truco: antes de salir del hotel, abre cada día una vez con WiFi para dejar todo cacheado.

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

Son servidores públicos y gratuitos, de uso comunitario: son suficientes para un
viaje personal, pero pueden ir lentos o fallar puntualmente.
