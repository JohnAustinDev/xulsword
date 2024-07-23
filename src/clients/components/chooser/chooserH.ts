import type React from 'react';
import { getSwordOptions, ofClass, sanitizeHTML } from '../../../common.ts';
import C from '../../../constant.ts';
import { G } from '../../G.ts';
import { delayHandler } from '../libxul/xul.tsx';
import log from '../../log.ts';

import type { BookGroupType } from '../../../type.ts';
import type Chooser from './chooser.tsx';
import type { ChooserProps, ChooserState } from './chooser.tsx';

export default function handler(this: Chooser, es: React.SyntheticEvent): void {
  const target = es.target as HTMLElement;
  switch (es.type) {
    case 'click': {
      const e = es as React.MouseEvent;
      e.currentTarget.classList.remove('show');
      break;
    }

    case 'mouseenter': {
      const e = es as React.MouseEvent;
      const targ = ofClass(
        ['bookgroup', 'bookgroupitem', 'chaptermenucell'],
        target,
      );
      if (!targ) return;
      const { bookGroups, headingsModule } = this.props as ChooserProps;
      const state = this.state as ChooserState;
      const bookgroup = target.dataset.bookgroup as BookGroupType;
      switch (targ.type) {
        case 'bookgroup': {
          if (
            bookgroup &&
            state.bookGroup !== bookgroup &&
            bookGroups?.includes(bookgroup)
          )
            delayHandler.bind(this)(
              () => {
                this.setState({ bookGroup: bookgroup });
              },
              C.UI.Chooser.bookgroupHoverDelay,
              'bookgroupTO',
            )(es);
          break;
        }

        case 'bookgroupitem': {
          const { mouseScroll } = this;
          if (e.clientY < mouseScroll.top) this.startSlidingDown(e, 65);
          else if (e.clientY > mouseScroll.bottom) this.startSlidingUp(e, 65);
          else this.stopSliding();
          break;
        }

        case 'chaptermenucell': {
          const chapterMenu = ofClass('chaptermenu', target);
          if (!chapterMenu) return;
          const { book, chapter } = targ.element.dataset;
          if (!book || !chapter || !headingsModule) return;
          const headingmenu = chapterMenu.element.getElementsByClassName(
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
          G.callBatch([
            [
              'LibSword',
              'getChapterText',
              [headingsModule, `${book}.${chapter}`, options],
            ],
          ])
            .then((result) => {
              const [gct] = result as Array<
                ReturnType<typeof G.LibSword.getChapterText>
              >;
              const { text } = gct;
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
                const row = chapterMenu.element.firstChild as HTMLElement;
                if (row) {
                  headingmenu.style.top = `${Number(
                    -2 +
                      (1 + Math.floor((Number(chapter) - 1) / 10)) *
                        row.offsetHeight,
                  )}px`;
                  chapterMenu.element.classList.add('show');
                }
              }
            })
            .catch((er) => {
              log.error(er);
            });
          break;
        }
        default:
          throw Error(`Unhandled chooserH mouseover on: '${targ.type}'`);
      }
      break;
    }

    case 'mouseout': {
      if (this.headingmenuTO) clearTimeout(this.headingmenuTO);
      break;
    }

    case 'mouseleave': {
      const e = es as React.MouseEvent;
      if (this.headingmenuTO) clearTimeout(this.headingmenuTO);
      const chmenu = ofClass(['chaptermenu'], target);
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      if (chmenu && relatedTarget?.classList) {
        if (!relatedTarget.classList.contains('headingmenu')) {
          chmenu.element.classList.remove('show');
        }
      }
      break;
    }

    case 'wheel': {
      const e = es as React.WheelEvent;
      const { rowHeight } = this;
      const wheelD = Math.round(e.deltaY / rowHeight);
      if (e.deltaY < 0) this.slideDown(-1 * wheelD);
      else if (e.deltaY > 0) this.slideUp(wheelD);
      break;
    }

    default:
      throw Error(`Unhandled ChooserH event type: '${es.type}'`);
  }
}
