/* eslint-disable @typescript-eslint/no-loop-func */
import { jsdump, parseLocation } from '../rutil';
import C from '../../constant';
import G from '../rg';
import { firstIndexOfBookGroup } from '../../common';

export function xulswordHandler(e, ...args) {
  switch (e.type) {
    case 'click':
      switch (e.currentTarget.id) {
        case 'back':
          this.setHistory(this.state.historyIndex + 1);
          break;
        case 'historymenu':
          e.stopPropagation();
          this.setState((prevState) => {
            return {
              historyMenupopup: prevState.historyMenupopup
                ? undefined
                : this.historyMenu(),
            };
          });
          break;
        case 'forward':
          this.setHistory(this.state.historyIndex - 1);
          break;

        case 'chapter':
        case 'verse':
          if ('select' in e.target) {
            e.target.select();
          }
          break;

        case 'prevchap':
          this.setState((prevState) => {
            return { chapter: prevState.chapter - 1 };
          });
          break;
        case 'nextchap':
          this.setState((prevState) => {
            return { chapter: prevState.chapter + 1 };
          });
          break;
        case 'prevverse':
          this.setState((prevState) => {
            return { verse: prevState.verse - 1 };
          });
          break;
        case 'nextverse':
          this.setState((prevState) => {
            return { verse: prevState.verse + 1 };
          });
          break;

        case 'searchButton':
          jsdump(`searchButton click not yet implemented`);
          break;

        case 'hdbutton':
          this.setState((prevState) => {
            return { showHeadings: !prevState.showHeadings };
          });
          break;
        case 'fnbutton':
          this.setState((prevState) => {
            return { showFootnotes: !prevState.showFootnotes };
          });
          break;
        case 'crbutton':
          this.setState((prevState) => {
            return { showCrossRefs: !prevState.showCrossRefs };
          });
          break;
        case 'dtbutton':
          this.setState((prevState) => {
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
      switch (e.target.id) {
        case 'book__textbox__input':
        case 'book__menulist__select': {
          this.setState((prevState) => {
            // reset Bookselect even if book doesn't change
            const bsreset = prevState.bsreset + 1;
            const location = parseLocation(e.target.value);
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
          this.setState({ chapter: Number(e.target.value) });
          break;

        case 'verse__input':
          this.setState({ verse: Number(e.target.value) });
          break;

        case 'searchText__input': {
          const enable = /\S+/.test(e.target.value);
          if (this.state.searchDisabled === enable)
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
      switch (e.target.id) {
        case 'searchText__input': {
          if (e.key === 'Enter') {
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

export function handleViewport(e, ...args) {
  switch (e.type) {
    case 'click': {
      e.stopPropagation();
      const search = [
        'chaptermenucell',
        'bookname',
        'bar',
        'open-chooser',
        'close-chooser',
        'reg-tab', // regular tab
        'mts-tab', // multi-tab main tab
        'mto-tab', // multi-tab option tab
        'ilt-tab', // interlinear tab
      ];
      let targ = e.target;
      while (
        targ &&
        !search.some((x) => targ.classList && targ.classList.contains(x))
      ) {
        targ = targ.parentNode;
      }
      if (!targ || !targ.classList) return;
      const type = search.find((c) => targ.classList.contains(c));
      switch (type) {
        case 'bar': {
          const m = targ.className.match(/\bbar_(\S+)\b/);
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
          const bk = targ.className.match(/\bbookname_([\w\d]+)\b/);
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
          const ch = targ.className.match(/chmc_([\w\d]+)_(\d+)\b/);
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
        case 'reg-tab':
        case 'mts-tab':
        case 'mto-tab':
        case 'ilt-tab': {
          const w = targ.dataset.wnum;
          const m = targ.dataset.module;
          if (w && m && !this.state.isPinned[w]) {
            const i = w - 1;
            if (type === 'ilt-tab') {
              this.setState((prevState) => {
                const { ilModules } = prevState;
                ilModules[i] = ilModules[i] ? '' : m;
                return { ilModules };
              });
            } else {
              this.setState((prevState) => {
                const { modules, mtModules, flagHilight, flagScroll } =
                  prevState;
                modules[i] = m;
                flagHilight[i] = C.HILIGHT_IFNOTV1;
                flagScroll[i] = C.SCROLLTYPECENTER;
                if (type === 'mto-tab' || type === 'mts-tab') {
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
      }
      break;
    }

    default:
      throw Error(`Unhandled handleViewport event type '${e.type}'`);
  }
}
