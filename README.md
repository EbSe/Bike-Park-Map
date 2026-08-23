# 🚵 Bikepark Map

Progressive Web App (PWA) zum Entdecken, Filtern und Tracken von Bikeparks in **Süddeutschland, Österreich, Schweiz und Norditalien** (bis Gardasee). 

Installation in unter 60 Sekunden auf jedem iPhone — siehe [SETUP.md](./SETUP.md).

## Features

- 🗺️ **Karten- & Listenansicht** mit ~80 kuratierten Parks (große Resorts wie Leogang, Lenzerheide, Livigno bis hin zu kleinen Vereins-Flowtrails wie Stromberg/Ottweiler)
- 🔍 **Filter** nach Land, Schwierigkeit, Bike-Typ, Lift-Art, Ausstattung, Preis und Entfernung
- 📋 **Detail-Seite pro Park** mit Trails inkl. Schwierigkeit/Länge, Preisen, Lifte, Saison, Ausstattung, Webseite-Link
- 🌦️ **Live-Wetter** + 4-Tage-Vorschau pro Park (Open-Meteo, kostenlos)
- 🧭 **Navigation** in einem Tap → Apple Maps / Google Maps
- ⭐ **Wishlist** für Parks, die du noch fahren willst
- ✅ **Sessions tracken** mit Rating, Notizen, Foto- & Video-Upload (lokal gespeichert)
- 📊 **GPX & FIT Import** aus Garmin / Apple Fitness / Strava / Komoot — automatisch dem nächstgelegenen Park zugeordnet
- 📈 **Statistik-Dashboard**: Parks gefahren, km, Höhenmeter, Stunden, pro Land
- ➕ **Eigene Parks anlegen** (Vereinsparks, kleine Trails, neue Spots)
- 💾 **Export/Import als JSON-Backup** — alles lokal, kein Cloud-Account nötig
- 📡 **Offline-fähig**: Karten-Tiles werden gecached
- 🔒 **100% privat**: keine Anmeldung, kein Backend, keine Tracking-Cookies

## Zusatztool: Ticket-Planer Saalbach Hinterglemm

Eigenständiges, von der PWA unabhängiges Werkzeug unter
[`ticket-planer-saalbach/`](./ticket-planer-saalbach/): berechnet pro Person
und Tag die kostenminimale Bike-Ticket-Kombination in Saalbach Hinterglemm
unter Berücksichtigung von Joker Card, Freifahrten und Mehrtagesrabatten.
Details siehe [`ticket-planer-saalbach/README.md`](./ticket-planer-saalbach/README.md).

## Installation auf dem iPhone

Siehe **[SETUP.md](./SETUP.md)** für die Schritt-für-Schritt-Anleitung.

Kurzform:
1. Im GitHub-Repo: **Settings → Pages → Source: GitHub Actions**
2. Auf iPhone-Safari `https://ebse.github.io/Bike-Park-Map/` öffnen
3. Teilen-Symbol → **„Zum Home-Bildschirm"** → Fertig

## Lokal entwickeln

```bash
npm install
npm run dev      # Entwicklungsserver
npm run build    # Production-Build nach dist/
npm run preview  # Build lokal anschauen
npm run icons    # PWA-Icons neu generieren
```

## Architektur

- **Vanilla JS + Vite** – keine Framework-Last, schnelles Laden
- **Leaflet + leaflet.markercluster** – Karte mit Clustering
- **vite-plugin-pwa (Workbox)** – Service Worker, Offline-Cache, Manifest
- **IndexedDB** – komplette lokale Datenhaltung (visits, media, custom parks, tracks)
- **Open-Meteo** – kostenloses Wetter-API ohne Key
- **OpenStreetMap / OpenTopoMap / CartoDB** – Karten-Tiles, durchschaltbar

Bundle-Größe: ca. 311 KB JS (gzip 84 KB), 34 KB CSS (gzip 10 KB), Lighthouse-PWA-Score ≥ 90.

## Datenquellen

- **Park-Datenbank**: handkuratiert für ~80 Parks mit Preisen, Saisonzeiten, Strecken-Listen, Lifte, Ausstattung. Stand: 2024 — bitte vor dem Besuch auf der Webseite des jeweiligen Parks aktuelle Infos prüfen!
- **OpenStreetMap-Erweiterung möglich**: `npm run fetch-osm` läuft die Overpass-API ab und liefert weitere Parks. Aktuell nicht in den Build integriert weil die kuratierten Daten qualitativ besser sind. Wenn du eigene Parks ergänzen willst, ist der „Park hinzufügen"-Dialog in der App der einfachste Weg.

## Lizenz

Code: MIT. Park-Daten: Best-Effort-Recherche, kein Anspruch auf Aktualität oder Vollständigkeit. Karten © OpenStreetMap-Mitwirkende.
