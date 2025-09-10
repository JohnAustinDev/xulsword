import React from 'react';
import PropTypes from 'prop-types';
import RefParser from '../../../refParser.ts';
import C from '../../../constant.ts';
import { G } from '../../G.ts';
import { addClass, xulPropTypes, type XulProps, xulStyle } from './xul.tsx';
import { Box } from './boxes.tsx';
import Spacer from './spacer.tsx';
import Stack from './stack.tsx';
import Menulist from './menulist.tsx';
import Textbox from './textbox.tsx';
import './bookselect.css';

import type { GType, OSISBookType } from '../../../type.ts';

// XUL Bookselect
// This component contains an overlapping Textbox and Menulist.
// The Menulist's value does not display (its selection is covered
// by the Textbox). Only its drop-down menu button is visible.
// The Menulist just serves to allow book selection from a dropdown
// menu. The Textbox shows the selected Bible book name in the program
// locale. It can be changed by the user to another location, using
// auto-completed typing in the Textbox, or selected via the drop-
// down Menulist. If the Textbox gains focus, the value will become
// selected. If the escape key is pressed while typing, or the
// textbox loses focus, then the textbox value is returned to what
// it originally was. The Bookselect onChange event will be fired
// only if the user selects a book from the drop-down Menulist, or
// presses the Enter key on the Textbox while it contains a valid
// Bible book name. If Enter is pressed without a valid book name,
// the Textbox is simply returned to its original value without
// firing onChange.

const propTypes = {
  ...xulPropTypes,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  selection: PropTypes.string,
  disabled: PropTypes.bool,
  sizetopopup: PropTypes.string,
};

type BookselectProps = {
  options: OSISBookType[];
  selection?: string | undefined;
  disabled?: boolean | undefined;
  sizetopopup?: string | undefined;
} & XulProps;

type BookselectState = {
  book: string | undefined;
  pattern: RegExp;
  autocomp: boolean;
};

class Bookselect extends React.Component {
  static propTypes: typeof propTypes;

  textInput: React.RefObject<HTMLInputElement>;

  parser: RefParser;

  constructor(props: BookselectProps) {
    super(props);

    this.state = { book: props.selection, pattern: /.*/, autocomp: true };

    this.textInput = React.createRef();

    // noVariations is important for autocomplete because some
    // variations are short abbreviations.
    this.parser = new RefParser(null, {
      noVariations: true,
      locales: Build.isElectronApp
        ? C.Locales.map((l) => l[0])
        : [G.i18n.language],
    });

    this.getBookOptions = this.getBookOptions.bind(this);
    this.textboxChange = this.textboxChange.bind(this);
    this.textboxKeyDown = this.textboxKeyDown.bind(this);
    this.selectChange = this.selectChange.bind(this);
    this.focusChange = this.focusChange.bind(this);
  }

  getBookOptions = (): PropTypes.ReactElementLike[] => {
    const { options } = this.props as BookselectProps;
    const { book } = this.state as BookselectState;
    const { Book } = G;
    const books = options.map((bk) => {
      return (
        <option key={bk} value={bk}>
          {bk in Book ? Book[bk].longname : bk}
        </option>
      );
    });

    // If book is not defined (no selection) then first item is always
    // selected, and thus onChange would not fire when chosen by the
    // user. So an empty selection at the top of the list allows all
    // valid selections to fire onChange.
    if (!book) {
      books.unshift(<option key="no-selection" />);
    }

    return books;
  };

  focusChange = (e: React.FocusEvent) => {
    const { selection: book } = this.props as BookselectProps;
    const refelem = this
      .textInput as unknown as React.RefObject<HTMLInputElement>;
    const input = refelem !== null ? refelem.current : null;
    if (e.type === 'click') {
      if (input !== null) input.select();
    } else if (e.type === 'blur') {
      this.setState({ book, pattern: /.*/, autocomp: true });
    } else {
      throw Error(`Unhandled focus event: ${e.type}`);
    }
  };

  textboxKeyDown = (e: React.KeyboardEvent) => {
    const { selection: book, onChange } = this.props as BookselectProps;
    const refelem = this
      .textInput as unknown as React.RefObject<HTMLInputElement>;
    const input = refelem !== null ? refelem.current : null;
    if (input === null) return;

    switch (e.key) {
      case 'Escape': {
        this.setState({ book, pattern: /.*/, autocomp: true });
        break;
      }
      case 'Enter': {
        if (typeof onChange === 'function') {
          e.type = 'change';
          onChange(e);
          e.stopPropagation();
        }
        break;
      }
      case 'Backspace': {
        this.setState({ book: undefined, pattern: /.*/, autocomp: false });
        break;
      }
      default:
    }
  };

  textboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { autocomp } = this.state as BookselectState;
    if (autocomp) {
      const loc = this.parser.parse(e.target.value, null)?.location;
      if (loc) {
        this.setState({
          book: loc.book,
          pattern: /[\s\d.:-]+$/,
          autocomp: false,
        });
      }
    } else if (/^\s*$/.test(e.target.value)) {
      this.setState({ pattern: /.*/, autocomp: true });
    }
    e.stopPropagation();
  };

  selectChange = (e: React.SyntheticEvent) => {
    const es = e as React.ChangeEvent<HTMLSelectElement>;
    this.setState({ book: es.target.value, pattern: /.*/, autocomp: true });
  };

  render() {
    const props = this.props as BookselectProps;
    const state = this.state as BookselectState;

    // book (and thus bookName) may be undefined. This is a necessary
    // option as it is the only way to update Bookselect state without
    // effecting Textbox state.
    const { book } = state;
    const { Books } = G;
    let bookName = book;
    for (let x = 0; x < Books.length; x += 1) {
      if (book && Books[x].code === book) bookName = Books[x].name;
    }

    return (
      <Box {...addClass('bookselect xsinput', props)}>
        <Stack>
          <Box style={xulStyle(props)}>
            <Menulist
              id={`${props.id}__menulist`}
              options={this.getBookOptions()}
              disabled={props.disabled}
              value={book ?? ''}
              onChange={this.selectChange}
            />
          </Box>
          <Box style={xulStyle(props)}>
            <Textbox
              id={`${props.id}__textbox`}
              value={bookName}
              pattern={state.pattern}
              disabled={props.disabled}
              onChange={this.textboxChange}
              onKeyDown={this.textboxKeyDown}
              onClick={this.focusChange}
              onBlur={this.focusChange}
              inputRef={this.textInput}
            />
            <Spacer />
          </Box>
        </Stack>
      </Box>
    );
  }
}
Bookselect.propTypes = propTypes;

export default Bookselect;
