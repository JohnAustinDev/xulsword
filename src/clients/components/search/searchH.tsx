import React from 'react';
import Subscription from '../../../subscription.ts';
import {
  noAutoSearchIndex,
  escapeRE,
  getCSS,
  sanitizeHTML,
  randomID,
} from '../../../common.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import { dString } from '../../common.ts';
import Commands from '../../commands.ts';
import log from '../../log.ts';
import RenderPromise from '../../renderPromise.ts';
import { getElementData, verseKey } from '../../htmlData.ts';
import SearchHelp from '../searchHelp/searchHelp.tsx';
import { getStrongsModAndKey } from '../atext/zdictionary.ts';

import type {
  BookGroupType,
  LocationVKType,
  OSISBookType,
  V11nType,
  WindowDescriptorType,
} from '../../../type.ts';
import type S from '../../../defaultPrefs.ts';
import type { SearchResult } from '../../../servers/components/libsword.ts';
import type { SearchProps, SearchState } from './search.tsx';
import type Search from './search.tsx';

export type SearchMatchType = {
  term: string;
  type: 'string' | 'RegExp' | null;
};

const libSwordSearchTypes = {
  REGEX: 0,
  PHRASE: -1,
  MULTIWORD: -2,
  ENTRYATTRIBUTE: -3,
  LUCENE: -4,
  COMPOUND: -5,
};

export const strongsCSS = {
  css: null as { sheet: CSSStyleSheet; rule: CSSRule; index: number } | null,
  sheet: document.styleSheets[document.styleSheets.length - 1],
  added: [] as number[],
};

export function getLuceneSearchText(
  searchtext0: string,
  renderPromise: RenderPromise,
) {
  let searchtext = searchtext0;
  Object.entries(C.UI.Search.symbol).forEach((entry) => {
    const [k, [uiVal, luceneVal]] = entry;
    let uiVal2 = uiVal;
    if (GI.i18n.exists(false, renderPromise, k)) {
      const kv = GI.i18n.t('', renderPromise, k);
      if (!/^\s*$/.test(kv)) uiVal2 = kv;
    }
    searchtext = searchtext.replace(
      new RegExp(escapeRE(uiVal2), 'g'),
      luceneVal,
    );
  });
  searchtext = searchtext.replace(/^\s*/, '');
  searchtext = searchtext.replace(/\s*$/, '');
  searchtext = searchtext.replace(/\s+/g, ' ');
  return searchtext;
}

