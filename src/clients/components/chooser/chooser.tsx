import React, { SyntheticEvent } from 'react';
import { dString } from '../../../common.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import RenderPromise from '../../renderPromise.ts';
import { audioConfigs, clearPending, getMaxChapter } from '../../common.ts';
import { Hbox, Vbox } from '../libxul/boxes.tsx';
import Spacer from '../libxul/spacer.tsx';
import {
  type XulProps,
  addClass,
  delayHandler,
  topHandle,
} from '../libxul/xul.tsx';
import audioIcon from '../audioIcon/audioIcon.tsx';
import handlerH from './chooserH.ts';
import './chooser.css';

import type {
  BookGroupType,
  AudioPlayerFileGB,
  OSISBookType,
  V11nType,
  AudioPlayerFileVK,
} from '../../../type.ts';
import type {
  RenderPromiseComponent,
  RenderPromiseState,
} from '../../renderPromise.ts';
import type Xulsword from '../xulsword/xulsword.tsx';

export type ChooserProps = {
  bookGroups?: BookGroupType[];
  selection: OSISBookType | '';
  availableBooks?: Set<string>;
  hideUnavailableBooks?: boolean;
  headingsModule?: string | null;
  v11n: V11nType;
  viewportParentHandler: Xulsword['viewportParentHandler'];
  onAudioClick: (
    audio: AudioPlayerFileVK | AudioPlayerFileGB | null,
    e: React.SyntheticEvent,
  ) => void;
} & XulProps;

export type ChooserState = RenderPromiseState & {
  // The visible bookGroup
  bookGroup: BookGroupType;
  // The index (base 0) of the topmost visible
  // book-item in each bookGroup slider
  slideIndex: Record<string, number>;
};

