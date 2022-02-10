/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-rest-params */
import { CommandsPublic, SearchType } from '../type';
import C from '../constant';
import { JSON_stringify } from '../common';
import { getTab, setGlobalStateFromPref } from './minit';
import LibSword from './modules/libsword';
import Prefs from './modules/prefs';

const Commands: typeof CommandsPublic = {
  addRepositoryModule() {
    console.log(`Action not implemented: addRepositoryModule`);
  },

  addLocalModule() {
    console.log(`Action not implemented: addLocalModule`);
  },

  removeModule() {
    console.log(`Action not implemented: removeModule`);
  },

  exportAudio() {
    console.log(`Action not implemented: exportAudio`);
  },

  importAudio() {
    console.log(`Action not implemented: importAudio`);
  },

  pageSetup() {
    console.log(`Action not implemented: pageSetup`);
  },

  printPreview() {
    console.log(`Action not implemented: printPreview`);
  },

  printPassage() {
    console.log(`Action not implemented: printPassage`);
  },

  print() {
    console.log(`Action not implemented: print`);
  },

  edit(which, ...args) {
    return this[which](...args);
  },

  undo(...args) {
    console.log(`Action not implemented: undo(${JSON_stringify(arguments)})`);
    return false;
  },

  redo(...args) {
    console.log(`Action not implemented: redo(${JSON_stringify(arguments)})`);
    return false;
  },

  cut(...args) {
    console.log(`Action not implemented: cut(${JSON_stringify(arguments)})`);
    return false;
  },

  copy(...args) {
    console.log(`Action not implemented: copy(${JSON_stringify(arguments)})`);
    return false;
  },

  paste(...args) {
    console.log(`Action not implemented: paste(${JSON_stringify(arguments)})`);
    return false;
  },

  search(search) {
    console.log(`Action not implemented: search(${JSON_stringify(arguments)})`);
  },

  copyPassage() {
    console.log(`Action not implemented: copyPassage`);
  },

  openFontsColors(module) {
    console.log(
      `Action not implemented: openFontsColors(${JSON_stringify(arguments)})`
    );
  },

  openBookmarksManager() {
    console.log(`Action not implemented: openBookmarksManager()`);
  },

  openNewDbItemDialog(
    userNote: boolean,
    mod: string,
    bk: string,
    ch: number,
    vs: number,
    lv?: number | null
  ) {
    console.log(
      `Action not implemented: openNewBookmarkDialog(${JSON_stringify(
        arguments
      )})`
    );
  },

  openDbItemPropertiesDialog(bookmark) {
    console.log(
      `Action not implemented: openBookmarkPropertiesDialog(${JSON_stringify(
        arguments
      )})`
    );
  },

  deleteDbItem(bookmark) {
    console.log(
      `Action not implemented: deleteBookmark(${JSON_stringify(arguments)})`
    );
  },

  openHelp(module) {
    console.log(`Action not implemented: openHelp()`);
  },

  goToBibleLocation(
    v11n,
    bk,
    ch,
    vs = 1,
    sel = '',
    flagScroll = C.VSCROLL.centerAlways
  ) {
    // To go to a verse system location without also changing xulsword's current
    // versekey module requires this location be converted into the current v11n.
    let book = bk;
    let chapter = ch;
    let verse = vs;
    let selection = sel;
    const tab = getTab();
    const panels = Prefs.getComplexValue('xulsword.panels');
    const vkm = panels.find((m: string | null) => m && tab[m].isVerseKey);
    if (vkm && tab[vkm].v11n !== v11n) {
      const [bks, chs, vss] = LibSword.convertLocation(
        v11n,
        [book, chapter, verse].join('.'),
        tab[vkm].v11n
      ).split('.');
      const nsel = sel
        ? LibSword.convertLocation(v11n, sel, tab[vkm].v11n)
        : null;
      book = bks;
      chapter = Number(chs);
      verse = Number(vss);
      selection = nsel || '';
    }
    const fs = panels.map(() => flagScroll);
    Prefs.setCharPref('xulsword.book', book);
    Prefs.setIntPref('xulsword.chapter', chapter);
    Prefs.setIntPref('xulsword.verse', verse);
    Prefs.setCharPref('xulsword.selection', selection);
    Prefs.setComplexValue('xulsword.flagScroll', fs);
    setGlobalStateFromPref(null, [
      'xulsword.book',
      'xulsword.chapter',
      'xulsword.verse',
      'xulsword.selection',
      'xulsword.flagScroll',
    ]);
  },
};

export default Commands;

export function newDbItemWithDefaults(
  userNote: boolean,
  mod?: string,
  bk?: string,
  ch?: number,
  vs?: number,
  lv?: number | null
) {
  const tab = getTab();
  const panels = Prefs.getComplexValue('xulsword.panels');
  const vkm = panels.find(
    (m: string | null) => m && m in tab && tab[m].isVerseKey
  );
  if (vkm) {
    let verse = Prefs.getIntPref('xulsword.verse');
    let lastverse = verse;
    const sel = Prefs.getCharPref('xulsword.selection');
    if (sel) [, , verse, lastverse] = sel.split('.').map((x) => Number(x));
    Commands.openNewDbItemDialog(
      userNote,
      mod || vkm,
      bk || Prefs.getCharPref('xulsword.book'),
      ch || Prefs.getIntPref('xulsword.chapter'),
      vs || verse,
      lv || lastverse
    );
  }
}
