/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
import i18n from 'i18next';
import C from '../../constant';
import { clone, ofClass } from '../../common';
import G from '../rg';

import type { LocationVKType, SearchType } from '../../type';
import type { SearchWinState } from './search';
import type SearchWin from './search';
import { log } from '../rutil';

export const ResultsPerPage = 30;

export async function search(sthis: SearchWin) {
  const state = sthis.state as SearchWinState;
  const { module, displayBible: db } = state;
  if (state.progress !== 0) return false;
  if (!/\w\w/.test(state.searchtext)) return false;
  if (!module) return false;

  const hasIndex = G.LibSword.luceneEnabled(module);
  const isBible = G.Tab[module].type === C.BIBLE;
  const displayBible = isBible ? module : db;

  const s: Partial<SearchWinState> = {
    results: [],
    pageindex: 0,
    progress: hasIndex ? 0 : 0.01,
    progressLabel: i18n.t('SEARCHING'),
    displayBible,
  };
  sthis.setState(s);
  // TODO!: Search

  s.progress = 0;
  sthis.setState(s);
  return true;
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
          break;
        }
        case 'createIndexButton': {
          const { module } = state;
          if (module && G.Tab[module]) {
            G.Window.modal('darkened', 'all');
            const s: Partial<SearchWinState> = {
              results: [],
              pageindex: 0,
              progress: -1,
              progressLabel: i18n.t('BuildingIndex'),
            };
            this.setState(s);
            if (G.LibSword.luceneEnabled(module)) {
              G.LibSword.searchIndexDelete(module);
            }
            // The timeout allows UI to catch up before indexing begins,
            // which is still required even though indexing is anync.
            setTimeout(() => {
              G.LibSword.searchIndexBuild(module)
                .then(() => {
                  G.Window.modal('off', 'all');
                  this.setState({ progress: 0 });
                  return search(this);
                })
                .catch((er: Error) => {
                  log.error(er);
                  G.Window.modal('off', 'all');
                });
            }, 100);
          }
          break;
        }
        case 'pagefirst': {
          this.setState({ pageindex: 0 });
          break;
        }
        case 'pagelast': {
          let pageindex = state.results.length - ResultsPerPage;
          if (pageindex < 0) pageindex = 0;
          this.setState({ pageindex });
          break;
        }
        case 'pageprev': {
          let pageindex = state.pageindex - ResultsPerPage;
          if (pageindex < 0) pageindex = 0;
          this.setState({ pageindex });
          break;
        }
        case 'pagenext': {
          let pageindex = state.pageindex + ResultsPerPage;
          if (pageindex >= state.results.length)
            pageindex = state.results.length - ResultsPerPage;
          if (pageindex < 0) pageindex = 0;
          this.setState({ pageindex });
          break;
        }

        default:
          throw Error(`Unhandled searchH click on id '${target.id}'`);
      }
      break;
    }
    case 'change': {
      const targid = currentTarget.id as keyof SearchWinState;
      switch (targid) {
        case 'module':
        case 'displayBible':
        case 'searchtype':
        case 'scoperadio':
        case 'scopeselect': {
          const se = target as any;
          this.setState({ [targid]: se.value });
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
