import type React from 'react';
import Subscription from '../../../subscription.ts';
import {
  cleanDoubleClickSelection,
  clone,
  getCSS,
  ofClass,
  pad,
  randomID,
  sanitizeHTML,
} from '../../../common.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import {
  doUntilDone,
  eventHandled,
  getExtRefHTML,
  isBlocked,
  cancelStrongsHiLights,
  strongsHilights,
} from '../../common.ts';
import log from '../../log.ts';
import { getElementData } from '../../htmlData.ts';
import { delayHandler } from '../libxul/xul.tsx';
import { aTextWheelScroll, getScrollVerse } from './zversekey.ts';

import type { GType, SearchType } from '../../../type.ts';
import type Atext from './atext.tsx';

function scroll2Note(atext: HTMLElement, id: string) {
  Array.from(atext.getElementsByClassName('fnselected')).forEach((note) => {
    note.classList.remove('fnselected');
  });
  const note = document.getElementById(id);
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
  if (isBlocked(e)) return;
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
          if (!popupParent && module) {
            let row;
            let id;
            if (targ.type === 'cr' && p) {
              id = `w${index}.footnote.${ptype}.${title}`;
              row = document.getElementById(id);
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

        case 'image-viewport': {
          // When pointerType isn't mouse it usually means that pinch zoom is
          // available, so let that be used instead of click-zoom.
          if (pointerType === 'mouse') {
            // When an image-viewport is clicked, the viewport's current width and height
            // will become fixed and it will be made the relative ancestor of the scroll-
            // container, which will become absolutely positioned. With the mouse cursor
            // position in the viewport recorded as (Xt, Yt) the image is resized to its
            // natural width and height and the scroll-container top and left are set to
            // calculated (Xn, Yn) such that the image pixel that was under the cursor when
            // it was clicked will remain under the cursor after the image is resized to
            // its natural size. If clicked again, the image will be resized back to the
            // viewport width with scroll-container top and left set to 0.
            // Yn = Y(1 - (Wi/Wv))
            // WHERE:
            // Yn = CSS top value of the image container with respect to viewport
            // Y = Y coordinate of the cursor within the viewport (containing the fit image)
            // Wi = Width of the natural image
            // Wv = Width of the viewport
            const viewport = elem as HTMLDivElement;
            const scrollcn = viewport.firstChild as HTMLDivElement;
            const img = scrollcn?.firstChild as HTMLImageElement | undefined;
            let expandShrink: boolean | undefined;
            if (
              ep &&
              img &&
              ['zoom-in', 'zoom-out'].includes(img.style.cursor)
            ) {
              const scrollcnS = window.getComputedStyle(scrollcn, null);
              if (scrollcnS.position === 'absolute') {
                expandShrink = img.style.width !== `${img.naturalWidth}px`;
              } else if (img.width < img.naturalWidth) {
                expandShrink = true;
                const viewportS = window.getComputedStyle(viewport, null);
                const vph = viewportS.height;
                const vpw = viewportS.width;
                viewport.style.height = vph;
                viewport.style.width = vpw;
                viewport.style.position = 'relative';
                viewport.style.overflow = 'visible';
                scrollcn.style.position = 'absolute';
              }
              if (expandShrink !== undefined) {
                if (expandShrink) {
                  const cbox = viewport.getBoundingClientRect();
                  const Y = ep.clientY - cbox.top;
                  const top = Y * (1 - img.naturalWidth / viewport.offsetWidth);
                  const X = ep.clientX - cbox.left;
                  const left =
                    X * (1 - img.naturalHeight / viewport.offsetHeight);
                  scrollcn.style.top = `${top}px`;
                  scrollcn.style.left = `${left}px`;
                  img.style.width = `${img.naturalWidth}px`;
                  img.style.maxWidth = 'unset';
                  img.style.cursor = 'zoom-out';
                } else {
                  scrollcn.style.top = '0';
                  scrollcn.style.left = '0';
                  img.style.width = `${viewport.offsetWidth}px`;
                  img.style.maxWidth = '';
                  img.style.cursor = 'zoom-in';
                }
              } else img.style.cursor = '';
            }
          }
          break;
        }

        case 'dictkeyinput': {
          const input = elem as HTMLInputElement;
          input.select();
          break;
        }

        default:
          if (Build.isDevelopment)
            log.warn(`Unhandled atextHandler click event '${targ.type}'`);
          return;
      }
      break;
    }

    case 'dblclick': {
      if (ofClass(['sb'], e.target)) {
        // Get selected text
        const selob = window.getSelection();
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
      const place = isPinned && pin ? pin.place : pl;
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

          case 'image-viewport': {
            okay = true;
            const img = element.getElementsByTagName('img')[0] as
              | HTMLImageElement
              | undefined;
            if (
              img &&
              !img.style.cursor &&
              img.width < img.naturalWidth &&
              window.getComputedStyle(img, null).cursor !== 'not-allowed'
            ) {
              img.style.cursor = 'zoom-in';
            }
            break;
          }

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
      const { isPinned, module } = this.props;
      if (isPinned && module) {
        const atext = ew.currentTarget as HTMLElement;
        const { type } = G.Tab[module];
        if (atext && type !== C.DICTIONARY && !ofClass(['nbc'], ew.target)) {
          aTextWheelScroll(ew, atext, this);
        }
      }
      break;
    }

    // Note: scroll events don't bubble!
    case 'scroll': {
      if (Build.isWebApp && window.WebAppTextScroll === -1) {
        const { isPinned, module, location, panelIndex, xulswordState } =
          this.props;
        if (!isPinned && module && location) {
          let atext: HTMLElement | null = null;
          const singleColumnScrollSyncs: number[] = [];
          (
            Array.from(document.querySelectorAll('.atext')) as HTMLElement[]
          ).forEach((txt) => {
            const { index: i, module: mod, columns, ispinned } = txt.dataset;
            if (
              mod &&
              mod in G.Tab &&
              G.Tab[mod].isVerseKey &&
              Number(columns) === 1 &&
              ispinned === 'false'
            ) {
              singleColumnScrollSyncs.push(Number(i));
              if (Number(i) === panelIndex) atext = txt;
            }
          });
          if (atext && singleColumnScrollSyncs.length > 1) {
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
                        window.WebAppTextScroll = panelIndex;
                        setTimeout(() => (window.WebAppTextScroll = -1), 1000);
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
          | HTMLSelectElement
          | undefined;
        const module = s?.value;
        if (module) {
          xulswordState((prevState) => {
            let { ilModules } = prevState;
            ilModules = clone(ilModules);
            ilModules[panelIndex] = module;
            return { ilModules };
          });
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
