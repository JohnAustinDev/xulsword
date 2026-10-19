// A history item has the type HistoryTypeVK and only a single
// verse selection for a chapter will be successively saved in
// history. If add is supplied, its v11n must be the same as
// current v11n or nothing will be recorded. The history entry
// will be recorded at the current historyIndex, and the history

import React from 'react';
import VerseKey from '../../../verseKey.ts';
import { clone } from '../../../common.ts';
import C from '../../../constant.ts';
import { G } from '../../G.ts';
import Menupopup from '../libxul/menupopup.tsx';
import { Box } from '../libxul/boxes.tsx';

import type { HistoryVKType, LocationVKType } from '../../../type.ts';
import type Xulsword from './xulsword.tsx';
import type { XulswordState } from './xulsword.tsx';

// Return true if a and b are the same chapter. Since v11n may switch with a
// module having a different v11n, a is converted to b's v11n before comparing.
function sameChapter(
  a: LocationVKType,
  b: LocationVKType,
  renderPromise: Xulsword['renderPromise'],
): boolean {
  const avk = new VerseKey(a, renderPromise).location(b.v11n);
  return avk.book === b.book && avk.chapter === b.chapter;
}

// array size will be limited to maxHistoryMenuLength. In the web-app, chapter
// changes are also added to window.history so that the browser or device's
// native back and forward controls will navigate them.
export function addHistory(this: Xulsword, add?: HistoryVKType): void {
  const { state, renderPromise } = this;
  const { location, selection, history, historyIndex } = state;
  if (!location || (add && add.location.v11n !== location.v11n)) return;
  const newhist: HistoryVKType = add || {
    location,
    selection,
  };
  // The current entry gets the chapter if it has none (and is not a card),
  // otherwise a new entry is pushed. After popstate, window.history.state is
  // already the current chapter, so nothing more is recorded.
  if (Build.isWebApp) {
    const ws = window.history.state;
    const prev = ws?.xulsword as HistoryVKType | undefined;
    const card = !!ws?.controller?.card;
    if (!prev && !card) {
      window.history.replaceState({ ...ws, xulsword: newhist }, '');
    } else if (
      card ||
      (prev && !sameChapter(prev.location, location, renderPromise))
    ) {
      window.history.pushState({ xulsword: newhist }, '');
    }
  }
  // Don't record multiple entries for the same chapter.
  if (
    history[historyIndex] &&
    sameChapter(history[historyIndex].location, location, renderPromise)
  )
    return;
  this.setState((prevState) => {
    const newhistory = clone(prevState.history);
    newhistory.splice(prevState.historyIndex, 0, newhist);
    if (newhistory.length > C.UI.Xulsword.maxHistoryMenuLength) {
      newhistory.pop();
    }
    return { history: newhistory };
  });
}

// Set scripture location state to a particular history index. Also, if
// promote is true, move that history entry to history[0].
export function setHistory(
  this: Xulsword,
  index: number,
  promote = false,
): void {
  const { state, renderPromise } = this;
  const { history: h } = state;
  if (
    index < 0 ||
    index > h.length - 1 ||
    index > C.UI.Xulsword.maxHistoryMenuLength
  )
    return;
  this.setState((prevState) => {
    const { history: h, location: l } = prevState;
    const history = clone(h);
    const location = clone(l);
    if (location) {
      // To update state to a history index without changing the selected
      // modules, history needs to be converted to the current v11n.
      const { location: hloc, selection: hsel } = history[index];
      const newloc = new VerseKey(hloc, renderPromise).location(location.v11n);
      const newsel = hsel
        ? new VerseKey(hsel, renderPromise).location(location.v11n)
        : null;
      if (promote) {
        const targ = history.splice(index, 1);
        history.splice(0, 0, targ[0]);
      }
      return {
        location: newloc,
        selection: newsel,
        scroll: { verseAt: 'center' },
        history,
        historyIndex: promote ? 0 : index,
        historyMenupopup: undefined,
      };
    }
    return null;
  });
}

// Web-app window popstate listener: show the chapter of a window.history
// entry which was recorded by addHistory.
export function onPopState(this: Xulsword, e: PopStateEvent): void {
  const { state, renderPromise } = this;
  const { location, history } = state;
  const entry = e.state?.xulsword as HistoryVKType | undefined;
  // A card entry will unmount xulsword, so leave it to the controller.
  if (!entry || e.state?.controller?.card || !location) return;
  // Use the history menu entry if there is one, so the menu stays in sync.
  const index = history.findIndex((h) =>
    sameChapter(h.location, entry.location, renderPromise),
  );
  if (index !== -1) {
    this.setHistory(index);
    return;
  }
  const { location: hloc, selection: hsel } = entry;
  this.setState({
    location: new VerseKey(hloc, renderPromise).location(location.v11n),
    selection: hsel
      ? new VerseKey(hsel, renderPromise).location(location.v11n)
      : null,
    scroll: { verseAt: 'center' },
  });
}

// Build and return a history menupopup from state.
export function historyMenu(
  this: Xulsword,
  state: XulswordState,
  onPointerDown: (e: any, i: number) => void,
) {
  const { history, historyIndex, location } = state;
  const { renderPromise } = this;
  let is = historyIndex - Math.round(C.UI.Xulsword.maxHistoryMenuLength / 2);
  if (is < 0) is = 0;
  let ie = is + C.UI.Xulsword.maxHistoryMenuLength;
  if (ie > history.length) ie = history.length;
  const items = history.slice(is, ie);
  if (!items?.length || !location) return;
  return (
    <Menupopup>
      {items.map((histitem, i) => {
        const { location: hloc, selection: hsel } = histitem;
        const itemvk = new VerseKey(hloc, renderPromise);
        const itemloc = itemvk.location(location.v11n);
        if (itemloc.verse === 1) {
          itemloc.verse = undefined;
          itemloc.lastverse = undefined;
        }
        // Verse comes from verse or selection; lastverse comes from selection.
        if (hsel?.verse && hsel.verse > 1) {
          itemloc.verse = hsel.verse;
          if (hsel.lastverse && hsel.lastverse > hsel.verse)
            itemloc.lastverse = hsel.lastverse;
        }
        const index = i + is;
        const selected = index === historyIndex ? 'selected' : '';
        return (
          <Box
            key={[selected, index, histitem].join('.')}
            className={selected}
            onPointerDown={(e) => {
              onPointerDown(e, index);
            }}
          >
            {itemvk.readable(G.i18n.language, null, true)}
          </Box>
        );
      })}
    </Menupopup>
  );
}
