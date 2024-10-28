// A history item has the type HistoryTypeVK and only a single
// verse selection for a chapter will be successively saved in
// history. If add is supplied, its v11n must be the same as
// current v11n or nothing will be recorded. The history entry
// will be recorded at the current historyIndex, and the history

import React from 'react';
import { clone } from '../../../common.ts';
import C from '../../../constant.ts';
import { G } from '../../G.ts';
import verseKey from '../../verseKey.ts';
import Menupopup from '../libxul/menupopup.tsx';

import type { HistoryVKType } from '../../../type.ts';
import type Xulsword from './xulsword.tsx';
import type { XulswordState } from './xulsword.tsx';

// array size will be limited to maxHistoryMenuLength.
export function addHistory(this: Xulsword, add?: HistoryVKType): void {
  const { location, selection, history, historyIndex } = this
    .state as XulswordState;
  const { renderPromise } = this;
  if (!location || (add && add.location.v11n !== location.v11n)) return;
  const newhist: HistoryVKType = add || {
    location,
    selection,
  };
  // Don't record multiple entries for the same chapter, and convert vlln
  // before comparing so duplicate history is not recorded when v11n
  // switches with a module having a different v11n.
  if (history[historyIndex]) {
    const locvk = verseKey(
      history[historyIndex].location,
      renderPromise,
    ).location(location.v11n);
    if (location.book === locvk.book && location.chapter === locvk.chapter)
      return;
  }
  this.setState((prevState: XulswordState) => {
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
  const { history: h } = this.state as XulswordState;
  const { renderPromise } = this;
  if (
    index < 0 ||
    index > h.length - 1 ||
    index > C.UI.Xulsword.maxHistoryMenuLength
  )
    return;
  this.setState((prevState: XulswordState) => {
    let ret: Partial<XulswordState> | null = null;
    const { history: h, location: l } = prevState;
    const history = clone(h);
    const location = clone(l);
    if (location) {
      // To update state to a history index without changing the selected
      // modules, history needs to be converted to the current v11n.
      const { location: hloc, selection: hsel } = history[index];
      const newloc = verseKey(hloc, renderPromise).location(location.v11n);
      const newsel = hsel
        ? verseKey(hsel, renderPromise).location(location.v11n)
        : null;
      if (promote) {
        const targ = history.splice(index, 1);
        history.splice(0, 0, targ[0]);
      }
      ret = {
        location: newloc,
        selection: newsel,
        scroll: { verseAt: 'center' },
        history,
        historyIndex: promote ? 0 : index,
        historyMenupopup: undefined,
      };
    }
    return ret;
  });
}

// Build and return a history menupopup from state.
export function historyMenu(
  this: Xulsword,
  state: XulswordState,
  onClick: (e: any, i: number) => void,
) {
  const { history, historyIndex, location } = state;
  const { renderPromise } = this;
  let is = historyIndex - Math.round(C.UI.Xulsword.maxHistoryMenuLength / 2);
  if (is < 0) is = 0;
  let ie = is + C.UI.Xulsword.maxHistoryMenuLength;
  if (ie > history.length) ie = history.length;
  const items = history.slice(is, ie);
  if (!items?.length || !location) return null;
  return (
    <Menupopup>
      {items.map((histitem, i) => {
        const { location: hloc, selection: hsel } = histitem;
        const itemvk = verseKey(hloc, renderPromise);
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
          <div
            key={[selected, index, histitem].join('.')}
            className={selected}
            onClick={(e) => {
              onClick(e, index);
            }}
          >
            {itemvk.readable(G.i18n.language, null, true)}
          </div>
        );
      })}
    </Menupopup>
  );
}
