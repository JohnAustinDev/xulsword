import Cache from './cache.ts';
import C from './constant.ts';

import type { getLocaleDigits, getLocalizedBooks } from './servers/common.ts';
import type {
  BookGroupType,
  LocationVKType,
  V11nType,
  OSISBookType,
} from './type.ts';

type IdentifyBookType = {
  code: OSISBookType | '';
  locale: string | null;
};

type BookNamePartsType = {
  number: number;
  name: string;
  locale: string | null;
};

type InvalidLocationVKType = {
  v11n: V11nType;
  book: '';
  chapter: 0;
  verse: null;
  lastverse: null;
};

export type RefParserOptionsType = {
  locales?: string[]; // search just these locales for book names (undefined is current locale only)

  onlyOsisCode?: boolean; // search OSIS book codes and not locales

  noVariations?: boolean; // don't consider a locale's CODEVariations entry

  exactMatch?: boolean; // locale books must match exactly (case insensitive), instead of allowing unmatched suffixes

  uncertain?: boolean; // if multiple different book codes are matched, the first is returned, instead of null
};

// Parse human readable Bible reference strings into LocationVKType
// or null if the string is not an understandable reference.
export default class RefParser {
  locales: string[];

  onlyOsisCode: boolean;

  noVariations: boolean;

  exactMatch: boolean;

  uncertain: boolean;

  osisString: string;

  osisStringLC: string;

  localeDigits: ReturnType<typeof getLocaleDigits>;

  localizedBooks: ReturnType<typeof getLocalizedBooks>;

  constructor(
    localeDigits: ReturnType<typeof getLocaleDigits>,
    localizedBooks: ReturnType<typeof getLocalizedBooks>,
    options?: RefParserOptionsType,
  ) {
    this.localeDigits = localeDigits;
    this.localizedBooks = localizedBooks;
    this.onlyOsisCode = false;
    this.noVariations = false;
    this.exactMatch = false;
    this.uncertain = false;
    this.osisString = C.SupportedBookGroups.reduce((p, bg) => {
      return `${p}${C.SupportedBooks[bg].join('.')}.`;
    }, '.');
    this.osisStringLC = this.osisString.toLowerCase();
    this.locales = [];
    if (options) {
      Object.entries(options).forEach((entry) => {
        const name = entry[0] as keyof RefParserOptionsType;
        const val = entry[1] as any;
        this[name] = val;
      });
    }
    if (
      !this.locales.every(
        (l) => l in this.localeDigits && l in this.localizedBooks,
      )
    ) {
      throw new Error(
        `Missing RefParser data: locales=${this.locales.join(
          ', ',
        )} localeDigits=${Object.keys(this.localeDigits).join(
          ', ',
        )} localizedBooks=${Object.keys(this.localizedBooks).join(', ')}`,
      );
    }
  }

