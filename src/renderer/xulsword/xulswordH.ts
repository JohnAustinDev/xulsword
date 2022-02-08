/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-loop-func */
import React from 'react';
import C from '../../constant';
import { ofClass } from '../../common';
import { chapterChange, verseChange } from '../viewport/zversekey';
import { jsdump, parseLocation } from '../rutil';
import G from '../rg';

import type Xulsword from './xulsword';
import type { XulswordState } from './xulsword';

export default function handler(this: Xulsword, es: React.SyntheticEvent<any>) {
  const state = this.state as XulswordState;
  switch (es.type) {
    case 'click': {
      const e = es as React.MouseEvent;
      const target = e.target as HTMLElement;
      switch (e.currentTarget.id) {
        case 'back': {
          this.setHistory(state.historyIndex + 1);
          break;
        }
        case 'historymenu': {
          e.stopPropagation();
          this.setState((prevState: XulswordState) => {
            if (!prevState.windowV11n) return null;
            return {
              historyMenupopup: prevState.historyMenupopup
                ? undefined
                : this.historyMenu(prevState),
            };
          });
          break;
        }
        case 'forward': {
          this.setHistory(state.historyIndex - 1);
          break;
        }
        case 'chapter':
        case 'verse': {
          const tbp = ofClass(['textbox'], target);
          const tb = tbp && tbp.element.getElementsByTagName('input');
          if (tb) tb[0].select();
          break;
        }
        case 'prevchap': {
          this.setState((prevState: XulswordState) => {
            const { flagScroll } = prevState;
            const s = chapterChange(prevState.book, prevState.chapter, -1);
            if (!s) return null;
            s.selection = '';
            s.flagScroll = flagScroll.map(() => C.VSCROLL.chapter);
            return s;
          });
          break;
        }
        case 'nextchap': {
          this.setState((prevState: XulswordState) => {
            const { v11nmod, flagScroll } = prevState;
            if (!v11nmod) return null;
            const maxch = G.LibSword.getMaxChapter(v11nmod, prevState.book);
            const s = chapterChange(
              prevState.book,
              prevState.chapter,
              1,
              maxch
            );
            if (!s) return null;
            s.selection = '';
            s.flagScroll = flagScroll.map(() => C.VSCROLL.chapter);
            return s;
          });
          break;
        }
        case 'prevverse': {
          this.setState((prevState: XulswordState) => {
            const { v11nmod, flagScroll } = prevState;
            if (!v11nmod) return null;
            const s = verseChange(
              v11nmod,
              prevState.book,
              prevState.chapter,
              prevState.verse,
              -1
            );
            if (!s) return null;
            s.selection = [s.book, s.chapter, s.verse, s.verse].join('.');
            s.flagScroll = flagScroll.map(() => C.VSCROLL.centerAlways);
            return s;
          });
          break;
        }
        case 'nextverse': {
          this.setState((prevState: XulswordState) => {
            const { v11nmod, flagScroll } = prevState;
            if (!v11nmod) return null;
            const s = verseChange(
              v11nmod,
              prevState.book,
              prevState.chapter,
              prevState.verse,
              1
            );
            if (!s) return null;
            s.selection = [s.book, s.chapter, s.verse, s.verse].join('.');
            s.flagScroll = flagScroll.map(() => C.VSCROLL.centerAlways);
            return s;
          });
          break;
        }
        case 'searchButton': {
          let module = state.v11nmod;
          if (!module && G.Tabs.length) module = G.Tabs[0].module;
          const tbp = document.getElementById('searchText');
          const tb = tbp && tbp.getElementsByTagName('input');
          const searchtext = tb && tb[0].value;
          if (searchtext && module && module in G.Tab) {
            G.Commands.search({
              module,
              searchtext,
              type: 'SearchExactText',
            });
          }
          break;
        }
        case 'hdbutton': {
          this.setState((prevState: XulswordState) => {
            const { show } = prevState;
            show.headings = !show.headings;
            return { show };
          });
          break;
        }
        case 'fnbutton': {
          this.setState((prevState: XulswordState) => {
            const { show } = prevState;
            show.footnotes = !show.footnotes;
            return { show };
          });
          break;
        }
        case 'crbutton': {
          this.setState((prevState: XulswordState) => {
            const { show } = prevState;
            show.crossrefs = !show.crossrefs;
            return { show };
          });
          break;
        }
        case 'dtbutton': {
          this.setState((prevState: XulswordState) => {
            const { show } = prevState;
            show.dictlinks = !show.dictlinks;
            return { show };
          });
          break;
        }
        default:
          throw Error(
            `Unhandled xulswordHandler onClick event on '${es.currentTarget.id}'`
          );
      }
      break;
    }

    case 'change': {
      if (!('value' in es.target)) return;
      if (!('id' in es.target)) return;
      const { id, value } = es.target as any;
      switch (id) {
        case 'book__textbox__input':
        case 'book__menulist__select': {
          this.setState((prevState: XulswordState) => {
            const { flagScroll: pfs } = prevState;
            // reset Bookselect even if book doesn't change
            const bsreset = prevState.bsreset + 1;
            const location = parseLocation(value);
            if (location !== null) {
              // eslint-disable-next-line prefer-const
              let { book, chapter, verse, lastverse } = location;
              if (book) {
                if (!chapter) chapter = 1;
                if (!verse) verse = 1;
                const selection = [book, chapter, verse, lastverse].join('.');
                const flagScroll = pfs.map(() => C.VSCROLL.center);
                const s: Partial<XulswordState> = {
                  book,
                  chapter,
                  verse,
                  selection,
                  bsreset,
                  flagScroll,
                };
                return s;
              }
            }
            return { bsreset };
          });
          break;
        }
        case 'chapter__input': {
          this.setState((prevState: XulswordState) => {
            const { v11nmod, flagScroll } = prevState;
            if (!v11nmod) return null;
            const maxch = G.LibSword.getMaxChapter(v11nmod, prevState.book);
            const s = chapterChange(prevState.book, Number(value), 0, maxch);
            if (!s) return null;
            s.selection = '';
            s.flagScroll = flagScroll.map(() => C.VSCROLL.chapter);
            return s;
          });
          break;
        }
        case 'verse__input': {
          this.setState((prevState: XulswordState) => {
            const { v11nmod, flagScroll } = prevState;
            if (!v11nmod) return null;
            const s = verseChange(
              v11nmod,
              prevState.book,
              prevState.chapter,
              Number(value)
            );
            if (!s) return null;
            s.selection = [s.book, s.chapter, s.verse, s.verse].join('.');
            s.flagScroll = flagScroll.map(() => C.VSCROLL.centerAlways);
            return s;
          });
          break;
        }
        case 'searchText__input': {
          const enable = /\S+/.test(value);
          if (state.searchDisabled === enable)
            this.setState({ searchDisabled: !enable });
          break;
        }
        default:
          throw Error(
            `Unhandled xulswordHandler onChange event on '${es.currentTarget.id}'`
          );
      }
      break;
    }

    case 'keydown': {
      const ek = es as React.KeyboardEvent;
      const ea = es as any;
      const id = ea.target?.id ? ea.target.id : null;
      switch (id) {
        case 'searchText__input': {
          if (ek.key === 'Enter') {
            jsdump(`search Enter not yet implemented`);
          }
          break;
        }
        default:
          throw Error(
            `Unhandled xulswordHandler onKeyDown event on '${es.currentTarget.id}'`
          );
      }
      break;
    }

    default:
      throw Error(`Unhandled xulswordHandler event type '${es.type}'`);
  }
}
