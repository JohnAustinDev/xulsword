import type React from 'react';
import Subscription from '../../../subscription.ts';
import {
  cleanDoubleClickSelection,
  clone,
  ofClass,
  randomID,
} from '../../../common.ts';
import { sanitizeHTML } from '../../../sanitizeHTML.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import {
  doUntilDone,
  eventHandled,
  getExtRefHTML,
  isBlockedEvent,
  cancelStrongsHiLights,
  strongsHilights,
} from '../../common.ts';
import log from '../../log.ts';
import { getElementData } from '../../htmlData.ts';
import { getRootNode, getSelection } from '../../rootNode.ts';
import { onVersenumClick } from '../../audioTiming.ts';
import { imageZoomCursor, imageZoomToggle } from '../../imageZoom.ts';
import { delayHandler } from '../libxul/xul.tsx';
import { aTextWheelScroll, getScrollVerse } from './zversekey.ts';

import type S from '../../../defaultPrefs.ts';
import type { GType, SearchType, TextualVariantType } from '../../../type.ts';
import type Atext from './atext.tsx';

function scroll2Note(atext: HTMLElement, id: string) {
  Array.from(atext.getElementsByClassName('fnselected')).forEach((note) => {
    note.classList.remove('fnselected');
  });
  const note = getRootNode().getElementById(id);
  if (!note) return false;
  note.classList.add('fnselected');
  const nb = atext.querySelector('.nb');
  if (nb) {
    nb.scrollTop = note.offsetTop;
  }
  return true;
}

