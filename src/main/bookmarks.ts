/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-nested-ternary */
import C, { SPBM } from '../constant';
import { clone, randomID, replaceASCIIcontrolChars } from '../common';
import { verseKey } from './minit';
import { PrefCallbackType } from './components/prefs';

import type {
  BookmarkFolderType,
  BookmarkItem,
  BookmarkType,
  BookmarkTypes,
  LocationGBType,
  LocationVKType,
  NewModulesType,
  OSISBookType,
  PrefValue,
  TransactionType,
} from '../type';
import type { SelectVKMType } from '../renderer/libxul/vkselect';

type BMkeys =
  | keyof BookmarkItem
  | keyof BookmarkType
  | keyof BookmarkFolderType;

type StringRegex = [string, RegExp];

// Storage for all undo/redo transactions (not just bookmarks)
export const Transaction = {
  pause: false as boolean, // to pause transaction addition when new index is selected
  list: [] as TransactionType[],
  index: -1 as number,
};

export function canUndo(): boolean {
  const { list, index } = Transaction;
  return list.length >= 2 && index >= 1;
}

export function canRedo(): boolean {
  const { list, index } = Transaction;
  return index < list.length - 1;
}

export const addBookmarkTransaction: PrefCallbackType = (
  _callingWinID: number,
  key: string,
  value: PrefValue,
  store?: string
) => {
  const { pause, list } = Transaction;
  if (!pause && store === 'bookmarks' && key === 'manager.bookmarks') {
    Transaction.index += 1;
    const { index } = Transaction;
    list[index] = {
      prefkey: key,
      value: clone(value),
      store,
    };
    const trim = list.length - 1 - index;
    if (trim > 0) list.splice(index + 1, trim);
  }
};

// Import a json file with bookmarks. Basic validation of property names
// and types is done, along with a few enums. But validation is certainly
// not comprehensive, so don't modify bookmark files by hand!
export default function importBookmarkObject(
  obj: any, // should be BookmarkFolderType
  parentFolder: BookmarkFolderType,
  results?: NewModulesType
): NewModulesType {
  const r: NewModulesType = results || clone(C.NEWMODS);
  const valid: Record<BMkeys, any> = {
    id: 'string',
    label: 'string',
    labelLocale: 'string',
    note: 'string',
    noteLocale: 'string',
    creationDate: 'number',
    type: [
      'string',
      new RegExp(`^(${(['folder', 'bookmark'] as BookmarkTypes).join('|')})$`),
    ] as StringRegex,
    tabType: [
      'string',
      new RegExp(`^(${Object.values(C.SupportedTabTypes).join('|')})$`),
    ] as StringRegex,
    location: 'location',
    sampleText: 'string',
    childNodes: 'array',
    hasCaret: 'boolean',
    isExpanded: 'boolean',
    isSelected: 'boolean',
  };
  const validateBookMark = (o: any): BookmarkFolderType | null => {
    let validationFailed = false;
    Object.entries(o).forEach((entry) => {
      const [k, v] = entry;
      if (v === undefined) delete o[k];
      else if (!validationFailed && k in valid) {
        const validk: string | StringRegex = valid[k as keyof typeof valid];
        const type = Array.isArray(validk) ? validk[0] : validk;
        let isValid = false;
        switch (type) {
          case 'location': {
            if (v && typeof v === 'object') {
              if ('v11n' in v) {
                const v2 = v as LocationVKType;
                const vk = verseKey(v2);
                if (!vk.book) {
                  isValid = false;
                  r.reports.push({
                    error: `Bookmark ${o.id} location failed to validate: ${v}`,
                  });
                } else isValid = true;
              } else {
                const v2 = v as LocationGBType;
                const { module, key, paragraph } = v2;
                isValid =
                  !!module &&
                  typeof module === 'string' &&
                  !!key &&
                  typeof key === 'string' &&
                  !(paragraph && typeof paragraph !== 'number');
              }
            }
            break;
          }
          case 'array': {
            isValid = Array.isArray(v);
            break;
          }
          default: {
            isValid = typeof v === type;
            if (isValid && Array.isArray(validk)) {
              const v2 = v as string;
              isValid = validk[1].test(v2);
            }
          }
        }
        if (!isValid) {
          validationFailed = true;
          r.reports.push({
            error: `Bookmark ${o.id} property ${k} failed to validate: ${v}`,
          });
        }
      } else {
        r.reports.push({
          warning: `Bookmark ${o.id} unknown property ${k} was removed.`,
        });
        delete o[k];
      }
    });
    if (validationFailed) return null;
    if ('childNodes' in o) {
      for (let x = 0; x < o.childNodes.length; x += 1) {
        if (!validateBookMark(o.childNodes[x])) return null;
      }
    }
    return o as BookmarkFolderType;
  };
  const validated = validateBookMark(obj);
  if (validated) {
    if (validated.id === SPBM.manager.bookmarks.id) {
      parentFolder.childNodes.push(...validated.childNodes);
    } else {
      parentFolder.childNodes.push(validated);
    }
    r.bookmarks.push(validated.id);
  }
  return r;
}

