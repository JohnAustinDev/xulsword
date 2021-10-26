/* eslint-disable react/static-property-placement */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import Tooltip from './tooltip';
import {
  keep,
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  xulStyle,
} from './xul';
import { Hbox } from './boxes';
import Menulist from './menulist';
import Textbox from './textbox';
import { parseLocation } from '../rutil';
import G from '../rglobal';
import { BookType } from '../../type';
import { getAvailableBooks } from '../../common';
import './xul.css';

// XUL Booklist
// This component contains both a Textbox and a Menulist.
// The Menulist does not show a selection, but only serves
// to allow book selection from a dropdown menu. The Textbox
// shows the current book initially and can also be changed
// by the user (using auto-complete) to another location.
// If the escape key is pressed, or the textbox loses focus,
// then the textbox value is returned to what it originally
// was. If the user presses the return key on the Textbox, or
// selects a book from the dropdown, then the Booklist onChange
// will be called.
class Booklist extends React.Component {
  static defaultProps: unknown;

  static propTypes: unknown;

  propBook: string | null | undefined;

  constructor(props: BooklistProps) {
    super(props);

    this.state = { book: null };

    this.propBook = undefined;

    this.getBookOptions = this.getBookOptions.bind(this);
    this.textboxChange = this.textboxChange.bind(this);
    this.textboxKeyDown = this.textboxKeyDown.bind(this);
    this.selectChange = this.selectChange.bind(this);
  }

  getBookOptions = (): PropTypes.ReactElementLike[] => {
    const { onlyavailablebooks, trans } = this.props as BooklistProps;
    if (onlyavailablebooks) {
      if (trans !== null) {
        const abs = getAvailableBooks(G, trans.split(/\s*,\s*/)[0]);
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

  textboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const autocomplete = parseLocation(e.target.value);
    if (autocomplete !== null && autocomplete.shortName !== null) {
      let name = autocomplete.shortName;
      for (let x = 0; x < G.Book.length; x += 1) {
        if (G.Book[x].sName === autocomplete.shortName) name = G.Book[x].bName;
      }
      this.setState({ book: name });
    }
  };

  textboxKeyDown = (e: React.KeyboardEvent) => {
    const { onChange } = this.props as BooklistProps;
    switch (e.key) {
      case 'Escape': {
        const { book } = this.props as BooklistProps;
        this.setState({ book });
        break;
      }
      case 'Enter':
        if (typeof onChange === 'function') {
          onChange(e);
        }
        break;

      default:
    }
  };

  selectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { onChange } = this.props as BooklistProps;
    this.setState({ book: e.target.value });
    if (typeof onChange === 'function') onChange(e);
  };

  render() {
    const { book, disabled, tooltip, trans } = this.props as BooklistProps;

    const { book: sBook } = this.state as BooklistState;

    // If props.book has changed, always update book to that value,
    // otherwise use state.
    let newBook = book === this.propBook ? sBook : book;
    this.propBook = book;
    if (newBook === null) {
      newBook = getAvailableBooks(G, trans.split(/\s*,\s*/)[0]);
      newBook = Array.isArray(newBook) && newBook[0] ? newBook[0] : 'Matt';
    }

    const books = this.getBookOptions();

    let newBookName = newBook;
    for (let x = 0; x < G.Book.length; x += 1) {
      if (G.Book[x].sName === newBook) newBookName = G.Book[x].bName;
    }

    return (
      <Hbox
        className={xulClass('booklist', this.props)}
        {...keep(this.props)}
        style={xulStyle(this.props)}
      >
        <Textbox
          value={newBookName}
          disabled={disabled}
          onChange={this.textboxChange}
          onKeyDown={this.textboxKeyDown}
        />

        <Menulist
          disabled={disabled}
          onChange={this.selectChange}
          options={books}
        />

        <Tooltip tip={tooltip} />
      </Hbox>
    );
  }
}
Booklist.defaultProps = {
  ...xulDefaultProps,
  book: null,
  disabled: undefined,
  onlyavailablebooks: null,
  sizetopopup: null,
  tooltip: undefined,
  trans: 'KJV',
};
Booklist.propTypes = {
  ...xulPropTypes,
  book: PropTypes.string,
  disabled: PropTypes.bool,
  onlyavailablebooks: PropTypes.bool,
  sizetopopup: PropTypes.string,
  tooltip: PropTypes.string,
  trans: PropTypes.string,
};

interface BooklistProps extends XulProps {
  book?: string | null;
  disabled?: boolean | undefined;
  onlyavailablebooks?: boolean | null;
  sizetopopup?: string | null;
  tooltip?: string | undefined;
  trans: string;
}

interface BooklistState {
  book: string | null;
}

export default Booklist;
