/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import C from '../../constant';
import { ofClass } from '../../common';
import { chapterChange, verseChange } from '../viewport/zversekey';
import { refParser, verseKey } from '../rutil';
import G from '../rg';

import type { ShowType } from '../../type';
import type Xulsword from './xulsword';
import type { XulswordState } from './xulsword';

const parser = refParser();

export default function handler(this: Xulsword, es: React.SyntheticEvent<any>) {
  const state = this.state as XulswordState;
  const target = es.target as HTMLElement;
  const currentId = es.currentTarget?.id;
  switch (es.type) {
    case 'click': {
      const e = es as React.MouseEvent;
      switch (currentId) {
        case 'back': {
          this.setHistory(state.historyIndex + 1);
          break;
        }
        case 'historymenu': {
          e.stopPropagation();
          this.setState((prevState: XulswordState) => {
            if (!prevState.location) return null;
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
        case 'prevchap':
        case 'nextchap': {
          this.setState((prevState: XulswordState) => {
            const { location, flagScroll } = prevState;
            if (location) {
              const newloc = chapterChange(
                location,
                currentId === 'prevchap' ? -1 : 1
              );
              if (newloc) {
                const s: Partial<XulswordState> = {
                  location: newloc,
                  selection: null,
                  flagScroll: flagScroll.map(() => C.VSCROLL.chapter),
                };
                return s;
              }
            }
            return null;
          });
          break;
        }
        case 'prevverse':
        case 'nextverse': {
          this.setState((prevState: XulswordState) => {
            const { location, flagScroll } = prevState;
            if (location) {
              const newloc = verseChange(
                location,
                currentId === 'prevverse' ? -1 : 1
              );
              if (newloc) {
                const s: Partial<XulswordState> = {
                  location: newloc,
                  selection: newloc,
                  flagScroll: flagScroll.map(() => C.VSCROLL.centerAlways),
                };
                return s;
              }
            }
            return null;
          });
          break;
        }
        case 'searchButton': {
          let module = state.panels.find((m) => m);
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
        case 'headings':
        case 'footnotes':
        case 'crossrefs':
        case 'dictlinks': {
          this.setState((prevState: XulswordState) => {
            const { show } = prevState;
            const id = currentId as keyof ShowType;
            show[id] = !show[id];
            return { show };
          });
          break;
        }
        default:
          throw Error(
            `Unhandled xulswordHandler onClick event on '${currentId}'`
          );
      }
      break;
    }

    case 'change': {
      // Text inputs use input delay and filtering, meaning that the currentTarget
      // will be the same element as target. So target.id must be used here.
      if (!('value' in es.target)) return;
      if (!('id' in es.target)) return;
      const { id, value } = es.target as any;
      switch (id) {
        case 'book__menulist__select': {
          this.setState((prevState: XulswordState) => {
            const { flagScroll, location } = prevState;
            if (location) {
              const newloc = verseKey({
                book: value,
                chapter: 1,
                verse: 1,
                v11n: location.v11n,
              });
              const s: Partial<XulswordState> = {
                location: newloc.location(),
                selection: newloc.location(),
                flagScroll: flagScroll.map(() => C.VSCROLL.center),
                bsreset: prevState.bsreset + 1,
              };
              return s;
            }
            return null;
          });
          break;
        }
        case 'book__textbox__input': {
          this.setState((prevState: XulswordState) => {
            const { flagScroll, location } = prevState;
            const newloc = parser.parse(
              value,
              location?.v11n || 'KJV'
            )?.location;
            // Check that the entered location exists.
            if (newloc && !newloc.chapter) newloc.chapter = 1;
            if (newloc && !newloc.verse) newloc.verse = 1;
            if (newloc && verseChange(newloc, 0)) {
              const s: Partial<XulswordState> = {
                location: newloc,
                selection: newloc,
                flagScroll: flagScroll.map(() => C.VSCROLL.center),
                bsreset: prevState.bsreset + 1,
              };
              return s;
            }
            return { bsreset: prevState.bsreset + 1 };
          });
          break;
        }
        case 'chapter__input':
        case 'verse__input': {
          this.setState((prevState: XulswordState) => {
            const { flagScroll, location } = prevState;
            // reset Bookselect on Enter key even if chapter doesn't change
            const bsreset = prevState.bsreset + 1;
            if (location) {
              const pvk = verseKey(location);
              let newloc;
              if (id === 'chapter__input') {
                pvk.chapter = Number(value);
                newloc = chapterChange(pvk.location());
              } else {
                pvk.verse = Number(value);
                newloc = verseChange(pvk.location());
              }
              if (newloc) {
                const s: Partial<XulswordState> = {
                  location: newloc,
                  selection: newloc,
                  flagScroll: flagScroll.map(() =>
                    id === 'chapter__input'
                      ? C.VSCROLL.chapter
                      : C.VSCROLL.verse
                  ),
                  bsreset,
                };
                return s;
              }
            }
            return { bsreset };
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
            `Unhandled xulswordHandler onChange event on '${currentId}'`
          );
      }
      break;
    }

    default:
      throw Error(`Unhandled xulswordHandler event type '${es.type}'`);
  }
}
