import React from 'react';
import PropTypes from 'prop-types';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import RenderPromise from '../../renderPromise.ts';
import {
  dString,
  audioConfigs,
  clearPending,
  getMaxChapter,
} from '../../common.tsx';
import { Hbox, Vbox } from '../libxul/boxes.tsx';
import Spacer from '../libxul/spacer.tsx';
import {
  xulPropTypes,
  type XulProps,
  addClass,
  delayHandler,
  topHandle,
} from '../libxul/xul.tsx';
import handlerH from './chooserH.ts';
import audioIcon from '../audioIcon/audioIcon.tsx';
import './chooser.css';

import type {
  BookGroupType,
  AudioPlayerSelectionGB,
  OSISBookType,
  V11nType,
  AudioPlayerSelectionVK,
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
  onAudioClick: (
    audio?: AudioPlayerSelectionVK | AudioPlayerSelectionGB | null,
  ) => void;
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

  rowHeight: number;

  listAreaHeight: number;

  handler: (e: React.SyntheticEvent) => void;

  renderPromise: RenderPromise;

  loadingRef: React.RefObject<HTMLDivElement>;

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

    this.startSlidingUp = this.startSlidingUp.bind(this);
    this.startSlidingDown = this.startSlidingDown.bind(this);
    this.stopSliding = this.stopSliding.bind(this);
    this.slideUp = this.slideUp.bind(this);
    this.slideDown = this.slideDown.bind(this);
    this.centerBook = this.centerBook.bind(this);

    this.rowHeight = 0;
    this.listAreaHeight = 0;

    this.handler = handlerH.bind(this);

    this.loadingRef = React.createRef();
    this.renderPromise = new RenderPromise(this, this.loadingRef);
  }

  componentDidMount() {
    const { rowHeight, renderPromise, centerBook } = this;
    const { selection } = this.props as ChooserProps;

    const bookList = document.querySelector('.book-list');
    if (!rowHeight && bookList) {
      const smallbox = bookList.getBoundingClientRect();
      this.listAreaHeight = smallbox.bottom - smallbox.top;
      const bookItemList = bookList.querySelector('.bookgrouplist:not(.sizer)');
      if (bookItemList) {
        const bigbox = bookItemList.getBoundingClientRect();
        const bbh = bigbox.bottom - bigbox.top;
        const bookElem = bookItemList.querySelectorAll(`.bookgroupitem`);
        if (bookElem.length > 1) {
          const ith = bbh / bookElem.length;
          if (ith && !this.rowHeight) this.rowHeight = ith;
        }
      }
    }

    if (selection) centerBook(selection);

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

  startSlidingUp(_e: any, ms: number) {
    const { slideUp } = this;
    if (this.slideInterval) return;
    this.slideInterval = setInterval(() => {
      slideUp(1);
    }, ms);
  }

  startSlidingDown(_e: any, ms: number) {
    const { slideDown } = this;
    if (this.slideInterval) return;
    this.slideInterval = setInterval(() => {
      slideDown(1);
    }, ms);
  }

  stopSliding() {
    if (this.slideInterval) clearInterval(this.slideInterval);
    this.slideInterval = undefined;
  }

  slideUp(rows = 1) {
    const { rowHeight, listAreaHeight, stopSliding } = this;
    const { bookGroup, slideIndex } = this.state as ChooserState;

    const maxScrollIndex =
      C.SupportedBooks[bookGroup].length - listAreaHeight / rowHeight;

    if (slideIndex[bookGroup] >= maxScrollIndex) {
      stopSliding();
      return;
    }

    if (rowHeight) {
      this.setState((prevState: ChooserState) => {
        let next = prevState.slideIndex[bookGroup] + rows;
        if (next > maxScrollIndex) next = maxScrollIndex;
        prevState.slideIndex[bookGroup] = next;
        return prevState;
      });
    }
  }

  slideDown(rows = 1) {
    const { rowHeight, stopSliding } = this;
    const { bookGroup, slideIndex } = this.state as ChooserState;

    if (slideIndex[bookGroup] === 0) {
      stopSliding();
      return;
    }

    if (rowHeight) {
      this.setState((prevState: ChooserState) => {
        let next = prevState.slideIndex[bookGroup] - rows;
        if (next < 0) next = 0;
        prevState.slideIndex[bookGroup] = next;
        return prevState;
      });
    }
  }

  centerBook(book: OSISBookType) {
    const { rowHeight, listAreaHeight } = this;
    const { hideUnavailableBooks } = this.props as ChooserProps;
    if (!hideUnavailableBooks) {
      const Book = G.Book(G.i18n.language);
      const { bookGroup, indexInBookGroup } = Book[book];
      this.setState((prevState: ChooserState) => {
        const { slideIndex } = prevState;
        const maxScrollIndex =
          C.SupportedBooks[bookGroup].length - listAreaHeight / rowHeight;
        let i = 3 + indexInBookGroup - 0.5 * (listAreaHeight / rowHeight);
        if (i > maxScrollIndex) i = maxScrollIndex;
        if (i < 0) i = 0;
        slideIndex[bookGroup] = i;
        return { bookGroup, slideIndex } as ChooserState;
      });
    }
  }

  render() {
    const props = this.props as ChooserProps;
    const state = this.state as ChooserState;
    const { handler, rowHeight, longestBook, renderPromise, loadingRef } = this;
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
      <Vbox
        domref={loadingRef}
        {...addClass(`chooser verse-chooser`, props)}
        onMouseOut={handler}
      >
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

          <Vbox className="book-list" onWheel={handler}>
            {
              // This 'sizer' BookGroupList has one row and is only needed to set
              // chooser width according to the longest book name of all bookGroups.
            }
            <BookGroupList
              className={`sizer${
                (audioConfigs(headingsModule || '', renderPromise).length &&
                  ' audio') ||
                ''
              }`}
              availableBooks={new Set([longestBook])}
              headingsModule={headingsModule}
              hideUnavailableBooks
              v11n={v11n}
              style={{ visibility: 'hidden' }}
              chooserRef={this}
              renderPromise={renderPromise}
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
              style={{
                position: 'absolute',
                top: `${-1 * slideIndex[bookGroup] * rowHeight}px`,
              }}
              handler={handler}
              onAudioClick={onAudioClick}
              chooserRef={this}
              renderPromise={renderPromise}
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
    onAudioClick?: (
      selection?: AudioPlayerSelectionVK | AudioPlayerSelectionGB | null,
    ) => void;
    chooserRef: React.Component;
    renderPromise: RenderPromise;
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
    renderPromise,
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
            renderPromise={renderPromise}
          />
        );
      })}
    </Vbox>
  );
}

