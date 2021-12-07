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
import G from '../rg';
import { Hbox, Vbox } from '../libxul/boxes';
import {
  bookGroupLength,
  dString,
  findBookGroup,
  findBookNum,
} from '../../common';
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
  bookGroups: ['ot', 'nt'],
  handler: undefined,
  headingsModule: undefined,
  hideUnavailableBooks: false,
  selection: 'Gen',
  type: 'bible',
  versification: 'KJV',
};

const propTypes = {
  ...xulPropTypes,
  availableBooks: PropTypes.arrayOf(PropTypes.string),
  bookGroups: PropTypes.arrayOf(PropTypes.string),
  handler: PropTypes.func,
  headingsModule: PropTypes.string,
  hideUnavailableBooks: PropTypes.bool,
  selection: PropTypes.string,
  type: PropTypes.oneOf(['bible', 'genbook', 'none']),
  versification: PropTypes.string,
};

interface ChooserProps extends XulProps {
  availableBooks: string[];
  bookGroups: string[];
  handler: (e: any) => void;
  headingsModule: string | undefined;
  hideUnavailableBooks: boolean;
  selection: string;
  type: string;
  versification: string;
}

interface ChooserState {
  bookGroup: string;
  slideIndex: { [i: string]: number };
}

const slideSpeed = 65;

