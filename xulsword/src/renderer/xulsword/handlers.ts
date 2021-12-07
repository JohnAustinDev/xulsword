/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-loop-func */
import { jsdump, parseLocation } from '../rutil';
import C from '../../constant';
import G from '../rg';
import { firstIndexOfBookGroup, ofClass } from '../../common';
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
        case 'historymenu':
          e.stopPropagation();
          this.setState((prevState: XulswordState) => {
            return {
              historyMenupopup: prevState.historyMenupopup
                ? undefined
                : this.historyMenu(),
            };
          });
          break;
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
            return { chapter: prevState.chapter - 1 };
          });
          break;
        case 'nextchap':
          this.setState((prevState: XulswordState) => {
            return { chapter: prevState.chapter + 1 };
          });
          break;
        case 'prevverse':
          this.setState((prevState: XulswordState) => {
            return { verse: prevState.verse - 1 };
          });
          break;
        case 'nextverse':
          this.setState((prevState: XulswordState) => {
            return { verse: prevState.verse + 1 };
          });
          break;

        case 'searchButton':
          jsdump(`searchButton click not yet implemented`);
          break;

        case 'hdbutton':
          this.setState((prevState: XulswordState) => {
            return { showHeadings: !prevState.showHeadings };
          });
          break;
        case 'fnbutton':
          this.setState((prevState: XulswordState) => {
            return { showFootnotes: !prevState.showFootnotes };
          });
          break;
        case 'crbutton':
          this.setState((prevState: XulswordState) => {
            return { showCrossRefs: !prevState.showCrossRefs };
          });
          break;
        case 'dtbutton':
          this.setState((prevState: XulswordState) => {
            return { showDictLinks: !prevState.showDictLinks };
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
              let { book, chapter, verse } = location;
              if (book) {
                if (!chapter) chapter = 1;
                if (!verse) verse = 1;
                return { book, chapter, verse, bsreset };
              }
            }
            return { bsreset };
          });
          break;
        }
        case 'chapter__input':
          this.setState({ chapter: Number(value) });
          break;

        case 'verse__input':
          this.setState({ verse: Number(value) });
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
          'bookname',
          'bookgroup',
          'open-chooser',
          'close-chooser',
          'notebox-maximizer',
          'reg-tab', // a regular tab
          'mts-tab', // the multi-tab main tab
          'mto-tab', // a multi-tab option tab
          'ilt-tab', // the interlinear tab
        ],
        t
      );
      if (targ === null) return;
      switch (targ.type) {
        case 'text-win': {
          G.Commands.openTextWindow();
          break;
        }
        case 'text-pin': {
          const atext = e.currentTarget as HTMLElement;
          const i = Number(atext.dataset.wnum) - 1;
          this.setState((prevState: XulswordState) => {
            const { isPinned } = prevState;
            isPinned[i] = !isPinned[i];
            return { isPinned };
          });
          break;
        }
        case 'bookgroup': {
          const m = targ.element.className.match(/\bbookgroup_(\S+)\b/);
          const b = m ? firstIndexOfBookGroup(m[1]) : null;
          if (b !== null) {
            this.setState({
              book: G.Book[b].sName,
              chapter: 1,
              verse: 1,
              lastverse: 1,
            });
          }
          break;
        }
        case 'bookname': {
          const bk = targ.element.className.match(/\bbookname_([\w\d]+)\b/);
          if (bk) {
            this.setState({
              book: bk[1],
              chapter: 1,
              verse: 1,
              lastverse: 1,
            });
          }
          break;
        }
        case 'chaptermenucell': {
          const ch = targ.element.className.match(/chmc_([\w\d]+)_(\d+)\b/);
          if (ch) {
            this.setState({
              book: ch[1],
              chapter: Number(ch[2]),
              verse: 1,
              lastverse: 1,
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
          if (w && m && !state.isPinned[i]) {
            if (targ.type === 'ilt-tab') {
              if (m === 'disabled') return;
              this.setState((prevState: XulswordState) => {
                const { ilModules } = prevState;
                ilModules[i] = ilModules[i] ? '' : m;
                return { ilModules };
              });
            } else {
              this.setState((prevState: XulswordState) => {
                const { modules, mtModules, flagHilight, flagScroll } =
                  prevState;
                modules[i] = m;
                flagHilight[i] = C.HILIGHT_IFNOTV1;
                flagScroll[i] = C.SCROLLTYPECENTER;
                if (targ.type === 'mto-tab' || targ.type === 'mts-tab') {
                  mtModules[i] = m;
                }
                return {
                  flagHilight,
                  flagScroll,
                  modules,
                  mtModules,
                };
              });
            }
          }
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
      // This event means the bb bar is dragging while maximizeNoteBox > 0
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
