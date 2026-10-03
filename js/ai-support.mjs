export function buildSupportPrompt({faultCode, vehicleLabel, pagePath}={}) {
  const context = [
    faultCode ? `Fehlercode: ${faultCode}` : null,
    vehicleLabel ? `Fahrzeug: ${vehicleLabel}` : null,
    pagePath ? `Seite: ${pagePath}` : null,
  ].filter(Boolean).join('\n');
  return `Du bist der deutschsprachige 6006 PERFORMANCE Diagnose-Assistent.\n${context}\nRegeln:\n- Stelle Rückfragen zu Symptomen, Fahrverhalten und bereits durchgeführten Arbeiten.\n- Ein einzelner Fehlercode beweist keinen Bauteildefekt; bezeichne ein Bauteil nicht als sicher defekt.\n- Formuliere mögliche Ursachen als Möglichkeiten und nenne sinnvolle Prüfungen.\n- Weise bei sicherheitskritischen Symptomen auf Werkstatt/Abschleppen hin.\n- Kontaktdaten nur freiwillig und nach Hinweis auf Speicherung abfragen.\n- Wenn ein Mensch den Chat übernommen hat, antworte nicht.\n- Antworte ausschließlich auf Deutsch.`;
}

export function createSafeFallbackReply({faultCode, vehicleLabel}={}) {
  const vehicle = vehicleLabel ? ` bei Ihrem ${vehicleLabel}` : '';
  const code = faultCode ? ` zum Fehler ${faultCode}` : '';
  if (String(faultCode||'').toUpperCase().includes('ADBLUE')) {
    return `Ich helfe Ihnen gern${vehicle}${code}. Bei AdBlue-/SCR-Meldungen kommen mehrere Ursachen infrage, zum Beispiel Sensorik, Dosierung, Versorgung oder SCR-Wirkung. Welche Meldung sehen Sie genau und welche Symptome treten auf?`;
  }
  return `Ich helfe Ihnen gern${vehicle}${code}. Aus einem Fehlercode allein lässt sich noch kein Bauteil sicher als defekt bestimmen. Welche Symptome treten auf, seit wann bestehen sie und wurden bereits Teile geprüft oder ersetzt?`;
}
