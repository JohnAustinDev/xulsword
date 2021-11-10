/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/mouse-events-have-key-events */
/* eslint-disable react/static-property-placement */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import i18next from 'i18next';
import React from 'react';
import PropTypes from 'prop-types';
import path from 'path';
import G from '../gr';
import C from '../../constant';
import { Hbox, Vbox } from '../libxul/boxes';
import { dString, findBookGroup, findBookNum } from '../../common';
import {
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  htmlAttribs,
  delayHandler,
} from '../libxul/xul';
import '../libxul/xul.css';
import './chooser.css';

// XUL stack
const defaultProps = {
  ...xulDefaultProps,
  availableBooks: ['Gen'],
  handler: undefined,
  headingsModule: undefined,
  selection: 'Gen',
  type: 'bible',
  versification: 'KJV',
};

const propTypes = {
  ...xulPropTypes,
  availableBooks: PropTypes.arrayOf(PropTypes.string),
  handler: PropTypes.func,
  headingsModule: PropTypes.string,
  selection: PropTypes.string,
  type: PropTypes.oneOf(['genbook', 'bible']),
  versification: PropTypes.string,
};

interface ChooserProps extends XulProps {
  availableBooks: string[];
  handler: (e: any) => void;
  headingsModule: string | undefined;
  selection: string;
  type: string;
  versification: string;
}

interface ChooserState {
  bookGroup: string;
  slideIndex: { [i: string]: number };
}

const slideSpeed = 50;

