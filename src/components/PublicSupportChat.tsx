import { useMemo } from 'react';
import { createChatApi } from '../chat/api';
import { configuredApiBaseUrl } from '../config/api';
import type { Language } from '../i18n/language';
import type { VehicleContext } from '../vehicle/catalog';
import { SupportChat } from './SupportChat';

export function PublicSupportChat({ language, vehicle, faultCode }: {
  language: Language;
  vehicle: VehicleContext;
  faultCode?: string;
}) {
  const api = useMemo(() => createChatApi({ baseUrl: configuredApiBaseUrl() }), []);
  return <SupportChat api={api} language={language} vehicle={vehicle} faultCode={faultCode} />;
}
