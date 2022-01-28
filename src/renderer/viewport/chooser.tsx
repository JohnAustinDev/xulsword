/* eslint-disable @typescript-eslint/no-use-before-define */
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
import C from '../../constant';
import G from '../rg';
import { Hbox, Vbox } from '../libxul/boxes';
import {
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  addClass,
  delayHandler,
  topHandle,
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
  windowV11n: '',
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
  windowV11n: PropTypes.string.isRequired,
};

export interface ChooserProps extends XulProps {
  bookGroups: string[];
  onCloseChooserClick: (e: any) => void;
  headingsModule: string | undefined;
  availableBooksModule: string | undefined;
  hideUnavailableBooks: boolean;
  selection: string;
  type: string;
  windowV11n: string;
}

export interface ChooserState {
  // The visible bookGroup
  bookGroup: string;
  // The index (base 0) of the topmost visible
  // book-item in each bookGroup slider
  slideIndex: { [i: string]: number };
}

let chooserCompRef: Chooser | undefined;

class Chooser extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  slideInterval: NodeJS.Timeout | undefined;

  bookgroupTO: NodeJS.Timeout | undefined;

  headingmenuTO: NodeJS.Timeout | undefined;

  longestBook: string; // to determine chooser width

  containerRef: React.RefObject<HTMLDivElement>;

  sliderRef: React.RefObject<HTMLDivElement>;

  rowRef: React.RefObject<HTMLDivElement>;

  mouseScroll: { top: number; bottom: number };

  rowHeight: number;

  handler: (e: React.SyntheticEvent) => void;

  constructor(props: ChooserProps) {
    super(props);
    chooserCompRef = this;

    let bookGroup = findBookGroup(G, props.selection)?.group;
    if (!bookGroup || !props.bookGroups.includes(bookGroup))
      [bookGroup] = props.bookGroups;

    const slideIndex: any = {};
    props.bookGroups.forEach((g) => {
      slideIndex[g] = 0;
    });

    const s: ChooserState = { bookGroup, slideIndex };
    this.state = s;

    let longest = 0;
    this.longestBook = G.Books[0].sName;
    G.Books.forEach((bk) => {
      if (bk.bName.length > longest) {
        longest = bk.bName.length;
        this.longestBook = bk.sName;
      }
    });

    this.rowHeight = 0;
    this.mouseScroll = { top: 0, bottom: 0 };
    this.containerRef = React.createRef();
    this.sliderRef = React.createRef();
    this.rowRef = React.createRef();

    this.handler = handlerH.bind(this);

    if (props.selection) {
      setTimeout(() => {
        this.startSlidingUp(null, 0, props.selection);
      }, 0);
    }
  }

  componentDidMount() {
    const { containerRef, rowRef } = this;
    const container = containerRef?.current;
    const row = rowRef?.current;
    if (container && row) {
      const b = container.getBoundingClientRect();
      this.mouseScroll = {
        top: b.top + C.UI.Chooser.mouseScrollMargin,
        bottom: b.bottom - C.UI.Chooser.mouseScrollMargin,
      };
      this.rowHeight = row.clientHeight - 2;
    }
  }

  maxScrollIndex(): number {
    const { containerRef, sliderRef, rowHeight } = this;
    const container = containerRef?.current;
    const slider = sliderRef?.current;
    let max = 0;
    if (container && slider) {
      const sliderRows = slider.clientHeight / rowHeight;
      max = Math.round(sliderRows - container.clientHeight / rowHeight);
      if (max < 0) max = 0;
    }
    return max;
  }

  numChooserRows(): number {
    const { containerRef, rowHeight } = this;
    const container = containerRef?.current;
    let num = 0;
    if (container) {
      num = Math.round(container.clientHeight / rowHeight);
    }
    return num;
  }

  startSlidingUp(_e: any, ms: number, showBook?: string) {
    if (this.slideInterval) return;
    this.slideInterval = setInterval(() => {
      this.slideUp(1, showBook);
    }, ms);
  }

  startSlidingDown(_e: any, ms: number) {
    if (this.slideInterval) return;
    this.slideInterval = setInterval(() => {
      this.slideDown(1);
    }, ms);
  }

  stopSliding() {
    if (this.slideInterval) clearInterval(this.slideInterval);
    this.slideInterval = undefined;
  }

  slideUp(rows = 1, showBook?: string) {
    const { bookGroup, slideIndex } = this.state as ChooserState;

    // If showBook is set and the book is visible, then stop.
    if (showBook && findBookGroup(G, showBook)?.group === bookGroup) {
      const n = findBookGroup(G, showBook)?.index;
      if (n !== undefined && n !== null) {
        const c = n - this.numChooserRows() + 3;
        if (slideIndex[bookGroup] > c) {
          this.stopSliding();
          return;
        }
      }
    }
    const maxindex = this.maxScrollIndex();
    if (slideIndex[bookGroup] > maxindex) {
      this.stopSliding();
      return;
    }
    this.setState((prevState: ChooserState) => {
      let next = prevState.slideIndex[bookGroup] + rows;
      if (next > maxindex) next = maxindex;
      prevState.slideIndex[bookGroup] = next;
      return prevState;
    });
  }

  slideDown(rows = 1) {
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

  render() {
    const props = this.props as ChooserProps;
    const state = this.state as ChooserState;
    const { handler, rowHeight, longestBook, containerRef, sliderRef, rowRef } =
      this;
    const {
      availableBooksModule,
      selection,
      type,
      windowV11n,
      onCloseChooserClick,
    } = props;
    const { bookGroup, slideIndex } = state;

    if (type === 'none') return [];

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

    return (
      <Vbox {...addClass(`chooser ${type}`, props)} onMouseOut={handler}>
        <Hbox className="fadetop" />

        <Hbox flex="5" className="chooser-container">
          <div className="close-chooser" onClick={onCloseChooserClick} />

          <Vbox className="bookgroup-selector">
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

          <Vbox className="book-list" onWheel={handler} domref={containerRef}>
            {
              // This 'sizer' BookGroupList has one row and is only needed to set
              // chooser width according to the longest book name of all bookGroups.
            }
            <BookGroupList
              className="sizer"
              availableBooks={[longestBook]}
              hideUnavailableBooks
              windowV11n={windowV11n}
              domref={rowRef}
              style={{ visibility: 'hidden' }}
            />
            {
              // This is the real BookGroupList...
            }
            <BookGroupList
              bookGroup={bookGroup}
              selection={selection}
              availableBooks={availableBooks}
              windowV11n={windowV11n}
              domref={sliderRef}
              style={{
                position: 'absolute',
                top: `${-1 * slideIndex[bookGroup] * rowHeight}px`,
              }}
              handler={handler}
            />
          </Vbox>
        </Hbox>

        <Hbox flex="1" className="fadebot" />
      </Vbox>
    );
  }
}
Chooser.defaultProps = defaultProps;
Chooser.propTypes = propTypes;

