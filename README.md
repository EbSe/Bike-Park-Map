# 🎟️ Ticket-Planer Saalbach Hinterglemm

Werkzeug zur kostenminimalen Bike-Ticket-Planung für einen mehrtägigen Trip nach
Saalbach Hinterglemm mit Joker Card. Trage pro Person und Tag die geplante
Fahrintensität ein — das Werkzeug berechnet daraus die günstigste Kombination
aus 4-Stunden-, Tages- und Mehrtagestickets, unter Berücksichtigung von
Joker-Rabatt, Freifahrten und Mehrtagesrabatten.

Live: **https://ebse.github.io/Bike-Park-Map/**

## Nutzung

`index.html` direkt öffnen (statischer HTTP-Server, z. B. `npx http-server .`)
oder per GitHub Pages ausliefern — siehe `.github/workflows/deploy.yml`. Die
Seite ist bis auf den Wetterabruf vollständig offlinefähig; Eingaben, Preise
und Wetterstand werden automatisch im Browser gespeichert (`localStorage`) und
beim nächsten Öffnen wiederhergestellt.

Auf dem iPhone/iPad: Safari öffnen → Teilen-Symbol → **„Zum Home-Bildschirm"**.

## Dateien

- **`index.html`** — UI, Zustandsverwaltung, Persistenz, Wetterabruf. Lädt
  `logic.js` per `<script type="module" src="./logic.js">`.
- **`logic.js`** — die eigentliche Substanz: Domänenregeln, DP-Optimierer,
  Preistabellen, Wetter-Codes/-Scoring, Formatierung. Reine Funktionen, kein
  DOM-Zugriff, per ES-Modul sowohl von `index.html` als auch von Node aus
  importierbar.
- **`logic.test.mjs`** — Node-Testskript ohne Abhängigkeiten, bildet die
  Akzeptanzkriterien aus der Anforderungsspezifikation direkt ab.

Kein Build-Schritt: alle Dateien werden unverändert vom Browser bzw. von Node
geladen. Test ausführen:

```bash
node logic.test.mjs
```

## Fahrintensitäten

Fünf Stufen pro Person und Tag (Tippzyklus): **Aus** → **Chill** (bis 2 Runs,
komplett über Joker-Freifahrten) → **Halbtag** (4-Stunden-Ticket, danach
Feierabend) → **Halbtag+** (4-Stunden-Ticket vormittags, danach Pause, dann
noch 2 Joker-Freifahrten am Nachmittag) → **Vollgas** (ganzer Tag, Tagesticket)
→ zurück zu Aus.

Halbtag+ kostet genauso viel wie ein reiner Halbtag (dieselbe Mindestanforderung
an ein 4-Stunden-Ticket) — der Unterschied ist rein die Auswertung: die
zusätzlichen 2 Fahrten am Nachmittag werden separat als genutzte Freifahrt
ausgewiesen. Liegt der Tag ohnehin innerhalb eines gekauften Mehrtagesblocks
(weil das günstiger war), gibt es nichts zusätzlich zu zählen — das Ticket
deckt den ganzen Tag bereits ab.

## Bekannte Vereinfachungen

- **Gegenwert der Freifahrten** (Kennzahlenleiste): Die Spezifikation nennt
  diese Kennzahl, beziffert aber nicht, wie sie berechnet wird. Hier gewählt:
  Anzahl reiner Chill-Freifahrttage × 4-Stunden-Ticketpreis (Joker) des
  jeweiligen Tarifs — die günstigste kostenpflichtige Alternative für einen
  Tag mit Restbedarf. Halbtag+-Nachmittagsfahrten fließen bewusst nicht in
  diesen Euro-Wert ein (dort ist bereits ein Ticket bezahlt, die Freifahrten
  sind nur der Bonus obendrauf), werden aber mit Fahrtenzahl separat
  ausgewiesen. Nicht in die Gesamtsumme eingerechnet.
- **Zustandsscore der Wetterbewertung**: Die Formel
  "Zustandsscore − Niederschlagswahrscheinlichkeit / 25" ist vorgegeben, die
  Basiswerte je Zustand nicht. Gewählt: sonnig 4, wolkig 3, Schauer 2, Regen 1,
  Schnee 1, Gewitter 0, offen 1,5 (neutral, da unbekannt).
- **Personenverwaltung** ist bewusst nicht umgesetzt — laut Spezifikation
  nicht Teil des Auftrags. Das Datenmodell (Personen als Array mit
  `id`/`tariff`) ist aber so gehalten, dass eine spätere UI dafür ohne
  Datenmigration ergänzt werden kann.
- **Jugendtarif** ist in den Preistabellen vollständig hinterlegt, aber in der
  Standard-Personenliste (Sebastian, Jeannette, Theo, Tom) nicht verwendet, da
  alle vier aktuell Erwachsen/Kind sind.
- **10-Tages-Ticket** bewusst nicht aufgenommen, da die Preiswerte zwischen
  App und Website widersprüchlich waren und vor Ort verifiziert werden
  müssten. Preistabellen und Optimierer unterstützen Trips bis 8 Tage
  (Standard); eine spätere Erweiterung erfordert nur zusätzliche Einträge im
  `days`-Array der Preistabelle.

## Lizenz

MIT.
