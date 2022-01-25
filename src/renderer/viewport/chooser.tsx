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
import {
  bookGroupLength,
  dString,
  findBookGroup,
  findBookNum,
} from '../../common';
import G from '../rg';
import { Hbox, Vbox } from '../libxul/boxes';
import {
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  htmlAttribs,
  delayHandler,
} from '../libxul/xul';
import '../libxul/xul.css';
import handlerH from './chooserH';
import './chooser.css';

const defaultProps = {
  ...xulDefaultProps,
  bookGroups: ['ot', 'nt'],
  onCloseChooserClick: undefined,
  headingsModule: undefined,
  availableBooksModule: undefined,
  hideUnavailableBooks: false,
  selection: '',
  type: 'bible',
  versification: '',
};

const propTypes = {
  ...xulPropTypes,
  bookGroups: PropTypes.arrayOf(PropTypes.string),
  onCloseChooserClick: PropTypes.func.isRequired,
  headingsModule: PropTypes.string,
  availableBooksModule: PropTypes.string,
  hideUnavailableBooks: PropTypes.bool,
  selection: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['bible', 'genbook', 'none']).isRequired,
  versification: PropTypes.string.isRequired,
};

export interface ChooserProps extends XulProps {
  bookGroups: string[];
  onCloseChooserClick: (e: any) => void;
  headingsModule: string | undefined;
  availableBooksModule: string | undefined;
  hideUnavailableBooks: boolean;
  selection: string;
  type: string;
  versification: string;
}

export interface ChooserState {
  // The visible bookGroup
  bookGroup: string;
  // The index (base 0) of the topmost visible
  // book-item in each bookGroup slider
  slideIndex: { [i: string]: number };
}