export default Chooser;

function BookGroupList(
  props: {
    windowV11n: string;
    bookGroup?: string | undefined;
    selection?: string | undefined;
    availableBooks?: string[] | undefined;
    hideUnavailableBooks?: boolean;
    handler?: (e: React.SyntheticEvent) => void | undefined;
  } & XulProps
) {
  const {
    bookGroup,
    selection,
    availableBooks,
    hideUnavailableBooks,
    windowV11n,
    handler,
  } = props;
  const listBookIndexes = [];
  if (bookGroup) {
    for (let i = 0; i < bookGroupLength(bookGroup); i += 1) {
      listBookIndexes.push(findBookNum(G, bookGroup, i));
    }
  } else G.Books.forEach((_b, i) => listBookIndexes.push(i));
  return (
    <Vbox {...addClass('bookgrouplist', props)}>
      {listBookIndexes.map((b) => {
        if (b === null) return null;
        const bk = G.Books[b];
        const classes = [];
        if (selection && bk.sName === selection) classes.push('selected');
        if (availableBooks && !availableBooks.includes(bk.sName)) {
          if (hideUnavailableBooks) return null;
          classes.push('disabled');
        }
        return (
          <BookGroupItem
            key={bk.sName}
            sName={bk.sName}
            classes={classes}
            windowV11n={windowV11n}
            handler={handler}
          />
        );
      })}
    </Vbox>
  );
}
BookGroupList.defaultProps = {
  bookGroup: undefined,
  selection: undefined,
  availableBooks: undefined,
  hideUnavailableBooks: false,
  handler: undefined,
};

function BookGroupItem(
  props: {
    sName: string;
    windowV11n: string;
    classes?: string[] | undefined;
    handler?: (e: React.SyntheticEvent) => void | undefined;
  } & XulProps
) {
  const { sName, classes, handler, windowV11n } = props;
  const hasAudio = false; // TODO! add audio icons for available audio
  const c = classes || [];
  return (
    <Hbox
      {...addClass(['bookgroupitem'].concat(c), props)}
      {...topHandle('onMouseEnter', handler, props)}
      data-book={sName}
    >
      <div className="label">{G.Book[sName].bName}</div>

      {hasAudio && <div className="hasAudio" />}

      <div key="charrow" className="charrow" />

      <ChapterMenu sName={sName} windowV11n={windowV11n} handler={handler} />
    </Hbox>
  );
}
BookGroupItem.defaultProps = {
  classes: undefined,
  handler: undefined,
};

function ChapterMenu(props: {
  sName: string;
  windowV11n: string;
  handler?: (e: React.SyntheticEvent) => void;
}) {
  const { sName, windowV11n, handler } = props;
  const dlyhandler =
    handler && chooserCompRef
      ? delayHandler.bind(chooserCompRef)(
          handler,
          C.UI.Chooser.headingMenuOpenDelay,
          'headingmenuTO'
        )
      : undefined;
  const chmenuCells = [];
  let ch = 1;
  const lastch = G.LibSword.getMaxChapter(windowV11n, sName);
  for (let row = 1; row <= 1 + lastch / 10; row += 1) {
    const cells = [];
    for (let col = 1; col <= 10; col += 1) {
      if (ch <= lastch) {
        cells.push(
          <div
            key={[sName, ch].join('.')}
            data-book={sName}
            data-chapter={ch}
            className="chaptermenucell cs-Program"
            onMouseEnter={dlyhandler}
            onMouseLeave={handler}
          >
            {dString(ch)}
          </div>
        );
      } else {
        cells.push(<div key={[sName, ch].join('.')} className="emptych" />);
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
      key={[windowV11n, sName].join('.')}
      className="chaptermenu"
      onClick={handler}
    >
      {chmenuCells}
      <div className="headingmenu" onMouseLeave={handler} />
    </div>
  );
}
ChapterMenu.defaultProps = {
  handler: undefined,
};
