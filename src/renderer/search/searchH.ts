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

async function search(s: SearchWinState) {
  return false;
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
          search(state);
          break;
        }
        case 'helpButton': {
          break;
        }
        case 'createIndexButton': {
          const { module } = state;
          if (module && G.Tab[module]) {
            G.Window.modal('installing', 'all');
            const s: Partial<SearchWinState> = {
              results: [],
              pageindex: 0,
              progress: 0.01,
              progressLabel: i18n.t('BuildingIndex'),
            };
            this.setState(s);
            if (G.LibSword.luceneEnabled(module)) {
              G.LibSword.searchIndexDelete(module);
            }
            G.LibSword.searchIndexBuild(module)
              .then(() => {
                G.Window.modal('off', 'all');
                this.setState({ progress: 0 });
                return search(state);
              })
              .catch((er: Error) => {
                G.Window.modal('off', 'all');
                log.error(er);
              });
          }
          break;
        }
        case 'pagefirst': {
          break;
        }
        case 'pagelast': {
          break;
        }
        case 'pageprev': {
          break;
        }
        case 'pagenext': {
          break;
        }
        case 'stopSearch': {
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