class Chooser extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  static cache: any;

  slideInterval: undefined | NodeJS.Timeout;

  rowHeight: number;

  chooserHeight: number;

  constructor(props: ChooserProps) {
    super(props);

    this.state = {
      bookGroup: findBookGroup(G, props.selection) || 'nt',
      slideIndex: {
        ot: 0,
        nt: 0,
      },
    };

    setTimeout(() => {
      this.startSlidingUp(null, 1, props.selection);
    }, 0);

    // this.chooserElem; can't be set until componentDidUpdate()
    this.rowHeight = 0;
    this.chooserHeight = 0;

    this.testamentMouseOver = this.testamentMouseOver.bind(this);
    this.startSlidingUp = this.startSlidingUp.bind(this);
    this.startSlidingDown = this.startSlidingDown.bind(this);
    this.stopSliding = this.stopSliding.bind(this);
    this.slideUp = this.slideUp.bind(this);
    this.slideDown = this.slideDown.bind(this);
    this.checkScroll = this.checkScroll.bind(this);
    this.onWheel = this.onWheel.bind(this);
  }

  componentDidUpdate() {
    const { id } = this.props as ChooserProps;
    const chooser = id
      ? document.getElementById(id)
      : document.getElementsByClassName('chooser')[0];
    const container = chooser?.getElementsByClassName('container')[0];
    const sizer = container?.getElementsByClassName('sizer-nt')[0];
    if (!container || !sizer) return;

    this.chooserHeight = container.clientHeight;
    const book = sizer?.getElementsByClassName('bookname')[0];
    if (!book) return;
    this.rowHeight = book.clientHeight;
  }

  testamentMouseOver = (e: any) => {
    let bookGroup: string;
    if (e.target.classList.contains('tbot')) bookGroup = 'ot';
    else if (e.target.classList.contains('tbnt')) bookGroup = 'nt';
    else return;
    if (this.state === bookGroup) return;
    delayHandler.call(
      this,
      () => {
        this.setState({ bookGroup });
      },
      300
    )(e);
  };

  checkScroll = (e: any) => {
    const scrollMargin = 2;
    const { bookGroup, slideIndex } = this.state as ChooserState;
    const targ = e.currentTarget.className.match(/bb_(\d+)\b/);
    if (targ === null) return;
    const over = Number(targ[1]) - (bookGroup === 'nt' ? C.NumOT : 0);
    const numSliderRows = Math.round(this.chooserHeight / this.rowHeight);
    const downScroller = slideIndex[bookGroup] + scrollMargin;
    const upScroller = slideIndex[bookGroup] + numSliderRows - scrollMargin;
    if (over <= downScroller) this.startSlidingDown(e, 100);
    else if (over >= upScroller) this.startSlidingUp(e, 100);
    else this.stopSliding();
  };

  onWheel = (e: any) => {
    if (e.deltaY < 0) this.slideDown(Math.round((-1 * e.deltaY) / 50));
    else if (e.deltaY > 0) this.slideUp(Math.round(e.deltaY / 50));
  };

  startSlidingUp = (_e: any, speed = slideSpeed, showBook?: string) => {
    if (this.slideInterval) return;
    this.slideInterval = setInterval(() => {
      this.slideUp(1, showBook);
    }, speed);
  };

  startSlidingDown = (_e: any, speed = slideSpeed) => {
    if (this.slideInterval) return;
    this.slideInterval = setInterval(() => {
      this.slideDown();
    }, speed);
  };

  stopSliding = () => {
    if (this.slideInterval) clearInterval(this.slideInterval);
    this.slideInterval = undefined;
  };

  slideUp = (x = 1, showBook?: string) => {
    const { bookGroup, slideIndex } = this.state as ChooserState;
    let numBooksInList;
    if (bookGroup === 'ot') numBooksInList = C.NumOT;
    else if (bookGroup === 'nt') numBooksInList = C.NumNT;
    else return;

    // If showBook is set and the book is visible, then stop.
    if (showBook && findBookGroup(G, showBook) === bookGroup) {
      let n = findBookNum(G, showBook);
      if (n !== null) {
        n -= bookGroup === 'nt' ? C.NumOT : 0;
        const c = n - Math.round(this.chooserHeight / this.rowHeight) + 3;
        if (slideIndex[bookGroup] >= c) {
          this.stopSliding();
          return;
        }
      }
    }

    const slideMaxIndex = numBooksInList - this.chooserHeight / this.rowHeight;
    if (slideIndex[bookGroup] >= slideMaxIndex) {
      this.stopSliding();
      return;
    }

    this.setState((prevState: ChooserState) => {
      prevState.slideIndex[bookGroup] += x;
      return prevState;
    });
  };

  slideDown = (x = 1) => {
    const { bookGroup, slideIndex } = this.state as ChooserState;
    if (bookGroup !== 'ot' && bookGroup !== 'nt') return;

    if (slideIndex[bookGroup] === 0) {
      this.stopSliding();
      return;
    }

    this.setState((prevState: ChooserState) => {
      prevState.slideIndex[bookGroup] -= x;
      return prevState;
    });
  };

  testamentButton = (tkey: string): React.ReactNode[] => {
    const name = i18next.exists(tkey) ? i18next.t(tkey) : '';
    if (/^\s*$/.test(name)) {
      const lng = G.Prefs.getCharPref(C.LOCALEPREF);
      const src = path.join(G.Dirs.path.xsAsset, `${tkey}_${lng}.png`);
      return [<img key={src} src={src} alt="" />];
    }
    return [...name].map((l, i) => {
      // eslint-disable-next-line react/no-array-index-key
      return <div key={`tb${i}`}>{l}</div>;
    });
  };

  chapterMenu = (b: number) => {
    const { versification } = this.props as ChooserProps;

    const k = `${versification}_${b}`;
    if (Chooser.cache[k]) return Chooser.cache[k];

    const elements = [];
    let ch = 1;
    // getMaxChapter should take a v11n! Until then must use KJV
    const lastch = G.LibSword.getMaxChapter(versification, G.Book[b].sName);
    for (let row = 1; row <= 1 + lastch / 10; row += 1) {
      const cells = [];
      let key = `${versification}${b}`;
      for (let col = 1; col <= 10; col += 1) {
        key = `${versification}${b}${ch}`;
        if (ch <= lastch) {
          cells.push(
            <div
              key={`1${key}`}
              className={`chaptermenucell cs-Program chmc_${b}_${ch}`}
            >
              {dString(ch)}
            </div>
          );
        } else {
          cells.push(<div key={`2${key}`} className="emptych" />);
        }
        ch += 1;
      }
      elements.push(
        <div key={`3${key}`} className="chaptermenurow">
          {cells}
        </div>
      );
      elements.push(<div key={`4${key}`} className="headingmenu" />);
    }
    Chooser.cache[k] = elements;

    return Chooser.cache[k];
  };

  bookGroupButtons = (
    group: string,
    selBook?: string,
    availBooks?: string[]
  ): React.ReactNode[] => {
    const start = group === 'ot' ? 0 : C.NumOT;
    const end = group === 'ot' ? C.NumOT : G.Book.length;
    const books = [];
    for (let b = start; b < end; b += 1) {
      const type =
        selBook === undefined && availBooks === undefined ? 'sizer' : 'bb';

      const bk = G.Book[b];
      const classes = [
        'bookname',
        `${type}_${b}`,
        selBook && bk.sName === selBook ? 'selected' : '',
        availBooks && !availBooks.includes(bk.sName) ? 'disabled' : '',
      ];

      books.push(
        <div
          key={`${type}_${b}`}
          className={classes.filter(Boolean).join(' ')}
          onMouseMove={this.checkScroll}
        >
          <div>
            <div>
              {bk.bName}
              {type === 'bb' && (
                <>
                  <div className="charrow" />
                  <div id={`chmenu_${b}`} className="chaptermenu">
                    {this.chapterMenu(b)}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      );
    }
    return books;
  };

  render() {
    const props = this.props as ChooserProps;
    const { availableBooks, selection, type } = this.props as ChooserProps;
    const { bookGroup, slideIndex } = this.state as ChooserState;
    return (
      <div {...htmlAttribs(`chooser ${type}`, this.props)}>
        <Vbox height="100%">
          <Hbox height="20px" className="fadetop" />
          <Hbox flex="5" className={`container ${bookGroup}`}>
            <Vbox className="testament-buttons" width="22px">
              <Vbox
                className="tbot"
                flex="50%"
                pack="center"
                align="center"
                onMouseOver={this.testamentMouseOver}
              >
                <div className="close-chooser" onClick={props.handler} />
                {this.testamentButton('OTtext')}
              </Vbox>
              <Vbox
                className="tbnt"
                flex="50%"
                pack="center"
                align="center"
                onMouseOver={this.testamentMouseOver}
              >
                {this.testamentButton('NTtext')}
              </Vbox>
            </Vbox>
            {/* The book-list contains multiple panels which are absolutely positioned
            allowing them to occupy the same space but with different top offsets. Absolute
            positioning requires duplicate content placement in order to size the panel
            container. */}
            <Vbox className="book-list" onWheel={this.onWheel}>
              <Vbox className="sizer-ot">{this.bookGroupButtons('ot')}</Vbox>
              <Vbox className="sizer-nt">{this.bookGroupButtons('nt')}</Vbox>
              <Vbox
                className="bbot"
                style={{ top: `${-1 * slideIndex.ot * this.rowHeight}px` }}
              >
                {this.bookGroupButtons('ot', selection, availableBooks)}
              </Vbox>
              <Vbox
                className="bbnt"
                style={{ top: `${-1 * slideIndex.nt * this.rowHeight}px` }}
              >
                {this.bookGroupButtons('nt', selection, availableBooks)}
              </Vbox>
            </Vbox>
          </Hbox>
          <Hbox flex="1" className="fadebot" />
        </Vbox>
      </div>
    );
  }
}
Chooser.defaultProps = defaultProps;
Chooser.propTypes = propTypes;
Chooser.cache = {};

export default Chooser;
