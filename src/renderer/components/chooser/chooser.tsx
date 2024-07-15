import React from 'react';
import PropTypes from 'prop-types';
import { dString } from '../../../common.ts';
import C from '../../../constant.ts';
import G, { GI } from '../../rg.ts';
import RenderPromise from '../../renderPromise.ts';
import { audioConfig, clearPending, getMaxChapter } from '../../rutil.ts';
import { Hbox, Vbox } from '../../libxul/boxes.tsx';
import Spacer from '../../libxul/spacer.tsx';
import {
  xulPropTypes,
  type XulProps,
  addClass,
  delayHandler,
  topHandle,
} from '../../libxul/xul.tsx';
import handlerH from './chooserH.ts';
import audioIcon from '../audioIcon/audioIcon.tsx';
import './chooser.css';

import type {
  BookGroupType,
  BookType,
  GenBookAudioFile,
  OSISBookType,
  V11nType,
  VerseKeyAudioFile,
} from '../../../type.ts';
import type {
  RenderPromiseComponent,
  RenderPromiseState,
} from '../../renderPromise.ts';

const propTypes = {
  ...xulPropTypes,
  bookGroups: PropTypes.arrayOf(PropTypes.string),
  selection: PropTypes.string.isRequired,
  availableBooks: PropTypes.instanceOf(Set),
  hideUnavailableBooks: PropTypes.bool,
  headingsModule: PropTypes.string,
  v11n: PropTypes.string.isRequired,
  onCloseChooserClick: PropTypes.func.isRequired,
  onAudioClick: PropTypes.func.isRequired,
};

export type ChooserProps = {
  bookGroups?: BookGroupType[];
  selection: OSISBookType | '';
  availableBooks?: Set<string>;
  hideUnavailableBooks?: boolean;
  headingsModule?: string;
  v11n: V11nType;
  onCloseChooserClick: (e: any) => void;
  onAudioClick: (audio?: VerseKeyAudioFile | GenBookAudioFile) => void;
} & XulProps;

export type ChooserState = RenderPromiseState & {
  // The visible bookGroup
  bookGroup: BookGroupType;
  // The index (base 0) of the topmost visible
  // book-item in each bookGroup slider
  slideIndex: Record<string, number>;
};

class Chooser extends React.Component implements RenderPromiseComponent {
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

  renderPromise: RenderPromise;

