// If renderPromise is null, convertLocation will return the input, and only
// the global locale will be used for parsing.

import C from '../constant.ts';
import { G, GI } from './G.ts';
import { dString } from './common.tsx';
import RenderPromise from './renderPromise.ts';
import RefParser from '../refParser.ts';
import VerseKey from '../verseKey.ts';

import type { LocationVKType, V11nType } from '../type.ts';
import type { RefParserOptionsType } from '../refParser.ts';

export default function verseKey(
  versekey: LocationVKType | { parse: string; v11n: V11nType },
  renderPromise: RenderPromise | null,
  optionsx?: RefParserOptionsType,
): VerseKey {
  // Minimal parser options are 'locales: [locale]'
  const options = optionsx || {};
  const locales = [G.i18n.language];
  if (options.locales) {
    locales.push(...options.locales.filter((l) => l !== G.i18n.language));
  }
  options.locales = locales;

  const locs = Build.isElectronApp
    ? C.Locales.map((l) => l[0])
    : options.locales;
  let digits: Record<string, string[] | null>;
  let books: ReturnType<typeof GI.getLocalizedBooks>;
  if (Build.isElectronApp) {
    digits = locs.reduce(
    (p, c) => {
      p[c] = G.getLocaleDigits(c);
      return p;
    },
    {} as Record<string, string[] | null>,
  );
    books = G.getLocalizedBooks(true);
  } else if (renderPromise) {
    digits = locs.reduce(
    (p, c) => {
      p[c] = GI.getLocaleDigits(null, renderPromise, c);
      return p;
    },
    {} as Record<string, string[] | null>,
  );
    books = GI.getLocalizedBooks({}, renderPromise, locs);
  } else {
    options.locales = [G.i18n.language];
    digits = { [G.i18n.language]: G.getLocaleDigits() };
    books = G.getLocalizedBooks([G.i18n.language]);
  }
  if (renderPromise?.waiting()) {
    options.locales = [G.i18n.language];
    digits = { [G.i18n.language]: G.getLocaleDigits() };
    books = G.getLocalizedBooks([G.i18n.language]);
  }

  let convertLocation;
  if (renderPromise !== null) {
    convertLocation = (
      fromv11n: V11nType,
      vkeytext: string,
      tov11n: V11nType,
    ) => {
      const newloc = GI.LibSword.convertLocation(
        vkeytext,
        renderPromise,
        fromv11n,
        vkeytext,
        tov11n,
      );
      return newloc;
    };
  }

  return new VerseKey(
    new RefParser(digits, books, options),
    {
      convertLocation,
      Book: () => G.Book(G.i18n.language),
      Tab: () => G.Tab,
      getBkChsInV11n: (v11n: V11nType) => {
        return GI.getBkChsInV11n([], renderPromise, v11n);
      },
    },
    (str: string | number, locale?: string) => {
      return dString(str, locale, renderPromise ?? undefined);
    },
    versekey,
  );
}