class Chooser extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  static cache: any;

  slideInterval: undefined | NodeJS.Timeout;

  // Slide-scrolling cannot begin until after the first update because
  // layout dimensions must be known. Therefore, the following values
  // cannot be accessed until slideReady is set to true at the end of
  // updateDimensionVars().
  rowHeight: number;

  chooserHeight: number;

  sliderHeight: { [i: string]: number };

  slideReady: boolean;

  constructor(props: ChooserProps) {
    super(props);

    const bg = findBookGroup(G, props.selection)?.group;
    const si: any = {};
    props.bookGroups.forEach((g) => {
      si[g] = 0;
    });

    this.state = {
      bookGroup: bg && props.bookGroups.includes(bg) ? bg : props.bookGroups[0],
      slideIndex: si,
    };

    this.slideReady = false;

    setTimeout(() => {
      this.startSlidingUp(null, 1, props.selection);
    }, 0);

    this.rowHeight = 0;
    this.chooserHeight = 0;
    const sh: any = {};
    props.bookGroups.forEach((g) => {
      sh[g] = 0;
    });
    this.sliderHeight = sh;

    this.groupBarMouseOver = this.groupBarMouseOver.bind(this);
    this.startSlidingUp = this.startSlidingUp.bind(this);
    this.startSlidingDown = this.startSlidingDown.bind(this);
    this.stopSliding = this.stopSliding.bind(this);
    this.slideUp = this.slideUp.bind(this);
    this.slideDown = this.slideDown.bind(this);
    this.checkScroll = this.checkScroll.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.updateDimensionVars = this.updateDimensionVars.bind(this);
  }

  componentDidMount() {
    this.updateDimensionVars();
  }

  componentDidUpdate() {
    this.updateDimensionVars();
  }

  updateDimensionVars = () => {
    const { id, bookGroups } = this.props as ChooserProps;
    const { bookGroup } = this.state as ChooserState;
    const chooser = id
      ? document.getElementById(id)
      : document.getElementsByClassName('chooser')[0];
    const container = chooser?.getElementsByClassName('container')[0];
    const sliders: any = {};
    bookGroups.forEach((bg) => {
      sliders[bg] = container?.getElementsByClassName(`slider_${bg}`)[0];
    });
    const book = sliders[bookGroup]?.getElementsByClassName('bookname')[0];
    if (!container || !book) return;
    this.chooserHeight = container.clientHeight;
    this.rowHeight = book.clientHeight + 2; // 2px for the margin between rows
    bookGroups.forEach((bg) => {
      this.sliderHeight[bg] = sliders[bg].clientHeight;
    });
    this.slideReady = true;
  };

  groupBarMouseOver = (e: any) => {
    const { bookGroups } = this.props as ChooserProps;
    const bg = e.target.className.match(/\bbookgroup_(.+?)\b/);
    if (!bg || !bookGroups.includes(bg[1])) return;
    if (this.state === bg[1]) return;
    delayHandler.call(
      this,
      () => {
        this.setState({ bookGroup: bg[1] });
      },
      300
    )(e);
  };

  checkScroll = (e: any) => {
    if (!this.slideReady) return;
    const scrollMargin = 2; // mouse can be this close to top/bottom before scrolling
    const { bookGroup, slideIndex } = this.state as ChooserState;
    const bookname = e.currentTarget.className.match(/\bbookname_([\w\d]+)\b/);
    if (bookname === null) return;
    const index = findBookGroup(G, bookname[1])?.index;
    if (index === null || index === undefined) return;
    const numSliderRows = Math.round(this.chooserHeight / this.rowHeight);
    const downScroller = slideIndex[bookGroup] + scrollMargin;
    const upScroller = slideIndex[bookGroup] + numSliderRows - scrollMargin;
    if (index <= downScroller) this.startSlidingDown(e, slideSpeed);
    else if (index >= upScroller) this.startSlidingUp(e, slideSpeed);
    else this.stopSliding();
  };

  onWheel = (e: any) => {
    const wheelD = Math.round(e.deltaY / 50);
    if (Math.abs(wheelD) > 5) return;
    if (e.deltaY < 0) this.slideDown(-1 * wheelD);
    else if (e.deltaY > 0) this.slideUp(wheelD);
  };

  startSlidingUp = (_e: any, speed: number, showBook?: string) => {
    if (this.slideInterval) return;
    this.slideInterval = setInterval(() => {
      this.slideUp(1, showBook);
    }, speed);
  };

  startSlidingDown = (_e: any, speed: number) => {
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
    if (!this.slideReady) return;
    const { bookGroup, slideIndex } = this.state as ChooserState;
    const numBooksInList = Math.round(
      this.sliderHeight[bookGroup] / this.rowHeight
    );

    // If showBook is set and the book is visible, then stop.
    if (showBook && findBookGroup(G, showBook)?.group === bookGroup) {
      const n = findBookGroup(G, showBook)?.index;
      if (n !== undefined && n !== null) {
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
    if (!this.slideReady) return;
    const { bookGroup, slideIndex } = this.state as ChooserState;

    if (slideIndex[bookGroup] === 0) {
      this.stopSliding();
      return;
    }

    this.setState((prevState: ChooserState) => {
      prevState.slideIndex[bookGroup] -= x;
      return prevState;
    });
  };

  groupBarLabel = (bookGroup: string): React.ReactNode[] => {
    const tkey = `${bookGroup.toUpperCase()}text`;
    const name = i18next.t(tkey);
    if (/^\s*$/.test(name))
      return [
        <div key={`label_${bookGroup}`} className={`label ${bookGroup}`} />,
      ];
    return [...name].map((l, i) => {
      // eslint-disable-next-line react/no-array-index-key
      return <div key={`gbl_${i}`}>{l}</div>;
    });
  };

  chapterMenu = (book: string) => {
    const { versification } = this.props as ChooserProps;

    const k = `${versification}_${book}`;
    if (Chooser.cache[k]) return Chooser.cache[k];

    const elements = [];
    let ch = 1;
    // getMaxChapter should take a v11n! Until then must use KJV
    const lastch = G.LibSword.getMaxChapter(versification, book);
    for (let row = 1; row <= 1 + lastch / 10; row += 1) {
      const cells = [];
      let key = `${versification}_${book}`;
      for (let col = 1; col <= 10; col += 1) {
        key = `${versification}_${book}_${ch}`;
        if (ch <= lastch) {
          cells.push(
            <div
              key={`1${key}`}
              className={`chaptermenucell cs-Program chmc_${book}_${ch}`}
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

  bookGroupList = (
    bookGroup: string,
    selBook?: string,
    availBooks?: string[]
  ): React.ReactNode[] => {
    const { hideUnavailableBooks } = this.props as ChooserProps;
    const unavailable = hideUnavailableBooks ? 'hidden' : 'disabled';
    const books = [];
    for (let i = 0; i < bookGroupLength(bookGroup); i += 1) {
      const type =
        selBook === undefined && availBooks === undefined
          ? 'sizer'
          : 'bookname';

      const b = findBookNum(G, bookGroup, i);
      if (b === null) break;
      const bk = G.Book[b];
      const classes = [
        'bookname',
        `${type}_${bk.sName}`,
        selBook && bk.sName === selBook ? 'selected' : '',
        availBooks && !availBooks.includes(bk.sName) ? unavailable : '',
      ];

      books.push(
        <div
          key={`${type}_${bookGroup}_${i}`}
          className={classes.filter(Boolean).join(' ')}
          onMouseMove={this.checkScroll}
        >
          <div>
            <div>
              {bk.bName}
              {type === 'bookname' && (
                <>
                  <div className="charrow" />
                  <div id={`chmenu_${bookGroup}_${i}`} className="chaptermenu">
                    {this.chapterMenu(bk.sName)}
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
    const rowHeight = this.slideReady ? this.rowHeight : 0;
    if (type === 'none') return [];
    return (
      <div {...htmlAttribs(`chooser ${type}`, this.props)}>
        <Vbox height="100%">
          <Hbox height="20px" className="fadetop" />
          <Hbox flex="5" className={`container ${bookGroup}`}>
            <div className="close-chooser" onClick={props.handler} />
            <Vbox width="26px">
              {props.bookGroups.map((bg) => {
                const selected = bg === bookGroup ? 'selected' : '';
                return (
                  <Vbox
                    key={`bookgroup_${bg}`}
                    className={`bookgroup bookgroup_${bg} ${selected}`}
                    flex="50%"
                    pack="center"
                    align="center"
                    onMouseOver={this.groupBarMouseOver}
                  >
                    {this.groupBarLabel(bg)}
                  </Vbox>
                );
              })}
            </Vbox>
            {/* The book-list contains multiple panels which are absolutely positioned
            allowing them to occupy the same space but with different top offsets. Absolute
            positioning requires duplicate content placement in order to size the panel
            container's width.
                Using absolutely positioned top and bottom slider scroll detection areas
            hides the underlying bookname entries from mouse events, so that method was
            ditched. Instead the checkScroll method is being used. */}
            <Vbox className="book-list" onWheel={this.onWheel}>
              <Vbox className="width-sizer">
                {props.bookGroups.map((bg) => {
                  return this.bookGroupList(bg);
                })}
              </Vbox>
              {props.bookGroups.map((bg) => {
                const selected = bg === bookGroup ? 'selected' : '';
                return (
                  <Vbox
                    key={`slider_${bg}`}
                    className={`slider slider_${bg} ${selected}`}
                    style={{ top: `${-1 * slideIndex[bg] * rowHeight}px` }}
                  >
                    {this.bookGroupList(bg, selection, availableBooks)}
                  </Vbox>
                );
              })}
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
