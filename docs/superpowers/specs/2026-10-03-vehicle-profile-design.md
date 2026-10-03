# 6006 PERFORMANCE — Fahrzeugprofil + fahrzeugspezifische Systemanimation

## Ziel
Die bestehende Fehlercode-Animation wird um eine fahrzeugspezifische Ebene erweitert. Kunden wählen Marke, Modell, Baureihe/Karosserie, Baujahr und Motor. Danach verwendet jede Fehlerdetailseite Fehlercode + Fahrzeugprofil; Silhouette, Bauteilpositionen, Systemwege und Fokusbereiche ändern sich passend zum Fahrzeug.

## Auswahlfluss
Marke → Modell → Baureihe / Generation / Karosserie → Baujahr → Motor / Motorcode. Die Auswahl bleibt lokal erhalten und kann auf „Allgemeine Darstellung“ zurückgesetzt werden.

## Architektur
Ansatz: **Plattform + Motorprofil + Modell-Override**.

### VehicleProfile
`brand`, `model`, `generation`, `bodyStyle`, `yearFrom`, `yearTo`, `engineLabel`, `engineCode`, `platformId`, `engineFamilyId`, `diagramVariant`, `componentPlacements`, `accuracy`.

### PlatformProfile
Grund-Silhouette, Motorraum-/Unterboden-Koordinatensystem, Standardpositionen für Batterie/ABS/Tank/ECU/Achsen und gemeinsame Systempfade.

### EngineProfile
Turbo/Ladeluft, AGR, DPF, SCR/AdBlue, NOx-Sensoren, Kraftstoffsystem, Öl- und Kühlkreislauf.

### Vehicle Override
Modellspezifische Abweichungen überschreiben Plattform- oder Motorpositionen.

## Darstellung
SVG/React statt statischer Bilder. Dunkle technische Cutaway-Silhouette; Antique Gold normale Wege; Amber/Rot Fehlerfokus; dezenter Glow; animierte Partikel für Luft, Flüssigkeit, Abgas, Daten und Strom.

## Fehlercode-Integration
`FaultSystemAnimation` erhält zusätzlich `vehicleProfile`.
1. `getFaultVisual(code)` bestimmt System und Fokus.
2. `getVehicleProfile(selection)` bestimmt konkrete Geometrie.
3. Plattform + Motorprofil + Modell-Override werden gemerged.
4. Fahrzeug-Silhouette und Bauteilkoordinaten werden gerendert.
5. Der zum Fehler passende Bereich wird animiert hervorgehoben.

## Fallback
Exaktes Profil → Plattformprofil → Motorprofil → „Allgemeine Systemdarstellung“. Niemals erfundene exakte Positionen als fahrzeugspezifisch ausgeben.

## Startdatenbasis
Volkswagen, Audi, BMW, Mercedes-Benz, Ford, Opel, Skoda, Seat/Cupra. Erste Cluster: VW MQB (Golf 7/8, Passat B8, Tiguan II, Octavia III/IV, Leon III/IV, A3 8V/8Y); BMW F30/F31, G20/G21, F10/F11, G30/G31, X1/X3; Mercedes W205/S205, W213/S213, GLC; Ford Focus MK3/MK4, Mondeo MK5, Kuga II/III; Opel Astra K/L, Insignia B, Grandland.

## Datenqualität
`accuracy: exact | platform | generic`. Technische Visualisierung, kein OEM-Reparaturleitfaden.

## Akzeptanzkriterien
- Fahrzeugauswahl funktioniert und bleibt zwischen Fehlercodes erhalten.
- BMW, VW, Ford, Mercedes zeigen klar unterschiedliche Profile.
- P0299, AdBlue/SCR, DPF, ABS, Batterie, Öl und Kühlung reagieren auf Fahrzeugprofile.
- Nicht unterstützte Fahrzeuge zeigen klar gekennzeichneten Fallback.
- Mobile ohne horizontales Überlaufen.
- Bestehende Fehlerbibliothek bleibt funktionsfähig.
