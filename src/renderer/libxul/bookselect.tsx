/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import C from '../../constant';
import G from '../rg';
import { parseLocation } from '../rutil';
import Tooltip from './tooltip';
import {
  addClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  xulStyle,
} from './xul';
import { Box, Hbox } from './boxes';
import Spacer from './spacer';
import Stack from './stack';
import Menulist from './menulist';
import Textbox from './textbox';
import './xul.css';
import './bookselect.css';

import type { BookType } from '../../type';

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

const defaultProps = {
  ...xulDefaultProps,
  book: undefined,
  disabled: false,
  onlyavailablebooks: false,
  sizetopopup: undefined,
  tooltip: undefined,
  trans: '',
};

const propTypes = {
  ...xulPropTypes,
  book: PropTypes.string,
  disabled: PropTypes.bool,
  onlyavailablebooks: PropTypes.bool,
  sizetopopup: PropTypes.string,
  tooltip: PropTypes.string,
  trans: PropTypes.string,
};

interface BookselectProps extends XulProps {
  book?: string | undefined;
  disabled?: boolean | undefined;
  onlyavailablebooks?: boolean | undefined;
  sizetopopup?: string | undefined;
  tooltip?: string | undefined;
  trans: string;
}

interface BookselectState {
  book: string | undefined;
  pattern: RegExp;
  autocomp: boolean;
}

class Bookselect extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  textInput: React.RefObject<HTMLInputElement>;

  constructor(props: BookselectProps) {
    super(props);

    this.state = { book: props.book, pattern: /.*/, autocomp: true };

    this.textInput = React.createRef();

    this.getBookOptions = this.getBookOptions.bind(this);
    this.textboxChange = this.textboxChange.bind(this);
    this.textboxKeyDown = this.textboxKeyDown.bind(this);
    this.selectChange = this.selectChange.bind(this);
    this.focusChange = this.focusChange.bind(this);
  }

  getBookOptions = (): PropTypes.ReactElementLike[] => {
    const { onlyavailablebooks, trans } = this.props as BookselectProps;
    const { book } = this.state as BookselectState;
    let books;
    if (trans && onlyavailablebooks) {
      const t = trans.split(/\s*,\s*/)[0];
      const abs =
        t in G.BooksInModule
          ? G.BooksInModule[t]
          : C.SupportedBooks.ot.concat(C.SupportedBooks.nt);
      books = abs.map((bk: string) => {
        let longName = bk;
        for (let x = 0; x < G.Books.length; x += 1) {
          if (G.Books[x].code === bk) longName = G.Books[x].longname;
        }
        return (
          <option key={bk} value={bk}>
            {longName}
          </option>
        );
      });
    } else {
      books = G.Books.map((bke: BookType) => {
        return (
          <option key={bke.code} value={bke.code}>
            {bke.longname}
          </option>
        );
      });
    }

    // If book is not defined (no selection) then first item is always
    // selected, and thus onChange will not fire when chosen by the
    // user. An empty selection at the top of the list means all valid
    // selections will fire onChange.
    if (!book) {
      books.unshift(<option key="no-selection" />);
    }

    return books;
  };

  focusChange = (e: React.FocusEvent) => {
    const { book } = this.props as BookselectProps;
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
    const { book, onChange } = this.props as BookselectProps;
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
      const bk = parseLocation(e.target.value, true, true);
      if (bk !== null && bk.book !== null) {
        this.setState({
          book: bk.book,
          pattern: /[\s\d.:-]+$/,
          autocomp: false,
        });
      }
    } else if (/^\s*$/.test(e.target.value)) {
      this.setState({ pattern: /.*/, autocomp: true });
    }
    e.stopPropagation();
  };

  selectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    this.setState({ book: e.target.value, pattern: /.*/, autocomp: true });
  };

  render() {
    const props = this.props as BookselectProps;
    const state = this.state as BookselectState;

    // book (and thus bookName) may be undefined. This is a necessary
    // option as it is the only way to update Bookselect state without
    // effecting Textbox state.
    const { book } = state;
    let bookName = book;
    for (let x = 0; x < G.Books.length; x += 1) {
      if (book && G.Books[x].code === book) bookName = G.Books[x].name;
    }

    return (
      <Box {...addClass('bookselect', props)}>
        <Stack>
          <Box style={xulStyle(props)}>
            <Menulist
              id={`${props.id}__menulist`}
              options={this.getBookOptions()}
              disabled={props.disabled}
              value={book}
              onChange={this.selectChange}
            />
          </Box>
          <Hbox style={xulStyle(this.props)}>
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
            <Spacer width="20px" />
          </Hbox>

          <Tooltip tip={props.tooltip} />
        </Stack>
      </Box>
    );
  }
}
Bookselect.defaultProps = defaultProps;
Bookselect.propTypes = propTypes;

export default Bookselect;
