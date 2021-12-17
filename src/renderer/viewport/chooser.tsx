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
  ofClass,
  sanitizeHTML,
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
import './chooser.css';

// XUL stack
const defaultProps = {
  ...xulDefaultProps,
  bookGroups: ['ot', 'nt'],
  handler: undefined,
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
  handler: PropTypes.func.isRequired,
  headingsModule: PropTypes.string,
  availableBooksModule: PropTypes.string,
  hideUnavailableBooks: PropTypes.bool,
  selection: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['bible', 'genbook', 'none']).isRequired,
  versification: PropTypes.string.isRequired,
};

interface ChooserProps extends XulProps {
  bookGroups: string[];
  handler: (e: any) => void;
  headingsModule: string | undefined;
  availableBooksModule: string | undefined;
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

  delayHandlerTO: NodeJS.Timeout | undefined;

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

    this.rowHeight = 0;
    this.chooserHeight = 0;
    const sh: any = {};
    props.bookGroups.forEach((g) => {
      sh[g] = 0;
    });
    this.sliderHeight = sh;

    this.bookGroupMouseOver = this.bookGroupMouseOver.bind(this);
    this.chapterMouseOver = this.chapterMouseOver.bind(this);
    this.chapterMouseOut = this.chapterMouseOut.bind(this);
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

  bookGroupMouseOver = (e: any) => {
    const { bookGroups } = this.props as ChooserProps;
    const state = this.state as ChooserState;
    const { bookgroup } = e.target.dataset;
    if (
      !bookgroup ||
      state.bookGroup === bookgroup ||
      !bookGroups.includes(bookgroup)
    )
      return;
    delayHandler(
      this,
      () => {
        this.setState({ bookGroup: bookgroup });
      },
      300
    )(e);
  };

  chapterMouseOver = (e: any) => {
    const cell = ofClass('chaptermenucell', e.target);
    const chapterMenu = ofClass('chaptermenu', e.target);
    if (!cell || !chapterMenu) return;
    const { book, chapter } = cell.element.dataset;
    if (!book || !chapter) return;
    const { headingsModule } = this.props as ChooserProps;
    if (!headingsModule) return;

    const headingmenu = chapterMenu.element.getElementsByClassName(
      'headingmenu'
    )[0] as HTMLElement;

    while (headingmenu.firstChild) {
      headingmenu.removeChild(headingmenu.firstChild);
    }

    // Set LibSword options and read the chapter
    G.LibSword.setGlobalOptions({ Headings: 'On', 'Verse Numbers': 'On' });

    // Regex gets array of headings and their following verse tags
    const hdplus =
      /<h\d[^>]*class="head1[^"]*"[^>]*>.*?<\/h\d>.*?<sup[^>]*>\d+<\/sup>/gim;

    // Regex parses heading from array member strings
    const hd = /<h\d([^>]*class="head1[^"]*"[^>]*>)(.*?)<\/h\d>/i;

    // Rexgex parses verse number from array member strings
    const vs = /<sup[^>]*>(\d+)<\/sup>/i; // Get verse from above

    const chtxt = G.LibSword.getChapterText(
      headingsModule,
      `${book}.${chapter}`
    );

    const headings = chtxt.match(hdplus);
    if (headings) {
      let hr = false;
      for (let x = 0; x < headings.length; x += 1) {
        const h = headings[x];
        if (h) {
          const mh = h.match(hd);
          const mv = h.match(vs);
          if (mh && mv) {
            const [, tag, txt] = mh;
            const [, verse] = mv;
            const text = txt.replace(/<[^>]*>/g, '');
            if (tag && text && !/^\s*$/.test(text)) {
              if (hr) headingmenu.appendChild(document.createElement('hr'));
              const a = headingmenu.appendChild(document.createElement('a'));
              sanitizeHTML(a, text);
              a.className = `heading-link cs-${headingsModule}`;
              a.dataset.module = headingsModule;
              a.dataset.book = book;
              a.dataset.chapter = chapter;
              a.dataset.verse = verse;
              hr = true;
            }
          }
        }
      }
    }

    // If headings were found, then display them inside the popup
    if (headingmenu.childNodes.length) {
      const row = chapterMenu.element.firstChild as HTMLElement;
      if (row) {
        headingmenu.style.top = `${Number(
          -2 + (1 + Math.floor((Number(chapter) - 1) / 10)) * row.offsetHeight
        )}px`;
        chapterMenu.element.classList.add('show');
      }
    }
  };

  chapterMouseOut = (e: any) => {
    const cell = ofClass('chaptermenucell', e.target);
    const menu = ofClass('chaptermenu', e.target);
    if (!cell && !menu) return;
    if (this.delayHandlerTO) clearTimeout(this.delayHandlerTO);
    if (ofClass('headingmenu', e.relatedTarget)) return;
    if (menu?.element && menu.element.classList.contains('show'))
      menu.element.classList.remove('show');
  };

  checkScroll = (e: any) => {
    if (!this.slideReady) return;
    const scrollMargin = 2; // mouse can be this close to top/bottom before scrolling
    const { bookGroup, slideIndex } = this.state as ChooserState;
    const { book } = e.currentTarget.dataset;
    if (!book === null) return;
    const index = findBookGroup(G, book)?.index;
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
      return [<div key={bookGroup} className={`label ${bookGroup}`} />];
    return [...name].map((l, i) => {
      // eslint-disable-next-line react/no-array-index-key
      return <div key={i}>{l}</div>;
    });
  };

  chapterMenu = (book: string) => {
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
      <div
        key={[versification, book].join('_')}
        className="chaptermenu"
        onMouseOver={delayHandler(this, this.chapterMouseOver, 500)}
        onMouseOut={this.chapterMouseOut}
      >
        {chmenuCells}
        <div className="headingmenu" />
      </div>
    );
  };

  bookGroupList = (
    bookGroup: string,
    selBook?: string,
    availBooks?: string[]
  ): React.ReactNode[] => {
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
          onMouseMove={this.checkScroll}
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
  };

  render() {
    const props = this.props as ChooserProps;
    const { availableBooksModule, selection, type } = this
      .props as ChooserProps;
    const { bookGroup, slideIndex } = this.state as ChooserState;
    if (type === 'none') return [];
    const rowHeight = this.slideReady ? this.rowHeight : 0;
    const availableBooks = availableBooksModule
      ? G.AvailableBooks[availableBooksModule]
      : [];
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
                    key={bg}
                    className={`bookgroup ${selected}`}
                    flex="50%"
                    pack="center"
                    align="center"
                    onMouseOver={this.bookGroupMouseOver}
                    data-bookgroup={bg}
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
Chooser.cache = {};

export default Chooser;