class Chooser extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  slideInterval: undefined | NodeJS.Timeout;

  delayHandlerTO: NodeJS.Timeout | undefined;

  chooserRef: React.RefObject<HTMLDivElement>;

  slideReady: boolean;

  handler: (e: React.SyntheticEvent) => void;

  // Booklist scrolling cannot begin until after the first update because
  // layout dimensions must be known. Therefore, the following values
  // cannot be accessed until slideReady is set to true at the end of
  // onUpdate().
  mouseScroll: { top: number; bottom: number };

  rowHeight: number;

  chooserRows: number;

  sliderMaxIndex: { [i: string]: number };

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

    if (props.selection) {
      setTimeout(() => {
        this.startSlidingUp(null, 1, props.selection);
      }, 0);
    }

    this.mouseScroll = { top: 0, bottom: 0 };
    this.rowHeight = 0;
    this.chooserRows = 0;
    const sh: any = {};
    props.bookGroups.forEach((g) => {
      sh[g] = 0;
    });
    this.sliderMaxIndex = sh;

    this.chooserRef = React.createRef();
    this.startSlidingUp = this.startSlidingUp.bind(this);
    this.startSlidingDown = this.startSlidingDown.bind(this);
    this.stopSliding = this.stopSliding.bind(this);
    this.slideUp = this.slideUp.bind(this);
    this.slideDown = this.slideDown.bind(this);
    this.handler = handlerH.bind(this);
  }

  componentDidMount() {
    const { chooserRef } = this;
    const { bookGroups } = this.props as ChooserProps;
    const { bookGroup } = this.state as ChooserState;
    const chooser = chooserRef?.current;
    if (chooser) {
      const containerx = chooser.getElementsByClassName('slide-container');
      if (containerx) {
        const container = containerx[0];
        const sliders: any = {};
        bookGroups.forEach((bg) => {
          const sx = chooser.getElementsByClassName(`slider_${bg}`);
          sliders[bg] = sx ? sx[0] : null;
        });
        const bookx = sliders[bookGroup]?.getElementsByClassName('bookname');
        const book = bookx ? bookx[0] : null;
        if (book) {
          this.rowHeight = book.clientHeight + 2; // 2px for the margin between rows
          this.chooserRows = container.clientHeight / this.rowHeight;
          const b = container.getBoundingClientRect();
          this.mouseScroll = { top: b.top + 120, bottom: b.bottom - 120 };
          bookGroups.forEach((bg) => {
            const sliderRows = sliders[bg].clientHeight / this.rowHeight;
            let smi = Math.round(sliderRows - this.chooserRows) + 1;
            if (smi < 0) smi = 0;
            this.sliderMaxIndex[bg] = smi;
          });
          this.slideReady = true;
        }
      }
    }
  }

  startSlidingUp(_e: any, speed: number, showBook?: string) {
    if (this.slideInterval) return;
    this.slideInterval = setInterval(() => {
      this.slideUp(1, showBook);
    }, speed);
  }

  startSlidingDown(_e: any, speed: number) {
    if (this.slideInterval) return;
    this.slideInterval = setInterval(() => {
      this.slideDown();
    }, speed);
  }

  stopSliding() {
    if (this.slideInterval) clearInterval(this.slideInterval);
    this.slideInterval = undefined;
  }

  slideUp(rows = 1, showBook?: string) {
    if (!this.slideReady) return;
    const { chooserRows, sliderMaxIndex } = this;
    const { bookGroup, slideIndex } = this.state as ChooserState;

    // If showBook is set and the book is visible, then stop.
    if (showBook && findBookGroup(G, showBook)?.group === bookGroup) {
      const n = findBookGroup(G, showBook)?.index;
      if (n !== undefined && n !== null) {
        const c = n - Math.round(chooserRows) + 3;
        if (slideIndex[bookGroup] > c) {
          this.stopSliding();
          return;
        }
      }
    }

    if (slideIndex[bookGroup] > sliderMaxIndex[bookGroup]) {
      this.stopSliding();
      return;
    }

    this.setState((prevState: ChooserState) => {
      let next = prevState.slideIndex[bookGroup] + rows;
      if (next > sliderMaxIndex[bookGroup]) next = sliderMaxIndex[bookGroup];
      prevState.slideIndex[bookGroup] = next;
      return prevState;
    });
  }

  slideDown(rows = 1) {
    if (!this.slideReady) return;
    const { bookGroup, slideIndex } = this.state as ChooserState;

    if (slideIndex[bookGroup] < 0) {
      this.stopSliding();
      return;
    }

    this.setState((prevState: ChooserState) => {
      let next = prevState.slideIndex[bookGroup] - rows;
      if (next < 0) next = 0;
      prevState.slideIndex[bookGroup] = next;
      return prevState;
    });
  }

  chapterMenu(book: string) {
    const { handler } = this;
    const { versification } = this.props as ChooserProps;
    const chmenuCells = [];
    let ch = 1;
    const lastch = G.LibSword.getMaxChapter(versification, book);
    for (let row = 1; row <= 1 + lastch / 10; row += 1) {
      const cells = [];
      for (let col = 1; col <= 10; col += 1) {
        if (ch <= lastch) {
          cells.push(
            <div
              key={[book, ch].join('.')}
              data-book={book}
              data-chapter={ch}
              className="chaptermenucell cs-Program"
              onMouseEnter={delayHandler(this, handler, 400)}
              onMouseLeave={handler}
            >
              {dString(ch)}
            </div>
          );
        } else {
          cells.push(<div key={[book, ch].join('.')} className="emptych" />);
        }
        ch += 1;
      }
      chmenuCells.push(
        <div key={row} className="chaptermenurow">
          {cells}
        </div>
      );
    }
    return (
      <div key={[versification, book].join('_')} className="chaptermenu">
        {chmenuCells}
        <div className="headingmenu" onMouseLeave={handler} />
      </div>
    );
  }

  bookGroupList(
    bookGroup: string,
    selBook?: string,
    availBooks?: string[]
  ): React.ReactNode[] {
    const { handler } = this;
    const { hideUnavailableBooks, versification } = this.props as ChooserProps;
    const unavailable = hideUnavailableBooks ? 'hidden' : 'disabled';
    const books = [];
    for (let i = 0; i < bookGroupLength(bookGroup); i += 1) {
      const type =
        selBook === undefined && availBooks === undefined
          ? 'sizer'
          : 'bookname';

      const b = findBookNum(G, bookGroup, i);
      if (b === null) break;
      const bk = G.Books[b];
      const classes = [
        'bookname',
        `${type}`,
        selBook && bk.sName === selBook ? 'selected' : '',
        availBooks && !availBooks.includes(bk.sName) ? unavailable : '',
      ];

      books.push(
        <div
          key={[bk.sName, versification].join('.')}
          className={classes.filter(Boolean).join(' ')}
          onMouseEnter={handler}
          data-book={bk.sName}
        >
          <div>
            <div>
              {bk.bName}
              {type === 'bookname' && (
                <>
                  <div key="charrow" className="charrow" />
                  {this.chapterMenu(bk.sName)}
                </>
              )}
            </div>
          </div>
        </div>
      );
    }
    return books;
  }

  render() {
    const { handler } = this;
    const props = this.props as ChooserProps;
    const { availableBooksModule, selection, type, onCloseChooserClick } = this
      .props as ChooserProps;
    const { bookGroup, slideIndex } = this.state as ChooserState;

    if (type === 'none') return [];

    const rowHeight = this.slideReady ? this.rowHeight : 0;
    const availableBooks = availableBooksModule
      ? G.AvailableBooks[availableBooksModule]
      : [];

    const label: any = {};
    const useLabelImage: any = {};
    props.bookGroups.forEach((bg) => {
      const tkey = `${bg.toUpperCase()}text`;
      label[bg] = i18next.t(tkey);
      useLabelImage[bg] = /^\s*$/.test(label[bg]);
    });

    // The book-list contains multiple panels which are absolutely positioned
    // allowing them to occupy the same space with different top offsets and
    // heights. Absolute positioning requires duplicate content placement in
    // order to size the panel container's width.

    return (
      <div
        {...htmlAttribs(`chooser ${type}`, this.props)}
        ref={this.chooserRef}
      >
        <Vbox height="100%">
          <Hbox height="20px" className="fadetop" />
          <Hbox flex="5" className={`slide-container ${bookGroup}`}>
            <div className="close-chooser" onClick={onCloseChooserClick} />
            <Vbox width="26px">
              {props.bookGroups.map((bg) => {
                const selected = bg === bookGroup ? 'selected' : '';
                return (
                  <Vbox
                    key={bg}
                    className={`bookgroup ${selected}`}
                    flex="50%"
                    pack="center"
                    align="center"
                    onMouseEnter={handler}
                    data-bookgroup={bg}
                  >
                    {useLabelImage[bg] && (
                      <div key={bg} className={`label ${bg}`} />
                    )}
                    {!useLabelImage[bg] &&
                      [...label[bg]].map((l, i) => {
                        // eslint-disable-next-line react/no-array-index-key
                        return <div key={i}>{l}</div>;
                      })}
                  </Vbox>
                );
              })}
            </Vbox>
            <Vbox className="book-list" onWheel={handler}>
              <Vbox className="width-sizer">
                {props.bookGroups.map((bg) => {
                  return this.bookGroupList(bg);
                })}
              </Vbox>
              {props.bookGroups.map((bg) => {
                const selected = bg === bookGroup ? 'selected' : '';
                return (
                  <Vbox
                    key={bg}
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

export default Chooser;
