window.faultData = {
  P0299: {
    label: 'P0299', title: 'Ladedruckregelung – Regelgrenze unterschritten', system: 'Motor / Aufladung', severity: 'Mittel bis hoch', drive: 'Nur vorsichtig weiterfahren, wenn keine weiteren Warnungen oder ungewöhnlichen Geräusche auftreten.',
    meaning: 'Das Motorsteuergerät erkennt über einen bestimmten Zeitraum einen niedrigeren Ladedruck als angefordert. Der Fehler ist herstellerübergreifend verbreitet, die genaue Prüfstrategie ist jedoch fahrzeugspezifisch.',
    symptoms: ['Leistungsverlust oder Notlauf', 'Träges Ansprechverhalten', 'Gelegentlich Pfeifen oder Zischen', 'Erhöhter Verbrauch möglich'],
    causes: ['Undichtigkeit in der Ladeluftstrecke', 'VTG- oder Wastegate-Ansteuerung arbeitet nicht korrekt', 'Unterdruckproblem', 'Ladedrucksensor liefert unplausible Werte', 'Turbolader mechanisch verschlissen oder schwergängig'],
    diagnosis: ['Fehlerspeicher inklusive Freeze-Frame-Daten auswerten', 'Soll- und Ist-Ladedruck unter Last vergleichen', 'Ladeluftsystem auf Undichtigkeiten prüfen', 'Unterdrucksystem bzw. elektrischen Steller prüfen', 'Sensorwerte plausibilisieren, bevor Bauteile ersetzt werden'],
    solutions: ['Undichte Schläuche, Schellen oder Ladeluftkühler instand setzen', 'Defekte Ansteuerung oder Sensorik ersetzen', 'VTG/Wastegate mechanisch prüfen und instand setzen', 'Turbolader nur nach eindeutiger Diagnose ersetzen'],
    note: 'Ein P0299 bedeutet nicht automatisch, dass der Turbolader defekt ist.'
  },
  P0401: {
    label:'P0401', title:'AGR-Durchfluss zu gering', system:'Motor / Abgasrückführung', severity:'Mittel', drive:'Fahrzeug ist oft noch fahrbar, die Ursache sollte zeitnah geprüft werden.',
    meaning:'Die erwartete Abgasrückführungsmenge wird nicht erreicht oder die Rückmeldung passt nicht zur Ansteuerung.',
    symptoms:['Motorkontrollleuchte', 'Unruhiger Lauf möglich', 'Leistungsverlust möglich', 'Erhöhte Emissionen'],
    causes:['Verkoktes AGR-Ventil', 'Zugesetzte AGR-Kanäle', 'Sensorabweichung', 'Unterdruck- oder Stellmotorproblem', 'Elektrische Ansteuerung fehlerhaft'],
    diagnosis:['Messwerte der AGR-Anforderung und Rückmeldung vergleichen','Stellgliedtest durchführen','Ansaug- und AGR-Strecke auf Ablagerungen prüfen','Sensorik und Verkabelung plausibilisieren'],
    solutions:['AGR-System reinigen, wenn technisch sinnvoll','Defekte Sensorik oder Ansteuerung ersetzen','Beschädigte Leitungen oder Unterdruckschläuche instand setzen'],
    note:'Die genaue Bedeutung kann sich je nach Hersteller und Motor unterscheiden.'
  },
  P2002: {
    label:'P2002', title:'Partikelfilter – Effizienz unter Grenzwert', system:'Abgas / DPF', severity:'Mittel bis hoch', drive:'Weiterfahrt nur nach Bewertung von Beladung, Differenzdruck und Temperaturdaten.',
    meaning:'Die berechnete Wirkung des Dieselpartikelfilters liegt außerhalb des erwarteten Bereichs.',
    symptoms:['Motorkontrollleuchte','DPF-Warnung möglich','Leistungsverlust','Regenerationen treten häufiger auf'],
    causes:['Hohe Ruß- oder Aschebeladung','Differenzdrucksensor oder Leitungen fehlerhaft','Temperatursensor fehlerhaft','Abgasleck','Filter beschädigt'],
    diagnosis:['Beladungswerte auslesen','Differenzdruck bei Motor aus, Leerlauf und Last vergleichen','Abgastemperaturen plausibilisieren','Abgasanlage auf Leck prüfen'],
    solutions:['Ursache der hohen Beladung beheben','Sensorik oder Leitungen instand setzen','Regeneration nur bei erfüllten Voraussetzungen durchführen','Filter bei tatsächlicher Beschädigung ersetzen'],
    note:'Eine erzwungene Regeneration ohne Ursachenprüfung kann das Problem verschleiern.'
  },
  U0100: {
    label:'U0100', title:'Kommunikation mit Motorsteuergerät gestört', system:'CAN-Bus / Kommunikation', severity:'Hoch', drive:'Je nach Begleitfehlern kann das Fahrzeug ausfallen oder nicht starten.',
    meaning:'Ein oder mehrere Steuergeräte verlieren die Kommunikation mit dem Motorsteuergerät.',
    symptoms:['Mehrere Warnleuchten gleichzeitig','Startprobleme','Notlauf','Kommunikationsfehler in mehreren Steuergeräten'],
    causes:['Unterspannung','Masseproblem','CAN-Leitung unterbrochen oder kurzgeschlossen','Steckverbindung korrodiert','Steuergerät ohne Versorgung'],
    diagnosis:['Bordnetzspannung prüfen','Gateway und mehrere Steuergeräte auslesen','Versorgung und Masse am Motorsteuergerät prüfen','CAN-H/CAN-L auf Plausibilität prüfen'],
    solutions:['Versorgungs- oder Masseproblem beseitigen','Beschädigte Leitungen oder Steckverbindungen reparieren','Steuergerät erst nach eindeutiger Prüfung ersetzen'],
    note:'U-Codes sind häufig Folgefehler einer Spannungs- oder Netzwerkstörung.'
  },
  P0171: {
    label:'P0171', title:'Gemisch zu mager', system:'Motor / Gemischbildung', severity:'Mittel', drive:'Meist kurzfristig fahrbar, bei starkem Ruckeln oder Fehlzündungen nicht weiter belasten.',
    meaning:'Die Gemischkorrektur liegt dauerhaft in Richtung Anfettung, weil das Steuergerät ein zu mageres Gemisch erkennt.',
    symptoms:['Unruhiger Leerlauf','Schlechte Gasannahme','Erhöhter Verbrauch möglich','Fehlzündungen möglich'],
    causes:['Falschluft','Kraftstoffdruck zu niedrig','Luftmassenmesser unplausibel','Einspritzproblem','Abgasleck vor Lambdasonde'],
    diagnosis:['Fuel-Trims auswerten','Ansaugsystem auf Falschluft prüfen','Luftmassenwert plausibilisieren','Kraftstoffdruck prüfen'],
    solutions:['Undichtigkeiten beseitigen','Sensorik oder Kraftstoffversorgung reparieren','Defekte Einspritzkomponenten ersetzen'],
    note:'Nicht jede magere Gemischkorrektur wird durch eine Lambdasonde verursacht.'
  },
  P0300: {
    label:'P0300', title:'Zufällige / mehrere Verbrennungsaussetzer', system:'Motor / Verbrennung', severity:'Hoch', drive:'Bei blinkender Motorkontrollleuchte oder starkem Ruckeln nicht weiterfahren.',
    meaning:'Das Motorsteuergerät erkennt Verbrennungsaussetzer auf mehreren oder wechselnden Zylindern.',
    symptoms:['Ruckeln','Leistungsverlust','Blinkende Motorkontrollleuchte möglich','Unruhiger Leerlauf'],
    causes:['Zündung','Einspritzung','Kompression','Falschluft oder Gemischproblem','Mechanischer Defekt'],
    diagnosis:['Misfire-Counter pro Zylinder auswerten','Zünd- und Einspritzkomponenten gezielt vergleichen','Kompression bzw. mechanischen Zustand prüfen','Gemischkorrekturen bewerten'],
    solutions:['Ursache am betroffenen System beheben','Zünd- oder Einspritzkomponenten nur nach eindeutiger Eingrenzung ersetzen'],
    note:'Dauerhafte Fehlzündungen können den Katalysator beschädigen.'
  },
  P2453: {
    label:'P2453', title:'DPF-Differenzdrucksensor – Signal unplausibel', system:'Abgas / DPF-Sensorik', severity:'Mittel', drive:'Meist kurzfristig fahrbar, DPF-Regeneration kann jedoch beeinträchtigt sein.',
    meaning:'Das Signal des DPF-Differenzdrucksensors liegt außerhalb des erwarteten Bereichs.',
    symptoms:['DPF- oder Motorkontrollleuchte','Regeneration wird abgebrochen','Unplausible DPF-Beladungswerte'],
    causes:['Differenzdrucksensor defekt','Druckschläuche zugesetzt oder undicht','Verkabelung fehlerhaft','DPF stark zugesetzt'],
    diagnosis:['Druckwert bei Motor aus prüfen','Werte bei Leerlauf und Last vergleichen','Schläuche auf Kondensat und Verstopfung prüfen','Elektrische Versorgung und Signal prüfen'],
    solutions:['Schläuche reinigen oder ersetzen','Sensor ersetzen, wenn Messung eindeutig fehlerhaft','DPF-Zustand anschließend neu bewerten'],
    note:'Vor dem Sensortausch immer die Druckschläuche mitprüfen.'
  },
  P0420: {
    label:'P0420', title:'Katalysatorwirkung unter Grenzwert', system:'Abgas / Katalysator', severity:'Mittel', drive:'Meist fahrbar, bei Fehlzündungen oder deutlichem Leistungsverlust Ursache zuerst beheben.',
    meaning:'Das Steuergerät bewertet die Sauerstoffspeicherfähigkeit des Katalysators als zu gering.',
    symptoms:['Motorkontrollleuchte','Oft keine spürbaren Symptome','Gelegentlich erhöhter Verbrauch'],
    causes:['Gealterter Katalysator','Lambdasonden fehlerhaft','Fehlzündungen','Abgasleck','Falsche Gemischbildung'],
    diagnosis:['Vor- und Nachkat-Sondensignale vergleichen','Fehlzündungen und Gemischfehler ausschließen','Abgasanlage auf Leck prüfen'],
    solutions:['Ursache der Gemisch- oder Zündprobleme beseitigen','Defekte Sonde ersetzen','Katalysator nur nach bestätigter Diagnose ersetzen'],
    note:'P0420 allein beweist keinen defekten Katalysator.'
  },
  OIL: {
    label:'Öldruck', title:'Rote Öldruckwarnung', system:'Motor / Schmierung', severity:'Sehr hoch', drive:'Motor sofort abstellen und nicht weiterfahren, bis die Ursache geklärt ist.',
    meaning:'Die rote Öldruckwarnung kann auf zu niedrigen Motoröldruck hinweisen.',
    symptoms:['Rote Ölkanne im Kombiinstrument','Klapper- oder Tickgeräusche möglich','Warnmeldung im Display'],
    causes:['Ölstand zu niedrig','Ölpumpe oder Ansaugsieb problematisch','Drucksensor defekt','Interner Motorverschleiß'],
    diagnosis:['Motor abstellen','Ölstand bei geeignetem Zustand prüfen','Fehlerauslese durchführen','Öldruck bei Bedarf mechanisch messen lassen'],
    solutions:['Ölverlust oder falschen Ölstand beheben','Defekten Sensor ersetzen','Schmiersystem mechanisch instand setzen'],
    note:'Eine rote Öldruckwarnung ist keine normale Serviceanzeige.'
  },
  ABS: {
    label:'ABS', title:'ABS-Warnung', system:'Bremsanlage / ABS', severity:'Hoch', drive:'Grundbremsfunktion kann vorhanden sein, ABS/ESP kann jedoch eingeschränkt sein. Vorsichtig und zeitnah prüfen lassen.',
    meaning:'Das Antiblockiersystem hat eine Störung erkannt.',
    symptoms:['ABS-Leuchte','ESP/Traktionskontrolle kann mit ausfallen','Tempomat oder Assistenzsysteme können deaktiviert sein'],
    causes:['Raddrehzahlsensor','Sensorring oder Radlager','Verkabelung','Unterspannung','ABS-Steuergerät'],
    diagnosis:['ABS-Fehlerspeicher auslesen','Raddrehzahlen live vergleichen','Sensorleitungen und Steckverbindungen prüfen'],
    solutions:['Defekten Sensor oder Ring ersetzen','Kabelschaden reparieren','Spannungsproblem beheben'],
    note:'Bei roter Bremswarnung zusätzlich zur ABS-Leuchte gelten strengere Sicherheitsmaßnahmen.'
  },
  TPMS: {
    label:'TPMS', title:'Reifendruckwarnung', system:'Reifen / Reifendruckkontrolle', severity:'Mittel', drive:'Reifendruck unmittelbar kontrollieren und Reifen auf Beschädigung prüfen.',
    meaning:'Das Reifendrucksystem erkennt einen Druckverlust oder eine Störung.',
    symptoms:['Gelbe Reifendruckleuchte','Warnmeldung im Kombiinstrument'],
    causes:['Tatsächlicher Druckverlust','Temperaturbedingte Druckänderung','Nicht korrekt angelernt','Sensor- oder ABS-Signalproblem'],
    diagnosis:['Reifendruck kalt messen','Reifen auf Beschädigung prüfen','Systemstatus und ggf. Sensorwerte auslesen'],
    solutions:['Reifendruck korrigieren','Reifen reparieren oder ersetzen','System zurücksetzen/anlernen','Defekten Sensor ersetzen'],
    note:'Bei sichtbarem Reifenschaden oder starkem Druckverlust nicht weiterfahren.'
  },
  BATTERY: {
    label:'12V', title:'Ladesystem-Warnung', system:'Bordnetz / Generator', severity:'Hoch', drive:'Fahrzeug kann weiterlaufen, aber jederzeit wegen Unterspannung ausfallen.',
    meaning:'Die Bordnetzspannung wird nicht ausreichend durch das Ladesystem gestützt.',
    symptoms:['Rote Batteriesymbol-Leuchte','Elektrische Verbraucher fallen aus','Startprobleme nach Abstellen'],
    causes:['Generator','Riemenantrieb','Batterie','Leitungs- oder Masseproblem','Energiemanagement'],
    diagnosis:['Ladespannung messen','Spannungsabfall an Plus und Masse prüfen','Riemenantrieb kontrollieren','Fehlerspeicher auslesen'],
    solutions:['Generator/Riemen instand setzen','Batterie nur bei bestätigtem Defekt ersetzen','Kontakt- und Masseprobleme reparieren'],
    note:'Die Batterieleuchte weist häufig auf das Ladesystem hin, nicht zwingend auf die Batterie selbst.'
  },
  DPF: {
    label:'DPF', title:'Partikelfilter-Warnung', system:'Abgas / Dieselpartikelfilter', severity:'Mittel bis hoch', drive:'Nur nach Herstellervorgabe weiterfahren; bei zusätzlicher Motorkontrollleuchte Diagnose priorisieren.',
    meaning:'Der Dieselpartikelfilter ist stark beladen oder das System erkennt eine relevante Störung.',
    symptoms:['DPF-Warnleuchte','Leistungsverlust möglich','Erhöhte Leerlaufdrehzahl während Regeneration'],
    causes:['Abgebrochene Regenerationen','Kurzstreckenbetrieb','Differenzdrucksensor','Temperatursensor','Motorische Ursache mit hoher Rußbildung'],
    diagnosis:['Beladungs- und Aschewerte prüfen','Differenzdruck auswerten','Temperaturen und Regenerationsstatus prüfen'],
    solutions:['Grundursache beheben','Regeneration nur bei zulässigen Bedingungen durchführen','Filter bei tatsächlicher Aschegrenze reinigen/ersetzen'],
    note:'Eine Regeneration ist keine Reparatur für einen Sensor- oder Motorfehler.'
  },
  COOLANT: {
    label:'Kühlmittel', title:'Kühlmitteltemperatur-Warnung', system:'Kühlung', severity:'Sehr hoch', drive:'Bei roter Temperaturwarnung sicher anhalten und Motor abkühlen lassen.',
    meaning:'Die Kühlmitteltemperatur liegt im kritischen Bereich oder das System meldet einen schweren Fehler.',
    symptoms:['Rote Temperaturwarnung','Temperaturanzeige steigt','Heizung kann ausfallen','Kühlmittelgeruch oder Dampf möglich'],
    causes:['Kühlmittelverlust','Thermostat','Wasserpumpe','Lüfter','Temperatursensor'],
    diagnosis:['Motor abkühlen lassen','Kühlmittelstand nur im sicheren Zustand prüfen','Lecksuche und Drucktest durchführen','Lüfter- und Pumpenfunktion prüfen'],
    solutions:['Leck beseitigen','Defekte Pumpe/Thermostat/Sensorik ersetzen','Kühlsystem korrekt entlüften'],
    note:'Einen heißen Kühlmittelbehälter nicht öffnen.'
  },
  AIRBAG: {
    label:'SRS', title:'Airbag / SRS-Warnung', system:'Rückhaltesystem', severity:'Hoch', drive:'Fahrzeug kann fahren, das Rückhaltesystem kann jedoch eingeschränkt sein.',
    meaning:'Das Airbag- bzw. Rückhaltesystem hat einen Fehler gespeichert.',
    symptoms:['Airbag-Leuchte bleibt an','Gurtstraffer- oder Sitzbelegungswarnung möglich'],
    causes:['Steckverbindung','Sitzbelegungserkennung','Gurtstraffer','Crashsensor','Steuergerät oder Verkabelung'],
    diagnosis:['SRS-Fehlerspeicher mit geeignetem Diagnosesystem auslesen','Versorgung und Steckverbindungen nach Herstellervorgabe prüfen'],
    solutions:['Defekte Sensorik oder Verkabelung instand setzen','Pyrotechnische Bauteile ausschließlich fachgerecht behandeln'],
    note:'Keine Widerstandsmessungen oder Manipulationen an pyrotechnischen Komponenten durchführen.'
  },
  BRAKE: {
    label:'Bremse', title:'Rote Bremsanlagen-Warnung', system:'Bremsanlage', severity:'Sehr hoch', drive:'Sicher anhalten und Ursache vor Weiterfahrt klären.',
    meaning:'Eine rote Bremswarnung kann auf Feststellbremse, zu niedrigen Bremsflüssigkeitsstand oder eine sicherheitsrelevante Störung hinweisen.',
    symptoms:['Rote Bremswarnleuchte','Warnmeldung','Verändertes Bremspedalgefühl möglich'],
    causes:['Feststellbremse aktiv oder fehlerhaft','Bremsflüssigkeitsstand zu niedrig','Hydraulikproblem','Elektronische Bremsanlage'],
    diagnosis:['Fahrzeug sicher abstellen','Bremsflüssigkeitsstand kontrollieren','Bremsanlage auf sichtbare Lecks prüfen','Fehlerspeicher auslesen'],
    solutions:['Ursache des Flüssigkeitsverlusts beheben','Elektronischen oder mechanischen Fehler reparieren'],
    note:'Bei verändertem Pedalgefühl oder Flüssigkeitsverlust nicht weiterfahren.'
  },
  EPC: {
    label:'EPC', title:'Elektronische Motorleistungsregelung', system:'Motorsteuerung', severity:'Mittel bis hoch', drive:'Bei starkem Leistungsverlust oder unruhigem Motorlauf nur vorsichtig bzw. nicht weiterfahren.',
    meaning:'Das elektronische Motormanagement hat eine Störung in einem für die Leistungsregelung relevanten System erkannt.',
    symptoms:['EPC-Leuchte','Notlauf','Leistungsverlust','Unruhiger Motorlauf möglich'],
    causes:['Drosselklappe','Pedalwertgeber','Sensorik','Zündung','Motormanagement'],
    diagnosis:['Motorsteuergerät auslesen','Begleit-DTCs priorisieren','Pedal- und Drosselklappenwerte vergleichen'],
    solutions:['Fehlerhafte Sensorik/Ansteuerung reparieren','Drosselklappensystem nach Herstellervorgabe instand setzen'],
    note:'EPC ist eine Sammelwarnung; der gespeicherte DTC liefert die eigentliche Richtung.'
  },
  STEERING: {
    label:'EPS', title:'Lenkung / Servolenkung', system:'Lenkung', severity:'Hoch', drive:'Bei deutlich erhöhter Lenkkraft oder roter Warnung sicher anhalten.',
    meaning:'Die elektrische oder elektromechanische Lenkunterstützung meldet eine Störung.',
    symptoms:['Gelbe oder rote Lenkwarnung','Lenkung wird schwergängig','Assistenzsysteme können deaktiviert sein'],
    causes:['Unterspannung','Lenkwinkelsensor','Servomotor','Verkabelung','Steuergerät'],
    diagnosis:['Bordnetzspannung prüfen','Lenkungssteuergerät auslesen','Lenkwinkel- und Versorgungssignale plausibilisieren'],
    solutions:['Spannungsproblem beheben','Sensorik kalibrieren oder ersetzen','Antrieb/Steuergerät nach Diagnose instand setzen'],
    note:'Nach Arbeiten an Fahrwerk oder Batterie kann je nach Fahrzeug eine Kalibrierung erforderlich sein.'
  }
};
