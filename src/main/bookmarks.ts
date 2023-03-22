/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-nested-ternary */
import log from 'electron-log';
import C from '../constant';
import S from '../defaultPrefs';
import { clone, randomID, replaceASCIIcontrolChars } from '../common';
import { verseKey } from './minit';
import { PrefCallbackType } from './components/prefs';

import type {
  BookmarkFolderType,
  BookmarkItem,
  BookmarkType,
  BookmarkItemTypes,
  LocationGBType,
  LocationVKType,
  NewModulesType,
  OSISBookType,
  TransactionType,
  BookmarkItemType,
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
  _callingWinID,
  store,
  key,
  value
) => {
  const { pause, list } = Transaction;
  if (!pause && store === 'bookmarks' && key === 'rootfolder') {
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

const bmTypes: BookmarkItemTypes = ['folder', 'bookmark'];

const bmPropertyTypes: Record<BMkeys, any> = {
  id: 'string',
  label: 'string',
  labelLocale: 'string',
  note: 'string',
  noteLocale: 'string',
  creationDate: 'number',
  type: ['string', new RegExp(`^(${bmTypes.join('|')})$`)] as StringRegex,
  tabType: [
    'string',
    new RegExp(`^(${Object.values(C.SupportedTabTypes).join('|')})$`),
  ] as StringRegex,
  location: 'location',
  sampleText: 'string',
  sampleModule: 'string',
  childNodes: 'array',
  hasCaret: 'boolean',
  isExpanded: 'boolean',
  isSelected: 'boolean',
};

const bmRequiredItemProps: (keyof BookmarkItem)[] = [
  'id',
  'label',
  'labelLocale',
  'note',
  'noteLocale',
  'creationDate',
  'type',
];

const bmRequiredBookmarkProps: (keyof BookmarkType)[] = [
  'tabType',
  'location',
  'sampleText',
  'sampleModule',
];

const bmRequiredFolderProps: (keyof BookmarkFolderType)[] = ['childNodes'];

function hasProps(item: unknown, props: string[]): boolean {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    return props.every((p) => Object.keys(item).includes(p));
  }
  return false;
}

// Validates a bookmark item, strips unknown properties, and gives new ids.
function isValidItem(
  test: unknown,
  newmods: NewModulesType
): BookmarkItemType | null {
  if (
    !test ||
    typeof test !== 'object' ||
    Array.isArray(test) ||
    !hasProps(test, bmRequiredItemProps) ||
    !('type' in test) ||
    (test.type === 'bookmark' && !hasProps(test, bmRequiredBookmarkProps)) ||
    (test.type === 'folder' && !hasProps(test, bmRequiredFolderProps))
  ) {
    newmods.reports.push({
      error: `Object is not a bookmark item.`,
    });
    log.debug(`FAILED:`, test);
    return null;
  }
  const item = test as BookmarkItemType;
  if (item.id !== S.bookmarks.rootfolder.id) {
    item.id = randomID();
  } else if (item.type !== 'folder') {
    newmods.reports.push({
      warning: `Imported root is not a folder.`,
    });
    return null;
  }
  let validationFailed = false;
  Object.entries(item).forEach((entry) => {
    const [k, v] = entry;
    if (!validationFailed && k in bmPropertyTypes) {
      const validk: string | StringRegex =
        bmPropertyTypes[k as keyof typeof bmPropertyTypes];
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
                newmods.reports.push({
                  error: `Bookmark ${item.id} location failed to validate: ${v}`,
                });
                log.debug(`FAILED:`, item, k, v);
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
        newmods.reports.push({
          error: `Bookmark ${item.id} property ${k} failed to validate: ${v}`,
        });
        log.debug(`FAILED:`, item, k, v);
      }
    } else {
      newmods.reports.push({
        warning: `Bookmark ${item.id} unknown property ${k} was removed.`,
      });
      delete item[k as keyof typeof item];
    }
  });
  if (validationFailed) return null;
  if (item.type === 'folder') {
    for (let x = 0; x < item.childNodes.length; x += 1) {
      if (!isValidItem(item.childNodes[x], newmods)) return null;
    }
  }
  return item;
}

// Import a json file with bookmarks. Basic validation of property names
// and types is done, along with a few enums. But validation is certainly
// not comprehensive.
export default function importBookmarkObject(
  objx: unknown, // test for BookmarkFolderType or { rootfolder: BookmarkFolderType }
  parentFolder: BookmarkFolderType,
  results?: NewModulesType
): NewModulesType {
  const r: NewModulesType = results || clone(C.NEWMODS);
  const obj =
    objx && typeof objx === 'object' && 'rootfolder' in objx
      ? objx.rootfolder
      : objx;
  const isValid = isValidItem(obj, r);
  if (isValid) {
    r.bookmarks.push(isValid.id);
    if (isValid.id === S.bookmarks.rootfolder.id) {
      parentFolder.childNodes.push(
        ...(isValid as BookmarkFolderType).childNodes
      );
    } else {
      parentFolder.childNodes.push(isValid);
    }
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

  const bms: [string, number, BookmarkItemType | null][] = filedata
    .split('<bMRet>')
    .map((record) => {
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
          labelLocale: locs.includes(NAMELOCALE) ? (NAMELOCALE as 'en') : '',
          note: NOTE,
          noteLocale: locs.includes(NOTELOCALE) ? (NOTELOCALE as 'en') : '',
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
            location,
            sampleText: BMTEXT,
            sampleModule: MODULE,
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
