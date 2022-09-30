/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
import C from '../../constant';
import { clone, ofClass } from '../../common';
import G from '../rg';

import type { LocationVKType, SearchType } from '../../type';
import type { SearchWinState } from './search';
import type SearchWin from './search';

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
          break;
        }
        case 'helpButton': {
          break;
        }
        case 'createIndexButton': {
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
