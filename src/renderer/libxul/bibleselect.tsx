/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import C from '../../constant';
import G from '../rg';
import { getMaxChapter, getMaxVerse } from '../rutil';
import { addClass, xulDefaultProps, XulProps, xulPropTypes } from './xul';
import Bookselect from './bookselect';
import { Hbox } from './boxes';
import Label from './label';
import Menulist from './menulist';
import Spacer from './spacer';
import './xul.css';

import type { BookGroupType } from '../../type';

const defaultProps = {
  ...xulDefaultProps,
  book: 'Gen',
  chapter: 1,
  verse: 1,
  lastverse: 1,
  trans: [],
  disabled: false,
  sizetopopup: 'none',
  books: ['ot', 'nt'],
};

const propTypes = {
  ...xulPropTypes,
  book: PropTypes.string,
  chapter: PropTypes.number,
  verse: PropTypes.number,
  lastverse: PropTypes.number,
  trans: PropTypes.arrayOf(PropTypes.string),
  disabled: PropTypes.bool,
  sizetopopup: PropTypes.oneOf(['none', 'always']),
  books: PropTypes.arrayOf(PropTypes.string),
};

interface BibleselectProps extends XulProps {
  book: string;
  chapter: number;
  verse: number;
  lastverse: number;
  trans: string[];
  disabled: boolean;
  sizetopopup: string;
  books: (BookGroupType | string)[];
}

interface BibleselectState {
  book: string;
  chapter: string;
  verse: string;
  lastverse: string;
  trans: string;
}

type BSevent =
  | React.ChangeEvent<HTMLInputElement>
  | React.ChangeEvent<HTMLSelectElement>;

// React Bibleselect
class Bibleselect extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  constructor(props: BibleselectProps) {
    super(props);
    const { book: bk, chapter: ch, verse: vs, lastverse: lv } = props;
    const book = bk || 'Gen';
    const chapter = ch ? ch.toString() : '1';
    const verse = vs ? vs.toString() : '1';
    const lastverse = lv ? lv.toString() : '1';
    const trans = props.trans[1] || '';
    const s: BibleselectState = {
      book,
      chapter,
      verse,
      lastverse,
      trans,
    };
    this.state = s;

    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(e: BSevent, onChange?: (e: BSevent) => void) {
    if (e.target.classList.contains('bsbook')) {
      this.setState({
        book: e.target.value,
      });
    } else if (e.target.classList.contains('bschapter')) {
      this.setState({
        chapter: e.target.value,
      });
    } else if (e.target.classList.contains('bsverse')) {
      this.setState({
        verse: e.target.value,
      });
    } else if (e.target.classList.contains('bslastverse')) {
      this.setState({
        lastverse: e.target.value,
      });
    } else if (e.target.classList.contains('bstrans')) {
      this.setState({
        trans: e.target.value,
      });
    }

    if (typeof onChange === 'function') onChange(e);
  }

  render() {
    const { book, chapter, verse, lastverse, trans } = this
      .state as BibleselectState;
    const { books, trans: translist } = this.props as BibleselectProps;

    const { id: pid, disabled, sizetopopup } = this.props as BibleselectProps;

    const { handleChange } = this;

    const tab = (trans && G.Tab[trans]) || null;
    const v11n = (tab && tab.v11n) || null;

    // Bible translation options
    const tops = translist.length
      ? translist
      : G.Tabs.filter((t) => t.type === C.BIBLE).map((t) => t.module);

    const translationOptions = tops.map((m) => {
      const t = G.Tab[m];
      return (
        <option key={m} className={`cs-${t.module}`} value={t.module}>
          <span className="name">{`${t.label}`}</span>
          {t.description && (
            <span className="description">{`${t.description}`}</span>
          )}
        </option>
      );
    });

    // Bible book options
    const booklist: string[] = [];
    books.forEach((bkbg: BookGroupType | string) => {
      const bg = (
        C.SupportedBookGroups.includes(bkbg as BookGroupType) ? bkbg : null
      ) as BookGroupType | null;
      if (bg) {
        booklist.push(...C.SupportedBooks[bg]);
      } else {
        booklist.push(bkbg);
      }
    });

    // Bible chapter options
    const mc = v11n ? getMaxChapter(v11n, book) : 0;
    const chapters = [];
    for (let x = 1; x <= mc; x += 1) {
      chapters.push(
        <option key={x} value={x}>
          {x}
        </option>
      );
    }

    // Bible verse options
    const mv = v11n ? getMaxVerse(v11n, `${book}.${chapter}`) : 0;
    const verses = [];
    for (let x = 1; x <= mv; x += 1) {
      verses.push(
        <option key={x} value={x}>
          {x}
        </option>
      );
    }

    // Bible last-verse options
    const lastverses = [];
    for (let x = Number(verse); x <= mv; x += 1) {
      lastverses.push(
        <option key={x} value={x}>
          {x}
        </option>
      );
    }

    return (
      <Hbox {...addClass('bibleselect', this.props)}>
        <Bookselect
          id={`${pid}__bsbook`}
          className="bsbook"
          selection={book}
          options={booklist}
          disabled={disabled}
          sizetopopup={sizetopopup}
          onChange={handleChange}
        />

        <Menulist
          id={`${pid}__bschapter`}
          className="bschapter"
          disabled={disabled}
          value={chapter.toString()}
          options={chapters}
          onChange={handleChange}
        />

        <Label className="colon" value=":" />

        <Menulist
          id={`${pid}__bsverse`}
          className="bsverse"
          disabled={disabled}
          value={verse.toString()}
          options={verses}
          onChange={handleChange}
        />

        <Label className="dash" value="&#8211;" />

        <Menulist
          id={`${pid}__bslastverse`}
          className="bslastverse"
          disabled={disabled}
          value={lastverse.toString()}
          options={lastverses}
          onChange={handleChange}
        />

        <Spacer width="27px" />

        <Menulist
          id={`${pid}__bstrans`}
          className="bstrans"
          disabled={disabled}
          value={trans}
          options={translationOptions}
          onChange={handleChange}
        />
      </Hbox>
    );
  }
}
Bibleselect.defaultProps = defaultProps;
Bibleselect.propTypes = propTypes;

export default Bibleselect;
