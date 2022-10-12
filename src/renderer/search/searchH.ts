/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-bitwise */
/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
import i18n from 'i18next';
import { getElementInfo } from '../../libswordElemInfo';
import {
  dString,
  escapeRE,
  getCSS,
  sanitizeHTML,
  stringHash,
} from '../../common';
import C from '../../constant';
import G from '../rg';
import { log, verseKey, windowArgument } from '../rutil';
import { getStrongsModAndKey } from '../viewport/zdictionary';

import type {
  BookGroupType,
  GlobalPrefType,
  LocationVKType,
  SearchType,
  V11nType,
} from '../../type';
import type { SearchWinState } from './search';
import type SearchWin from './search';

export type SearchMatchType = {
  term: string;
  type: 'string' | 'RegExp' | null;
};

const libSwordSearchTypes = {
  REGEX: 0,
  PHRASE: -1,
  MULTIWORD: -2,
  ENTRY_ATTRIBUTE: -3,
  LUCENE: -4,
  COMPOUND: -5,
};

export const searchArg = windowArgument('search') as SearchType;

export const strongsCSS = {
  css: getCSS('.matchingStrongs {'),
  sheet: document.styleSheets[document.styleSheets.length - 1],
  added: [] as number[],
};

type LibSwordSearchType = [string, string, string[], number, number];
const LibSwordSearch = {
  sthis: null as SearchWin | null,
  params: null as LibSwordSearchType | null,
  hash: '',
};

export function getLuceneSearchText(searchtext0: string) {
  let searchtext = searchtext0;
  Object.entries(C.UI.Search.symbol).forEach((entry) => {
    const k = entry[0];
    const [uiVal, luceneVal] = entry[1];
    let uiVal2 = uiVal;
    if (i18n.exists(k)) {
      const kv = i18n.t(k);
      if (!/^\s*$/.test(kv)) uiVal2 = kv;
    }
    searchtext = searchtext.replace(
      new RegExp(escapeRE(uiVal2), 'g'),
      luceneVal
    );
  });
  searchtext = searchtext.replace(/^\s*/, '');
  searchtext = searchtext.replace(/\s*$/, '');
  searchtext = searchtext.replace(/\s+/g, ' ');
  return searchtext;
}

// Return an array of book codes from a KJV book-scope string.
function scopeBooks(scope: string): string[] {
  const books: string[] = [];
  scope.split(/\s+/).forEach((seg) => {
    const bk = seg.split('-');
    let beg = bk[0] in G.Book ? G.Book[bk[0]].index : -1;
    const end = bk.length === 2 && bk[1] in G.Book ? G.Book[bk[1]].index : beg;
    if (beg === -1) beg = end;
    if (beg !== -1) {
      for (let i = beg; i <= end; i += 1) {
        books.push(G.Books[i].code);
      }
    }
  });
  return books;
}

// Return the minimal number of continuous module-order book segments
// as an array (for example: [Gen-Mal, John-Rev]) or, if single is set,
// an array of individual books in module-order is returned. Input is
// 'all' | BookGroupType | KJV-book-scope.
function getScopes(
  input: 'all' | BookGroupType | string,
  module: string,
  single = false
): string[] {
  const scopes: string[] = [];
  function continuation(start: any, end: any, skip: any) {
    if (!skip) {
      if (start && start === end) scopes.push(start);
      else if (start && end) scopes.push(`${start}-${end}`);
    }
  }
  if (module && module in G.Tab && G.Tab[module].isVerseKey) {
    const scopebooks = scopeBooks(input);
    const modbooks = G.getBooksInModule(module); // are in v11n order

    let contStart: string | null = null;
    let contEnd: string | null = null;
    modbooks.forEach((bk) => {
      let keep = false;
      if (input === 'all') keep = true;
      else if (C.SupportedBookGroups.includes(input as BookGroupType)) {
        keep = C.SupportedBooks[input as BookGroupType].some((b) => b === bk);
      } else {
        keep = scopebooks.some((b) => b === bk);
      }
      if (keep) {
        if (single) scopes.push(bk);
        if (!contStart) contStart = bk;
        contEnd = bk;
      } else {
        continuation(contStart, contEnd, single);
        contStart = null;
        contEnd = null;
      }
    });
    continuation(contStart, contEnd, single);
  }
  return scopes;
}

