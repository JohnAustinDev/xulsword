import { clone, decodeOSISRef, getSwordOptions } from '../../../common.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import RenderPromise from '../../renderPromise.ts';
import addBookmarks from '../../bookmarks.ts';
import { isValidVKM, getLocalizedChapterTerm, dString } from '../../common.tsx';
import { getDictEntryHTML } from '../../components/atext/zdictionary.ts';
import {
  getNoteHTML,
  getIntroductions,
} from '../../components/atext/zversekey.ts';

import type { AtextPropsType } from '../atext/atext.tsx';
import type { LibSwordResponse } from '../../components/atext/ztext.ts';
import type { SelectVKType } from '../../components/libxul/selectVK.tsx';
import type PrintPassageWin from './printPassage.tsx';
import type { PrintPassageState } from './printPassage.tsx';

export function handler(this: PrintPassageWin, ex: React.SyntheticEvent) {
  switch (ex.type) {
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
  selection: SelectVKType,
) {
  if (selection) {
    const { book } = selection;
    this.setState((prevState: PrintPassageState) => {
      const obook = prevState.chapters?.book;
      if (obook && book && obook !== book) {
        selection.chapter = 1;
        selection.lastchapter = 1;
      }
      return {
        chapters: { ...selection },
      } satisfies Partial<PrintPassageState>;
    });
  } else this.setState({ chapters: null });
}

function getDictionaryLinks(
  textHTML: string,
  renderPromise: RenderPromise,
): string {
  const m = textHTML.matchAll(/<span class="dt" data-title="([^"]*)\.[^."]*"/g);
  const decoded = [...new Set(Array.from(m).map((x) => decodeOSISRef(x[1])))];
  const sorted = decoded.sort((a, b) => {
    const ax = a.replace(/^[^:]+:/, '');
    const bx = b.replace(/^[^:]+:/, '');
    return ax.localeCompare(bx);
  });
  return sorted
    .map((osisRef) => {
      const [, mod, key] = osisRef.match(/^([^:]+):(.*?)$/) || [
        undefined,
        undefined,
      ];
      return key && mod ? getDictEntryHTML(key, mod, renderPromise) : '';
    })
    .join('');
}

export function bibleChapterText(
  props: Pick<AtextPropsType, 'module' | 'location'> & {
    show: AtextPropsType['show'] & {
      introduction: boolean;
      crossrefsText: boolean;
    };
  },
  renderPromise: RenderPromise,
): string {
  const { module, location, show } = props;
  if (module && location && show) {
    const { headings } = show;
    const { crossrefsText, introduction } = show;
    const { book, chapter } = location;

    // Set SWORD filter options
    const options = getSwordOptions(show, C.BIBLE);
    const [off] = C.SwordFilterValues;
    options["Strong's Numbers"] = off;
    options['Morphological Tags'] = off;

    let introHTML = '';
    let headHTML = '';
    const response: LibSwordResponse = {
      textHTML: '',
      noteHTML: '',
      notes: '',
      intronotes: '',
    };
    if (
      location.book &&
      GI.getBooksInVKModule([], renderPromise, module).includes(location.book)
    ) {
      const { text, notes } = GI.LibSword.getChapterText(
        { text: '', notes: '' },
        renderPromise,
        module,
        `${book}.${chapter}`,
        options,
      );
      response.textHTML = text;
      response.notes = notes;
      if (show.usernotes)
        addBookmarks(response, { ...props, modkey: '' }, renderPromise);
      response.noteHTML = getNoteHTML(
        response.notes,
        show,
        0,
        crossrefsText,
        undefined,
        undefined,
        renderPromise,
      );
    }
    const { noteHTML } = response;
    let { textHTML } = response;

    let moduleLocale = G.Config[module].AssociatedLocale;
    if (!moduleLocale) moduleLocale = G.i18n.language; // otherwise use current program locale
    const toptions = { lng: moduleLocale, ns: 'books' };

    // Localize verse numbers to match the module
    const digits =
      (moduleLocale && GI.getLocaleDigits(null, renderPromise, moduleLocale)) ||
      null;
    if (digits) {
      const verseNm = /(<sup class="versenum">)(\d+)(<\/sup>)/g;
      textHTML = textHTML.replace(
        verseNm,
        (_str, p1: string, p2: string, p3: string) => {
          return p1 + dString(p2, moduleLocale) + p3;
        },
      );
    }

    // Get introduction
    if (introduction) {
      const intro = getIntroductions(
        module,
        `${book} ${chapter}`,
        renderPromise,
      );
      if (intro.textHTML) introHTML = intro.textHTML;
    }

    // Get chapter heading
    if (headings && textHTML) {
      const headclass = ['chapterhead', `cs-${moduleLocale}`];
      if (chapter === 1) headclass.push('chapterfirst');
      headHTML = `
      <div class="${headclass.join(' ')}">
        <div class="chaptitle" >
          <div class="chapbk">${GI.i18n.t('', renderPromise, book, toptions)}</div>
          <div class="chapch">${getLocalizedChapterTerm(
            book,
            chapter,
            moduleLocale,
            renderPromise,
          )}</div>
        </div>
      </div>`;
    }

    return `
      <div class="introduction"></div>${introHTML}
      <div class="dictionary-links"></div>${getDictionaryLinks(introHTML, renderPromise)}
      <div class="chapter-start${chapter === 1 ? ' chapterfirst' : ''}"></div>${headHTML}
      ${textHTML}
      <div class="footnotes"></div>${noteHTML}
      <div class="dictionary-links"></div>${getDictionaryLinks(textHTML, renderPromise)}`;
  }
  return '';
}

export function validPassage(
  passage: SelectVKType | null,
  renderPromise: RenderPromise,
): SelectVKType {
  let chapters = clone(passage);
  if (
    !chapters ||
    !chapters.vkMod ||
    !isValidVKM(chapters, chapters.vkMod, renderPromise)
  ) {
    const vkMod = G.Tabs.find((t) => t.type === C.BIBLE)?.module || '';
    chapters = {
      vkMod,
      book:
        (vkMod && GI.getBooksInVKModule(['Gen'], renderPromise, vkMod)[0]) ||
        'Gen',
      chapter: 1,
      lastchapter: 1,
      v11n: (vkMod && vkMod in G.Tab && G.Tab[vkMod].v11n) || 'KJV',
    };
  }
  const { lastchapter, v11n } = chapters;
  if (!v11n) {
    const { vkMod } = chapters;
    chapters.v11n = (vkMod && vkMod in G.Tab && G.Tab[vkMod].v11n) || 'KJV';
  }
  if (!lastchapter || lastchapter < chapters.chapter) {
    chapters.lastchapter = chapters.chapter;
  }
  return chapters;
}
