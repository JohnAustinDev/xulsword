import { jsdump } from '../rutil';

export default function handler(e) {
  switch (e.type) {
    case 'click':
      switch (e.currentTarget.id) {
        case 'chapter':
        case 'verse':
          e.currentTarget.getElementsByTagName('input')[0].select();
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
          throw Error(`Unhandled onClick event on ${e.currentTarget.id}`);
      }
      break;

    case 'change':
      switch (e.target.id) {
        case 'chapter__input': {
          this.setState({ chapter: Number(e.target.value) });
          break;
        }
        case 'verse__input':
          this.setState({ verse: Number(e.target.value) });
          break;

        case 'searchText': {
          const enable = /\S+/.test(e.target.value);
          this.setState({ searchDisabled: !enable });
          break;
        }
        default:
          throw Error(`Unhandled onChange event on ${e.target.id}`);
      }
      break;

    default:
      throw Error(`Unhandled event type ${e.type}`);
  }
}
