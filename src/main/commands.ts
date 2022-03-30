/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-rest-params */
import i18n from 'i18next';
import { clone, JSON_stringify } from '../common';
import { verseKey, getTab, getTabs } from './minit';
import Prefs from './modules/prefs';
import Window from './window';

import type {
  GType,
  LocationVKType,
  TextVKType,
  XulswordStatePref,
} from '../type';

const Commands: GType['Commands'] = {
  addRepositoryModule() {
    console.log(`Action not implemented: addRepositoryModule`);
  },

  addLocalModule() {
    console.log(`Action not implemented: addLocalModule`);
  },

  removeModule() {
    console.log(`Action not implemented: removeModule`);
    Window.reset();
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

  openFontsColors(module, window) {
    const options = {
      title: i18n.t('fontsAndColors.label'),
      parent: window || undefined,
      webPreferences: {
        additionalArguments: [
          JSON_stringify({
            chooseFontState: {
              module,
            },
          }),
        ],
      },
    };
    Window.open({ name: 'chooseFont', type: 'dialog', options });
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
    newlocation: LocationVKType,
    newselection: LocationVKType,
    newScroll = { verseAt: 'center' }
  ) {
    // To go to a verse system location without also changing xulsword's current
    // versekey module requires this location be converted into the current v11n.
    const xulsword = Prefs.getComplexValue('xulsword') as XulswordStatePref;
    const { location } = xulsword;
    const newxulsword = clone(xulsword);
    const loc = verseKey(newlocation, location?.v11n || 'KJV');
    const sel = verseKey(newselection, location?.v11n || 'KJV');
    newxulsword.location = loc.location();
    newxulsword.selection = sel.location();
    newxulsword.scroll = newScroll;
    Prefs.mergeValue('xulsword', newxulsword);
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
