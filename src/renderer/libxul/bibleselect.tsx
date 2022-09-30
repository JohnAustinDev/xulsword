/* eslint-disable no-nested-ternary */
/* eslint-disable react/forbid-prop-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { clone, ofClass } from '../../common';
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
import ModuleMenu from './modulemenu';

export type BibleselectSelection = {
  tran?: string;
  book?: string;
  chapter?: number;
  lastchapter?: number;
  verse?: number;
  lastverse?: number;
};

// If left undefined, valid lists will be automatically created. Otherwise
// only the listed options will be provided. If there are no options (an
// empty array) then the corresponding selector will be hidden.
export type BibleselectOptions = {
  trans?: string[];
  books?: string[];
  chapters?: number[];
  lastchapters?: number[];
  verses?: number[];
  lastverses?: number[];
};

const defaultProps = {
  ...xulDefaultProps,
  initialSelection: {
    tran: 'KJV',
    book: 'Gen',
    chapter: 1,
    lastChapter: undefined,
    verse: 1,
    lastverse: 1,
  },
  options: {
    trans: [],
    books: undefined,
    chapters: undefined,
    verses: undefined,
    lastChapters: [],
    lastverses: undefined,
  },
  disabled: false,
  sizetopopup: 'none',
  onSelectionChange: undefined,
};

const propTypes = {
  ...xulPropTypes,
  initialSelection: PropTypes.shape({
    tran: PropTypes.string,
    book: PropTypes.string,
    chapter: PropTypes.number,
    verse: PropTypes.number,
    lastchapter: PropTypes.number,
    lastverse: PropTypes.number,
  }),
  options: PropTypes.shape({
    trans: PropTypes.arrayOf(PropTypes.string),
    books: PropTypes.arrayOf(PropTypes.string),
    chapters: PropTypes.arrayOf(PropTypes.number),
    verses: PropTypes.arrayOf(PropTypes.number),
    lastchapters: PropTypes.arrayOf(PropTypes.number),
    lastverses: PropTypes.arrayOf(PropTypes.number),
  }),
  disabled: PropTypes.bool,
  sizetopopup: PropTypes.oneOf(['none', 'always']),
  onSelectionChange: PropTypes.func,
};

interface BibleselectProps extends XulProps {
  initialSelection: BibleselectSelection;
  options: BibleselectOptions;
  disabled: boolean;
  sizetopopup: string;
  onSelectionChange: (
    e: BibleselectChangeEvents,
    selection: BibleselectSelection
  ) => void;
}

interface BibleselectState {
  selection: BibleselectSelection;
}

export type BibleselectChangeEvents =
  | React.ChangeEvent<HTMLInputElement>
  | React.ChangeEvent<HTMLSelectElement>;

// React Bibleselect
class Bibleselect extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  constructor(props: BibleselectProps) {
    super(props);

    const { initialSelection } = props;
    this.state = { selection: initialSelection } as BibleselectState;

    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(es: React.SyntheticEvent) {
    const e = es as BibleselectChangeEvents;
    const cls = ofClass(
      [
        'bstrans',
        'bsbook',
        'bschapter',
        'bslastchapter',
        'bsverse',
        'bslastverse',
      ],
      e.target
    );
    if (cls) {
      let { selection } = this.state as BibleselectState;
      selection = clone(selection);
      const { onSelectionChange } = this.props as BibleselectProps;
      const { value } = e.target;
      switch (cls.type) {
        case 'bstrans': {
          selection.tran = value;
          break;
        }
        case 'bsbook': {
          selection.book = value;
          break;
        }
        case 'bschapter': {
          selection.chapter = Number(value);
          break;
        }
        case 'bslastchapter': {
          selection.lastchapter = Number(value);
          break;
        }
        case 'bsverse': {
          selection.verse = Number(value);
          break;
        }
        case 'bslastverse': {
          selection.lastverse = Number(value);
          break;
        }
        default:
          throw new Error(`Unexpected Bibleselect class: '${cls.type}'`);
      }
      this.setState({ selection });
      if (typeof onSelectionChange === 'function') {
        onSelectionChange(e, selection);
      }
    }
  }

  render() {
    const props = this.props as BibleselectProps;
    const { selection } = this.state as BibleselectState;
    const { book, chapter, verse, lastverse, lastchapter, tran } = selection;
    const { options, disabled, sizetopopup } = props;
    const { trans, books, chapters, lastchapters, verses, lastverses } =
      options;
    const { handleChange } = this;

    const tab = (tran && G.Tab[tran]) || null;
    const v11n = (tab && tab.v11n) || 'KJV';

    // Bible book options
    const nb = books || ['ot', 'nt'];
    const bookset: Set<string> = new Set();
    nb.forEach((bkbg: BookGroupType | string) => {
      const bg = (
        C.SupportedBookGroups.includes(bkbg as BookGroupType) ? bkbg : null
      ) as BookGroupType | null;
      if (bg) {
        C.SupportedBooks[bg].forEach((b) => bookset.add(b));
      } else {
        bookset.add(bkbg);
      }
    });
    const { Book } = G;
    const newbooks = Array.from(bookset)
      .sort((a, b) => {
        const aa = Book[a];
        const bb = Book[b];
        if (!aa) return -1;
        if (!bb) return 1;
        return aa.index > bb.index ? 1 : aa.index < bb.index ? -1 : 0;
      })
      .filter((code) => Book[code]);

    // Bible chapter options
    let mc = chapters;
    if (!mc) {
      mc = [];
      for (
        let x = 1;
        x <= (v11n && book ? getMaxChapter(v11n, book) : 0);
        x += 1
      ) {
        mc.push(x);
      }
    }
    const newchapters = mc.map((ch) => (
      <option key={ch} value={ch}>
        {ch}
      </option>
    ));

    // Bible last chapter options
    if (lastchapters) mc = lastchapters;
    const newlastchapters = mc.map((ch) => (
      <option key={ch} value={ch}>
        {ch}
      </option>
    ));

    // Bible verse options
    let mv = verses;
    if (!mv) {
      mv = [];
      for (
        let x = 1;
        x <= (v11n ? getMaxVerse(v11n, `${book}.${chapter}`) : 0);
        x += 1
      ) {
        mv.push(x);
      }
    }
    const newverses = mv.map((vs) => (
      <option key={vs} value={vs}>
        {vs}
      </option>
    ));

    // Bible last-verse options
    if (lastverses) mv = lastverses;
    const newlastverses = mv.map((vs) => (
      <option key={vs} value={vs}>
        {vs}
      </option>
    ));

    return (
      <Hbox {...addClass('bibleselect', this.props)}>
        {newbooks.length > 0 && (
          <Bookselect
            className="bsbook"
            selection={book}
            options={newbooks}
            sizetopopup={sizetopopup}
            disabled={disabled}
            onChange={handleChange}
          />
        )}

        {newchapters.length > 0 && (
          <Menulist
            className="bschapter"
            value={(chapter || 1).toString()}
            options={newchapters}
            disabled={disabled}
            onChange={handleChange}
          />
        )}

        {newverses.length > 0 && (
          <>
            <Label className="colon" value=":" />
            <Menulist
              className="bsverse"
              value={(verse || 1).toString()}
              options={newverses}
              disabled={disabled}
              onChange={handleChange}
            />
          </>
        )}

        {((newverses.length > 0 && newlastverses.length > 0) ||
          (newchapters.length > 0 && newlastchapters.length > 0)) && (
          <Label className="dash" value="&#8211;" />
        )}
        {newlastverses.length > 0 && (
          <Menulist
            className="bslastverse"
            value={(lastverse || verse || 1).toString()}
            options={newlastverses}
            disabled={disabled}
            onChange={handleChange}
          />
        )}
        {newlastchapters.length > 0 && (
          <Menulist
            className="bslastchapter"
            value={(lastchapter || chapter || 1).toString()}
            options={newlastchapters}
            disabled={disabled}
            onChange={handleChange}
          />
        )}
        <Spacer width="27px" />
        <ModuleMenu
          className="bstrans"
          value={tran}
          types={[C.BIBLE]}
          disabled={disabled}
          onChange={handleChange}
        />
      </Hbox>
    );
  }
}
Bibleselect.defaultProps = defaultProps;
Bibleselect.propTypes = propTypes;

export default Bibleselect;
