import C from './constant.ts';
import { clone, dString } from './common.ts';

import type { GType, LocationVKType, OSISBookType, V11nType } from './type.ts';
import type RefParser from './refParser.ts';

type VerseKeyGtype = {
  convertLocation: GType['LibSword']['convertLocation'];
  Book: () => GType['Book'];
  Tab: () => GType['Tab'];
};

// Keep a reference to a particular range of Bible verses up to a whole
// chapter. Supports conversion between different verse systems.
// IMPORTANT: This class depends on data from the calling process, requiring
// access functions be supplied from the calling process during instantiation.
export default class VerseKey {
  #parser: RefParser;

  #bkChsInV11n: GType['BkChsInV11n'];

  #localeDirection: 'ltr' | 'rtl';

  #gfunctions: VerseKeyGtype;

  #loc: LocationVKType;

  #v11nCurrent: V11nType | null;

  constructor(
    parser: RefParser,
    bkChsInV11n: GType['BkChsInV11n'],
    localeDirection: 'ltr' | 'rtl',
    gfunction: VerseKeyGtype,
    location: LocationVKType | string,
    v11n?: V11nType | null
  ) {
    this.#parser = parser;
    this.#bkChsInV11n = bkChsInV11n;
    this.#localeDirection = localeDirection;
    this.#gfunctions = gfunction;
    if (typeof location === 'string') {
      const parsed = this.parseLocation(location, v11n);
      if (parsed.book) {
        this.#loc = parsed as LocationVKType;
      } else {
        this.#loc = {
          book: 'Gen',
          chapter: 1,
          v11n: 'KJV',
        };
      }
    } else {
      this.#loc = clone(location);
    }
    this.#v11nCurrent = v11n || this.#loc.v11n;
  }

  // Accept any osisRef work prefix and then look for an OSIS ref book code. If the
  // reference starts with a book code, the following string patterns are parsed:
  // code, code 1, code 1:1, code 1:1-1, code 1:1 - code 1:1, code.1, code.1.1, code.1.1.1
  // Otherwise the string will be parsed using parse() for up to two dash separated
  // segments. If a location cannot be parsed, book will be empty string and chapter will
  // be 0. If any range contains verses beyond the chapter, those verses will not be
  // included in the VerseKey.
  parseLocation(location: string, tov11n?: V11nType | null) {
    const Tab = this.#gfunctions.Tab();
    let work;
    let loc = location.trim();
    const match = loc.match(/^(\w[\w\d]+):(.*)$/);
    if (match) [, work, loc] = match;
    const workv11n = work && work in Tab && Tab[work].v11n;
    const code = loc.match(/^([\w\d]+)\./);
    let book: OSISBookType | '' = '';
    let chapter = 0;
    let verse = null as number | null | undefined;
    let lastverse = null as number | null | undefined;
    let v11n = workv11n || tov11n || null;
    if (
      code &&
      Object.values(C.SupportedBooks).some((bg: any) => bg.includes(code[1]))
    ) {
      const segs = loc.split('-');
      if (segs.length > 2) segs.splice(1, segs.length - 2);
      segs.forEach((seg) => {
        const [bk, ch, vs, lv] = seg.split('.');
        if (
          bk &&
          Object.values(C.SupportedBooks).some((bg: any) => bg.includes(bk))
        ) {
          if (!book) book = bk as OSISBookType;
          if (bk === book && ch) {
            if (!chapter) chapter = Number(ch);
            if (Number(ch) === chapter && vs) {
              if (!verse) verse = Number(vs);
              else lastverse = Number(vs);
              if (lv) lastverse = Number(lv);
            }
          }
        }
      });
    } else {
      const p = this.#parser.parse(loc, v11n)?.location;
      if (p) {
        ({ book, chapter, verse, lastverse, v11n } = p);
      }
    }
    return {
      book,
      chapter,
      verse,
      lastverse: lastverse || verse || null,
      v11n,
    };
  }

  // LibSword.convertLocation returns unpredictable locations if vkeytext's
  // book, chapter, verse and lastverse are not in the verse system or
  // if the book is not included in tov11n. Also LibSword only converts
  // between systems in C.SupportedV11nMaps. So these things must be
  // checked before ever calling LibSword.
  #doConvertLocation(tov11n: V11nType) {
    const fromv11n = this.#loc.v11n;
    if (fromv11n === tov11n) return false;
    if (!fromv11n || !tov11n) return false;
    if (!(fromv11n in C.SupportedV11nMaps)) return false;
    if (!C.SupportedV11nMaps[fromv11n].includes(tov11n)) return false;
    const { book, chapter, verse, lastverse } = this.#loc;
    if (!(tov11n in this.#bkChsInV11n)) return false;
    if (!this.#bkChsInV11n[tov11n].some((x) => x[0] === book)) return false;
    const bkfo =
      fromv11n in this.#bkChsInV11n &&
      this.#bkChsInV11n[fromv11n].find((x) => x[0] === book);
    const maxch: number = bkfo ? bkfo[1] : 0;
    if (chapter < 1 || chapter > maxch) return false;
    if (verse) {
      const maxv = C.MAXVERSE; // slow: getMaxVerse(fromv11n, [b, c].join('.'));
      if (
        verse < 1 ||
        verse > maxv ||
        (lastverse && lastverse < verse) ||
        (lastverse && lastverse > maxv)
      )
        return false;
    }
    return true;
  }

  get v11n() {
    return this.#v11nCurrent;
  }

  set v11n(v11n) {
    this.#v11nCurrent = v11n;
  }

  get book() {
    const l = this.location();
    return l.book;
  }

  set book(book) {
    this.#loc.book = book;
  }

  get chapter() {
    const l = this.location();
    return l.chapter;
  }

  set chapter(chapter) {
    this.#loc.chapter = chapter;
  }

  get verse() {
    const l = this.location();
    return l.verse;
  }

  set verse(verse) {
    this.#loc.verse = verse;
  }

  get lastverse() {
    const l = this.location();
    return l.lastverse;
  }

  set lastverse(lastverse) {
    this.#loc.lastverse = lastverse;
  }

  // Returns an osisRef string with form:
  // code.ch
  // code.ch.vs
  // code.ch.vs.lv (this is not valid according to the OSIS spec, but is used by xulsword)
  osisRef(v11n?: V11nType | null): string {
    const tov11n = v11n || this.#v11nCurrent;
    const l = this.location(tov11n);
    const bk = l.book;
    const ch = (l.book && l.chapter) || 0;
    const vs = (l.chapter && l.verse) || null;
    const lv = (l.verse && l.lastverse) || null;
    return [bk, ch, vs, lv].filter(Boolean).join('.');
  }

  // Return LocationVKType according to a particular v11n.
  location(v11n?: V11nType | null): LocationVKType {
    const tov11n = v11n || this.#v11nCurrent;
    if (!tov11n || !this.#loc.v11n) return this.#loc;
    if (this.#loc.v11n === tov11n) return this.#loc;
    if (!this.#doConvertLocation(tov11n)) return this.#loc;
    const parsed = this.parseLocation(
      this.#gfunctions.convertLocation(
        this.#loc.v11n,
        [
          this.#loc.book,
          this.#loc.chapter,
          this.#loc.verse,
          this.#loc.lastverse,
        ]
          .filter(Boolean)
          .join('.'),
        tov11n
      ),
      tov11n
    );
    if (parsed.book) return parsed as LocationVKType;
    return { book: 'Gen', chapter: 1, v11n: 'KJV' };
  }

  // Return a readable string like 'Genesis 4:5-6'. Since book, chapter and
  // verses may be either ltr or rtl characters, alone they will improperly effect
  // the visual order of separating punctuation. The HTML <bdi> tag is intended for
  // these situations. But, in order to return either HTML or UTF8, this function
  // uses HTML entities instead.
  readable(v11n?: V11nType, notHTML = false): string {
    const Book = this.#gfunctions.Book();
    const tov11n = v11n || this.#v11nCurrent;
    const l = this.location(tov11n);
    const { locale, localeDigits } = this.#parser;
    const guidir = this.#localeDirection;
    let d = guidir === 'rtl' ? '&rlm;' : '&lrm;';
    if (notHTML)
      d =
        guidir === 'rtl'
          ? String.fromCharCode(8207)
          : String.fromCharCode(8206);
    const book = l.book && l.book in Book ? Book[l.book].name : l.book;
    const parts: string[] = ['', book];
    if (l.chapter) {
      parts.push(' ');
      parts.push(l.chapter.toString());
    }
    if (l.chapter && l.verse) {
      parts.push(':');
      parts.push(l.verse.toString());
      if (l.lastverse && l.lastverse > l.verse) {
        parts.push('-');
        parts.push(l.lastverse.toString());
      }
    }
    parts.push('');
    const res = parts.join(d);
    return dString(localeDigits, res, locale);
  }
}
