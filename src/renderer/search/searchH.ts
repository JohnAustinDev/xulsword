/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
import C from '../../constant';
import { clone, ofClass } from '../../common';
import G from '../rg';

import type { LocationVKType, SearchType } from '../../type';
import type { SearchWinState } from './search';
import type SearchWin from './search';

export const startingState = {
  module: '' as string, // search module
  searchtext: '' as string, // search text
  searchtype: 'SearchExactText' as SearchType['type'], // type of search to do
  scoperadio: 'all' as 'all' | 'ot' | 'nt' | 'book' | 'other', // scope radio value
  scopeselect: 'gospel' as
    | 'custom'
    | 'pentateuch'
    | 'history'
    | 'wisdom'
    | 'prophets'
    | 'gospel'
    | 'letters', // scope select value
  moreLess: false as boolean, // more / less state
  displayBible: '' as string, // current module of Bible search
  results: [] as LocationVKType[],
  pageindex: 0 as number, // first results index to show
  progress: 0 as number, // between 0 and 1
  progressLabel: '' as string, // changing progress label
};

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
