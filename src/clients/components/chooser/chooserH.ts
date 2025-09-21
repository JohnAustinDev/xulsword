import type React from 'react';
import { getSwordOptions, ofClass, sanitizeHTML } from '../../../common.ts';
import C from '../../../constant.ts';
import { GI } from '../../G.ts';
import { doUntilDone, eventHandled, Events, isBlocked } from '../../common.ts';
import log from '../../log.ts';
import { delayHandler } from '../libxul/xul.tsx';

import type { BookGroupType } from '../../../type.ts';
import type Chooser from './chooser.tsx';

export default function handler(
  this: Chooser,
  e: React.SyntheticEvent | PointerEvent,
): void {
  if (isBlocked(e)) return;
  const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : (e as Event);
  const ep = nativeEvent instanceof PointerEvent ? nativeEvent : null;
  switch (e.type) {
    case 'pointerdown': {
      if (ep?.currentTarget instanceof HTMLElement)
        ep.currentTarget.classList.remove('show');
      break;
    }

    case 'pointerenter': {
      const oc = ofClass(
        ['headingmenu', 'bookgroup', 'bookgroupitem', 'chaptermenucell'],
        e.target,
      );
      if (!oc) return;
      const { bookGroups, headingsModule } = this.props;
      const { state } = this;
      const { element, type } = oc;
      const bookgroup = element.dataset.bookgroup as BookGroupType;
      switch (type) {
        case 'bookgroup': {
          if (
            bookgroup &&
            state.bookGroup !== bookgroup &&
            bookGroups?.includes(bookgroup)
          )
            delayHandler(
              this,
              () => this.setState({ bookGroup: bookgroup }),
              [],
              C.UI.Chooser.bookgroupHoverDelay,
              'bookgroupTO',
            );
          break;
        }

        case 'bookgroupitem': {
          const bookList = document.querySelector('.book-list');
          if (ep && bookList) {
            if (
              ep.clientY <
              bookList.getBoundingClientRect().top +
                C.UI.Chooser.mouseScrollMargin
            )
              this.startSlidingDown(e, 65);
            else if (
              ep.clientY >
              bookList.getBoundingClientRect().bottom -
                C.UI.Chooser.mouseScrollMargin
            )
              this.startSlidingUp(e, 65);
            else this.stopSliding();
          }
          break;
        }

        case 'headingmenu':
        case 'chaptermenucell': {
          const oc3 = ofClass('chaptermenu', e.target);
          if (!oc3) return;
          const { element: chaptermenu } = oc3;
          const { target } = e;
          const { book, chapter } =
            target instanceof HTMLElement ? target.dataset : {};
          if (!book || !chapter || !headingsModule) return;
          const headingmenu = chaptermenu.getElementsByClassName(
            'headingmenu',
          )[0] as HTMLElement;
          while (headingmenu.firstChild) {
            headingmenu.removeChild(headingmenu.firstChild);
          }
          // Set LibSword options and read the chapter
          const options = getSwordOptions(false, C.BIBLE);
          options.Headings = 'On';
          options['Verse Numbers'] = 'On';
          // Regex gets array of headings and their following verse tags
          const hdplus =
            /<h\d[^>]*class="head1[^"]*"[^>]*>.*?<\/h\d>.*?<sup[^>]*>\d+<\/sup>/gim;
          // Regex parses heading from array member strings
          const hd = /<h\d([^>]*class="head1[^"]*"[^>]*>)(.*?)<\/h\d>/i;
          // Rexgex parses verse number from array member strings
          const vs = /<sup[^>]*>(\d+)<\/sup>/i; // Get verse from above
          doUntilDone((renderPromise) => {
            const result = GI.LibSword.getChapterText(
              { text: '', notes: '' },
              renderPromise,
              headingsModule,
              `${book}.${chapter}`,
              options,
            );
            if (!renderPromise?.waiting()) {
              const { text } = result;
              const headings = text.match(hdplus);
              if (headings) {
                let hr = false;
                for (let x = 0; x < headings.length; x += 1) {
                  const h = headings[x];
                  if (h) {
                    const mh = h.match(hd);
                    const mv = h.match(vs);
                    if (mh && mv) {
                      const [, tag, txt] = mh;
                      const [, verse] = mv;
                      const text = txt.replace(/<[^>]*>/g, '');
                      if (tag && text && !/^\s*$/.test(text)) {
                        if (hr)
                          headingmenu.appendChild(document.createElement('hr'));
                        const a = headingmenu.appendChild(
                          document.createElement('a'),
                        );
                        sanitizeHTML(a, text);
                        a.className = `heading-link cs-${headingsModule}`;
                        a.dataset.module = headingsModule;
                        a.dataset.book = book;
                        a.dataset.chapter = chapter;
                        a.dataset.verse = verse;
                        hr = true;
                      }
                    }
                  }
                }
              }
              // If headings were found, then display them inside the popup
              if (headingmenu.childNodes.length) {
                const row = chaptermenu.firstChild as HTMLElement;
                if (row) {
                  headingmenu.style.top = `${Number(
                    -2 +
                      (1 + Math.floor((Number(chapter) - 1) / 10)) *
                        row.offsetHeight,
                  )}px`;
                  chaptermenu.classList.add('show');
                }
              } else if (Events.lastPointerEvent?.pointerType !== 'mouse') {
                // Followon events have been blocked below, but no menu items
                // exist, so initiate a new pointerdown event.
                /*
                element.dispatchEvent(
                  new PointerEvent('pointerdown', {
                    bubbles: true,
                    pointerId: 1,
                    isPrimary: true,
                    pointerType: 'mouse',
                  }),
                );*/
              }
            }
          });
          // Touch followon events are blocked below, but headingmenu
          // pointerdown should be handled.
          // TODO: chaptermenucell is here because the dispatchEvent above
          // hasn't been made to work yet. So finish that, then remove
          // 'chaptermenucell' here.
          if (type === 'chaptermenucell' || type === 'headingmenu') {
            Events.blocked = false;
            return;
          }
          break;
        }
        default:
          if (Build.isDevelopment)
            log.warn(`Unhandled chooserH mouseover on: '${type}'`);
          return;
      }
      // On touch, we've handled mouseover, so ignore followon events.
      if (Events.lastPointerEvent?.pointerType !== 'mouse') {
        Events.blocked = true;
        setTimeout(() => (Events.blocked = false), 150);
      }
      break;
    }

    case 'pointerleave': {
      if (ep) {
        if (this.headingmenuTO) clearTimeout(this.headingmenuTO);
        const ch3 = ofClass(['chaptermenu'], ep.target);
        const { relatedTarget } = ep;
        if (ch3 && relatedTarget instanceof HTMLElement) {
          const { element: chaptermenu } = ch3;
          if (!relatedTarget.classList.contains('headingmenu')) {
            chaptermenu.classList.remove('show');
          }
        }
      }
      break;
    }

    case 'wheel': {
      const ew = e as React.WheelEvent;
      const { rowHeight } = this;
      const wheelD = Math.round(ew.deltaY / rowHeight);
      if (ew.deltaY < 0) this.slideDown(-1 * wheelD);
      else if (ew.deltaY > 0) this.slideUp(wheelD);
      break;
    }

    default:
      if (Build.isDevelopment)
        log.warn(`Unhandled ChooserH event type: '${e.type}'`);
      return;
  }

  eventHandled(e);
}
