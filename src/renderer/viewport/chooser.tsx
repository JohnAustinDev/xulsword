/* eslint-disable no-restricted-globals */
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
import { dString } from '../../common';
import C from '../../constant';
import G from '../rg';
import { clearPending, getMaxChapter } from '../rutil';
import { Hbox, Vbox } from '../libxul/boxes';
import Spacer from '../libxul/spacer';
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

import type { BookGroupType, BookType, V11nType } from '../../type';

const defaultProps = {
  ...xulDefaultProps,
  bookGroups: ['ot', 'nt'],
  selection: '',
  availableBooks: new Set(),
  hideUnavailableBooks: false,
  headingsModule: undefined,
  v11n: 'KJV',
  type: 'bible',
  onCloseChooserClick: undefined,
};

const propTypes = {
  ...xulPropTypes,
  bookGroups: PropTypes.arrayOf(PropTypes.string),
  selection: PropTypes.string.isRequired,
  availableBooks: PropTypes.instanceOf(Set),
  hideUnavailableBooks: PropTypes.bool,
  headingsModule: PropTypes.string,
  v11n: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['bible', 'genbook', 'none']).isRequired,
  onCloseChooserClick: PropTypes.func.isRequired,
};

export interface ChooserProps extends XulProps {
  bookGroups: BookGroupType[];
  selection: string;
  availableBooks: Set<string> | undefined;
  hideUnavailableBooks: boolean;
  headingsModule: string | undefined;
  v11n: V11nType;
  type: string;
  onCloseChooserClick: (e: any) => void;
}

export interface ChooserState {
  // The visible bookGroup
  bookGroup: BookGroupType;
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

    let bookGroup: BookGroupType =
      props.selection && props.selection in G.Book
        ? G.Book[props.selection].bookGroup
        : props.bookGroups[0];
    if (!props.bookGroups.includes(bookGroup)) [bookGroup] = props.bookGroups;

    const slideIndex: any = {};
    props.bookGroups.forEach((g) => {
      slideIndex[g] = 0;
    });

    const s: ChooserState = { bookGroup, slideIndex };
    this.state = s;

    let longest = 0;
    this.longestBook = G.Books[0].code;
    G.Books.forEach((bk) => {
      if (bk.name.length > longest) {
        longest = bk.name.length;
        this.longestBook = bk.code;
      }
    });

    this.rowHeight = 0;
    this.mouseScroll = { top: 0, bottom: 0 };
    this.containerRef = React.createRef();
    this.sliderRef = React.createRef();
    this.rowRef = React.createRef();

    this.handler = handlerH.bind(this);

