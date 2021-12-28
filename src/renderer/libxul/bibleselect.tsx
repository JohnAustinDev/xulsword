/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import C from '../../constant';
import { xulClass, xulDefaultProps, XulProps, xulPropTypes } from './xul';
import Bookselect from './bookselect';
import { Hbox } from './boxes';
import Label from './label';
import Menulist from './menulist';
import Spacer from './spacer';
import './xul.css';
import G from '../rg';

declare global {
  interface Window {
    ipc: any;
  }
}

const defaultProps = {
  ...xulDefaultProps,
  book: 'Gen',
  chapter: 1,
  verse: 1,
  lastverse: 1,
  trans: 'default',
  disabled: false,
  onlyavailablebooks: false,
  sizetopopup: 'none',
};

const propTypes = {
  ...xulPropTypes,
  book: PropTypes.string,
  chapter: PropTypes.number,
  verse: PropTypes.number,
  lastverse: PropTypes.number,
  trans: PropTypes.string,
  disabled: PropTypes.bool,
  onlyavailablebooks: PropTypes.bool,
  sizetopopup: PropTypes.oneOf(['none', 'always']),
};

interface BibleselectProps extends XulProps {
  book: string;
  chapter: number;
  verse: number;
  lastverse: number;
  trans: string;
  propBook: string;
  propChapter: number;
  propVerse: number;
  propLastverse: number;
  propTrans: string;
  disabled: boolean;
  onlyavailablebooks: boolean;
  options: PropTypes.ReactElementLike[] | null;
  sizetopopup: string;
}

interface BibleselectState {
  book: string;
  chapter: number;
  verse: number;
  lastverse: number;
  trans: string;
  propBook: string;
  propChapter: number;
  propVerse: number;
  propLastverse: number;
  propTrans: string;
}

type BSevent =
  | React.ChangeEvent<HTMLInputElement>
  | React.ChangeEvent<HTMLSelectElement>;

// React Bibleselect
class Bibleselect extends React.Component {
  static translationOptions: PropTypes.ReactElementLike[] | undefined;

  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  constructor(props: BibleselectProps) {
    super(props);
    this.state = {
      book: 'Gen',
      chapter: 1,
      verse: 1,
      lastverse: 1,
      trans: 'default',
      propBook: undefined,
      propChapter: undefined,
      propVerse: undefined,
      propLastverse: undefined,
      propTrans: undefined,
    };

    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(e: BSevent, onChange?: (e: BSevent) => void) {
    const { book, chapter, verse, lastverse, trans } = this
      .props as BibleselectProps;
    if (e.target.classList.contains('bsbook')) {
      this.setState({
        book: e.target.value,
        propBook: book,
      });
    } else if (e.target.classList.contains('bschapter')) {
      this.setState({
        chapter: e.target.value,
        propChapter: chapter,
      });
    } else if (e.target.classList.contains('bsverse')) {
      this.setState({
        verse: e.target.value,
        propVerse: verse,
      });
    } else if (e.target.classList.contains('bslastverse')) {
      this.setState({
        lastverse: e.target.value,
        propLastverse: lastverse,
      });
    } else if (e.target.classList.contains('bstrans')) {
      this.setState({
        trans: e.target.value,
        propTrans: trans,
      });
    }

    if (typeof onChange === 'function') onChange(e);
  }

  static getTranslationOptions() {
    const translations = [];
    const tabs = G.Tabs;
    for (let m = 0; m <= tabs.length; m += 1) {
      if (tabs[m].type === C.BIBLE) {
        let description = G.LibSword.getModuleInformation(
          tabs[m].module,
          'Description'
        );
        if (description === C.NOTFOUND) description = '';
        translations.push(
          <option className={`cs-${tabs[m].locName}`} value={tabs[m].module}>
            <span className="name">{`${tabs[m].label}`}</span>
            {description && (
              <span className="description">{`${description}`}</span>
            )}
          </option>
        );
      }
    }
    return translations;
  }

  render() {
    const {
      book: sbook,
      chapter: schapter,
      verse: sverse,
      lastverse: slastverse,
      trans: strans,
    } = this.state as BibleselectState;

    const {
      id: pid,
      book: pbook,
      chapter: pchapter,
      verse: pverse,
      lastverse: plastverse,
      trans: ptrans,
      disabled: pdisabled,
      onlyavailablebooks: ponlyavailablebooks,
      sizetopopup: psizetopopup,
    } = this.props as BibleselectProps;

    const { propBook, propChapter, propVerse, propLastverse, propTrans } = this
      .state as BibleselectState;

    const { handleChange } = this;

    // If a props.value has been changed, use it to set a new value.
    let newBook = sbook;
    let newChapter = schapter;
    let newVerse = sverse;
    let newLastverse = slastverse;
    let newTrans = strans;
    if (pbook !== null && propBook !== pbook) {
      newBook = pbook;
    }
    if (pchapter !== null && propChapter !== pchapter) {
      newChapter = pchapter;
    }
    if (pverse !== null && propVerse !== pverse) {
      newVerse = pverse;
    }
    if (plastverse !== null && propLastverse !== plastverse) {
      newLastverse = plastverse;
    }
    if (ptrans !== null && propTrans !== ptrans) {
      newTrans = ptrans;
    }

    // Get updated select options
    const lastChapter = G.LibSword.getMaxChapter(newTrans, newBook);
    const chapters = [];
    for (let x = 1; x <= lastChapter; x += 1) {
      chapters.push(
        <option selected={x === newChapter} value={x}>
          {x}
        </option>
      );
    }
    const lastverse = G.LibSword.getMaxVerse(
      newTrans,
      `${newBook}.${newChapter}`
    );
    const verses = [];
    for (let x = 1; x <= lastverse; x += 1) {
      verses.push(
        <option selected={x === newVerse} value={x}>
          {x}
        </option>
      );
    }
    const lastverses = [];
    for (let x = newVerse; x <= lastverse; x += 1) {
      lastverses.push(
        <option selected={x === newLastverse} value={x}>
          {x}
        </option>
      );
    }

    return (
      <Hbox {...this.props} className={xulClass('bibleselect', this.props)}>
        <Bookselect
          id={`${pid}__bsbook`}
          className="bsbook"
          book={newBook}
          trans={newTrans}
          disabled={pdisabled}
          onlyavailablebooks={ponlyavailablebooks}
          sizetopopup={psizetopopup}
          onChange={handleChange}
        />

        <Menulist
          id={`${pid}__bschapter`}
          className="bschapter"
          disabled={pdisabled}
          options={chapters}
          onChange={handleChange}
        />

        <Label className="colon" value=":" />

        <Menulist
          id={`${pid}__bsverse`}
          className="bsverse"
          disabled={pdisabled}
          options={verses}
          onChange={handleChange}
        />

        <Label className="dash" value="&#8211;" />

        <Menulist
          id={`${pid}__bslastverse`}
          className="bslastverse"
          disabled={pdisabled}
          options={lastverses}
          onChange={handleChange}
        />

        <Spacer width="27px" />

        <Menulist
          id={`${pid}__bstrans`}
          className="bstrans"
          disabled={pdisabled}
          options={Bibleselect.translationOptions}
          onChange={handleChange}
        />
      </Hbox>
    );
  }
}
Bibleselect.defaultProps = defaultProps;
Bibleselect.propTypes = propTypes;
Bibleselect.translationOptions = Bibleselect.getTranslationOptions();

export default Bibleselect;