  constructor(props: ChooserProps) {
    super(props);
    const { selection, hideUnavailableBooks } = props;
    let { bookGroups } = props;
    if (!bookGroups) bookGroups = ['ot', 'nt'];
    const Book = G.Book(G.i18n.language);
    const Books = G.Books(G.i18n.language);

    let bookGroup: BookGroupType =
      selection && selection in Book
        ? Book[selection].bookGroup
        : bookGroups[0];
    if (!bookGroups.includes(bookGroup)) [bookGroup] = bookGroups;

    const slideIndex: any = {};
    bookGroups.forEach((g) => {
      slideIndex[g] = 0;
    });

    const s: ChooserState = { bookGroup, slideIndex, renderPromiseID: 0 };
    this.state = s;

    let longest = 0;
    this.longestBook = Books[0].code;
    Books.forEach((bk) => {
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

    this.renderPromise = new RenderPromise(this);

    if (
      !hideUnavailableBooks &&
      selection &&
      (C.SupportedBooks[bookGroup] as any).includes(selection)
    ) {
      this.startSlidingUp(null, 0, selection);
    }
  }

  componentDidMount() {
    const { containerRef, rowRef, renderPromise } = this;
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
    renderPromise.dispatch();
  }

  componentWillUnmount() {
    clearPending(this, ['bookgroupTO', 'headingmenuTO']);
    clearPending(this, 'slideInterval', true);
  }

  componentDidUpdate() {
    const { renderPromise } = this;
    renderPromise.dispatch();
  }

  maxScrollIndex(): number {
    const { containerRef, sliderRef, rowHeight } = this;
    const container = containerRef?.current;
    const slider = sliderRef?.current;
    let max = 0;
    if (container && slider) {
      const sliderRows = slider.clientHeight / rowHeight;
      max = sliderRows - container.clientHeight / rowHeight;
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
    const Book = G.Book(G.i18n.language);

    // If showBook is set and the book is visible, then stop.
    const shbk: BookType | null =
      !hideUnavailableBooks && showBook && showBook in Book
        ? Book[showBook]
        : null;
    if (shbk && shbk.bookGroup === bookGroup) {
      if (slideIndex[bookGroup] === 0) {
        this.stopSliding();
        return;
      }
    }
    const maxindex = this.maxScrollIndex();
    if (slideIndex[bookGroup] === maxindex) {
      this.stopSliding();
      return;
    }
    const mounted = this.rowHeight > 0;
    if (mounted) {
      this.setState((prevState: ChooserState) => {
        let next = prevState.slideIndex[bookGroup] + rows;
        if (next > maxindex) next = maxindex;
        prevState.slideIndex[bookGroup] = next;
        return prevState;
      });
    }
  }

  slideDown(rows = 1) {
    const { bookGroup, slideIndex } = this.state as ChooserState;

    if (slideIndex[bookGroup] === 0) {
      this.stopSliding();
      return;
    }

    const mounted = this.rowHeight > 0;
    if (mounted) {
      this.setState((prevState: ChooserState) => {
        let next = prevState.slideIndex[bookGroup] - rows;
        if (next < 0) next = 0;
        prevState.slideIndex[bookGroup] = next;
        return prevState;
      });
    }
  }

  render() {
    const props = this.props as ChooserProps;
    const state = this.state as ChooserState;
    const {
      handler,
      rowHeight,
      longestBook,
      containerRef,
      sliderRef,
      rowRef,
      renderPromise,
    } = this;
    const {
      availableBooks,
      headingsModule,
      selection,
      v11n,
      onCloseChooserClick,
      onAudioClick,
    } = props;
    let { bookGroups } = props;
    if (!bookGroups) bookGroups = ['ot', 'nt'];
    const { bookGroup, slideIndex } = state;

    const label = {} as Record<(typeof bookGroups)[number], string>;
    const useLabelImage: any = {};
    bookGroups.forEach((bg) => {
      const tkey = `chooserBookGroup_${bg}`;
      if (GI.i18n.exists(false, renderPromise, tkey)) {
        label[bg] = GI.i18n.t('', renderPromise, tkey);
        useLabelImage[bg] = /^\s*$/.test(label[bg]);
      } else label[bg] = bg.replaceAll('_', ' ').substring(0, 12);
    });

    return (
      <Vbox {...addClass(`chooser`, props)} onMouseOut={handler}>
        <Hbox className="fadetop skin" />

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
                  data-v11n={v11n}
                >
                  {useLabelImage[bg] && (
                    <div key={bg} className={`label ${bg}`} />
                  )}
                  <Spacer orient="horizontal" flex="1" />
                  {!useLabelImage[bg] &&
                    [...label[bg]].map((l, i) => {
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
              className={`sizer${
                (audioConfig(headingsModule) && ' audio') || ''
              }`}
              availableBooks={new Set([longestBook])}
              headingsModule={headingsModule}
              hideUnavailableBooks
              v11n={v11n}
              domref={rowRef}
              style={{ visibility: 'hidden' }}
              chooserRef={this}
            />
            {
              // This is the real BookGroupList...
            }
            <BookGroupList
              className={!['ot', 'nt'].includes(bookGroup) ? 'other' : ''}
              bookGroup={bookGroup}
              selection={selection}
              availableBooks={availableBooks}
              headingsModule={headingsModule}
              v11n={v11n}
              domref={sliderRef}
              style={{
                position: 'absolute',
                top: `${-1 * slideIndex[bookGroup] * rowHeight}px`,
              }}
              handler={handler}
              onAudioClick={onAudioClick}
              chooserRef={this}
            />
          </Vbox>
        </Hbox>

        <Hbox flex="1" className="fadebot skin" />
      </Vbox>
    );
  }
}
Chooser.propTypes = propTypes;

export default Chooser;

function BookGroupList(
  props: {
    v11n: V11nType;
    bookGroup?: BookGroupType;
    selection?: string;
    availableBooks?: Set<string>;
    headingsModule?: string;
    hideUnavailableBooks?: boolean;
    handler?: (e: React.SyntheticEvent) => void;
    onAudioClick?: (audio?: VerseKeyAudioFile | GenBookAudioFile) => void;
    chooserRef: React.Component;
  } & XulProps,
) {
  const {
    bookGroup,
    selection,
    availableBooks,
    hideUnavailableBooks,
    headingsModule,
    v11n,
    handler,
    onAudioClick,
    chooserRef,
  } = props;
  const Book = G.Book(G.i18n.language);
  const Books = G.Books(G.i18n.language);
  const listOfBookIndexes: number[] = [];
  if (bookGroup) {
    C.SupportedBooks[bookGroup].forEach((code) => {
      listOfBookIndexes.push(Book[code].index);
    });
  } else Books.forEach((_b, i) => listOfBookIndexes.push(i));
  return (
    <Vbox {...addClass('bookgrouplist', props)}>
      {listOfBookIndexes.map((b) => {
        if (b === null) return null;
        const bk = Books[b];
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
            headingsModule={headingsModule}
            v11n={v11n}
            handler={handler}
            onAudioClick={onAudioClick}
            chooserRef={chooserRef}
          />
        );
      })}
    </Vbox>
  );
}

function BookGroupItem(
  props: {
    sName: string;
    classes?: string[];
    headingsModule?: string;
    v11n: V11nType;
    handler?: (e: React.SyntheticEvent) => void;
    onAudioClick?: (audio?: VerseKeyAudioFile | GenBookAudioFile) => void;
    chooserRef: React.Component;
  } & XulProps,
) {
  const {
    sName,
    classes,
    headingsModule,
    handler,
    onAudioClick,
    v11n,
    chooserRef,
  } = props;
  const c = classes || [];
  const Book = G.Book(G.i18n.language);
  return (
    <Hbox
      {...addClass(['bookgroupitem'].concat(c), props)}
      {...topHandle('onMouseEnter', handler, props)}
      data-book={sName}
      data-v11n={v11n}
    >
      <div className="label">{Book[sName].name}</div>

      {headingsModule &&
        onAudioClick &&
        audioIcon(headingsModule, sName, undefined, onAudioClick)}

      <div key="charrow" className="charrow" />
      {!classes?.includes('disabled') && (
        <ChapterMenu
          headingsModule={headingsModule}
          bkcode={sName}
          v11n={v11n}
          handler={handler}
          onAudioClick={onAudioClick}
          chooserRef={chooserRef}
        />
      )}
    </Hbox>
  );
}

function ChapterMenu(props: {
  headingsModule?: string;
  bkcode: string;
  v11n: V11nType;
  handler?: (e: React.SyntheticEvent) => void;
  onAudioClick?: (audio?: VerseKeyAudioFile | GenBookAudioFile) => void;
  chooserRef: React.Component;
}) {
  const { headingsModule, bkcode, v11n, handler, onAudioClick, chooserRef } =
    props;
  const dlyhandler =
    handler && chooserRef
      ? delayHandler.bind(chooserRef)(
          handler,
          C.UI.Chooser.headingMenuOpenDelay,
          'headingmenuTO',
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
            data-v11n={v11n}
            className="chaptermenucell"
            onMouseEnter={dlyhandler}
            onMouseLeave={handler}
          >
            {dString(G.getLocaleDigits(), ch, G.i18n.language)}
            {headingsModule &&
              onAudioClick &&
              audioIcon(headingsModule, bkcode, ch, onAudioClick)}
          </div>,
        );
      } else {
        cells.push(<div key={[bkcode, ch].join('.')} className="emptych" />);
      }
      ch += 1;
    }
    chmenuCells.push(
      <div key={row} className="chaptermenurow">
        {cells}
      </div>,
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
