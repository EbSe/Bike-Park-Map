# 🚵 Bikepark Map – Setup auf dem iPhone

So bekommst du die App in unter 60 Sekunden auf dein iPhone.

## Voraussetzungen
Nur **Safari auf einem iPhone**. Kein App Store, kein Mac, kein Apple Developer Account.

## Schritt 1: GitHub Pages aktivieren (einmalig, ca. 30 Sek.)

Falls noch nicht aktiv:
1. Auf GitHub im Repo `EbSe/Bike-Park-Map` öffnen → **Settings** → **Pages**
2. Unter "Build and deployment" → **Source: GitHub Actions** auswählen
3. Bei "Branch protection" sicherstellen, dass der Branch `claude/ios-bike-parks-app-4n2rc` durchlaufen darf (oder ggf. auf `main` mergen).
4. Push triggert automatisch den Workflow `.github/workflows/deploy.yml`. Im Tab **Actions** kannst du dem Build zusehen (ca. 1 Min.).

Sobald der Job grün ist, ist die App live unter:
> **https://ebse.github.io/Bike-Park-Map/**

(Die URL erscheint auch in den Pages-Settings, sobald der erste Deploy fertig ist.)

## Schritt 2: Auf dem iPhone installieren

1. Öffne **Safari** (wichtig: nicht Chrome – nur Safari kann PWAs auf iOS installieren).
2. Öffne `https://ebse.github.io/Bike-Park-Map/`
3. Tippe auf das **Teilen-Symbol** (Quadrat mit Pfeil nach oben) unten in der Adressleiste.
4. Scrolle nach unten und tippe **„Zum Home-Bildschirm"** (auf englischen Geräten: *Add to Home Screen*).
5. Tippe **„Hinzufügen"** rechts oben.
6. Fertig! Die App liegt jetzt auf deinem Home-Screen mit dem 🚵 Icon.

Beim ersten Öffnen wirst du eventuell nach dem **Standortzugriff** gefragt – akzeptiere ihn, dann kann die App Parks nach Entfernung sortieren.

## Schritt 3: Garmin / Apple Watch Tracks importieren

iOS-PWAs können noch keine direkten Watch-Apps haben. Stattdessen funktioniert das so:

### Aus Garmin Connect
1. Aktivität in **Garmin Connect** öffnen.
2. ⋮ Menü → **Originaldatei exportieren** (das speichert eine `.fit` oder `.gpx` Datei in „Dateien").
3. In der Bikepark-Map den jeweiligen Park öffnen → **„📊 GPX / FIT importieren"** → Datei auswählen.
4. Distanz, Höhenmeter, Tempo & Zeit werden automatisch deinen Stats hinzugefügt.

### Aus Apple Fitness
1. Workout in der **Fitness-App** öffnen.
2. **„Workout exportieren"** → speichert ein .gpx in „Dateien".
3. Genauso wie oben in der Bikepark-Map importieren.

### Strava / Komoot
- Strava: Auf strava.com einloggen → Aktivität → drei Punkte → **„Export GPX"**.
- Komoot: Tour öffnen → drei Punkte → **„GPX exportieren"** (Premium).

## Tipp: App offline nutzen

Die App cached automatisch:
- Alle Karten-Tiles, die du einmal angesehen hast (kannst du also vor dem Trip vorab "voraufladen", indem du im WLAN über die Region zoomst).
- Die komplette Park-Datenbank.
- Deine eigenen Daten (sind sowieso lokal).

Heißt: im Funkloch am Berg funktioniert alles bis auf Live-Wetter und Routing zum Park.

## Tipp: Backup machen

Mehr → **„Daten exportieren (JSON)"** erstellt eine Datei mit allen Sessions, Bewertungen und Fotos. Per AirDrop auf den Mac/anderes iPhone übertragbar oder in iCloud Drive sichern.

## Update-Hinweis

Wenn ich (oder ein anderer Helfer) Änderungen pushen, deployt der Workflow automatisch neu. Beim nächsten App-Start wird die neue Version geladen (Service Worker macht ein Hintergrund-Update). Bei Änderungen an der Park-Datenbank musst du eventuell die App einmal aus dem Multitasking schließen.

## Bekannte iOS-Limits

- **Push-Benachrichtigungen** funktionieren nur seit iOS 16.4 und nur wenn die App vom Home-Screen aus geöffnet ist – aktuell nicht implementiert.
- **Hintergrund-GPS-Tracking** ist in iOS-PWAs nicht möglich. Deshalb der Workflow über GPX/FIT-Import.
- **Web-Share-Target** (PWA als Ziel im iOS Share-Sheet) wird von Safari noch nicht unterstützt. Deshalb der Datei-Picker statt direktem Share.

## Troubleshooting

- **„Seite kann nicht geladen werden"** → Pages-Workflow noch nicht durchgelaufen? Schau in Actions.
- **Karte bleibt schwarz** → Standortberechtigung verweigert + langes Cache-Problem. Lösung: Safari → Einstellungen → Verlauf löschen → App neu installieren.
- **Einstellungen → ⚙️ → „Daten löschen"** setzt nur deine eigenen Daten zurück, nicht die App selbst. Zum kompletten Reset: App-Icon antippen lange drücken → „App entfernen".