// Event handler for a text pane's content.
export default function handler(this: Atext, e: React.SyntheticEvent | Event) {
  if (isBlockedEvent(e)) return;
  const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : (e as Event);
  const ep = nativeEvent instanceof PointerEvent ? nativeEvent : null;
  const { pointerType } = ep ?? {};
  switch (e.type) {
    case 'pointerdown': {
      const { target } = e;
      if (ofClass(['npopup'], target)) return;
      const targ = ofClass(
        [
          'cr',
          'crtwisty',
          'versePerLineButton',
          'image-viewport',
          'dictkeyinput',
          'versenum',
          'notebox-maximizer',
        ],
        target,
      );
      if (!targ) return;
      const { props } = this;
      const { module, panelIndex: index } = props;
      const atext = e.currentTarget as HTMLElement;
      if (e.cancelable) e.preventDefault();
      let popupParent: any = ofClass(['npopup'], target);
      popupParent = popupParent ? popupParent.element : null;
      const elem = targ.element;
      const p = getElementData(elem);
      const { title, type: ptype } = p;
      switch (targ.type) {
        case 'cr':
        case 'crtwisty':
          // A web app cross-reference opens a popup, not its notebox row.
          if (Build.isWebApp && targ.type === 'cr') break;
          if (!popupParent && module) {
            let row;
            let id;
            if (targ.type === 'cr' && p) {
              id = `w${index}.footnote.${ptype}.${title}`;
              row = getRootNode().getElementById(id);
            } else {
              const rowx = ofClass(['fnrow'], elem);
              if (rowx) row = rowx.element;
            }
            if (row) {
              const { location } = getElementData(row);
              row.classList.toggle('cropened');
              const col5 = ofClass('fncol5', row, 'descendant');
              if (col5 && location) {
                const el = col5.element;
                const refs = el.dataset.reflist;
                if (refs) {
                  doUntilDone((renderPromise) => {
                    let html = '';
                    if (renderPromise)
                      html = getExtRefHTML(
                        G,
                        GI,
                        refs,
                        module,
                        G.i18n.language,
                        location,
                        row.classList.contains('cropened'),
                        false,
                        renderPromise,
                      );
                    if (!renderPromise?.waiting()) sanitizeHTML(el, html);
                  });
                }
              }
              if (id) scroll2Note(atext, id);
            }
          }
          break;

        case 'versePerLineButton':
          this.setState((prevState) => {
            const { versePerLine } = prevState;
            return { versePerLine: !versePerLine };
          });
          break;

        case 'image-viewport':
          if (ep) imageZoomToggle(elem, ep);
          break;

        case 'dictkeyinput': {
          const input = elem as HTMLInputElement;
          input.select();
          break;
        }

        case 'notebox-maximizer':
          // (viewportParentH handles the other types of panel, by pref)
          if (this.isDictionary()) {
            this.minimizeDictNotebox(!this.noteboxMinimized());
          } else {
            // The notebox of a panel which resizes to fit opens to its
            // maximum height.
            this.setState({
              noteBoxMaximized: this.noteboxMinimized() && this.resizesToFit(),
            });
          }
          break;

        case 'versenum': {
          const { audio, isPinned } = props;
          if (module && audio.open && !isPinned)
            onVersenumClick(elem, module, audio);
          break;
        }

        default:
          if (Build.isDevelopment)
            log.warn(`Unhandled atextHandler click event '${targ.type}'`);
          return;
      }

      // Allow the other handlers to handle pointerdown
      return;
    }

    case 'dblclick': {
      if (ofClass(['sb'], e.target)) {
        // Get selected text
        const selob = getSelection();
        if (selob) {
          let searchtext = selob.toString();
          searchtext = cleanDoubleClickSelection(searchtext);
          const { module } = this.props;
          if (module && searchtext && !/^\s*$/.test(searchtext)) {
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
        }
      }
      break;
    }

    case 'pointerenter': {
      const { target } = e;
      if (ofClass(['npopup'], target)) return;
      const oc = ofClass(['cr', 'fn', 'sn', 'un', 'image-viewport'], target);
      if (!oc) return;
      const { element, type } = oc;
      if (!element) return;
      const { props } = this;
      const { isPinned, module, panelIndex: index, place: pl } = props;
      const { pin } = this.state;
      const place = this.notePlace(isPinned && pin ? pin.place : pl);
      const atext = ofClass(['atext'], target)?.element;
      const modtype = module ? G.Tab[module].type : '';
      const p = getElementData(element);
      const { title, type: ptype } = p;
      let okay;
      if (atext) {
        switch (type) {
          case 'cr':
            if (p && place.crossrefs === 'notebox') {
              okay = scroll2Note(atext, `w${index}.footnote.${ptype}.${title}`);
            }
            break;

          case 'fn':
            // genbk fn are embedded in text
            if (modtype === C.GENBOOK) okay = true;
            else if (p && place.footnotes === 'notebox') {
              okay = scroll2Note(atext, `w${index}.footnote.${ptype}.${title}`);
            }
            break;

          case 'un':
            if (
              p &&
              place.usernotes === 'notebox' &&
              (modtype === C.BIBLE || modtype === C.COMMENTARY)
            ) {
              okay = scroll2Note(atext, `w${index}.footnote.${ptype}.${title}`);
            }
            break;

          case 'sn': {
            // Add elem's strong's classes to stylesheet for highlighting
            const classes = Array.from(element.classList);
            classes.shift(); // remove sn base class
            strongsHilights(classes);
            break;
          }

          case 'image-viewport':
            okay = true;
            imageZoomCursor(element);
            break;

          default:
            if (Build.isDevelopment)
              log.warn(`Unhandled atextHandler mouseOver event '${type}'`);
            return;
        }
      }

      if (okay === false) {
        element.style.cursor = okay === false ? 'help' : 'default';
      }
      break;
    }

    case 'pointerleave': {
      // Remove any footnote hilighting
      const atext = ofClass('atext', e.target)?.element;
      if (atext) {
        const nbc = atext.lastChild;
        if (nbc instanceof HTMLElement) {
          Array.from(nbc.getElementsByClassName('fnselected')).forEach(
            (note) => {
              note.classList.remove('fnselected');
            },
          );
        }
      }

      if (
        ep &&
        pointerType === 'mouse' &&
        !ofClass(['npopup'], ep.target) &&
        !ofClass(['npopup'], ep.relatedTarget)
      )
        cancelStrongsHiLights();
      break;
    }

    case 'wheel': {
      const ew = e as React.WheelEvent;
      const { isPinned, module, columns } = this.props;
      // (the multi-column wheel turns pages, which viewportParentH handles)
      if (isPinned && module && columns === 1) {
        const atext = ew.currentTarget as HTMLElement;
        const { type } = G.Tab[module];
        if (atext && type !== C.DICTIONARY && !ofClass(['nbc'], ew.target)) {
          aTextWheelScroll(ew, atext, this);
        }
      }
      // Allow the other handlers to handle wheel
      return;
    }

    case 'scroll': {
      if (this.props.columns > 1) {
        this.onPageScroll();
        break;
      }
      // This handler is only intended for web-app user scrolling of atext, NOT
      // programmatic scrolling of any kind. Also it should never effect the
      // atext element which the user scrolled, only the others. Note: scroll
      // events don't bubble!
      const { userScrolled, scriptScrolled } = window.WebAppTextScroll;
      if (Build.isWebApp && userScrolled === -1 && !scriptScrolled) {
        const { isPinned, module, location, panelIndex, xulswordState } =
          this.props;
        if (!isPinned && module && location) {
          let atext: HTMLElement | null = null;
          const scrollSyncs: number[] = [];
          (
            Array.from(
              getRootNode().querySelectorAll('.atext'),
            ) as HTMLElement[]
          ).forEach((txt) => {
            const { index: i, module: mod, ispinned } = txt.dataset;
            if (
              mod &&
              mod in G.Tab &&
              G.Tab[mod].isVerseKey &&
              ispinned === 'false'
            ) {
              scrollSyncs.push(Number(i));
              if (Number(i) === panelIndex) atext = txt;
            }
          });
          if (atext && scrollSyncs.length > 1) {
            delayHandler(
              this,
              () => {
                doUntilDone((renderPromise2) => {
                  if (atext && renderPromise2) {
                    const { location: oldloc } = this.props;
                    if (oldloc) {
                      const newloc = getScrollVerse(atext, renderPromise2);
                      if (
                        !renderPromise2?.waiting() &&
                        newloc &&
                        oldloc.verse !== newloc.verse
                      ) {
                        window.WebAppTextScroll.userScrolled = panelIndex;
                        setTimeout(
                          () => (window.WebAppTextScroll.userScrolled = -1),
                          1000,
                        );
                        xulswordState({
                          location: newloc,
                          scroll: { verseAt: 'top' },
                        });
                      }
                    }
                  }
                });
              },
              [],
              C.UI.Atext.mobileScrollDelay,
              'atextScrollTO',
            );
          }
        }
      }
      break;
    }

    case 'change': {
      const { xulswordState, panelIndex } = this.props;
      const origselect = ofClass(['origselect'], e.target);
      if (origselect) {
        const s = origselect.element.firstChild as
          HTMLSelectElement | undefined;
        const module = s?.value;
        if (module) {
          // Remember the user's choice for the current testament. Choosing the
          // default (first) option clears the choice, so that whatever is the
          // default at the time will be used.
          const { location, ilModuleOption } = this.props;
          const book = location?.book;
          const Book = G.getBook(G.i18n.language);
          const bookGroup = book && book in Book ? Book[book].bookGroup : null;
          if (bookGroup === 'ot' || bookGroup === 'nt') {
            const interlinear = {
              ...(G.Prefs.getComplexValue('global.interlinear') as
                typeof S.prefs.global.interlinear | undefined),
            };
            if (module === ilModuleOption[0]) delete interlinear[bookGroup];
            else interlinear[bookGroup] = module;
            G.Prefs.setComplexValue('global.interlinear', interlinear);
          }
          xulswordState((prevState) => {
            let { ilModules } = prevState;
            ilModules = clone(ilModules);
            ilModules[panelIndex] = module;
            return { ilModules };
          });
        }
      }
      const variantselect = ofClass(['variantselect'], e.target);
      if (variantselect) {
        const s = variantselect.element.firstChild as
          HTMLSelectElement | undefined;
        const { module, ilModule } = this.props;
        const variantModule = ilModule || module;
        if (s && variantModule) {
          const variants = {
            ...(G.Prefs.getComplexValue(
              'global.variants',
            ) as typeof S.prefs.global.variants),
            [variantModule]: s.value as TextualVariantType,
          };
          G.Prefs.setComplexValue('global.variants', variants);
          this.setState({ variants });
        }
      }
      break;
    }

    default:
      if (Build.isDevelopment)
        log.warn(`Unhandled atextHandler event type '${e.type}'`);
      return;
  }

  eventHandled(e);
}
