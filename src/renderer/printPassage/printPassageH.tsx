/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-use-before-define */
import i18n from 'i18next';
import { clone, dString, getLocalizedChapterTerm } from '../../common';
import C from '../../constant';
import G from '../rg';
import { getValidVK, verseKey } from '../rutil';
import { getNoteHTML, getIntroductions } from '../viewport/zversekey';
import { addUserNotes } from '../viewport/ztext';
import { SelectVKMType } from '../libxul/vkselect';

// TODO!:
// print bottom margin
// print introduction
// print footnotes open/closed
// print page numbers
// print progress stuff

import type {
  AtextPropsType,
  LocationVKType,
  SwordFilterType,
  SwordFilterValueType,
} from '../../type';
import type PrintPassageWin from './printPassage';
import type { PassageWinState } from './printPassage';

export function handler(this: PrintPassageWin, e: React.SyntheticEvent) {
  switch (e.type) {
    case 'change': {
      const cbid = e.currentTarget.id as keyof PassageWinState['checkbox'];
      this.setState((prevState: PassageWinState) => {
        const s: Partial<PassageWinState> = {
          checkbox: {
            ...prevState.checkbox,
            [cbid]: !prevState.checkbox[cbid],
          },
        };
        return s;
      });
      break;
    }
    default:
      throw new Error(`Unhandled event type ${e.type} in printPassage.tsx`);
  }
}

export function vkSelectHandler(
  this: PrintPassageWin,
  selection: SelectVKMType,
  id: string
) {
  if (id) {
    const changed = id === 'from-select' ? 'firstChapter' : 'lastChapter';
    const other = id === 'from-select' ? 'lastChapter' : 'firstChapter';
    if (selection) {
      const { book, chapter, vkmod } = selection;
      const v11n = G.Tab[selection.vkmod].v11n || selection.v11n || 'KJV';
      if (book && chapter && vkmod) {
        this.setState((prevState: PassageWinState) => {
          const s: Partial<PassageWinState> = {};
          s[changed] = { book, chapter, v11n, vkmod };
          const prev = prevState[changed];
          if (prev && book !== prev.book) {
            const changedx = s[changed];
            if (changedx) changedx.chapter = 1;
          }
          s[other] = {
            ...verseKey(
              (prevState[other] || s[changed]) as LocationVKType,
              v11n
            ).location(),
            vkmod,
          };
          return s;
        });
        return;
      }
    }
    this.setState({ [changed]: null });
  }
}

export function bibleChapterText(
  props: Pick<AtextPropsType, 'module' | 'location' | 'show'>
): string {
  const { module, location, show } = props;
  if (module && location && show) {
    const { headings } = show;
    const { crossrefsText, introduction } = show as any;
    const { book, chapter } = location;

    // Set SWORD filter options
    const options = {} as { [key in SwordFilterType]: SwordFilterValueType };
    Object.entries(C.SwordFilters).forEach((entry) => {
      const sword = entry[0] as SwordFilterType;
      let showi = show[entry[1]] ? 1 : 0;
      if (C.AlwaysOn[C.BIBLE].includes(sword)) showi = 1;
      options[sword] = C.SwordFilterValues[showi];
    });
    const [off] = C.SwordFilterValues;
    options["Strong's Numbers"] = off;
    options['Morphological Tags'] = off;

    let introHTML = '';
    let headHTML = '';
    let textHTML = '';
    let noteHTML = '';
    if (G.getBooksInModule(module).includes(location.book)) {
      textHTML = G.LibSword.getChapterText(
        module,
        `${book}.${chapter}`,
        options
      );
      noteHTML = getNoteHTML(G.LibSword.getNotes(), show, 0, crossrefsText);
    }

    // Add usernotes to text
    if (show.usernotes) addUserNotes({}, {});

    let moduleLocale = G.Config[module].AssociatedLocale;
    if (!moduleLocale) moduleLocale = i18n.language; // otherwise use current program locale
    const toptions = { lng: moduleLocale, ns: 'common/books' };

    // Localize verse numbers to match the module
    if (moduleLocale && dString(1, moduleLocale) !== dString(1, 'en')) {
      const verseNm = new RegExp('(<sup class="versenum">)(\\d+)(</sup>)', 'g');
      textHTML = textHTML.replace(verseNm, (_str, p1, p2, p3) => {
        return p1 + dString(p2, moduleLocale) + p3;
      });
    }

    // Get introduction
    if (introduction) {
      const heading = i18n.t('IntroLink', toptions);
      const intro = getIntroductions(module, `${book} ${chapter}`);
      const introNotesHTML = getNoteHTML(intro.intronotes, show, 0, true);
      if (intro.textHTML)
        introHTML = `<div class="head1">${heading}</div>${intro.textHTML}${introNotesHTML}`;
    }

    // Get chapter heading
    if (headings && textHTML) {
      const headclass = ['chapterhead', `cs-${moduleLocale}`];
      if (chapter === 1) headclass.push('chapterfirst');
      /* eslint-disable prettier/prettier */
      headHTML = `
      <div class="${headclass.join(' ')}">
        <div class="chaptitle" >
          <div class="chapbk">${i18n.t(book, toptions)}</div>
          <div class="chapch">${getLocalizedChapterTerm(book, chapter, moduleLocale)}</div>
        </div>
      </div>`;
    }
    return `
      <div class="introduction"></div>${introHTML}
      <div class="chapter-start${chapter === 1 ? ' chapterfirst' : ''}"></div>${headHTML}
      ${textHTML}
      <div class="footnotes"></div>${noteHTML}`;
       /* eslint-enable prettier/prettier */
  }
  return '';
}

export function validPassage(is: PassageWinState): PassageWinState {
  const s = clone(is);
  if (!s.firstChapter || !s.lastChapter) {
    let vkmod = s.firstChapter?.vkmod;
    if (!vkmod || !(vkmod in G.Tab)) {
      vkmod = G.Tabs.find((t) => t.type === C.BIBLE)?.module || '';
    }
    if (vkmod && (!s.firstChapter?.vkmod || !s.lastChapter?.vkmod)) {
      s.firstChapter = { ...getValidVK(vkmod), vkmod };
      s.lastChapter = clone(s.firstChapter);
    }
    if (!vkmod) {
      s.firstChapter = null;
      s.lastChapter = null;
      return s;
    }
  }
  // To-vkmod must contain its selected book and from-vkmod must
  // contain its selected book
  (['firstChapter', 'lastChapter'] as const).forEach((p) => {
    const ch = s[p];
    if (ch) {
      const books = G.getBooksInModule(ch.vkmod);
      if (!books.includes(ch.book)) {
        [ch.book] = books;
        ch.chapter = 1;
      }
    }
  });
  // To-book must come after from-book.
  if (s.lastChapter && s.firstChapter) {
    const { book: bookF, chapter: chapterF } = s.firstChapter;
    const { book: bookL, chapter: chapterL } = s.lastChapter;
    if (G.Book[bookF].index > G.Book[bookL].index) {
      s.lastChapter.book = s.firstChapter.book;
      s.lastChapter.chapter = s.firstChapter.chapter;
    }
    // To-chapter must come after from-chapter
    if (bookF === bookL && chapterF > chapterL) {
      s.lastChapter.chapter = s.firstChapter.chapter;
    }
  }
  return s;
}
