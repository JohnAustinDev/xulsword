/* eslint-disable @typescript-eslint/no-explicit-any */
import i18next from 'i18next';
import C from './constant';
import { escapeRE, iString } from './common';

import type { BookGroupType, LocationVKType, GType, V11nType } from './type';

type RefParserGtype = {
  Book: () => GType['Book'];
};

type IdentifyBookType = {
  code: string;
  locale: string | null;
};

type BookNamePartsType = {
  number: number;
  name: string;
  locale: string | null;
};

export type RefParserOptionsType = {
  noOsisCode?: boolean; // don't search for OSIS book codes

  onlyOsisCode?: boolean; // search OSIS book codes and not locales

  noOtherLocale?: boolean; // search just the program locale, and no others

  noVariations?: boolean; // don't consider a locale's CODEVariations entry

  exactMatch?: boolean; // locale books must match exactly (case insensitive), instead of allowing unmatched suffixes

  uncertain?: boolean; // if multiple different book codes are matched, the first is still returned, instead of null
};

// Parse human readable Bible reference strings into LocationVKType or
// null if the string is not an understandable reference.
// IMPORTANT: This class depends on data from the calling process, requiring
// that access functions are supplied from the calling process during creation.
export default class RefParser {
  #locales: string[];

  noOsisCode: boolean;

  onlyOsisCode: boolean;

  noOtherLocale: boolean;

  noVariations: boolean;

  exactMatch: boolean;

  uncertain: boolean;

  gfunctions: RefParserGtype;

  localesAccessor: () => string[];

  constructor(
    gfunctions: RefParserGtype,
    localesAccessor: () => string[],
    options?: RefParserOptionsType
  ) {
    this.gfunctions = gfunctions;
    this.localesAccessor = localesAccessor;
    this.#locales = [];
    this.noOsisCode = false;
    this.onlyOsisCode = false;
    this.noOtherLocale = false;
    this.noVariations = false;
    this.exactMatch = false;
    this.uncertain = false;
    if (options) {
      Object.entries(options).forEach((entry) => {
        const name = entry[0] as keyof RefParserOptionsType;
        const val = entry[1] as any;
        this[name] = val;
      });
    }
  }