    if (
      !props.hideUnavailableBooks &&
      props.selection &&
      C.SupportedBooks[bookGroup].includes(props.selection)
    ) {
      this.startSlidingUp(null, 0, props.selection);
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

  componentWillUnmount() {
    clearPending(this, ['bookgroupTO', 'headingmenuTO']);
    clearPending(this, 'slideInterval', true);
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
    const { hideUnavailableBooks } = this.props as ChooserProps;

    // If showBook is set and the book is visible, then stop.
    const shbk: BookType | null =
      !hideUnavailableBooks && showBook && showBook in G.Book
        ? G.Book[showBook]
        : null;
    if (shbk && shbk.bookGroup === bookGroup) {
      const c = shbk.indexInBookGroup - this.numChooserRows() + 3;
      if (slideIndex[bookGroup] > c) {
        this.stopSliding();
        return;
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
      availableBooks,
      bookGroups,
      selection,
      type,
      v11n,
      onCloseChooserClick,
    } = props;
    const { bookGroup, slideIndex } = state;

    if (type === 'none') return [];

    const label: any = {};
    const useLabelImage: any = {};
    bookGroups.forEach((bg) => {
      const tkey = `chooserBookGroup_${bg}`;
      if (i18next.exists(tkey)) {
        label[bg] = i18next.t(tkey);
        useLabelImage[bg] = /^\s*$/.test(label[bg]);
      } else label[bg] = bg.replaceAll('_', ' ').substring(0, 12);
    });

    return (
      <Vbox {...addClass(`chooser ${type}`, props)} onMouseOut={handler}>
        <Hbox className="fadetop" />

        <Hbox className="chooser-container" flex="20">
          <div className="close-chooser" onClick={onCloseChooserClick} />

          <Vbox className="bookgroup-selector">
            {bookGroups.map((bg) => {
              const selected = bg === bookGroup ? 'selected' : '';
              const other = !['ot', 'nt'].includes(bg) ? 'other' : '';
              return (
                <Vbox
                  key={bg}
                  className={`bookgroup ${selected} ${other}`}
                  flex="1"
                  pack="start"
                  align="center"
                  onMouseEnter={handler}
                  data-bookgroup={bg}
                >
                  {useLabelImage[bg] && (
                    <div key={bg} className={`label ${bg}`} />
                  )}
                  <Spacer orient="horizontal" flex="1" />
                  {!useLabelImage[bg] &&
                    [...label[bg]].map((l, i) => {
                      // eslint-disable-next-line react/no-array-index-key
                      return <div key={i}>{l}</div>;
                    })}
                  <Spacer orient="horizontal" flex="1" />
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
              availableBooks={new Set([longestBook])}
              hideUnavailableBooks
              v11n={v11n}
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
              v11n={v11n}
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
    v11n: V11nType;
    bookGroup?: BookGroupType | undefined;
    selection?: string | undefined;
    availableBooks?: Set<string> | undefined;
    hideUnavailableBooks?: boolean;
    handler?: (e: React.SyntheticEvent) => void | undefined;
  } & XulProps
) {
  const {
    bookGroup,
    selection,
    availableBooks,
    hideUnavailableBooks,
    v11n,
    handler,
  } = props;
  const listOfBookIndexes: number[] = [];
  if (bookGroup) {
    C.SupportedBooks[bookGroup].forEach((code) => {
      listOfBookIndexes.push(G.Book[code].index);
    });
  } else G.Books.forEach((_b, i) => listOfBookIndexes.push(i));
  return (
    <Vbox {...addClass('bookgrouplist', props)}>
      {listOfBookIndexes.map((b) => {
        if (b === null) return null;
        const bk = G.Books[b];
        const classes = [];
        if (selection && bk.code === selection) classes.push('selected');
        if (availableBooks && !availableBooks.has(bk.code)) {
          if (hideUnavailableBooks) return null;
          classes.push('disabled');
        }
        return (
          <BookGroupItem
            key={bk.code}
            sName={bk.code}
            classes={classes}
            v11n={v11n}
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
    v11n: V11nType;
    classes?: string[] | undefined;
    handler?: (e: React.SyntheticEvent) => void | undefined;
  } & XulProps
) {
  const { sName, classes, handler, v11n } = props;
  const hasAudio = false; // TODO! add audio icons for available audio
  const c = classes || [];
  return (
    <Hbox
      {...addClass(['bookgroupitem'].concat(c), props)}
      {...topHandle('onMouseEnter', handler, props)}
      data-book={sName}
    >
      <div className="label">{G.Book[sName].name}</div>

      {hasAudio && <div className="hasAudio" />}

      <div key="charrow" className="charrow" />
      {!classes?.includes('disabled') && (
        <ChapterMenu bkcode={sName} v11n={v11n} handler={handler} />
      )}
    </Hbox>
  );
}
BookGroupItem.defaultProps = {
  classes: undefined,
  handler: undefined,
};

function ChapterMenu(props: {
  bkcode: string;
  v11n: V11nType;
  handler?: (e: React.SyntheticEvent) => void;
}) {
  const { bkcode, v11n, handler } = props;
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
  const lastch = getMaxChapter(v11n, bkcode);
  for (let row = 1; row <= 1 + lastch / 10; row += 1) {
    const cells = [];
    for (let col = 1; col <= 10; col += 1) {
      if (ch <= lastch) {
        cells.push(
          <div
            key={[bkcode, ch].join('.')}
            data-book={bkcode}
            data-chapter={ch}
            className="chaptermenucell"
            onMouseEnter={dlyhandler}
            onMouseLeave={handler}
          >
            {dString(ch)}
          </div>
        );
      } else {
        cells.push(<div key={[bkcode, ch].join('.')} className="emptych" />);
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
      key={[v11n, bkcode].join('.')}
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