export async function search(sthis: SearchWin) {
  LibSwordSearch.sthis = sthis;
  const state = sthis.state as SearchWinState;
  const { module, displayBible: db, searchtext } = state;
  let { searchtype } = state;
  if (state.progress !== 0) return false;
  if (!/\S\S/.test(state.searchtext)) return false;
  if (!module || !(module in G.Tab)) return false;

  const hasIndex = G.LibSword.luceneEnabled(module);
  const isBible = G.Tab[module].type === C.BIBLE;
  const displayBible = isBible ? module : db;

  if (!hasIndex && /lemma:/.test(state.searchtext)) {
    return createSearchIndex(sthis, module);
  }

  const s: Partial<SearchWinState> = {
    count: 0,
    pageindex: 0,
    progress: 0,
    progressLabel: '',
    displayBible,
  };

  G.Window.setTitle(`${i18n.t('search.label')} "${searchtext}"`);

  // Replace UI search symbols with Clucene recognized search symbols,
  // and prepare the query string according to search type.
  let searchtextLS = getLuceneSearchText(state.searchtext);

  let libSwordSearchType = libSwordSearchTypes.REGEX;
  if (G.LibSword.luceneEnabled(module)) {
    libSwordSearchType = libSwordSearchTypes.LUCENE;

    // If Lucene special operators are present, always search advanced.
    if (
      searchtextLS.search(
        /(\+|-|&&|\|\||!|\(|\)|{|}|\[|\]|\^|"|~|\*|\?|:|\\|AND|OR|NOT)/
      ) !== -1
    ) {
      searchtype = 'SearchAdvanced';
      s.searchtype = searchtype;
    }

    switch (searchtype) {
      case 'SearchAnyWord':
        searchtextLS = searchtextLS.replace(/ /gm, ' AND ');
        break;

      case 'SearchSimilar':
        searchtextLS = searchtextLS.replace(/\s*$/, '~');
        searchtextLS = searchtextLS.replace(/ /gm, '~ AND ');
        break;

      case 'SearchExactText':
        // MULTIWORD and REGEX ARE CASE SENSETIVE! So use REGEX.
        libSwordSearchType = libSwordSearchTypes.REGEX;
        break;

      default:
    }
  } else {
    // no Lucene
    searchtype = 'SearchExactText';
    s.searchtype = searchtype;
  }

  // Prepare the search scope (is empty-string for non-versekey modules)
  let scopes = [''];
  if (G.Tab[module].isVerseKey) {
    scopes = [];
    const { scoperadio, scopeselect } = state;
    const bookByBook = libSwordSearchType !== libSwordSearchTypes.LUCENE;
    switch (scoperadio) {
      case 'all':
      case 'ot':
      case 'nt': {
        scopes = getScopes(scoperadio, module, bookByBook);
        break;
      }
      case 'book': {
        const location = G.Prefs.getComplexValue(
          'xulsword.location'
        ) as GlobalPrefType['xulsword']['location'];
        if (location?.book) {
          scopes = getScopes(location.book, module, bookByBook);
        }
        break;
      }
      case 'other': {
        scopes = getScopes(scopeselect, module, bookByBook);
        break;
      }
      default:
    }
  }

  // get Search flags
  // BUG NOTE: FLAGS = 2 DOESNT WORK FOR NON-ENGLISH/NON-LUCENE SEARCHES
  let flags = 2; // Turn "Ignore Case" flag on.
  if (searchtype === 'SearchSimilar' || /~/.test(searchtextLS)) {
    flags |= 2048; // Turn on Sort By Relevance flag
  }

  s.count = await libSwordSearch(
    module,
    searchtextLS,
    scopes,
    libSwordSearchType,
    flags
  );

  sthis.setState(s);

  return true;
}

async function libSwordSearch(
  module: string,
  searchtext: string,
  scopes: string[],
  libswordSearchType: number,
  flags: number
): Promise<number> {
  let funcs: (() => Promise<number | null>)[] = [];
  if (module && module in G.Tab) {
    // Simultaneous searchers would conflate them so both would give
    // incorrect results. So make other windows modal if scopes.length > 1.
    if (scopes.length > 1) G.Window.modal('transparent', 'not-self');
    // Save search arguments and hash for LibSword search validation.
    LibSwordSearch.params = [
      module,
      searchtext,
      scopes,
      libswordSearchType,
      flags,
    ];
    LibSwordSearch.hash = stringHash(LibSwordSearch.params);
    let isnew = true;
    funcs = scopes.map((scope, i) => {
      return async () => {
        const count = await G.LibSword.search(
          module,
          searchtext,
          scope,
          libswordSearchType,
          flags,
          isnew,
          LibSwordSearch.hash
        );
        isnew = false;
        if (scopes.length > 1 && LibSwordSearch.sthis) {
          const s: Partial<SearchWinState> = {
            progress: (i + 1) / scopes.length,
            progressLabel: scope in G.Book ? G.Book[scope].name : scope,
          };
          LibSwordSearch.sthis.setState(s);
        }
        return count;
      };
    });
  }
  let grandTotal = 0;
  for (const func of funcs) {
    const c = await func();
    if (c !== null) grandTotal = c;
  }

  if (scopes.length > 1) {
    G.Window.modal('off', 'not-self');
    if (LibSwordSearch.sthis) {
      const s: Partial<SearchWinState> = {
        progress: 0,
        progressLabel: '',
      };
      LibSwordSearch.sthis.setState(s);
    }
  }

  return grandTotal;
}

// When multiple search windows are open and paging events switch from
// one page to another, fresh search results must be generated.
export async function getSearchResults(
  mod: string,
  i: number,
  maxPage: number,
  keepstrings: boolean,
  ptr: any
): Promise<string> {
  let r = G.LibSword.getSearchResults(
    mod,
    i,
    maxPage,
    keepstrings,
    ptr,
    LibSwordSearch.hash
  );
  if (r === null) {
    await libSwordSearch(...(LibSwordSearch.params as LibSwordSearchType));
    r = G.LibSword.getSearchResults(
      mod,
      i,
      maxPage,
      keepstrings,
      ptr,
      LibSwordSearch.hash
    );
  }

  return r || '';
}

function createSearchIndex(sthis: SearchWin, module: string) {
  if (module && module in G.Tab) {
    G.Window.modal('darkened', 'all');
    const s: Partial<SearchWinState> = {
      count: 0,
      pageindex: 0,
      progress: -1,
      progressLabel: i18n.t('BuildingIndex'),
    };
    sthis.setState(s);
    if (G.LibSword.luceneEnabled(module)) {
      G.LibSword.searchIndexDelete(module);
    }
    // The timeout allows UI to catch up before indexing begins,
    // which is still required even though indexing is anync.
    setTimeout(() => {
      G.LibSword.searchIndexBuild(module)
        .then(() => {
          G.Window.modal('off', 'all');
          sthis.setState({ progress: 0 });
          return search(sthis);
        })
        .catch((er: Error) => {
          log.error(er);
          G.Window.modal('off', 'all');
        });
    }, 100);
  }
}

export function formatResult(div: HTMLDivElement, state: SearchWinState) {
  const { module, displayBible, searchtext, searchtype } = state;
  const dModule =
    !module || !(module in G.Tab) || G.Tab[module].type === C.BIBLE
      ? displayBible
      : module;
  if (module && module in G.Tab && dModule && dModule in G.Tab) {
    Array.from(div.getElementsByClassName('slist')).forEach((slist) => {
      const p = getElementInfo(slist as HTMLElement);

      // Add the reference link to each result
      const span = document.createElement('span');
      span.innerHTML = '-';
      slist.insertBefore(span, slist.firstChild);
      const a = document.createElement('a');
      slist.insertBefore(a, slist.firstChild);
      const type = (p?.mod && G.Tab[p.mod].type) || C.BIBLE;
      switch (type) {
        case C.BIBLE:
        case C.COMMENTARY: {
          if (a && p?.osisref) {
            // Translate from module to DisplayBible
            const vsys = G.LibSword.getVerseSystem(module);
            const v = verseKey(p.osisref, vsys);
            sanitizeHTML(a, v.readable(G.LibSword.getVerseSystem(dModule)));
            a.className = 'cs-locale';
            a.id = ['verselink', vsys, v.osisRef()].join('.');
          }
          break;
        }

        case C.GENBOOK:
        case C.DICTIONARY: {
          if (p?.ch && p?.mod) {
            sanitizeHTML(a, p.ch.toString());
            a.className = `cs-${p.mod}`;
            // p.ch may contain . so careful using split('.')!
            a.id = ['keylink', p.mod, encodeURIComponent(p.ch.toString())].join(
              '.'
            );
          }
          break;
        }
        default:
      }

      // Apply hilight class to search result matches
      const lastChild = slist.lastChild as HTMLElement;
      sanitizeHTML(
        lastChild,
        markSearchMatches(
          lastChild.innerHTML,
          getSearchMatches(searchtext, searchtype)
        )
      );
    });
  }
}

function markSearchMatches(
  htmlStr: string,
  matches: SearchMatchType[]
): string {
  let html = htmlStr;
  matches.forEach((m) => {
    if (m.type === 'RegExp') {
      const re = new RegExp(m.term, 'gim');
      html = html
        .split(/(<[^>]*>)/)
        .map((t) => {
          if (/^<[^>]*>$/.test(t)) return t;
          return t.replace(re, '$1<span class="searchterm">$2</span>$3');
        })
        .join('');
    } else if (m.type === 'string') {
      const re = new RegExp(escapeRE(m.term), 'gim');
      html = html
        .split(/(<[^>]*>)/)
        .map((t) => {
          if (/^<[^>]*>$/.test(t)) return t;
          return t.replace(re, '<span class="searchterm">$&</span>');
        })
        .join('');
    }
  });

  return html.replace(/<br[^>]*>/g, ''); // since <br> looks bad in display
}

// To highlight results, build regular expressions for matching them.
function getSearchMatches(
  searchtext: string,
  searchtype: SearchWinState['searchtype']
) {
  let matches: SearchMatchType[] = [];
  let t = getLuceneSearchText(searchtext);
  switch (searchtype) {
    case 'SearchAnyWord':
    case 'SearchSimilar':
      // change spaces into ";" for later splitting
      t = t.replace(/ +/g, ';');
      matches = getMatchTermsArray(t);
      break;

    case 'SearchExactText':
      matches = [{ term: t, type: 'string' }];
      break;

    case 'SearchAdvanced': {
      t = t.replace(/ +/g, ';');
      t = t.replace(
        /(\+|-|&&|\|\||!|\(|\)|{|}|\[|\]|\^|~|:|"|\\|AND;|OR;|NOT;)/g,
        ''
      ); // Remove all control chars except [?";*]
      t = t.replace(/\?/g, '.'); // add dots before any ?s
      t = t.replace(/\*/g, '.*?'); // add dots before any *s

      // Change ";"s which are between quotes back into spaces, and remove the quotes
      let quoted = false;
      let rt = '';
      for (let x = 0; x < t.length; x += 1) {
        const mychr = t.charAt(x);
        if (mychr === '"') {
          quoted = !quoted;
        } else if (quoted && mychr === ';') {
          // \\s+ allows for more than one space between words in the striped text (common thing)
          rt += '\\s+';
        } else {
          rt += mychr;
        }
      }
      matches = getMatchTermsArray(rt);
      break;
    }
    default:
  }

  function getMatchTermsArray(terms: string): SearchMatchType[] {
    const tr: SearchMatchType[] = [];
    terms.split(';').forEach((term) => {
      if (!/lemma:/.test(term)) {
        const aTerm: SearchMatchType = { term: '', type: null };
        // Begin and End cannot be \W because non-English letters ARE \W!
        aTerm.term = `(^|\\s|–|\\(|>)(${term})(<|\\s|\\.|\\?|,|;|:|"|!|\\)|$)`;
        aTerm.type = 'RegExp';
        tr.push(aTerm);
      }
    });
    return tr;
  }

  return matches;
}

export function hilightStrongs(strongs: RegExpMatchArray | null) {
  strongsCSS.added.forEach((r) => {
    strongsCSS.sheet.deleteRule(r);
  });
  strongsCSS.added = [];
  strongs?.forEach((s) => {
    const c = `S_${s.replace(/lemma:\s*/, '')}`;
    log.debug(`Adding sn class: ${c}`);
    const index = strongsCSS.sheet.cssRules.length;
    if (strongsCSS.css) {
      strongsCSS.sheet.insertRule(
        strongsCSS.css.rule.cssText.replace('matchingStrongs', c),
        index
      );
      strongsCSS.added.push(index);
    }
  });
}

export async function lexicon(lexdiv: HTMLDivElement, state: SearchWinState) {
  const { searchtext, searchtype, module, displayBible, count } = state;
  const dModule =
    !module || !(module in G.Tab) || G.Tab[module].type === C.BIBLE
      ? displayBible
      : module;
  if (!dModule || !(dModule in G.Tab)) return;

  lexdiv.style.display = 'none'; // might this speed things up??
  const list: HTMLSpanElement[] = [];
  sanitizeHTML(
    lexdiv,
    markSearchMatches(
      await getSearchResults(
        dModule,
        0,
        C.UI.Search.maxLexiconSearchResults,
        true,
        null
      ),
      getSearchMatches(searchtext, searchtype)
    )
  );

  // If searching for a Strong's number, collect all its translations.
  const strongs: RegExpMatchArray | null = searchtext.match(/lemma:\s*\S+/g);
  if (strongs) {
    strongs.forEach((s) => {
      const c = `S_${s.replace(/lemma:\s*/, '')}`;
      const snlex: { text: string; count: number }[] = [];

      // Iterate through each and every element having this Strong's number
      Array.from(lexdiv.getElementsByClassName(c)).forEach((el) => {
        let j;
        for (j = 0; j < snlex.length; j += 1) {
          if (el.innerHTML === snlex[j].text) {
            snlex[j].count += 1;
            break;
          }
        }
        if (j === snlex.length) snlex.push({ text: el.innerHTML, count: 1 });
      });

      // sort the results
      snlex.sort((a, b) => {
        return b.count - a.count;
      });

      // format and save the results
      const lexlist = document.createElement('p');
      list.push(lexlist);
      lexlist.className = 'lexlist';

      const dictinfo = getStrongsModAndKey(c);
      const strongNum = c.replace('S_', '');

      const a = lexlist.appendChild(document.createElement('span'));
      if (dictinfo.mod && dictinfo.key) {
        a.className = `sn ${c}`;
      }
      a.dataset.title = [dModule, c].join('.');
      a.textContent = strongNum;

      const span1 = lexlist.appendChild(document.createElement('span'));
      span1.textContent = ` - [${dString(1)}-${dString(
        count > C.UI.Search.maxLexiconSearchResults
          ? C.UI.Search.maxLexiconSearchResults
          : count
      )}]: `;

      const span2 = lexlist.appendChild(document.createElement('span'));
      span2.className = `cs-${dModule}`;
      span2.textContent = snlex
        .map((snl) => `${snl.text}(${snl.count.toString()})`)
        .join(', ');
    });
  } else {
    // Otherwise searching for strings. Find all corresponding Strong's numbers.
    type Sts = { strongs: string; count: number };
    const strongsLists = { H: [] as Sts[], G: [] as Sts[] };
    Array.from(lexdiv.getElementsByClassName('searchterm')).forEach((term) => {
      const p = term.parentNode as HTMLElement;
      if (p) {
        const re = '\\bS_(G|H)\\d+\\b';
        const sclass = p.className.match(new RegExp(re, 'g'));
        if (sclass && sclass.length) {
          sclass.forEach((sc) => {
            const [mclass, mtypex] = Array.from(sc.match(new RegExp(re)) || []);
            const mtype = mtypex as keyof typeof strongsLists;
            let j;
            for (j = 0; j < strongsLists[mtype].length; j += 1) {
              if (mclass === strongsLists[mtype][j].strongs) {
                strongsLists[mtype][j].count += 1;
                break;
              }
            }
            if (j === strongsLists[mtype].length)
              strongsLists[mtype].push({ strongs: mclass, count: 1 });
          });
        }
      }
    });

    // format and write the results in the Lexicon section
    Object.entries(strongsLists).forEach((entry) => {
      const [hgx, stsa] = entry;
      const hg = hgx as 'H' | 'G';
      // sort the results
      stsa.sort((a, b) => {
        return b.count - a.count;
      });

      if (stsa.length) {
        const lexlist = document.createElement('p');
        list.push(lexlist);
        lexlist.className = 'lexlist';

        let mtype = '';
        if (hg === 'H') mtype = i18n.t('ORIGLabelOT');
        if (hg === 'G') mtype = i18n.t('ORIGLabelNT');

        const sns: string[] = [];
        stsa.forEach((sts: Sts) => {
          const strongNum = sts.strongs.replace('S_', '');
          const sti = getStrongsModAndKey(sts.strongs);
          const cls = sti.mod && sti.key ? ` class="sn ${sts.strongs}"` : '';
          sns.push(
            `<span${cls} data-title="${[
              dModule,
              ...sts.strongs.split(' '),
            ].join('.')}">${strongNum}</span>(${sts.count.toString()})`
          );
        });
        const c =
          count > C.UI.Search.maxLexiconSearchResults
            ? C.UI.Search.maxLexiconSearchResults
            : count;
        sanitizeHTML(
          lexlist,
          `${mtype} - [${dString(1)}-${dString(c)}]: ${sns.join(', ')}`
        );
      }
    });
  }

  // now display the list
  while (lexdiv.firstChild) {
    lexdiv.removeChild(lexdiv.firstChild);
  }
  if (!list.length) {
    lexdiv.innerHTML = '';
  } else {
    list.forEach((ns, i) => {
      lexdiv.appendChild(ns);
      if (i < list.length - 1) {
        lexdiv.appendChild(document.createElement('div'));
      }
    });
  }
  lexdiv.style.display = ''; // was set to 'none' earlier
}

export default function handler(this: SearchWin, e: React.SyntheticEvent) {
  const state = this.state as SearchWinState;
  const target = e.target as HTMLElement;
  const currentTarget = e.currentTarget as HTMLElement;
  switch (e.type) {
    case 'click': {
      switch (currentTarget.id) {
        case 'moreLess': {
          this.setState((prevState: SearchWinState) => {
            const s: Partial<SearchWinState> = {
              moreLess: !prevState.moreLess,
            };
            return s;
          });
          break;
        }
        case 'searchButton': {
          search(this);
          break;
        }
        case 'helpButton': {
          G.Commands.searchHelp();
          break;
        }
        case 'createIndexButton': {
          const { module } = state;
          if (module && G.Tab[module]) {
            const s: Partial<SearchWinState> = {
              searchtype: 'SearchAnyWord',
            };
            this.setState(s);
            createSearchIndex(this, module);
          }
          break;
        }
        case 'pagefirst': {
          this.setState({ pageindex: 0 });
          break;
        }
        case 'pagelast': {
          let pageindex = state.count - C.UI.Search.resultsPerPage;
          if (pageindex < 0) pageindex = 0;
          this.setState({ pageindex });
          break;
        }
        case 'pageprev': {
          let pageindex = state.pageindex - C.UI.Search.resultsPerPage;
          if (pageindex < 0) pageindex = 0;
          this.setState({ pageindex });
          break;
        }
        case 'pagenext': {
          let pageindex = state.pageindex + C.UI.Search.resultsPerPage;
          if (pageindex >= state.count)
            pageindex = state.count - C.UI.Search.resultsPerPage;
          if (pageindex < 0) pageindex = 0;
          this.setState({ pageindex });
          break;
        }
        case 'searchResults':
        case 'lexiconResults': {
          const p = target.id.split('.');
          const link = p.shift();
          switch (link) {
            case 'verselink': {
              const l: LocationVKType = {
                v11n: p.shift() as V11nType,
                book: p.shift() as string,
                chapter: Number(p.shift()),
                verse: Number(p.shift()),
              };
              G.Commands.goToLocationVK(l, l);
              break;
            }
            case 'keylink': {
              const module = p.shift();
              if (module && module in G.Tab) {
                G.Commands.goToLocationSK({
                  module,
                  key: decodeURIComponent(p.shift() || ''),
                });
              }
              break;
            }
            default:
          }
          break;
        }

        default:
          throw Error(`Unhandled searchH click on id '${target.id}'`);
      }
      break;
    }
    case 'change': {
      const targid = currentTarget.id as keyof SearchWinState;
      const se = target as any;
      switch (targid) {
        case 'module':
        case 'displayBible':
        case 'searchtext':
        case 'searchtype':
        case 'scoperadio':
        case 'scopeselect': {
          if (
            !['module', 'displayBible'].includes(targid) ||
            (se.value && se.value in G.Tab)
          ) {
            this.setState({ [targid]: se.value });
          }
          e.stopPropagation();
          break;
        }

        default:
          throw Error(`Unhandled searchH change on id '${target.id}'`);
      }
      break;
    }
    default:
      throw Error(`Unhandled searchH event type ${e.type}`);
  }
}