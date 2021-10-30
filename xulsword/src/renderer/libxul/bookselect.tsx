/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import Tooltip from './tooltip';
import {
  xulClass,
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
import { parseLocation } from '../rutil';
import G from '../gr';
import { BookType } from '../../type';
import { getAvailableBooks } from '../../common';
import './xul.css';
import './bookselect.css';

// XUL Bookselect
// This component contains an overlapping Textbox and Menulist.
// The Menulist's value does not appear (its selection is covered
// by the Textbox; however its drop-down menu button is visible).
// The Menulist only serves to allow book selection from the dropdown
// menu. The Textbox shows the selected Bible book name in the program
// locale. It can be changed by the user to another location, using
// auto-completed typing in the Textbox or selection via the drop-
// down Menulist. If the Textbox gains focus, the value will become
// selected. If the escape key is pressed while typing, or the
// textbox loses focus, then the textbox value is returned to what
// it originally was. The Bookselect onChange event will be fired
// only if the user selects a book from the drop-down Menulist, or
// presses the Enter key on the Textbox while it contains a valid
// Bible book name (if Enter is pressed without a valid book name,
// the Textbox is returned to its original value without firing
// onChange.

const defaultProps = {
  ...xulDefaultProps,
  book: null,
  disabled: undefined,
  onlyavailablebooks: null,
  sizetopopup: null,
  tooltip: undefined,
  trans: 'KJV',
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
  book?: string | null;
  disabled?: boolean | undefined;
  onlyavailablebooks?: boolean | null;
  sizetopopup?: string | null;
  tooltip?: string | undefined;
  trans: string;
}

interface BookselectState {
  book: string | null;
  propBook: string | undefined;
}

class Bookselect extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  textInput: React.RefObject<Textbox>;

  constructor(props: BookselectProps) {
    super(props);

    this.state = { book: props.book, propBook: props.book };

    this.textInput = React.createRef();

    this.getBookOptions = this.getBookOptions.bind(this);
    this.textboxChange = this.textboxChange.bind(this);
    this.textboxKeyDown = this.textboxKeyDown.bind(this);
    this.selectChange = this.selectChange.bind(this);
    this.focusChange = this.focusChange.bind(this);
  }

  getBookOptions = (): PropTypes.ReactElementLike[] => {
    const { onlyavailablebooks, trans } = this.props as BookselectProps;
    if (onlyavailablebooks) {
      if (trans !== null) {
        const abs = getAvailableBooks(trans.split(/\s*,\s*/)[0], G);
        return abs.map((bk: string) => {
          let longName = bk;
          for (let x = 0; x < G.Book.length; x += 1) {
            if (G.Book[x].sName === bk) longName = G.Book[x].bNameL;
          }
          return (
            <option key={bk} value={bk}>
              {longName}
            </option>
          );
        });
      }
      throw Error(
        `The tran attribute must be set when onlyavailablebooks is set`
      );
    }

    return G.Book.map((bke: BookType) => {
      return (
        <option key={bke.sName} value={bke.sName}>
          {bke.bNameL}
        </option>
      );
    });
  };

  focusChange = (e: React.FocusEvent) => {
    const { book } = this.props as BookselectProps;
    const refelem = this
      .textInput as unknown as React.RefObject<HTMLInputElement>;
    const input = refelem !== null ? refelem.current : null;
    if (e.type === 'focus') {
      if (input !== null) input.select();
    } else if (e.type === 'blur') {
      this.setState({ book, propBook: book });
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
        this.setState({ book, propBook: book });
        break;
      }
      case 'Enter': {
        const { value } = e.target as HTMLInputElement;
        const bk = parseLocation(value);
        const newBook = bk === null ? book : bk.book;
        this.setState({ book: newBook, propBook: book });
        if (typeof onChange === 'function') {
          e.type = 'change';
          onChange(e);
          e.stopPropagation();
        }
        break;
      }
      default:
    }
  };

  textboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { book: pbook } = this.props as BookselectProps;
    const { book: sbook } = this.state as BookselectState;
    const bk = parseLocation(e.target.value);
    if (bk !== null && bk.book !== sbook) {
      this.setState({ book: bk.book, propBook: pbook });
    }
    e.stopPropagation;
  };

  selectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { book } = this.props as BookselectProps;
    this.setState({ book: e.target.value, propBook: book });
  };

  render() {
    const { id, book, disabled, tooltip, trans } = this
      .props as BookselectProps;

    const { book: sBook, propBook } = this.state as BookselectState;

    // As a 'Controlled' React input, we use state as the source of
    // truth and overwrite the input's value property with it. But when
    // props.value has been changed, use it to set the new value.
    let newBook = sBook;
    if (typeof book === 'string' && (book !== propBook || sBook === propBook)) {
      newBook = book;
    }

    if (newBook === null) {
      newBook = getAvailableBooks(trans.split(/\s*,\s*/)[0], G);
      newBook = Array.isArray(newBook) && newBook[0] ? newBook[0] : 'Matt';
    }

    const books = this.getBookOptions();

    let newBookName = newBook;
    for (let x = 0; x < G.Book.length; x += 1) {
      if (G.Book[x].sName === newBook) newBookName = G.Book[x].bName;
    }

    return (
      <Box {...this.props} className={xulClass('bookselect', this.props)}>
        <Stack>
          <Box style={xulStyle(this.props)}>
            <Menulist
              id={`${id}__menulist`}
              options={books}
              disabled={disabled}
              onChange={this.selectChange}
            />
          </Box>
          <Hbox style={xulStyle(this.props)}>
            <Textbox
              id={`${id}__textbox`}
              value={newBookName}
              disabled={disabled}
              onChange={this.textboxChange}
              onKeyDown={this.textboxKeyDown}
              onFocus={this.focusChange}
              onBlur={this.focusChange}
              inputRef={this.textInput}
            />
            <Spacer width="14px" />
          </Hbox>

          <Tooltip tip={tooltip} />
        </Stack>
      </Box>
    );
  }
}
Bookselect.defaultProps = defaultProps;
Bookselect.propTypes = propTypes;

export default Bookselect;
