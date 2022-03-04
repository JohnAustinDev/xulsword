/* eslint-disable @typescript-eslint/no-explicit-any */
import i18next from 'i18next';
import C from './constant';
import { deepClone, dString } from './common';

import type { GType, LocationVKType, V11nType } from './type';
import type RefParser from './refparse';

type VerseKeyGtype = {
  Book: () => GType['Book'];
  BkChsInV11n: () => GType['BkChsInV11n'];
  Tab: () => GType['Tab'];
};

// Keep a reference to a particular range of Bible verses up to a whole
// chapter. Supports conversion between different verse systems.
// IMPORTANT: This class depends on data from the calling process, requiring
// that access functions are supplied from the calling process during creation.
export default class VerseKey {
  #loc: LocationVKType;

  #v11nCurrent: V11nType;

  #parser: RefParser;

  #gfunctions: VerseKeyGtype;

  #convertLocation: GType['LibSword']['convertLocation'];

  constructor(
    parser: RefParser,
    libswordConvertLocation: GType['LibSword']['convertLocation'],
    gfunction: VerseKeyGtype,
    location: LocationVKType | string,
    v11n?: V11nType
  ) {
    this.#parser = parser;
    this.#convertLocation = libswordConvertLocation;
    this.#gfunctions = gfunction;
    this.#loc =
      typeof location === 'string'
        ? this.setLocation(location, v11n)
        : deepClone(location);
    this.#v11nCurrent = v11n || this.#loc.v11n;
  }

  // Accept any osisRef work prefix and then look for an OSIS ref book code. If the
  // reference starts with a book code, the following string patterns are parsed:
  // code, code 1, code 1:1, code 1:1-1, code 1:1 - code 1:1, code.1, code.1.1, code.1.1.1
  // Otherwise the string will be parsed using parseLocation() on up to two dash separated
  // segments. If the location cannot be read, book will be empty string and chapter,
  // verse and lastverse will be 0. If any range contains verses beyond the chapter, those
  // verses will not be included in the VerseKey.
  setLocation(location: string, tov11n?: V11nType) {
    const Tab = this.#gfunctions.Tab();
    let work;
    let loc = location.trim();
    const match = loc.match(/^(\S+):(.*)$/);
    if (match) [, work, loc] = match;
    const workv11n = work && work in Tab && Tab[work].v11n;
    const code = loc.match(/^([\w\d]+)\./);
    let book = '';
    let chapter = 0;
    let verse = 0 as number | null | undefined;
    let lastverse = 0 as number | null | undefined;
    let v11n = workv11n || tov11n || 'KJV';
    if (
      code &&
      C.SupportedBookGroups.some((bg) => {
        return C.SupportedBooks[bg].includes(code[1]);
      })
    ) {
      const segs = loc.split('-');
      if (segs.length > 2) segs.splice(1, segs.length - 2);
      segs.forEach((seg) => {
        const [bk, ch, vs, lv] = seg.split('.');
        if (bk) {
          if (!book) book = bk;
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
      chapter: chapter || 1,
      verse: verse || null,
      lastverse: lastverse || verse || null,
      v11n,
    };
  }

  // LibSword.convertLocation returns unpredictable locations if vkeytext's
  // book, chapter, verse and lastverse are not in the verse system or
  // if the book is not included in tov11n. Also LibSword only converts
  // between systems in C.SupportedV11nMaps. So these things must be
  // checked before ever calling LibSword.
  #canConvertLocation(tov11n: V11nType) {
    const fromv11n = this.#loc.v11n;
    if (fromv11n === tov11n) return false;
    if (!(fromv11n in C.SupportedV11nMaps)) return false;
    if (!C.SupportedV11nMaps[fromv11n].includes(tov11n)) return false;
    const { book, chapter, verse, lastverse } = this.#loc;
    const bkChsInV11n = this.#gfunctions.BkChsInV11n();
    if (!(tov11n in bkChsInV11n)) return false;
    if (!(book in bkChsInV11n[tov11n])) return false;
    const maxch =
      fromv11n in bkChsInV11n && book in bkChsInV11n[fromv11n]
        ? bkChsInV11n[fromv11n][book]
        : 0;
    if (chapter < 1 || chapter > maxch) return false;
    if (verse) {
      const maxv = 200; // slow: getMaxVerse(fromv11n, [b, c].join('.'));
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
  osisRef(v11n?: V11nType): string {
    const tov11n = v11n || this.#v11nCurrent;
    const l = this.location(tov11n);
    const bk = l.book;
    const ch = (l.book && l.chapter) || 0;
    const vs = (l.chapter && l.verse) || null;
    const lv = (l.verse && l.lastverse) || null;
    return [bk, ch, vs, lv].filter(Boolean).join('.');
  }

  // Return LocationVKType according to a particular v11n.
  location(v11n?: V11nType): LocationVKType {
    const tov11n = v11n || this.#v11nCurrent;
    if (this.#loc.v11n === tov11n) return this.#loc;
    if (!this.#canConvertLocation(tov11n)) return this.#loc;
    return this.setLocation(
      this.#convertLocation(
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
  }

  // Return a readable string like 'Genesis 4:5-6'
  readable(v11n?: V11nType, notHTML = false): string {
    const tov11n = v11n || this.#v11nCurrent;
    const l = this.location(tov11n);
    const guidir = i18next.dir();
    let dc = guidir === 'rtl' ? '&rlm;' : '&lrm;';
    if (notHTML)
      dc =
        guidir === 'rtl'
          ? String.fromCharCode(8207)
          : String.fromCharCode(8206);
    const Book = this.#gfunctions.Book();
    const book = l.book && l.book in Book ? Book[l.book].name : l.book;
    let ret = dc + l.chapter ? `${book}${dc} ${l.chapter}` : book;
    if (l.chapter && l.verse) {
      ret += `${dc}:${l.verse}`;
      if (l.lastverse && l.lastverse > l.verse) {
        ret += `${dc}-${l.lastverse}`;
      }
    }
    return dString(ret);
  }
}
