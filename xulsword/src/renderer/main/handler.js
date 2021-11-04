import { jsdump, parseLocation } from '../rutil';

export default function handler(e, ...args) {
  switch (e.type) {
    case 'click':
      switch (e.currentTarget.id) {
        case 'back':
        case 'historyMenu':
        case 'forward':
          jsdump(`${e.currentTarget.id} click not yet implented`);
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
          throw Error(`Unhandled onClick event on '${e.currentTarget.id}'`);
      }
      break;

    case 'change': {
      if (!('value' in e.target)) return;
      switch (e.target.id) {
        case 'book__textbox__input':
        case 'book__menulist__select': {
          this.bsreset += 1; // reset Bookselect even if book didn't change
          const location = parseLocation(e.target.value);
          if (location !== null) {
            // eslint-disable-next-line prefer-const
            let { book, chapter, verse } = location;
            if (book) {
              if (!chapter) chapter = 1;
              if (!verse) verse = 1;
              this.setState({ book, chapter, verse });
              return;
            }
          }
          this.forceUpdate();
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
          throw Error(`Unhandled onChange event on '${e.currentTarget.id}'`);
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
          throw Error(`Unhandled onKeyDown event on '${e.currentTarget.id}'`);
      }
      break;
    }

    default:
      throw Error(`Unhandled event type '${e.type}'`);
  }
}
