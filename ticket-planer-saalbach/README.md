# Ticket-Planer Saalbach Hinterglemm

Werkzeug zur kostenminimalen Bike-Ticket-Planung für einen mehrtägigen Trip nach
Saalbach Hinterglemm mit Joker Card. Siehe die Anforderungsspezifikation für
den vollständigen Kontext (Domänenregeln, Preisdaten, Akzeptanzkriterien).

## Nutzung

Einfach `index.html` über einen beliebigen statischen HTTP-Server öffnen
(z. B. `npx http-server ticket-planer-saalbach`) oder direkt per GitHub Pages
ausliefern. Die Seite ist bis auf den Wetterabruf vollständig offlinefähig;
Eingaben, Preise und Wetterstand werden automatisch im Browser gespeichert
(`localStorage`) und beim nächsten Öffnen wiederhergestellt.

## Dateien und Abweichung von NFR-01

Die Spezifikation fordert eine einzelne, in sich geschlossene HTML-Datei ohne
Build-Schritt, erlaubt aber explizit begründete Ausnahmen. Abschnitt 10 der
Spezifikation verlangt zusätzlich ausdrücklich, dass der Optimierer "in ein
eigenes, testbares Modul mit reinen Funktionen ohne DOM-Bezug" gehört, damit
die Akzeptanzkriterien 1:1 als Unit-Tests abgebildet werden können. Diese
beiden Vorgaben lassen sich nur durch einen minimalen Split auflösen:

- **`logic.js`** — die eigentliche Substanz: Domänenregeln, DP-Optimierer,
  Preistabellen, Wetter-Codes/-Scoring, Formatierung. Reine Funktionen, kein
  DOM-Zugriff, per ES-Modul sowohl von `index.html` als auch von Node aus
  importierbar.
- **`index.html`** — UI, Zustandsverwaltung, Persistenz, Wetterabruf. Lädt
  `logic.js` per `<script type="module" src="./logic.js">`.
- **`logic.test.mjs`** — Node-Testskript ohne Abhängigkeiten, bildet die
  Akzeptanzkriterien T-01 bis T-11 aus Abschnitt 7 direkt ab.

Kein Build-Schritt nötig: beide Dateien werden unverändert vom Browser bzw.
von Node geladen. Test ausführen:

```bash
node ticket-planer-saalbach/logic.test.mjs
```

## Bekannte Vereinfachungen

- **Gegenwert der Freifahrten** (Kennzahlenleiste): Die Spezifikation nennt
  diese Kennzahl, beziffert aber nicht, wie sie berechnet wird. Hier gewählt:
  Anzahl Freifahrttage × 4-Stunden-Ticketpreis (Joker) des jeweiligen Tarifs —
  die günstigste kostenpflichtige Alternative für einen Tag mit Restbedarf.
  Deutlich als Kennzahl mit Fahrtenzahl ausgewiesen, nicht in die Gesamtsumme
  eingerechnet.
- **Zustandsscore der Wetterbewertung** (FR-40): Die Formel
  "Zustandsscore − Niederschlagswahrscheinlichkeit / 25" ist vorgegeben, die
  Basiswerte je Zustand nicht. Gewählt: sonnig 4, wolkig 3, Schauer 2, Regen 1,
  Schnee 1, Gewitter 0, offen 1,5 (neutral, da unbekannt).
- **Personenverwaltung** (Ausbaustufe 1, Abschnitt 9) ist bewusst nicht
  umgesetzt — laut Spezifikation nicht Teil des Auftrags. Das Datenmodell
  (Personen als Array mit `id`/`tariff`) ist aber so gehalten, dass eine
  spätere UI dafür ohne Datenmigration ergänzt werden kann.
- **Jugendtarif** (OP-05) ist in den Preistabellen vollständig hinterlegt,
  aber in der Standard-Personenliste (Sebastian, Jeannette, Theo, Tom) nicht
  verwendet, da alle vier aktuell Erwachsen/Kind sind.
- **10-Tages-Ticket**: Aus der Spezifikation (Datenqualitätshinweis
  Abschnitt 3) bewusst nicht aufgenommen, da die Werte zwischen App und
  Website widersprüchlich sind und vor Ort verifiziert werden müssen. Die
  Preistabellen und der Optimierer unterstützen Trips bis 8 Tage (Standard);
  eine spätere Erweiterung auf mehr Tage erfordert nur zusätzliche Einträge
  im `days`-Array der Preistabelle.
