import i18next from 'i18next';

export default function safeGetStringFromName(
  defvalue: string,
  locale: string,
  namespace: string,
  key: string
) {
  const options = { lng: locale, ns: namespace };
  return i18next.exists(key, options) ? i18next.t(key, options) : defvalue;
}
