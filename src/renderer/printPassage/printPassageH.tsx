/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-use-before-define */
import { clone, dString, getLocalizedChapterTerm } from '../../common';
import C from '../../constant';
import G from '../rg';
import { getValidVK, isValidVKM } from '../rutil';
import { getNoteHTML, getIntroductions } from '../viewport/zversekey';
import { addUserNotes } from '../viewport/ztext';
import { SelectVKMType } from '../libxul/vkselect';

import type {
  AtextPropsType,
  SwordFilterType,
  SwordFilterValueType,
} from '../../type';
import type PrintPassageWin from './printPassage';
import type { PrintPassageState } from './printPassage';

export function handler(this: PrintPassageWin, ex: React.SyntheticEvent) {
  switch (ex.type) {
    case 'click': {
      const e = ex as React.MouseEvent;
      const { textdiv } = this;
      const pageW = textdiv.current?.clientWidth ?? 0;
      const scrollW = textdiv.current?.scrollWidth ?? 0;
      const { id } = e.currentTarget;
      switch (id) {
        case 'pagefirst': {
          const s: Partial<PrintPassageState> = {
            showpage: 1,
          };
          this.setState(s);
          break;
        }
        case 'pageprev': {
          this.setState((prevState: PrintPassageState) => {
            let { showpage } = prevState;
            showpage -= 1;
            if (showpage < 1) showpage = 1;
            return { showpage };
          });
          break;
        }
        case 'pagenext': {
          this.setState((prevState: PrintPassageState) => {
            let { showpage } = prevState;
            showpage += 1;
            const max = Math.ceil(scrollW / pageW);
            if (showpage > max) showpage = max;
            return { showpage };
          });
          break;
        }
        case 'pagelast': {
          const s: Partial<PrintPassageState> = {
            showpage: Math.ceil(scrollW / pageW),
          };
          this.setState(s);
          break;
        }
        default:
          throw new Error(`Unhandled click event ${id} in printPassageH.tsx`);
      }
      break;
    }
    case 'change': {
      const cbid = ex.currentTarget.id as keyof PrintPassageState['checkbox'];
      this.setState((prevState: PrintPassageState) => {
        const s: Partial<PrintPassageState> = {
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
      throw new Error(`Unhandled event type ${ex.type} in printPassage.tsx`);
  }
}

export function vkSelectHandler(
  this: PrintPassageWin,
  selection: SelectVKMType
) {
  if (selection) {
    const { book, lastchapter, vkmod, v11n: vsys } = selection;
    if (lastchapter) {
      const state = this.state as PrintPassageState;
      const obook = state.chapters?.book;
      if (!obook || obook !== book) {
        selection.chapter = 1;
        selection.lastchapter = 1;
      }
      const v11n = G.Tab[vkmod].v11n || vsys || 'KJV';
      const s: Partial<PrintPassageState> = {
        chapters: { ...selection, v11n, vkmod },
      };
      this.setState(s);
      return;
    }
  }
  this.setState({ chapters: null });
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
    if (!moduleLocale) moduleLocale = G.i18n.language; // otherwise use current program locale
    const toptions = { lng: moduleLocale, ns: 'common/books' };

    // Localize verse numbers to match the module
    if (
      moduleLocale &&
      dString(G.i18n, 1, moduleLocale) !== dString(G.i18n, 1, 'en')
    ) {
      const verseNm = new RegExp('(<sup class="versenum">)(\\d+)(</sup>)', 'g');
      textHTML = textHTML.replace(verseNm, (_str, p1, p2, p3) => {
        return p1 + dString(p2, moduleLocale) + p3;
      });
    }

    // Get introduction
    if (introduction) {
      const heading = G.i18n.t('IntroLink', toptions);
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
          <div class="chapbk">${G.i18n.t(book, toptions)}</div>
          <div class="chapch">${getLocalizedChapterTerm(G.i18n, book, chapter, moduleLocale)}</div>
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

export function validPassage(passage: SelectVKMType | null): SelectVKMType {
  let chapters = clone(passage);
  if (!chapters || !chapters.vkmod || !isValidVKM(chapters, chapters.vkmod)) {
    const vkmod = G.Tabs.find((t) => t.type === C.BIBLE)?.module || '';
    chapters = {
      vkmod,
      ...getValidVK(vkmod),
      lastchapter: 1,
    };
  }
  let { lastchapter, v11n } = chapters;
  if (!v11n) {
    const { vkmod } = chapters;
    v11n = (vkmod in G.Tab && G.Tab[vkmod].v11n) || 'KJV';
  }
  if (!lastchapter || lastchapter > chapters.chapter) {
    lastchapter = chapters.chapter;
  }
  return chapters;
}