  // Search through each book name (including short, long, + variations) of a locale.
  #compareAgainstLocale(
    exact: boolean,
    inbook: BookNamePartsType,
    bookInfo: IdentifyBookType
  ): number {
    let locales = this.#locales;
    // If there is an inbook.locale, make sure it is always searched, and first.
    if (inbook.locale) {
      if (!locales.includes(inbook.locale)) locales.unshift(inbook.locale);
      else if (locales.length > 1) {
        locales = locales.filter((l) => l !== inbook.locale);
        locales.unshift(inbook.locale);
      }
    }
    const book = this.gfunctions.Book();
    const bgs: BookGroupType[] = ['ot', 'nt'];
    let count = 0;
    locales.forEach((loc) => {
      const toptions = { lng: loc, ns: 'common/books' };
      bgs.forEach((bg: BookGroupType) => {
        C.SupportedBooks[bg].forEach((bk) => {
          const keys = [book[bk].code, `Long${book[bk].code}`];
          if (!this.noVariations) keys.push(`${book[bk].code}Variations`);
          const list = keys.map((k) => {
            const r = i18next.t(k, toptions);
            return !r ? null : r.trim().split(/\s*,\s*/);
          });
          let s;
          let l;
          let isMatch = false;
          list.forEach((a) => {
            if (isMatch || a === null) return;
            a.forEach((v) => {
              if (isMatch || !v) return;
              const testbook = this.#getBookNameParts(v, loc);
              if (inbook.number === testbook.number) {
                if (testbook.name.length < inbook.name.length) {
                  s = testbook.name;
                  l = inbook.name;
                } else {
                  s = inbook.name;
                  l = testbook.name;
                }
                const sre = exact
                  ? new RegExp(`^${escapeRE(s)}$`, 'i')
                  : new RegExp(`^${escapeRE(s)}`, 'i');
                if (sre.test(l)) isMatch = true;
              }
            });
          });
          if (isMatch) {
            if (bookInfo.code !== book[bk].code) {
              bookInfo.code = book[bk].code;
              count += 1;
            }
          }
        });
      });
    });

    return count;
  }

  // Some book names may have a space between a name and a number (ie 1st Corinthians).
  // This separates the name and number (ie '1' and 'Corinthians'). If the name has no
  // number associated with it, 0 is returned as number.
  #getBookNameParts(string: string, alocale?: string): BookNamePartsType {
    let name = string;
    name = name.trim();

    let locale: string | null = null;
    const locales = alocale ? [alocale] : this.#locales;
    locales.forEach((loc) => {
      const test = iString(name, loc);
      if (test === name) return;
      name = test;
      locale = loc;
    });

    const parts = name.split(' ');

    let number = 0;
    const namea: string[] = [];
    parts.forEach((p) => {
      const digit = p.match(/(\d+)/);
      if (!digit) {
        namea.push(p);
      } else {
        number = Number(digit[1]);
        if (parts.length === 1) {
          namea.push(p.replace(digit[1], ''));
        }
      }
    });

    return { number, name: namea.join(' '), locale };
  }

  // Takes a string and tries to parse out a localized book name. If a book name
  // is found, the OSIS book code and any default modules for the successful
  // locale are recorded. If parsing is unsuccessful, null is returned.
  #identifyBook(book: string): IdentifyBookType | null {
    const r: IdentifyBookType = { code: '', locale: null };

    if (!this.noOsisCode) {
      C.SupportedBookGroups.some((bg) => {
        const bk = C.SupportedBooks[bg].find(
          (b) => b.toLowerCase() === book.toLowerCase()
        );
        if (bk) {
          r.code = bk;
          return true;
        }
        return false;
      });
    }
    if (r.code) return r;
    if (this.onlyOsisCode) return null;

    const inbook = this.#getBookNameParts(book);

    // Look for exact match and if not found maybe look for partial match.
    let count = this.#compareAgainstLocale(true, inbook, r);
    if (!this.uncertain && count > 1) return null;
    if (!this.exactMatch) {
      if (!count) count = this.#compareAgainstLocale(false, inbook, r);
      if (!this.uncertain && count > 1) return null;
    }

    return r && r.code ? r : null;
  }

  // Tries to parse a readable reference string to return an OSIS book code,
  // chapter, verse, lastverse, and locale. If no book code results from the
  // parse, null is returned. Otherwise a missing chapter is returned as 0,
  // while missing verse and lastverse are returned as null.
  parse(
    text2parse: string,
    v11n: V11nType
  ): { location: LocationVKType; locale: string | null } | null {
    let text = text2parse;
    text = text.replace(/[^\s\p{L}\p{N}:-]/gu, '');
    text = text.replace(/\s+/g, ' ');
    text = text.trim();

    if (!text) {
      return null;
    }

    const r: { location: LocationVKType; locale: string | null } = {
      location: {
        v11n,
        book: '',
        chapter: 0,
        verse: null,
        lastverse: null,
      },
      locale: null,
    };

    let has1chap;
    let shft; // book=1, chap=2, verse=3, lastverse=4
    /* eslint-disable prettier/prettier */
    let p = null;
    if (p === null) {p = text.match(/^(.+?)\s+(\d+):(\d+)-(\d+)$/); shft=0; has1chap=false;} // book 1:2-3
    if (p === null) {p = text.match(/^(.+?)\s+(\d+):(\d+)$/);       shft=0; has1chap=false;} // book 4:5
    if (p === null) {p = text.match(/^(.+?)\s+(\d+)$/);             shft=0; has1chap=false;} // book 6
    if (p === null) {p = text.match(/^(.+?)\s+[v|V].*(\d+)$/);      shft=0; has1chap=true; } // book v6 THIS VARIES WITH LOCALE!
    if (p === null) {p = text.match(/^(\d+)$/);                     shft=2; has1chap=false;} // 6
    if (p === null) {p = text.match(/^(\d+):(\d+)-(\d+)$/);         shft=1; has1chap=false;} // 1:2-3
    if (p === null) {p = text.match(/^(\d+):(\d+)$/);               shft=1; has1chap=false;} // 4:5
    if (p === null) {p = text.match(/^(\d+)-(\d+)$/);               shft=2; has1chap=false;} // 4-5
    if (p === null) {p = text.match(/^(.*?)$/);                     shft=0; has1chap=false;} // book
    /* eslint-enable prettier/prettier */
    // jsdump("parsed:" + parsed + " match type:" + m + "\n");

    if (p) {
      while (shft) {
        p.splice(1, 0);
        shft -= 1;
      }
      if (has1chap) p.splice(2, 0, '1'); // insert chapter=1 if book has only one chapter
      if (p[1]) {
        this.#locales = this.noOtherLocale
          ? [i18next.language]
          : this.localesAccessor();
        const idbk = this.#identifyBook(p[1]);
        if (idbk) {
          r.location.book = idbk.code;
          if (idbk.locale) r.locale = idbk.locale;
          if (p[2]) {
            r.location.chapter = Number(p[2]);
          }
          if (p[3]) {
            r.location.verse = Number(p[3]);
          }
          if (p[4]) {
            r.location.lastverse = Number(p[4]);
          }
          return r;
        }
      }
    }

    return null;
  }
}