// Return an array of book codes from a KJV book-scope string.
function kjvScopeBooks(scope: string): string[] {
  const books: string[] = [];
  const Book = G.Book(G.i18n.language);
  const Books = G.Books(G.i18n.language);
  scope.split(/\s+/).forEach((seg) => {
    const bk = seg.split('-');
    let beg = bk[0] in Book ? (Book as any)[bk[0]].index : -1;
    const end =
      bk.length === 2 && bk[1] in Book ? (Book as any)[bk[1]].index : beg;
    if (beg === -1) beg = end;
    if (beg !== -1) {
      for (let i = beg; i <= end; i += 1) {
        books.push(Books[i].code);
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
  single: boolean,
  renderPromise: RenderPromise,
): string[] {
  const scopes: string[] = [];
  function continuation(start: string, end: string, skip: boolean) {
    if (!skip) {
      if (start && start === end) scopes.push(start);
      else if (start && end) scopes.push(`${start}-${end}`);
    }
  }
  if (module && module in G.Tab && G.Tab[module].isVerseKey) {
    let kjvscope = input;
    if (kjvscope === 'all') {
      kjvscope = Object.values(C.SupportedBooks)
        .map((books) => `${books[0]}-${books.at(-1)}`)
        .join(' ');
    } else if (C.SupportedBookGroups.includes(kjvscope as never)) {
      const books =
        kjvscope in C.SupportedBooks && (C.SupportedBooks as any)[kjvscope];
      if (books) kjvscope = `${books[0]}-${books.at(-1)}`;
    }
    const scopebooks = kjvScopeBooks(kjvscope);
    const modbooks = GI.getBooksInVKModule(['Gen'], renderPromise, module); // are in v11n order

    let contStart: OSISBookType | '' = '';
    let contEnd: OSISBookType | '' = '';
    modbooks.forEach((bk) => {
      if (scopebooks.includes(bk)) {
        if (single) scopes.push(bk);
        if (!contStart) contStart = bk;
        contEnd = bk;
      } else {
        continuation(contStart, contEnd, single);
        contStart = '';
        contEnd = '';
      }
    });
    continuation(contStart, contEnd, single);
  }
  return scopes;
}

export async function search(xthis: Search): Promise<boolean> {
  log.debug(`SEARCHING...`);
  const state = xthis.state as SearchState;
  const { renderPromise } = xthis;
  const { descriptor } = xthis.props as SearchProps;
  const { module, searchtext } = state;
  let { searchtype } = state;
  if (state.progress !== -1) return false;
  if (!/\S\S/.test(state.searchtext)) return false;
  if (!module || !(module in G.Tab)) return false;

  let hasIndex = GI.LibSword.luceneEnabled(true, renderPromise, module);

  if (!hasIndex) {
    hasIndex = await autoCreateSearchIndex(xthis, module, renderPromise);
  }

  const s: SearchState = {
    ...state,
    results: { html: '', count: 0, lexhtml: '' },
    pageindex: 0,
    progress: -1,
    progressLabel: '',
  };

  if (descriptor)
    G.Window.setTitle(
      `${GI.i18n.t('', renderPromise, 'menu.search')} "${searchtext}"`,
    );

  // Replace UI search symbols with Clucene recognized search symbols,
  // and prepare the query string according to search type.
  let searchtextLS = getLuceneSearchText(state.searchtext, renderPromise);

  let libSwordSearchType = libSwordSearchTypes.REGEX;
  if (GI.LibSword.luceneEnabled(true, renderPromise, module)) {
    libSwordSearchType = libSwordSearchTypes.LUCENE;

    // If Lucene special operators are present, always search advanced.
    if (
      searchtextLS.search(
        /(\+|-|&&|\|\||!|\(|\)|{|}|\[|\]|\^|"|~|\*|\?|:|\\|AND|OR|NOT)/,
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
        scopes = getScopes(scoperadio, module, bookByBook, renderPromise);
        break;
      }
      case 'book': {
        const location = G.Prefs.getComplexValue(
          'xulsword.location',
        ) as typeof S.prefs.xulsword.location;
        if (location?.book) {
          scopes = getScopes(location.book, module, bookByBook, renderPromise);
        }
        break;
      }
      case 'other': {
        scopes = getScopes(scopeselect, module, bookByBook, renderPromise);
        break;
      }
      default:
    }
  }

  // get Search flags
  // BUG NOTE: FLAGS = 2 DOESNT WORK FOR NON-ENGLISH/NON-LUCENE SEARCHES
  let flags = 2; // Turn "Ignore Case" flag on.
  if (searchtype === 'SearchSimilar' || searchtextLS.includes('~')) {
    flags |= 2048; // Turn on Sort By Relevance flag
  }

  s.searching = {
    module,
    search: searchtextLS,
    scopes,
    type: libSwordSearchType,
    flags,
  };

  s.displayModule = module;

  // Setting progress is important here as it signals to libswordSearch that
  // this should always be a new search set.
  s.progress = 0;

  await updateStateResults(xthis, s);

  log.debug(`FINISHED SEARCHING!`);
  return true;
}

export async function libSwordSearch(
  xthis: Search,
  state: SearchState,
): Promise<SearchResult | null> {
  let finalResult: SearchResult | null = null;

  // When these change, a whole new search set is initiated.
  const { module, search, scopes, type, flags } = state.searching;

  // When these change, previous search results are just re-processed.
  const { displayModule, pageindex } = state;

  if (module && module in G.Tab) {
    // Only one active search is allowed at a time, so make other windows
    // modal if scopes.length > 1.
    if (Build.isElectronApp && scopes.length > 1)
      G.Window.modal([{ modal: 'transparent', window: 'not-self' }]);

    const { progress } = state;

    // scopes.length > 1 searches would initiate a new search on
    // every page request if we didn't use progress state.
    const funcs = scopes
      .map((scope, i) => {
        if (progress !== -1 || i === scopes.length - 1) {
          return async () => {
            const result = await G.LibSword.search(
              module,
              search,
              scope,
              scopes,
              type,
              flags,
              i === 0 && progress !== -1,
              displayModule,
              i === scopes.length - 1 ? pageindex : 0,
              i === scopes.length - 1 ? C.UI.Search.resultsPerPage : 0,
              true,
              i === scopes.length - 1,
            );
            if (scopes.length > 1 && xthis) {
              const Book = G.Book(G.i18n.language);
              xthis.setState({
                progress: (i + 1) / scopes.length,
                progressLabel:
                  scope in Book ? (Book as any)[scope].name : scope,
              } as Partial<SearchState>);
            }
            return result;
          };
        }
      })
      .filter(Boolean) as (() => Promise<SearchResult | null>)[];

    let result: SearchResult | null = null;
    for (const func of funcs) {
      result = await func();
      if (result && 'limitedDoWait' in result) result = null;
      if (result === null) break;
    }
    finalResult = result;

    // Now reset modal off (progress must be reset along with the results).
    if (scopes.length > 1) {
      if (Build.isElectronApp)
        G.Window.modal([{ modal: 'off', window: 'not-self' }]);
    }
  }

  // If the result was null, the search engine was busy, so wait a
  // second for it to free up and try again.
  if (finalResult === null) {
    return await new Promise((resolve) => {
      setTimeout(
        () => {
          const r = libSwordSearch(xthis, state);
          resolve(r);
        },
        Build.isWebApp ? 5000 : 1000,
      );
    });
  }

  return finalResult;
}

export async function autoCreateSearchIndex(
  xthis: Search,
  module: string,
  renderPromise: RenderPromise,
): Promise<boolean> {
  let result = false;
  const csai = G.Prefs.getComplexValue(
    'global.noAutoSearchIndex',
  ) as typeof S.prefs.global.noAutoSearchIndex;
  const { descriptor } = xthis.props as SearchProps;
  if (descriptor && !csai.includes(module)) {
    result = await createSearchIndex(xthis, module, descriptor, renderPromise);
  }
  return result;
}

export const Indexing = { current: '' };
export async function createSearchIndex(
  xthis: Search,
  module: string,
  descriptor: WindowDescriptorType,
  renderPromise: RenderPromise,
): Promise<boolean> {
  if (Build.isElectronApp && module && module in G.Tab) {
    return await new Promise((resolve) => {
      const s: Partial<SearchState> = {
        results: { html: '', count: 0, lexhtml: '' },
        pageindex: 0,
        progress: 0,
        progressLabel: GI.i18n.t('', renderPromise, 'BuildingIndex'),
        indexing: true,
      };
      xthis.setState(s);
      Indexing.current = module;
      const winid = descriptor.id;
      // Add a delay before and after index creation to insure UI is responsive.
      setTimeout(() => {
        log.debug(`BUILDING createSearchIndex...`);
        G.LibSword.searchIndexBuild(module, winid)
          .then((result) => {
            // For some reason, indexing sometimes seems to corrupt the order of
            // booksInModule, so try reset all caches as a work-around.
            G.resetMain();
            G.Window.reset('cache-reset', 'all');
            if (!result) noAutoSearchIndex(G.Prefs, module);
            setTimeout(() => {
              resolve(result);
            }, 1);
            return result;
          })
          .finally(() => {
            xthis.setState({
              indexing: false,
              progress: -1,
              progressLabel: '',
            } as Partial<SearchState>);
            Indexing.current = '';
          })
          .catch((er) => {
            log.debug(er);
            noAutoSearchIndex(G.Prefs, module);
            resolve(false);
          });
      }, 1);
    });
  }
  return false;
}

export function formatResult(
  div: HTMLDivElement,
  state: SearchState,
  renderPromise: RenderPromise,
) {
  const { module, displayModule, searchtext, searchtype } = state;

  if (module && module in G.Tab) {
    Array.from(div.getElementsByClassName('slist')).forEach((slist) => {
      const p = getElementData(slist as HTMLElement);
      const { context } = p;
      if (context) {
        const { location, locationGB } = p;
        // Add the reference link to each result
        const span = document.createElement('span');
        span.innerHTML = '-';
        slist.insertBefore(span, slist.firstChild);
        const a = document.createElement('a');
        slist.insertBefore(a, slist.firstChild);
        const type = (context in G.Tab && G.Tab[context].type) || C.BIBLE;
        switch (type) {
          case C.BIBLE:
          case C.COMMENTARY: {
            if (a && location) {
              // Translate links from module to displayModule
              const vsys = G.Tab[module].v11n || null;
              const v = verseKey(location, vsys, undefined, renderPromise);
              sanitizeHTML(
                a,
                v.readable(G.i18n.language, G.Tab[displayModule].v11n || null),
              );
              a.className = 'cs-locale';
              a.id = ['verselink', vsys, v.osisRef()].join('.');
            }
            break;
          }

          case C.GENBOOK:
          case C.DICTIONARY: {
            if (locationGB) {
              const { otherMod: m, key } = locationGB;
              sanitizeHTML(a, key);
              a.className = `cs-${m}`;
              // p.ch may contain . so careful using split('.')!
              a.id = ['keylink', context, encodeURIComponent(key)].join('.');
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
            getSearchMatches(searchtext, searchtype, renderPromise),
          ),
        );
      }
    });
  }
}

function markSearchMatches(
  htmlStr: string,
  matches: SearchMatchType[],
): string {
  const repl = (re: RegExp, replacement: string) => {
    return html
      .split(/(<[^>]*>)/)
      .map((t) => {
        if (/^<[^>]*>$/.test(t)) return t;
        return t.replace(re, replacement);
      })
      .join('');
  };
  let html = htmlStr;
  matches.forEach((m) => {
    if (m.type === 'RegExp') {
      html = repl(
        new RegExp(m.term, 'gim'),
        '$1<span class="searchterm">$2</span>$3',
      );
    } else if (m.type === 'string') {
      html = repl(
        new RegExp(escapeRE(m.term), 'gim'),
        '<span class="searchterm">$&</span>',
      );
    }
  });

  return html.replace(/<br[^>]*>/g, ''); // since <br> looks bad in display
}

// To highlight results, build regular expressions for matching them.
function getSearchMatches(
  searchtext: string,
  searchtype: SearchState['searchtype'],
  renderPromise: RenderPromise,
) {
  let matches: SearchMatchType[] = [];
  let t = getLuceneSearchText(searchtext, renderPromise);
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
        '',
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
      if (!term.includes('lemma:')) {
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
    if (r < strongsCSS.sheet.cssRules.length) {
      strongsCSS.sheet.deleteRule(r);
    }
  });
  strongsCSS.added = [];
  strongs?.forEach((s) => {
    const c = `S_${s.replace(/lemma:\s*/, '')}`;
    log.debug(`Adding sn class: ${c}`);
    const index = strongsCSS.sheet.cssRules.length;
    if (!strongsCSS.css) {
      strongsCSS.css = getCSS('.resultBox .matchingStrongs {');
    }
    if (strongsCSS.css) {
      strongsCSS.sheet.insertRule(
        strongsCSS.css.rule.cssText.replace('matchingStrongs', c),
        index,
      );
      strongsCSS.added.push(index);
    }
  });
}

export async function lexicon(
  lexdiv: HTMLDivElement,
  xthis: Search,
  renderPromise: RenderPromise,
) {
  const state = xthis.state as SearchState;
  const { searchtext, searchtype, displayModule, results } = state;

  if (
    !displayModule ||
    !(displayModule in G.Tab) ||
    !G.Tab[displayModule].isVerseKey ||
    results === null
  ) {
    sanitizeHTML(lexdiv, '');
    return;
  }

  lexdiv.style.display = 'none'; // might this speed things up??
  const total =
    results.count > C.UI.Search.maxLexiconSearchResults
      ? C.UI.Search.maxLexiconSearchResults
      : results.count;
  const list: HTMLSpanElement[] = [];
  sanitizeHTML(
    lexdiv,
    markSearchMatches(
      results.lexhtml,
      getSearchMatches(searchtext, searchtype, renderPromise),
    ),
  );

  // If searching for a Strong's number, collect all its translations.
  const strongs: RegExpMatchArray | null = searchtext.match(/lemma:\s*\S+/g);
  if (strongs) {
    strongs.forEach((s) => {
      const c = `S_${s.replace(/lemma:\s*/, '')}`;
      const snlex: Array<{ text: string; count: number }> = [];

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

      const dictinfo = getStrongsModAndKey(c, renderPromise);
      const strongNum = c.replace('S_', '');

      const a = lexlist.appendChild(document.createElement('span'));
      if (dictinfo.mod && dictinfo.key) {
        a.className = `sn ${c}`;
      }
      a.dataset.title = [displayModule, c].join('.');
      a.textContent = strongNum;

      const span1 = lexlist.appendChild(document.createElement('span'));
      span1.textContent = ` - [${dString(1)}-${dString(total)}]: `;

      const span2 = lexlist.appendChild(document.createElement('span'));
      span2.className = `cs-${displayModule}`;
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
        if (sclass?.length) {
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
        if (hg === 'H') mtype = GI.i18n.t('', renderPromise, 'ORIGLabelOT');
        if (hg === 'G') mtype = GI.i18n.t('', renderPromise, 'ORIGLabelNT');

        const sns: string[] = [];
        stsa.forEach((sts: Sts) => {
          const strongNum = sts.strongs.replace('S_', '');
          const sti = getStrongsModAndKey(sts.strongs, renderPromise);
          const cls = sti.mod && sti.key ? ` class="sn ${sts.strongs}"` : '';
          sns.push(
            `<span${cls} data-title="${[
              displayModule,
              ...sts.strongs.split(' '),
            ].join('.')}">${strongNum}</span>(${sts.count.toString()})`,
          );
        });
        sanitizeHTML(
          lexlist,
          `${mtype} - [${dString(1)}-${dString(total)}]: ${sns.join(', ')}`,
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

export default async function handler(this: Search, e: React.SyntheticEvent) {
  const { renderPromise } = this;
  const state = this.state as SearchState;
  const target = e.target as HTMLElement;
  const currentTarget = e.currentTarget as HTMLElement;
  const { results } = state;
  const count = results?.count || 0;
  switch (e.type) {
    case 'click': {
      switch (currentTarget.id) {
        case 'moreLess': {
          this.setState((prevState: SearchState) => {
            const s: Partial<SearchState> = {
              moreLess: !prevState.moreLess,
            };
            return s;
          });
          break;
        }
        case 'searchButton': {
          search(this).catch((er) => {
            log.error(er);
          });
          break;
        }
        case 'helpButton': {
          if (Build.isElectronApp) G.Commands.searchHelp();
          else {
            this.setState((prevState: SearchState) => {
              const { onlyLucene } = this.props as SearchProps;
              const showHelp = prevState.showHelp ? null : (
                <SearchHelp onlyLucene={onlyLucene} />
              );
              return { showHelp };
            });
          }
          break;
        }
        case 'createIndexButton': {
          const { module } = state;
          const { descriptor } = this.props as SearchProps;
          if (descriptor && module && G.Tab[module]) {
            const s: Partial<SearchState> = {
              searchtype: 'SearchAnyWord',
            };
            this.setState(s);
            const result = await createSearchIndex(
              this,
              module,
              descriptor,
              renderPromise,
            );
            if (result)
              search(this).catch((er) => {
                log.error(er);
              });
          }
          break;
        }
        case 'pagefirst': {
          await updateStateResults(this, { ...state, pageindex: 0 });
          break;
        }
        case 'pagelast': {
          let pageindex = count - C.UI.Search.resultsPerPage;
          if (pageindex < 0) pageindex = 0;
          await updateStateResults(this, { ...state, pageindex });
          break;
        }
        case 'pageprev': {
          let pageindex = state.pageindex - C.UI.Search.resultsPerPage;
          if (pageindex < 0) pageindex = 0;
          await updateStateResults(this, { ...state, pageindex });
          break;
        }
        case 'pagenext': {
          let pageindex = state.pageindex + C.UI.Search.resultsPerPage;
          if (pageindex >= count)
            pageindex = count - C.UI.Search.resultsPerPage;
          if (pageindex < 0) pageindex = 0;
          await updateStateResults(this, { ...state, pageindex });
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
                book: p.shift() as OSISBookType,
                chapter: Number(p.shift()),
                verse: Number(p.shift()),
              };
              if (Build.isWebApp) Commands.setSearchOverlay(null);
              Commands.goToLocationVK(
                l,
                l,
                undefined,
                new RenderPromise(() =>
                  Subscription.publish.setRendererRootState({
                    reset: randomID(),
                  }),
                ),
              );
              break;
            }
            case 'keylink': {
              const module = p.shift();
              if (module && module in G.Tab) {
                if (Build.isWebApp) Commands.setSearchOverlay(null);
                Commands.goToLocationGB(
                  {
                    otherMod: module,
                    key: decodeURIComponent(p.shift() || ''),
                  },
                  undefined,
                  new RenderPromise(() =>
                    Subscription.publish.setRendererRootState({
                      reset: randomID(),
                    }),
                  ),
                );
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
      const targid = currentTarget.id as keyof SearchState;
      const se = target as any;
      switch (targid) {
        case 'displayModule': {
          if (se.value && se.value in G.Tab)
            await updateStateResults(this, {
              ...state,
              displayModule: se.value,
            });
          break;
        }
        case 'module':
        case 'searchtext':
        case 'searchtype':
        case 'scoperadio':
        case 'scopeselect': {
          e.stopPropagation();
          if (
            !['module', 'displayModule'].includes(targid) ||
            (se.value && se.value in G.Tab)
          ) {
            this.setState({ [targid]: se.value });
          }

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

async function updateStateResults(xthis: Search, state: SearchState) {
  let results: SearchState['results'] | null = null;

  try {
    results = await libSwordSearch(xthis, state);
  } catch (er) {
    log.error(er);
  }

  const progress = -1;
  const progressLabel = '';

  xthis.setState({ ...state, results, progress, progressLabel });
}