  // Search through each book name (including short, long and variations) of each
  // locale looking for matches to inbook. The number of matches found is returned.
  // If exact is true, inbook must match exactly (but case insensetive) and upon the
  // first match, searching will stop and 1 is returned. If exact is false. inbook
  // may have any suffix(es) and still be considered a match, and all locales are
  // searched exhaustively and all matches are returned.
  #compareAgainstLocale(
    exact: boolean,
    inbook: BookNamePartsType,
    bookInfo: IdentifyBookType,
  ): number {
    let { locales } = this;
    // If there is an inbook.locale (where getBookNameParts() was succesfull), make
    // sure that it is always searched first.
    if (inbook.locale) {
      locales = locales.filter((l) => l !== inbook.locale);
      locales.unshift(inbook.locale);
    }
    const codes = new Set<string>();
    locales.forEach((loc) => {
      // Currently xulsword locales only include ot and nt books.
      ['ot', 'nt'].forEach((bgs) => {
        const bg = bgs as BookGroupType;
        C.SupportedBooks[bg].forEach((code) => {
          if (codes.size && exact) return;
          let codeMatches = false;
          const locbooks = this.localizedBooks[loc];
          if (locbooks) {
            locbooks[code].forEach((lnamea, i) => {
              if (codeMatches || (i === 2 && this.noVariations)) return;
              lnamea.forEach((lname) => {
                if (codeMatches || !lname) return;
                const test = this.#getBookNameParts(lname, loc);
                if (inbook.number === test.number) {
                  let s;
                  let l;
                  // Don't allow swapping of variations, which may be abbreviated.
                  if (test.name.length < inbook.name.length && i !== 2) {
                    s = test.name.toLowerCase();
                    l = inbook.name.toLowerCase();
                  } else {
                    s = inbook.name.toLowerCase();
                    l = test.name.toLowerCase();
                  }
                  codeMatches = exact ? s === l : l.startsWith(s);
                }
              });
            });
          }
          if (codeMatches) {
            codes.add(code);
            if (!bookInfo.code) {
              bookInfo.code = code;
              bookInfo.locale = loc;
            }
          }
        });
      });
    });
    return codes.size;
  }

  // Some book names may have a space between a name and a number (ie
  // 1st Corinthians). This separates the name and number (ie '1' and
  // 'Corinthians'). If the name has no number associated with it, 0
  // is returned as number. Since both digits and ordinals (ie 'First')
  // may be localized, one or more localized searches is done. If
  // alocale is provided, that one is searched, otherwise all of the
  // parser's locales are searched. NOTE: Currently only localized
  // digits are supported, not localized ordinals, although this
  // function could do that if ordinals were added to xulsword's locales.
  #getBookNameParts(string: string, alocale?: string): BookNamePartsType {
    let name = string;
    name = name.trim();
    const ckey = `getBookNameParts(${string}, ${alocale})`;
    if (!Cache.has(ckey)) {
      let locale: string | null = null;
      const locales = alocale ? [alocale] : this.locales;
      const { localeDigits } = this;
      locales.forEach((loc) => {
        let test = name.toString();
        const a = localeDigits[loc];
        if (a !== null) {
          for (let i = 0; i <= 9; i += 1) {
            test = test.replaceAll(a[i], i.toString());
          }
        }
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
      Cache.write({ number, name: namea.join(' '), locale }, ckey);
    }
    return Cache.read(ckey);
  }

  // Takes a string and tries to parse out a localized book name. If a book
  // name is found, the locale of the matched book is returned. If parsing
  // is unsuccessful, null is returned.
  #identifyBook(book: string): IdentifyBookType | null {
    const r: IdentifyBookType = { code: '', locale: null };
    let osisi = this.osisStringLC.indexOf(`.${book.toLowerCase()}.`);
    osisi += 1;
    if (osisi) {
      const code = this.osisString.substring(
        osisi,
        this.osisString.indexOf('.', osisi),
      ) as OSISBookType;
      r.code = code;
      return r;
    }
    if (this.onlyOsisCode) return null;

    const inbook = this.#getBookNameParts(book);

    // Look for exact match.
    let count = this.#compareAgainstLocale(true, inbook, r);
    if (count || this.exactMatch) {
      return count && r && r.code ? r : null;
    }
    // Otherwise try matching with wildcard suffix.
    count = this.#compareAgainstLocale(false, inbook, r);
    if (count) {
      return (this.uncertain || count === 1) && r && r.code ? r : null;
    }

    return null;
  }

  // Tries to parse a readable reference string to return an OSIS book code,
  // chapter, verse, lastverse, and locale. If no book code results from the
  // parse, null is returned. Otherwise a missing chapter is returned as 0,
  // while missing verse and lastverse are returned as null.
  parse(
    text2parse: string,
    v11n: V11nType | null,
  ): {
    location: LocationVKType | InvalidLocationVKType;
    locale: string | null;
  } | null {
    let text = text2parse;
    text = text.replace(/[^\s\p{L}\p{N}:-]/gu, ' ');
    text = text.replace(/\s+/g, ' ');
    text = text.trim();

    if (!text) {
      return null;
    }

    const r: {
      location: LocationVKType | InvalidLocationVKType;
      locale: string | null;
    } = {
      location: {
        v11n: v11n ?? 'KJV',
        book: '',
        chapter: 0,
        verse: null,
        lastverse: null,
      } satisfies InvalidLocationVKType,
      locale: null,
    };

    let has1chap = false;
    let shft = 0; // book=1, chap=2, verse=3, lastverse=4
    let p = null;
    if (p === null) {
      p = text.match(/^(.+?)\s+(\d+)\s*:\s*(\d+)\s*-\s*(\d+)$/);
    } // book 1:2-3
    if (p === null) {
      p = text.match(/^(.+?)\s+(\d+)\s*:\s*(\d+)$/);
    } // book 4:5
    if (p === null) {
      p = text.match(/^(.+?)\s+(\d+)$/);
    } // book 6
    if (p === null) {
      p = text.match(/^(.+?)\s+[v|V].*(\d+)$/);
      if (p) has1chap = true;
    } // book v6 THIS VARIES WITH LOCALE!
    if (p === null) {
      p = text.match(/^(\d+)$/);
      if (p) shft = 1;
    } // 6
    if (p === null) {
      p = text.match(/^(\d+)\s*:\s*(\d+)\s*-\s*(\d+)$/);
      if (p) shft = 1;
    } // 1:2-3
    if (p === null) {
      p = text.match(/^(\d+)\s*:\s*(\d+)$/);
      if (p) shft = 1;
    } // 4:5
    if (p === null) {
      p = text.match(/^(\d+)\s*-\s*(\d+)$/);
      if (p) shft = 2;
    } // 4-5
    if (p === null) {
      p = text.match(/^(.*?)$/);
    } // book

    if (p) {
      while (shft) {
        p.splice(1, 0, '');
        shft -= 1;
      }
      if (has1chap) p.splice(2, 0, '1'); // insert chapter=1 if book has only one chapter
      if (p[1]) {
        const idbk = this.#identifyBook(p[1]);
        if (idbk) {
          r.location.book = idbk.code;
          if (idbk.locale) r.locale = idbk.locale;
          if (p[2]) {
            const ch = Number(p[2]);
            if (ch > C.MAXCHAPTER) return null;
            r.location.chapter = ch;
          }
          if (p[3]) {
            const vs = Number(p[3]);
            if (vs > C.MAXVERSE) return null;
            r.location.verse = vs;
          }
          if (p[4]) {
            const lv = Number(p[4]);
            if (lv > C.MAXVERSE) return null;
            if (r.location.verse && lv >= r.location.verse) {
              r.location.lastverse = lv;
            }
          }
          return r;
        }
      }
    }
    return null;
  }
}