// Import xulsword 3 and older .xsb bookmark files and convert them to
// xulsword 4+ bookmarks.
export function importDeprecatedBookmarks(
  fileContent: string,
  parentFolder: BookmarkFolderType,
  results?: NewModulesType
): NewModulesType {
  const r = results || clone(C.NEWMODS);
  const deprecatedRootID = 'http://www.xulsword.com/bookmarks/AllBookmarks';

  let filedata = fileContent.replace(
    new RegExp(`<nx/>[\n\r]+`, 'g'),
    '<bMRet>'
  );
  filedata = replaceASCIIcontrolChars(filedata);

  const bms: [string, number, BookmarkType | BookmarkFolderType | null][] =
    filedata.split('<bMRet>').map((record) => {
      const propertyValues = record.split('<bg/>');
      let parentID = propertyValues.shift();
      if (parentID === deprecatedRootID) parentID = parentFolder.id;
      let id = propertyValues.shift();
      if (id === deprecatedRootID) id = parentFolder.id;
      const index = Number(propertyValues.shift());
      if (parentID && id && !Number.isNaN(index)) {
        const [
          TYPE,
          NAME,
          NOTE,
          BOOK,
          CHAPTER,
          VERSE,
          LASTVERSE,
          MODULE,
          LOCATION,
          BMTEXT,
          ICON,
          CREATIONDATE,
          VISITEDDATE,
          NAMELOCALE,
          NOTELOCALE,
        ] = propertyValues;
        if (LOCATION && ICON && VISITEDDATE) {
          // These are no longer needed
        }
        const isVerseKey = !Number.isNaN(Number(CHAPTER));
        const locs: string[] = C.Locales.map((l) => l[0]);
        const item: BookmarkItem = {
          id,
          label: NAME,
          labelLocale: locs.includes(NAMELOCALE) ? NAMELOCALE : 'ru',
          note: NOTE,
          noteLocale: locs.includes(NOTELOCALE) ? NOTELOCALE : 'ru',
          creationDate: Date.parse(CREATIONDATE),
        };
        if (TYPE === 'Folder') {
          return [
            parentID,
            Number(index),
            {
              ...item,
              type: 'folder',
              hasCaret: true,
              isExpanded: false,
              childNodes: [],
            },
          ];
        }
        let location: SelectVKMType | LocationGBType;
        if (isVerseKey) {
          location = {
            vkmod: MODULE,
            book: BOOK as OSISBookType,
            chapter: Number(CHAPTER),
            verse: Number(VERSE),
            lastverse: Number(LASTVERSE),
            v11n: 'KJV',
          };
        } else {
          const paragraph =
            VERSE && !Number.isNaN(Number(VERSE)) ? Number(VERSE) : undefined;
          location = { module: MODULE, key: CHAPTER, paragraph };
        }
        return [
          parentID,
          Number(index),
          {
            ...item,
            type: 'bookmark',
            tabType: isVerseKey ? 'Texts' : 'Genbks',
            module: MODULE,
            location,
            sampleText: BMTEXT,
            hasCaret: false,
          },
        ];
      }
      return ['', 0, null];
    });
  // Now assemble them in the return folder
  bms
    .sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .forEach((bma) => {
      const [parent, , bm] = bma;
      if (bm) {
        const parx = bms.find((bmx) => bmx[2] && bmx[2].id === parent);
        const parentBM = parx && parx[2] ? parx[2] : null;
        if (parentBM) {
          if ('childNodes' in parentBM) parentBM.childNodes.push(bm);
          else {
            r.reports.push({
              warning: `Imported bookmark parent is not a folder: ${bm.label}`,
            });
            parentFolder.childNodes.push(bm);
          }
        } else if (parent === parentFolder.id) parentFolder.childNodes.push(bm);
        else {
          r.reports.push({
            warning: `Imported bookmark parent not found: ${bm.label}`,
          });
          parentFolder.childNodes.push(bm);
        }
      }
    });
  // Finally assign new xulsword-4 ids
  bms.forEach((bma) => {
    const [, , bm] = bma;
    if (bm && bm.id !== parentFolder.id) bm.id = randomID();
  });
  // Return results
  if (bms.find((bma) => bma[2])) {
    r.bookmarks.push(parentFolder.id);
  }
  return r;
}