function BookGroupItem(
  props: {
    sName: OSISBookType;
    classes?: string[];
    headingsModule?: string;
    v11n: V11nType;
    handler?: (e: React.SyntheticEvent) => void;
    onAudioClick?: (
      selection?: AudioPlayerSelectionVK | AudioPlayerSelectionGB | null,
    ) => void;
    chooserRef: React.Component;
    renderPromise: RenderPromise;
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
    renderPromise,
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
        audioIcon(
          headingsModule,
          sName,
          undefined,
          onAudioClick,
          renderPromise,
        )}

      <div key="charrow" className="charrow" />
      {!classes?.includes('disabled') && (
        <ChapterMenu
          headingsModule={headingsModule}
          bkcode={sName}
          v11n={v11n}
          handler={handler}
          onAudioClick={onAudioClick}
          chooserRef={chooserRef}
          renderPromise={renderPromise}
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
  onAudioClick?: (
    selection?: AudioPlayerSelectionVK | AudioPlayerSelectionGB | null,
  ) => void;
  chooserRef: React.Component;
  renderPromise: RenderPromise;
}) {
  const {
    headingsModule,
    bkcode,
    v11n,
    handler,
    onAudioClick,
    chooserRef,
    renderPromise,
  } = props;
  const dlyhandler =
    handler && chooserRef
      ? (e: React.SyntheticEvent) =>
          delayHandler(
            chooserRef,
            handler,
            [e],
            C.UI.Chooser.headingMenuOpenDelay,
            'headingmenuTO',
          )
      : undefined;
  const chmenuCells = [];
  let ch = 1;
  const lastch = getMaxChapter(v11n, bkcode, renderPromise);
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
            {dString(ch)}
            {headingsModule &&
              onAudioClick &&
              audioIcon(
                headingsModule,
                bkcode,
                ch,
                onAudioClick,
                renderPromise,
              )}
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
