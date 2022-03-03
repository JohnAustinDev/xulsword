/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-rest-params */
import C from '../constant';
import { JSON_stringify } from '../common';
import { verseKey, getTab, setGlobalStateFromPref, getTabs } from './minit';
import Prefs from './modules/prefs';
import { openWindow } from './window';

import type {
  CommandsPublic,
  LocationVKType,
  TextVKType,
  XulswordStatePref,
} from '../type';

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
    const options = {
      title: 'chooseFont',
      webPreferences: {
        additionalArguments: [
          'chooseFontWin',
          JSON_stringify({
            chooseFontState: {
              module,
            },
          }),
        ],
      },
    };
    openWindow('chooseFont', options);
  },

  openBookmarksManager() {
    console.log(`Action not implemented: openBookmarksManager()`);
  },

  openNewDbItemDialog(userNote: boolean, textvk: TextVKType) {
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

  goToLocationVK(
    location: LocationVKType,
    selection: LocationVKType,
    flagScroll = C.VSCROLL.centerAlways
  ) {
    // To go to a verse system location without also changing xulsword's current
    // versekey module requires this location be converted into the current v11n.
    const ploc = Prefs.getComplexValue(
      'xulsword.location'
    ) as XulswordStatePref['location'];
    const panels = Prefs.getComplexValue(
      'xulsword.panels'
    ) as XulswordStatePref['panels'];
    const loc = verseKey(location, ploc?.v11n || 'KJV');
    const sel = verseKey(selection, ploc?.v11n || 'KJV');
    Prefs.setComplexValue('xulsword.location', loc.location());
    Prefs.setComplexValue('xulsword.selection', sel.location());
    Prefs.setComplexValue(
      'xulsword.flagScroll',
      panels.map(() => flagScroll)
    );
    setGlobalStateFromPref(null, [
      'xulsword.location',
      'xulsword.selection',
      'xulsword.flagScroll',
    ]);
  },
};

export default Commands;

export function newDbItemWithDefaults(
  userNote: boolean,
  textvk: TextVKType | null
) {
  const tab = getTab();
  const tabs = getTabs();
  const panels = Prefs.getComplexValue(
    'xulsword.panels'
  ) as XulswordStatePref['panels'];
  const vkm = panels.find(
    (m: string | null) => m && m in tab && tab[m].isVerseKey
  );
  if (vkm) {
    const loc = Prefs.getComplexValue(
      'xulsword.location'
    ) as XulswordStatePref['location'];
    const sel = Prefs.getComplexValue(
      'xulsword.selection'
    ) as XulswordStatePref['selection'];
    const textvk2 = {
      module: textvk?.module || tabs[0].module,
      text: textvk?.text || '',
      location: {
        book: textvk?.location?.book || loc?.book || '',
        chapter: textvk?.location?.chapter || loc?.chapter || 0,
        verse: textvk?.location?.verse || sel?.verse || loc?.verse || null,
        lastverse:
          textvk?.location?.lastverse ||
          sel?.lastverse ||
          loc?.lastverse ||
          null,
        v11n: textvk?.location?.v11n || loc?.v11n || 'KJV',
      },
    };

    Commands.openNewDbItemDialog(userNote, textvk2);
  }
}
