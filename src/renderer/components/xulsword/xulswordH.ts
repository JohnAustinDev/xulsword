import C from '../../../constant.ts';
import RefParser from '../../../refParser.ts';
import { clone, ofClass, randomID, setGlobalPanels } from '../../../common.ts';
import G from '../../rg.ts';
import { genBookAudioFile, verseKeyAudioFile } from '../../rutil.ts';
import { verseKey } from '../../htmlData.ts';
import log from '../../log.ts';
import { chapterChange, verseChange } from '../atext/zversekey.ts';
import { genbookChange } from '../atext/ztext.ts';

import type React from 'react';
import type {
  GenBookAudioFile,
  OSISBookType,
  ShowType,
  VerseKeyAudioFile,
} from '../../../type.ts';
import type {
  BibleBrowserControllerGlobal,
  BibleBrowserControllerState,
} from '../../../browser/bibleBrowser/controller.tsx';
import type Xulsword from './xulsword.tsx';
import type { XulswordState } from './xulsword.tsx';

export default function handler(this: Xulsword, es: React.SyntheticEvent<any>) {
  const { renderPromise } = this;
  const state = this.state as XulswordState;
  const { target } = es;
  const currentId = es.currentTarget?.id;
  switch (es.type) {
    case 'click': {
      const e = es as React.MouseEvent;
      switch (currentId) {
        case 'closeplayer': {
          const audio: XulswordState['audio'] = {
            open: false,
            file: null,
          };
          this.setState({ audio });
          break;
        }
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
                : this.historyMenu(prevState, (e, index) => {
                    this.setHistory(index, true);
                    e.stopPropagation();
                  }),
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
          const tb = tbp?.element.getElementsByTagName('input');
          if (tb) tb[0].select();
          break;
        }
        case 'prevchap':
        case 'nextchap': {
          this.setState((prevState: XulswordState) => {
            const { location } = prevState;
            // TODO!: This v11n is sometimes null for some reason, and causes this
            // operation to fail.
            if (location) {
              const l = verseKey(location, undefined, undefined, renderPromise);
              l.verse = 1;
              const newloc = chapterChange(
                l.location(),
                currentId === 'prevchap' ? -1 : 1,
              );
              if (newloc) {
                const s: Partial<XulswordState> = {
                  location: newloc,
                  selection: null,
                  scroll: { verseAt: 'top' },
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
            const { location } = prevState;
            if (location) {
              const newloc = verseChange(
                location,
                currentId === 'prevverse' ? -1 : 1,
                renderPromise,
              );
              if (newloc) {
                const s: Partial<XulswordState> = {
                  location: newloc,
                  selection: newloc,
                  scroll: { verseAt: 'center' },
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
          if (!module && G.Tabs.length) [{ module }] = G.Tabs;
          const tbp = document.getElementById('searchText');
          const tb = tbp?.getElementsByTagName('input');
          const searchtext = tb?.[0].value;
          if (searchtext && module && module in G.Tab) {
            G.Commands.search({
              module,
              searchtext,
              type: 'SearchAnyWord',
            });
          }
          break;
        }
        case 'headings':
        case 'footnotes':
        case 'crossrefs':
        case 'dictlinks': {
          this.setState((prevState: XulswordState) => {
            let { show } = prevState;
            show = clone(show);
            const id = currentId as keyof ShowType;
            show[id] = !show[id];
            return { show };
          });
          break;
        }
        case 'choosermenu': {
          this.setState((prevState: XulswordState) => {
            let { showChooser } = prevState;
            showChooser = !showChooser;
            return { showChooser };
          });
          break;
        }
        case 'addcolumn':
        case 'removecolumn': {
          setGlobalPanels(G.Prefs, 0, currentId === 'addcolumn' ? 1 : -1);
          const { setBibleBrowserState } =
            window as BibleBrowserControllerGlobal;
          if (setBibleBrowserState) {
            setBibleBrowserState((prevState: BibleBrowserControllerState) => {
              const s = clone(prevState);
              s.renderKey = randomID();
              return s;
            });
          }
          break;
        }
        default:
          throw Error(
            `Unhandled xulswordHandler onClick event on '${currentId}'`,
          );
      }
      break;
    }

    case 'change': {
      // Text inputs use input delay and filtering, meaning that the currentTarget
      // will be the same element as target. So target.id must be used here.
      if (!('value' in es.target)) return;
      if (!('id' in es.target)) return;
      const { id, value } = es.target as { id: string; value: string };
      switch (id) {
        case 'book__menulist__select': {
          this.setState((prevState: XulswordState) => {
            const { location } = prevState;
            if (location) {
              const newloc = verseKey(
                {
                  book: value as OSISBookType,
                  chapter: 1,
                  verse: 1,
                  v11n: location.v11n,
                },
                undefined,
                undefined,
                renderPromise,
              );
              const s: Partial<XulswordState> = {
                location: newloc.location(),
                selection: newloc.location(),
                scroll: { verseAt: 'top' },
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
            const { location } = prevState;
            const newloc = new RefParser(
              G.getLocaleDigits(true),
              G.getLocalizedBooks(true),
              {
                locales: C.Locales.map((l) => l[0]),
              },
            ).parse(value, location?.v11n || null)?.location;
            if (newloc && newloc.book) {
              // Check that the entered location exists.
              if (newloc && !newloc.chapter) newloc.chapter = 1;
              if (newloc && !newloc.verse) newloc.verse = 1;
              if (newloc && verseChange(newloc, 0, renderPromise)) {
                const s: Partial<XulswordState> = {
                  location: newloc,
                  selection: newloc.verse === 1 ? null : newloc,
                  scroll: { verseAt: 'center' },
                  bsreset: prevState.bsreset + 1,
                };
                return s;
              }
            }
            return { bsreset: prevState.bsreset + 1 };
          });
          break;
        }
        case 'chapter__input':
        case 'verse__input': {
          this.setState((prevState: XulswordState) => {
            const { location } = prevState;
            // reset Bookselect on Enter key even if chapter doesn't change
            const bsreset = prevState.bsreset + 1;
            if (location) {
              const pvk = verseKey(
                location,
                undefined,
                undefined,
                renderPromise,
              );
              let newloc;
              if (id === 'chapter__input') {
                pvk.chapter = Number(value);
                pvk.verse = 1;
                newloc = chapterChange(pvk.location(), 0);
              } else {
                pvk.verse = Number(value);
                newloc = verseChange(pvk.location(), 0, renderPromise);
              }
              if (newloc) {
                const s: Partial<XulswordState> = {
                  location: newloc,
                  selection: newloc,
                  scroll: { verseAt: 'top' },
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
            `Unhandled xulswordHandler onChange event on '${currentId}'`,
          );
      }
      break;
    }

    case 'canplay': {
      const player: HTMLAudioElement | undefined = document
        .getElementById('player')
        ?.getElementsByTagName('audio')[0];
      if (player)
        player.play().catch((er) => {
          log.error(er);
        });
      break;
    }

    case 'ended': {
      const { audio } = state;
      const { file } = audio;
      let afile: VerseKeyAudioFile | GenBookAudioFile | null = null;
      if (file) {
        const { swordModule } = file;
        if (swordModule) {
          if ('book' in file) {
            const { book, chapter } = file;
            const nk = chapterChange(
              verseKey(
                {
                  book,
                  chapter,
                  v11n: G.Tab[swordModule].v11n || null,
                },
                undefined,
                undefined,
                renderPromise,
              ),
              1,
            );
            if (nk)
              afile = verseKeyAudioFile(
                swordModule,
                nk.book || undefined,
                nk.chapter,
              );
          } else if ('key' in file) {
            const { key: k } = file;
            const key = genbookChange(swordModule, k, true);
            if (key) {
              afile = genBookAudioFile(swordModule, key);
            }
          }
        }
      }
      G.Commands.playAudio(afile); // null closes the player
      break;
    }

    default:
      throw Error(`Unhandled xulswordHandler event type '${es.type}'`);
  }
}
