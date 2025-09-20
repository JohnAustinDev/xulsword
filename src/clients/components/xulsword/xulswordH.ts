import C from '../../../constant.ts';
import { playAudio } from '../../../commands.ts';
import VerseKey from '../../../verseKey.ts';
import RefParser from '../../../refParser.ts';
import Subscription from '../../../subscription.ts';
import analytics from '../../analytics.ts';
import { clone, ofClass, randomID, setGlobalPanels } from '../../../common.ts';
import { G } from '../../G.ts';
import {
  doUntilDone,
  audioSelections,
  Events,
  eventHandled,
  isBlocked,
} from '../../common.ts';
import log from '../../log.ts';
import { chapterChange, verseChange } from '../atext/zversekey.ts';
import { genbookChange } from '../atext/ztext.ts';

import type React from 'react';
import type {
  AudioPlayerSelectionGB,
  OSISBookType,
  SearchType,
  ShowType,
  AudioPlayerSelectionVK,
  AudioPrefType,
  GType,
} from '../../../type.ts';
import type S from '../../../defaultPrefs.ts';
import type { AnalyticsInfo } from '../../analytics.ts';
import type Xulsword from './xulsword.tsx';
import type { XulswordState } from './xulsword.tsx';

export default function handler(
  this: Xulsword,
  e: React.SyntheticEvent | PointerEvent,
) {
  if (isBlocked(e)) return;
  const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : (e as Event);
  const _ep = nativeEvent instanceof PointerEvent ? nativeEvent : null;
  const { state } = this;
  const { target, currentTarget } = e;
  const currentId =
    currentTarget instanceof HTMLElement ? currentTarget.id : undefined;
  switch (e.type) {
    case 'pointerdown': {
      switch (currentId) {
        case 'closeplayer': {
          const audio: XulswordState['audio'] = {
            open: false,
            file: null,
            defaults: state.audio.defaults,
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
          this.setState((prevState) => {
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
          doUntilDone((rp) => {
            if (rp) {
              this.setState((prevState) => {
                const { location } = prevState;
                if (location) {
                  const l = new VerseKey(location, rp);
                  l.verse = 1;
                  const newloc = chapterChange(
                    l.location(),
                    currentId === 'prevchap' ? -1 : 1,
                    rp,
                  );
                  if (newloc) {
                    return rp?.waiting()
                      ? null
                      : {
                          location: newloc,
                          selection: null,
                          scroll: { verseAt: 'top' },
                        };
                  }
                }
                return null;
              });
            }
          });
          break;
        }
        case 'prevverse':
        case 'nextverse': {
          doUntilDone((rp) => {
            if (rp) {
              this.setState((prevState) => {
                const { location } = prevState;
                if (location) {
                  const newloc = verseChange(
                    location,
                    currentId === 'prevverse' ? -1 : 1,
                    rp,
                  );
                  if (newloc) {
                    return rp?.waiting()
                      ? null
                      : {
                          location: newloc,
                          selection: newloc,
                          scroll: { verseAt: 'center' },
                        };
                  }
                }
                return null;
              });
            }
          });
          break;
        }
        case 'xsSearchButton': {
          let module = state.panels.find((m) => m);
          if (!module && G.Tabs.length) [{ module }] = G.Tabs;
          const tbp = document.getElementById('xsSearchText');
          const tb = tbp?.getElementsByTagName('input');
          const searchtext = tb?.[0].value;
          if (searchtext && module && module in G.Tab) {
            const search: SearchType = {
              module,
              searchtext,
              type: 'SearchAnyWord',
            };
            if (Build.isElectronApp) (G as GType).Commands.search(search);
            else
              Subscription.publish.setControllerState(
                {
                  reset: randomID(),
                  card: {
                    name: 'search',
                    props: { initialState: search, onlyLucene: true },
                  },
                },
                true,
              );
          }
          break;
        }
        case 'headings':
        case 'footnotes':
        case 'crossrefs':
        case 'dictlinks': {
          this.setState((prevState) => {
            let { show } = prevState;
            show = clone(show);
            const id = currentId as keyof ShowType;
            show[id] = !show[id];
            // Web app uses fewer buttons but that control multiple options.
            if (Build.isWebApp) {
              if (currentId === 'footnotes') {
                show['crossrefs'] = show[id];
              } else if (currentId === 'dictlinks') {
                show['strongs'] = show[id];
                show['morph'] = show[id];
              }
            }
            return { show };
          });
          break;
        }
        case 'choosermenu': {
          this.setState((prevState) => {
            let { showChooser } = prevState;
            showChooser = !showChooser;
            return { showChooser };
          });
          break;
        }
        case 'addcolumn': {
          setGlobalPanels(G.Prefs, 0, 1);
          // Set newly added panel to a StrongsNumbers module if such a tab is
          // available.
          const xulsword = G.Prefs.getComplexValue(
            'xulsword',
          ) as typeof S.prefs.xulsword;
          const { panels, tabs } = xulsword;
          const i = panels.length - 1;
          if (tabs[i]) {
            const module = tabs[i].find(
              (m) =>
                m in G.Tab &&
                G.Tab[m].tabType === 'Texts' &&
                G.Tab[m].features.includes('StrongsNumbers'),
            );
            if (module) {
              panels[i] = module;
              G.Prefs.setComplexValue('xulsword.panels', panels);
            }
          }
          Subscription.publish.setControllerState({ reset: randomID() }, false);
          break;
        }
        case 'removecolumn': {
          setGlobalPanels(G.Prefs, 0, -1);
          Subscription.publish.setControllerState({ reset: randomID() }, false);
          break;
        }
        default:
          throw Error(
            `Unhandled xulswordHandler onPointerDown event on '${currentId}'`,
          );
      }
      break;
    }

    case 'change': {
      // Text inputs use input delay and filtering, meaning that the currentTarget
      // will be the same element as target. So target.id must be used here.
      if (!target || !('value' in target)) return;
      if (!target || !('id' in target)) return;
      const { id, value } = target as { id: string; value: string };
      doUntilDone((rp) => {
        if (rp) {
          switch (id) {
            case 'book__menulist__select': {
              this.setState((prevState) => {
                const { location } = prevState;
                if (location) {
                  const newloc = new VerseKey(
                    {
                      book: value as OSISBookType,
                      chapter: 1,
                      verse: 1,
                      v11n: location.v11n,
                    },
                    rp,
                  );
                  return rp?.waiting()
                    ? null
                    : {
                        location: newloc.location(),
                        selection: newloc.location(),
                        scroll: { verseAt: 'top' },
                        bsreset: prevState.bsreset + 1,
                      };
                }
                return null;
              });
              break;
            }
            case 'book__textbox__input': {
              this.setState((prevState) => {
                const { location } = prevState;
                const newloc = new RefParser(null, {
                  locales: Build.isElectronApp
                    ? C.Locales.map((l) => l[0])
                    : [G.i18n.language],
                }).parse(value, location?.v11n || null)?.location;
                if (newloc && newloc.book) {
                  // Check that the entered location exists.
                  if (!newloc.chapter) newloc.chapter = 1;
                  if (!newloc.verse) newloc.verse = 1;
                  if (verseChange(newloc, 0, rp) && !rp?.waiting()) {
                    return {
                      location: newloc,
                      selection: newloc.verse === 1 ? null : newloc,
                      scroll: { verseAt: 'center' },
                      bsreset: prevState.bsreset + 1,
                    } as XulswordState;
                  }
                }
                if (!rp?.waiting()) return { bsreset: prevState.bsreset + 1 };
                return null;
              });
              break;
            }
            case 'chapter__input':
            case 'verse__input': {
              this.setState((prevState) => {
                const { location } = prevState;
                // reset Bookselect on Enter key even if chapter doesn't change
                const bsreset = prevState.bsreset + 1;
                if (location) {
                  const pvk = new VerseKey(location, rp);
                  let newloc;
                  if (id === 'chapter__input') {
                    pvk.chapter = Number(value);
                    pvk.verse = 1;
                    newloc = chapterChange(pvk.location(), 0, rp);
                  } else {
                    pvk.verse = Number(value);
                    newloc = verseChange(pvk.location(), 0, rp);
                  }
                  if (newloc && !rp?.waiting())
                    return {
                      location: newloc,
                      selection: newloc,
                      scroll: { verseAt: 'top' },
                      bsreset,
                    } as XulswordState;
                }
                if (!rp.waiting()) return { bsreset };
                return null;
              });
              break;
            }
            case 'xsSearchText__input': {
              const enable = /\S+/.test(value);
              if (state.searchDisabled === enable)
                this.setState({ searchDisabled: !enable });
              break;
            }
            case 'audioCodeSelect__select': {
              const { audio: a } = this.state;
              const { open, file, defaults: d } = clone(a);
              if (file) {
                const { swordModule } = file;
                if (swordModule) {
                  doUntilDone((rp) => {
                    const sels = audioSelections(file, rp);
                    if (!rp?.waiting()) {
                      const defaults = d ?? {};
                      defaults[swordModule] = value;
                      if (sels.length && swordModule in defaults)
                        sels.sort((a) =>
                          a.conf.module === defaults[swordModule] ? -1 : 0,
                        );
                      const audio: AudioPrefType = {
                        open,
                        defaults,
                        file: sels[0]?.selection ?? null,
                      };
                      this.setState({ audio });
                    }
                  });
                }
              }
              break;
            }
            default:
              if (Build.isDevelopment)
                log.warn(`Unhandled xulswordHandler onChange event on '${id}'`);
              return;
          }
        }
      });
      break;
    }

    case 'play': {
      const { file } = state.audio;
      if (file) {
        const { audioModule } = file;
        const AudioCode = audioModule ?? 'unknown';
        let info: AnalyticsInfo;
        if ('key' in file) {
          const { key } = file;
          info = {
            event: 'playAudio',
            AudioCode,
            locationky: key ?? 'unknown',
          };
        } else {
          const { book, chapter } = 'book' in file ? file : {};
          info = {
            event: 'playAudio',
            AudioCode,
            book: book ?? 'unkown',
            chapter: chapter ?? -1,
          };
        }
        analytics.recordElementEvent(info, target as HTMLElement);
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
      const { open, file, defaults } = clone(audio);
      doUntilDone((rp) => {
        if (rp && file) {
          const { swordModule } = file;
          if (swordModule && swordModule in G.Tab) {
            let selection:
              | AudioPlayerSelectionVK
              | AudioPlayerSelectionGB
              | null = null;
            if ('book' in file) {
              const { book, chapter } = file;
              if (
                typeof book !== 'undefined' &&
                typeof chapter !== 'undefined'
              ) {
                const nk = chapterChange(
                  new VerseKey(
                    {
                      book,
                      chapter,
                      v11n: G.Tab[swordModule].v11n || null,
                    },
                    rp,
                  ),
                  1,
                  rp,
                );
                if (nk)
                  selection = {
                    swordModule,
                    book: nk.book,
                    chapter: nk.chapter,
                  };
              }
            } else if ('key' in file) {
              const { key: k } = file;
              if (k) {
                const key = genbookChange(swordModule, k, true, rp);
                if (key) {
                  selection = {
                    swordModule,
                    key,
                  };
                }
              }
            }
            const sels = audioSelections(selection, rp);
            if (!rp?.waiting()) {
              if (defaults && swordModule in defaults)
                sels.sort((a) =>
                  a.conf.module === defaults[swordModule] ? -1 : 0,
                );
              void playAudio({
                open,
                // null closes the player
                file: sels[0]?.selection ?? null,
                defaults,
              });
            }
          }
        }
      });
      break;
    }

    default:
      if (Build.isDevelopment)
        log.warn(`Unhandled xulswordHandler event type '${e.type}'`);
      return;
  }

  eventHandled(e);
}
