// If renderPromise is null, convertLocation will return the input

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
    new RefParser(
      Build.isElectronApp
        ? C.Locales.reduce(
            (p, c) => {
              p[c[0]] = G.getLocaleDigits(c[0]);
              return p;
            },
            {} as Record<string, string[] | null>,
          )
        : { [G.i18n.language]: G.getLocaleDigits() },
      G.getLocalizedBooks(Build.isElectronApp ? true : [G.i18n.language]),
      options,
    ),
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
