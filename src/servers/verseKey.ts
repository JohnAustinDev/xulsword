import i18n from 'i18next';
import C from '../constant.ts';
import RefParser, { RefParserOptionsType } from '../refParser.ts';
import { LocationVKType, V11nType } from '../type.ts';
import VerseKey from '../verseKey.ts';
import {
  getBook,
  getBkChsInV11n,
  getLocaleDigits,
  getLocalizedBooks,
  getTab,
} from './common.ts';
import LibSword from './components/libsword.ts';

import type verseKeyClient from '../clients/verseKey.ts';

export default function verseKey(
  versekey: LocationVKType | { parse: string; v11n: V11nType },
  options?: RefParserOptionsType,
): VerseKey {
  const digits = C.Locales.reduce(
    (p, c) => {
      p[c[0]] = getLocaleDigits(c[0]);
      return p;
    },
    {} as Record<string, string[] | null>,
  );
  return new VerseKey(
    new RefParser(digits, getLocalizedBooks(true), options),
    {
      convertLocation: (
        fromv11n: V11nType,
        vkeytext: string,
        tov11n: V11nType,
      ) => {
        return LibSword.convertLocation(fromv11n, vkeytext, tov11n);
      },
      Book: (locale?: string) => {
        return getBook(locale);
      },
      Tab: () => {
        return getTab();
      },
      getBkChsInV11n,
    },
    (str: string | number, locale?: string) => {
      let s = str.toString();
      const digits = getLocaleDigits(locale ?? i18n.language);
      if (digits) {
        for (let i = 0; i <= 9; i += 1) {
          s = s.replaceAll(i.toString(), digits[i]);
        }
      }
      return s;
    },
    versekey,
  );
}

// A function having the call signature of src/common.ts verseKey(),
// since a RenderPromise is never required on the server.
export const verseKeyCommon: typeof verseKeyClient = (
  versekey,
  _renderPromise,
  options?,
) => {
  return verseKey(versekey, options);
};
