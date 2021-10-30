import { jsdump, parseLocation } from '../rutil';

export default function handler(e, ...args) {
  switch (e.type) {
    case 'click':
      switch (e.currentTarget.id) {
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

        case 'hdbutton':
          this.setState((prevState) => {
            return { hdbutton: !prevState.hdbutton };
          });
          break;
        case 'fnbutton':
          this.setState((prevState) => {
            return { fnbutton: !prevState.fnbutton };
          });
          break;
        case 'crbutton':
          this.setState((prevState) => {
            return { crbutton: !prevState.crbutton };
          });
          break;
        case 'dtbutton':
          this.setState((prevState) => {
            return { dtbutton: !prevState.dtbutton };
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
          const location = parseLocation(e.target.value);
          if (location !== null) {
            // eslint-disable-next-line prefer-const
            let { book, chapter, verse } = location;
            if (book) {
              if (!chapter) chapter = 1;
              if (!verse) verse = 1;
              this.setState({ book, chapter, verse });
            }
          }
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
          this.setState({ searchDisabled: !enable });
          break;
        }
        default:
          throw Error(`Unhandled onChange event on '${e.currentTarget.id}'`);
      }
      break;
    }
    default:
      throw Error(`Unhandled event type '${e.type}'`);
  }
}
