/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-loop-func */
import React from 'react';
import C from '../../constant';
// eslint-disable-next-line import/no-cycle
import { chapterChange, verseChange } from '../viewport/zversekey';
// eslint-disable-next-line import/no-cycle
import { jsdump, parseLocation } from '../rutil';
import G from '../rg';
// eslint-disable-next-line import/no-cycle
import Xulsword, { XulswordState } from './xulsword';

export default function handler(this: Xulsword, e: React.SyntheticEvent<any>) {
  const state = this.state as XulswordState;
  const { versification, v11nmod } = this;
  switch (e.type) {
    case 'click':
      switch (e.currentTarget.id) {
        case 'back':
          this.setHistory(state.historyIndex + 1);
          break;
        case 'historymenu': {
          e.stopPropagation();
          if (versification) {
            this.setState((prevState: XulswordState) => {
              return {
                historyMenupopup: prevState.historyMenupopup
                  ? undefined
                  : this.historyMenu(versification),
              };
            });
          }
          break;
        }
        case 'forward':
          this.setHistory(state.historyIndex - 1);
          break;

        case 'chapter':
        case 'verse': {
          const t: any = e.target;
          if ('select' in t) t.select();
          break;
        }

        case 'prevchap':
          this.setState((prevState: XulswordState) => {
            return chapterChange(prevState.book, prevState.chapter, -1);
          });
          break;
        case 'nextchap': {
          if (v11nmod) {
            this.setState((prevState: XulswordState) => {
              const maxch = G.LibSword.getMaxChapter(v11nmod, prevState.book);
              return chapterChange(prevState.book, prevState.chapter, 1, maxch);
            });
          }
          break;
        }
        case 'prevverse':
          this.setState((prevState: XulswordState) => {
            const r = verseChange(
              this.v11nmod,
              prevState.book,
              prevState.chapter,
              prevState.verse,
              -1
            ) as any;
            if (!r) return null;
            r.selection = [r.book, r.chapter, r.verse, r.verse].join('.');
            return r;
          });
          break;
        case 'nextverse':
          this.setState((prevState: XulswordState) => {
            const r = verseChange(
              this.v11nmod,
              prevState.book,
              prevState.chapter,
              prevState.verse,
              1
            ) as any;
            if (!r) return null;
            r.selection = [r.book, r.chapter, r.verse, r.verse].join('.');
            return r;
          });
          break;

        case 'searchButton':
          jsdump(`searchButton click not yet implemented`);
          break;

        case 'hdbutton':
          this.setState((prevState: XulswordState) => {
            const { show } = prevState;
            show.headings = !show.headings;
            return { show };
          });
          break;
        case 'fnbutton':
          this.setState((prevState: XulswordState) => {
            const { show } = prevState;
            show.footnotes = !show.footnotes;
            return { show };
          });
          break;
        case 'crbutton':
          this.setState((prevState: XulswordState) => {
            const { show } = prevState;
            show.crossrefs = !show.crossrefs;
            return { show };
          });
          break;
        case 'dtbutton':
          this.setState((prevState: XulswordState) => {
            const { show } = prevState;
            show.dictlinks = !show.dictlinks;
            return { show };
          });
          break;

        default:
          throw Error(
            `Unhandled xulswordHandler onClick event on '${e.currentTarget.id}'`
          );
      }
      break;

    case 'change': {
      if (!('value' in e.target)) return;
      if (!('id' in e.target)) return;
      const { id, value } = e.target as any;
      switch (id) {
        case 'book__textbox__input':
        case 'book__menulist__select': {
          this.setState((prevState: XulswordState) => {
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
                const flagScroll = [];
                for (let x = 0; x < C.NW; x += 1) {
                  flagScroll.push(C.SCROLLTYPECENTER);
                }
                return { book, chapter, verse, selection, bsreset, flagScroll };
              }
            }
            return { bsreset };
          });
          break;
        }
        case 'chapter__input': {
          if (v11nmod) {
            this.setState((prevState: XulswordState) => {
              const maxch = G.LibSword.getMaxChapter(v11nmod, prevState.book);
              return chapterChange(prevState.book, Number(value), 0, maxch);
            });
          }
          break;
        }

        case 'verse__input':
          this.setState((prevState: XulswordState) => {
            const r = verseChange(
              this.v11nmod,
              prevState.book,
              prevState.chapter,
              Number(value)
            ) as any;
            if (!r) return null;
            r.selection = [r.book, r.chapter, r.verse, r.verse].join('.');
            return r;
          });
          break;

        case 'searchText__input': {
          const enable = /\S+/.test(value);
          if (state.searchDisabled === enable)
            this.setState({ searchDisabled: !enable });
          break;
        }

        default:
          throw Error(
            `Unhandled xulswordHandler onChange event on '${e.currentTarget.id}'`
          );
      }
      break;
    }

    case 'keydown': {
      const ek = e as React.KeyboardEvent;
      const ea = e as any;
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
            `Unhandled xulswordHandler onKeyDown event on '${e.currentTarget.id}'`
          );
      }
      break;
    }

    default:
      throw Error(`Unhandled xulswordHandler event type '${e.type}'`);
  }
}
