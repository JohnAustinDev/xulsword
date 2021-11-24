import i18next from 'i18next';

export default function safeGetStringFromName(
  defvalue: string,
  locale: string,
  namespace: string,
  key: string
) {
  return i18next.t(key, { lng: locale, ns: namespace }) || defvalue;
}