class Chooser
  extends React.Component<ChooserProps, ChooserState>
  implements RenderPromiseComponent
{
  slideInterval: NodeJS.Timeout | undefined;

  bookgroupTO: NodeJS.Timeout | undefined;

  headingmenuTO: NodeJS.Timeout | undefined;

  longestBook: string; // to determine chooser width

  rowHeight: number;

  listAreaHeight: number;

  handler: (e: React.SyntheticEvent | WheelEvent) => void;

  wheelListener: (e: WheelEvent) => void;

  renderPromise: RenderPromise;

  loadingRef: React.RefObject<HTMLDivElement>;

  listRef: React.RefObject<HTMLDivElement>;

  constructor(props: ChooserProps) {
    super(props);
    const { selection } = props;
    let { bookGroups } = props;
    if (!bookGroups) bookGroups = ['ot', 'nt'];
    const Book = G.getBook(G.i18n.language);
    const Books = G.getBooks(G.i18n.language);

    let bookGroup: BookGroupType =
      selection && selection in Book
        ? Book[selection].bookGroup
        : bookGroups[0];
    if (!bookGroups.includes(bookGroup)) [bookGroup] = bookGroups;

    const slideIndex: any = {};
    bookGroups.forEach((g) => {
      slideIndex[g] = 0;
    });

    this.state = { bookGroup, slideIndex, renderPromiseID: 0 };

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

    this.wheelListener = (e: WheelEvent) => {
      const { current } = this.loadingRef;
      if (current && e.target instanceof Node && current.contains(e.target))
        this.handler(e);
    };

    this.loadingRef = React.createRef();
    this.listRef = React.createRef();
    this.renderPromise = new RenderPromise(this, this.loadingRef);
  }

  componentDidMount() {
    const {
      props,
      rowHeight,
      wheelListener,
      listRef,
      renderPromise,
      centerBook,
    } = this;
    const { selection } = props;

    // Capture every wheel event over the chooser. The listener is on the
    // document, in the capture phase, because otherwise the web-app stops
    // wheel propagation at the React root. It is also non-passive, so
    // eventHandled()'s preventDefault() can stop the wheel from scrolling
    // the web-app iframe's parent body.
    document.addEventListener('wheel', wheelListener, {
      capture: true,
      passive: false,
    });

    if (listRef.current) {
      const listAreaBox = listRef.current.getBoundingClientRect();
      this.listAreaHeight = listAreaBox.bottom - listAreaBox.top;
    }

    if (!rowHeight && listRef.current) {
      const bookGroupList = listRef.current.querySelector(
        '.bookgrouplist:not(.sizer)',
      );
      if (bookGroupList) {
        const bookGroupListBox = bookGroupList.getBoundingClientRect();
        const bbh = bookGroupListBox.bottom - bookGroupListBox.top;
        const bookElem = bookGroupList.querySelectorAll(`.bookgroupitem`);
        if (bookElem.length > 1) {
          const ith = bbh / bookElem.length;
          if (ith && !this.rowHeight) this.rowHeight = ith;
        }
      }
    }

    if (selection) setTimeout(() => centerBook(selection), 1000);

    renderPromise.dispatch();
  }

  componentWillUnmount() {
    const { wheelListener } = this;
    document.removeEventListener('wheel', wheelListener, { capture: true });
    clearPending(this, ['bookgroupTO', 'headingmenuTO']);
    clearPending(this, 'slideInterval', true);
  }

  componentDidUpdate() {
    const { listRef, renderPromise } = this;
    if (listRef.current) {
      const listAreaBox = listRef.current.getBoundingClientRect();
      this.listAreaHeight = listAreaBox.bottom - listAreaBox.top;
    }
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

  // Returns false if the slider is already at the bottom end, and so
  // cannot slide any further.
  slideUp(rows = 1) {
    const { state, rowHeight, listAreaHeight, stopSliding } = this;
    const { bookGroup, slideIndex } = state;

    const maxScrollIndex =
      C.SupportedBooks[bookGroup].length - listAreaHeight / rowHeight;

    if (slideIndex[bookGroup] >= maxScrollIndex) {
      stopSliding();
      return false;
    }

    if (!rowHeight) return false;

    this.setState((prevState) => {
      let next = prevState.slideIndex[bookGroup] + rows;
      if (next > maxScrollIndex) next = maxScrollIndex;
      prevState.slideIndex[bookGroup] = next;
      return prevState;
    });

    return true;
  }

  // Returns false if the slider is already at the top end, and so
  // cannot slide any further.
  slideDown(rows = 1) {
    const { state, rowHeight, stopSliding } = this;
    const { bookGroup, slideIndex } = state;

    if (slideIndex[bookGroup] <= 0) {
      stopSliding();
      return false;
    }

    if (!rowHeight) return false;

    this.setState((prevState) => {
      let next = prevState.slideIndex[bookGroup] - rows;
      if (next < 0) next = 0;
      prevState.slideIndex[bookGroup] = next;
      return prevState;
    });

    return true;
  }

  centerBook(book: OSISBookType) {
    const { props, rowHeight, listAreaHeight } = this;
    const { hideUnavailableBooks } = props;
    if (!hideUnavailableBooks) {
      const Book = G.getBook(G.i18n.language);
      const { bookGroup, indexInBookGroup } = Book[book];
      this.setState((prevState) => {
        const { slideIndex } = prevState;
        const maxScrollIndex =
          C.SupportedBooks[bookGroup].length - listAreaHeight / rowHeight;
        let i = 3 + indexInBookGroup - 0.5 * (listAreaHeight / rowHeight);
        if (i > maxScrollIndex) i = maxScrollIndex;
        if (i < 0) i = 0;
        slideIndex[bookGroup] = i;
        return { bookGroup, slideIndex };
      });
    }
  }

  render() {
    const {
      props,
      state,
      handler,
      rowHeight,
      longestBook,
      renderPromise,
      loadingRef,
      listRef,
    } = this;
    const {
      availableBooks,
      headingsModule,
      selection,
      v11n,
      viewportParentHandler,
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
        pack="start"
        {...addClass(`chooser verse-chooser`, props)}
        onPointerLeave={handler}
      >
        <Hbox className="fadetop" />

        <Hbox className="chooser-container" flex="20">
          <div
            className="close-chooser"
            onPointerDown={viewportParentHandler}
          />

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
                  onPointerEnter={handler}
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

          <Vbox domref={listRef} className="book-list">
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

        <Hbox flex="1" className="fadebot" />
      </Vbox>
    );
  }
}

export default Chooser;

function BookGroupList(
  props: {
    v11n: V11nType;
    bookGroup?: BookGroupType | null;
    selection?: string;
    availableBooks?: Set<string>;
    headingsModule?: string | null;
    hideUnavailableBooks?: boolean;
    handler?: (e: React.SyntheticEvent) => void;
    onAudioClick?: (
      selection: AudioPlayerFileVK | AudioPlayerFileGB | null,
      e: SyntheticEvent<Element, Event>,
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
  const Book = G.getBook(G.i18n.language);
  const Books = G.getBooks(G.i18n.language);
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
    headingsModule?: string | null;
    v11n: V11nType;
    handler?: (e: React.SyntheticEvent) => void;
    onAudioClick?: (
      selection: AudioPlayerFileVK | AudioPlayerFileGB | null,
      e: SyntheticEvent<Element, Event>,
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
  const Book = G.getBook(G.i18n.language);
  return (
    <Hbox
      {...addClass(['bookgroupitem'].concat(c), props)}
      {...topHandle('onPointerEnter', handler, props)}
      data-book={sName}
      data-v11n={v11n}
    >
      <div className="label">{Book[sName].name}</div>

      {headingsModule &&
        onAudioClick &&
        audioIcon({
          swordModule: headingsModule,
          bookOrKey: sName,
          audioHandler: onAudioClick,
          renderPromise,
        })}

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
  headingsModule?: string | null;
  bkcode: string;
  v11n: V11nType;
  handler?: (e: React.SyntheticEvent) => void;
  onAudioClick?: (
    selection: AudioPlayerFileVK | AudioPlayerFileGB | null,
    e: SyntheticEvent<Element, Event>,
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
            onPointerEnter={dlyhandler}
            onPointerLeave={handler}
          >
            {dString(ch)}
            {headingsModule &&
              onAudioClick &&
              audioIcon({
                swordModule: headingsModule,
                bookOrKey: bkcode,
                chapter: ch,
                audioHandler: onAudioClick,
                renderPromise,
              })}
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
      onPointerDown={handler}
    >
      {chmenuCells}
      <div className="headingmenu" onPointerLeave={handler} />
    </div>
  );
}
