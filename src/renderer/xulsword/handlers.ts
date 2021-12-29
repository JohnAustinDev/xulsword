/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-loop-func */
import C from '../../constant';
import { firstIndexOfBookGroup, ofClass } from '../../common';
import { textChange, chapterChange, verseChange } from '../viewport/tversekey';
import { convertDotString, jsdump, parseLocation } from '../rutil';
import G from '../rg';
// eslint-disable-next-line import/no-cycle
import Xulsword, { XulswordState } from './xulsword';

export function xulswordHandler(this: Xulsword, e: React.SyntheticEvent<any>) {
  const state = this.state as XulswordState;
  switch (e.type) {
    case 'click':
      switch (e.currentTarget.id) {
        case 'back':
          this.setHistory(state.historyIndex + 1);
          break;
        case 'historymenu': {
          e.stopPropagation();
          const v11nmod = state.modules.find((m, i) => {
            return (
              i < state.numDisplayedWindows &&
              m &&
              (G.Tab[m].type === C.BIBLE || G.Tab[m].type === C.COMMENTARY)
            );
          });
          const versification = v11nmod ? G.Tab[v11nmod].v11n : undefined;
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
          const { v11nmod } = this;
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
          const { v11nmod } = this;
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

export function handleViewport(
  this: Xulsword,
  e: React.SyntheticEvent<any>,
  ...args: any
) {
  const state = this.state as XulswordState;
  const t = e.target as HTMLElement;
  switch (e.type) {
    case 'click': {
      const targ = ofClass(
        [
          'text-pin',
          'text-win',
          'chaptermenucell',
          'heading-link',
          'bookname',
          'bookgroup',
          'open-chooser',
          'close-chooser',
          'notebox-maximizer',
          'reg-tab', // a regular tab
          'mts-tab', // the multi-tab main tab
          'mto-tab', // a multi-tab option tab
          'ilt-tab', // the interlinear tab
          'prevchaplink',
          'nextchaplink',
        ],
        t
      );
      if (targ === null) return;
      e.preventDefault();
      switch (targ.type) {
        case 'text-win': {
          G.Commands.openTextWindow();
          break;
        }
        case 'text-pin': {
          const atext = e.currentTarget as HTMLElement;
          const i = Number(atext.dataset.wnum) - 1;
          const c = ofClass(['show1', 'show2', 'show3'], atext);
          const columns = c ? Number(c.type.substring(c.type.length - 1)) : 1;
          this.setState((prevState: XulswordState) => {
            const { isPinned } = prevState;
            for (let x = i; x < columns + i; x += 1) {
              isPinned[x] = !isPinned[x];
            }
            return { isPinned };
          });
          break;
        }
        case 'bookgroup': {
          const { bookgroup } = targ.element.dataset;
          const b = bookgroup ? firstIndexOfBookGroup(bookgroup) : null;
          if (b !== null) {
            this.setState({
              book: G.Books[b].sName,
              chapter: 1,
              verse: 1,
              selection: '',
            });
          }
          break;
        }
        case 'bookname': {
          const { book } = targ.element.dataset;
          if (book) {
            this.setState({
              book,
              chapter: 1,
              verse: 1,
              selection: '',
            });
          }
          break;
        }
        case 'chaptermenucell': {
          const { book, chapter } = targ.element.dataset;
          if (chapter) {
            this.setState({
              book,
              chapter: Number(chapter),
              verse: 1,
              selection: '',
            });
          }
          break;
        }
        case 'heading-link': {
          const {
            module: m,
            book: b,
            chapter: c,
            verse: v,
          } = targ.element.dataset;
          if (m) {
            const from = [b, c, v, G.Tab[m].v11n].join('.');
            const to = this.versification
              ? convertDotString(from, this.versification)
              : from;
            const [book, chapter, verse] = to.split('.');
            this.setState({
              book,
              chapter: Number(chapter),
              verse: Number(verse),
              selection: '',
            });
          }
          break;
        }
        case 'open-chooser': {
          this.setState({ showChooser: true });
          break;
        }
        case 'close-chooser': {
          this.setState({ showChooser: false });
          break;
        }
        case 'notebox-maximizer': {
          const atext = e.currentTarget as HTMLElement;
          const i = Number(atext.dataset.wnum) - 1;
          this.setState((prevState: XulswordState) => {
            const { maximizeNoteBox, noteBoxHeight } = prevState;
            if (maximizeNoteBox[i] > 0) {
              noteBoxHeight[i] = maximizeNoteBox[i];
              maximizeNoteBox[i] = 0;
            } else {
              maximizeNoteBox[i] = noteBoxHeight[i];
              noteBoxHeight[i] =
                atext.clientHeight - C.TextHeaderHeight - C.TextBBTopMargin - 5;
            }
            return { maximizeNoteBox, noteBoxHeight };
          });
          break;
        }
        case 'reg-tab':
        case 'mts-tab':
        case 'mto-tab':
        case 'ilt-tab': {
          const w = targ.element.dataset.wnum;
          const m = targ.element.dataset.module;
          const i = Number(w) - 1;
          if (w && m && m !== 'disabled' && !state.isPinned[i]) {
            if (targ.type === 'ilt-tab') {
              this.setState((prevState: XulswordState) => {
                const { ilModules } = prevState;
                ilModules[i] = ilModules[i] ? '' : m;
                return { ilModules };
              });
            } else {
              this.setState((prevState: XulswordState) => {
                const { modules, mtModules } = prevState;
                modules[i] = m;
                if (targ.type === 'mto-tab' || targ.type === 'mts-tab') {
                  mtModules[i] = m;
                }
                return {
                  modules,
                  mtModules,
                };
              });
            }
          }
          break;
        }
        case 'prevchaplink': {
          const atext = e.currentTarget as HTMLElement;
          const s = textChange(atext, false);
          if (s) this.setState(s);
          break;
        }
        case 'nextchaplink': {
          const atext = e.currentTarget as HTMLElement;
          const s = textChange(atext, true);
          if (s) this.setState(s);
          break;
        }
        default:
          throw Error(
            `Unhandled handleViewport click event on '${t.className}'`
          );
      }
      break;
    }

    case 'mousemove': {
      // This event means the bb bar is being dragged while maximizeNoteBox > 0
      const targ = ofClass('atext', t);
      if (targ !== null) {
        const w = targ.element.dataset.wnum;
        const i = Number(w) - 1;
        this.setState((prevState) => {
          const { maximizeNoteBox } = prevState as XulswordState;
          maximizeNoteBox[i] = 0;
          return { maximizeNoteBox };
        });
      } else {
        throw Error(
          `Unhandled handleViewport mousemove class on '${t.className}`
        );
      }
      break;
    }

    case 'mouseup': {
      const targ = ofClass(['atext'], t);
      const [noteboxResizing, maximize] = args;
      if (targ !== null) {
        const w = targ.element.dataset.wnum;
        const i = Number(w) - 1;
        this.setState((prevState: XulswordState) => {
          const { maximizeNoteBox, noteBoxHeight } = prevState;
          const [initial, final] = noteboxResizing;
          if (maximize) maximizeNoteBox[i] = noteBoxHeight[i];
          noteBoxHeight[i] += initial - final;
          return { maximizeNoteBox, noteBoxHeight };
        });
      } else {
        throw Error(
          `Unhandled handleViewport mouseup event on '${t.className}'`
        );
      }
      break;
    }

    default:
      throw Error(`Unhandled handleViewport event type '${e.type}'`);
  }
}
