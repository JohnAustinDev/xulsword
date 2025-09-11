import React from 'react';
import {
  JSON_attrib_stringify,
  ofClass,
  sanitizeHTML,
  stringHash,
} from '../../../common.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import { libswordImgSrc, notMouse, windowArguments } from '../../common.ts';
import RenderPromise from '../../renderPromise.ts';
import { topHandle, htmlAttribs } from '../libxul/xul.tsx';
import { Box, Hbox } from '../libxul/boxes.tsx';
import Button from '../libxul/button.tsx';
import { getRefBible } from '../atext/zversekey.ts';
import popupH, { getPopupHTML } from './popupH.ts';
import '../../libsword.css';
import './popup.css';
// These classes are used by generated HTML:
import '../libxul/label.css';
import '../libxul/button.css';

import type { FeatureMods, GType } from '../../../type.ts';
import type S from '../../../defaultPrefs.ts';
import type { HTMLData } from '../../htmlData.ts';
import type {
  RenderPromiseComponent,
  RenderPromiseState,
} from '../../renderPromise.ts';
import type { XulProps } from '../libxul/xul.tsx';

export type PopupProps = {
  // key must be set correctly for popup to update, like:
  // key={[gap, elemdata.length, popupReset].join('.')}
  key: string;
  elemdata: HTMLData[] | null; // data of target elements
  gap?: number; // Pixel distance between target element and top of popup window
  isWindow?: boolean; // Set to true to use popup in windowed mode
  onPopupClick: (e: React.SyntheticEvent) => void;
  onSelectChange: (e: React.SyntheticEvent) => void;
  onMouseLeftPopup?: (e: React.SyntheticEvent) => void;
  onPopupContextMenu?: (e: React.SyntheticEvent) => void;
} & XulProps;

export type PopupState = RenderPromiseState & {
  drag: {
    dragging: boolean;
    adjustment: number; // keep popup bottom edge on the viewport
    x: number[];
    y: number[];
  } | null;
};

// To show/hide a popup, either Popup should be rendered, or not.
// Popup shows information about particular types of elements (a
// list of verses for a cross-reference note, or information about
// a Strong's number for a Strong's link, etc.). The data object
// of a target element must be supplied on the elemdata prop, which
// is an array because a Popup may be updated to show information
// about other elements appearing within the popup, and a back link
// will appear when there are previous views to return to. To use
// Popup as a windowed popup, it should be rendered as the child of
// a visible parent element and isWindow should be true. To use as
// a regular popup, Popup should be rendered using a React portal
// to a target element within which it will appear (usually the
// same element as elemdata[0] but this is not necessary), and
// isWindow should be false (the default).
class Popup
  extends React.Component<PopupProps, PopupState>
  implements RenderPromiseComponent
{
  handler: (e: React.MouseEvent) => void;

  renderPromise: RenderPromise;

  loadingRef: React.RefObject<HTMLDivElement>;

  constructor(props: PopupProps) {
    super(props);

    this.state = {
      drag: null,
      renderPromiseID: 0,
    };

    this.handler = popupH.bind(this);
    this.update = this.update.bind(this);
    this.setTitle = this.setTitle.bind(this);
    this.selector = this.selector.bind(this);
    this.positionPopup = this.positionPopup.bind(this);
    this.onMouseLeftPopup = this.onMouseLeftPopup.bind(this);

    this.loadingRef = React.createRef();
    this.renderPromise = new RenderPromise(this, this.loadingRef, '.npopupTX');
  }

  componentDidMount() {
    const { renderPromise } = this;
    this.update();
    renderPromise.dispatch();
  }

  componentDidUpdate() {
    const { renderPromise } = this;
    this.update();
    renderPromise.dispatch();
  }

  setTitle() {
    const { props, loadingRef } = this;
    const { isWindow } = props;
    const popup = loadingRef?.current;
    if (isWindow && popup) {
      const maxlen = Math.floor((popup.clientWidth - 50) / 10);
      const search = ['crref', 'lemma-header', 'popup-text'];
      let title;
      for (let x = 0; !title && x < search.length; x += 1) {
        const els = popup.getElementsByClassName(search[x]);
        if (els?.[0]) {
          const elem = els[0] as HTMLElement;
          title = elem?.textContent;
          title = title?.replace(/[\n\s]+/g, ' ');
          if (title && title.length > maxlen) {
            title = `${title.substring(0, title.indexOf(' ', maxlen))}…`;
          }
        }
      }
      if (Build.isElectronApp && title) (G as GType).Window.setTitle(title);
    }
  }

  // Set root location of popup, and if it is overflowing the bottom of
  // the text area, then drag it up.
  positionPopup(force = false as boolean) {
    const { props, state, loadingRef } = this;
    const { isWindow, gap } = props;
    if ((force || !state.drag) && !isWindow) {
      const popup = loadingRef?.current;
      const parent = popup?.parentNode as HTMLElement | null;
      if (popup && parent) {
        const drag = {
          dragging: false,
          adjustment: 0,
          y: [],
          x: [],
        };

        // For mobile web app, the popup should always cover the width of the
        // screen.
        if (Build.isWebApp && window.innerWidth <= C.UI.WebApp.mobileW) {
          const margin = 10;
          const pwidth = `calc(100vw - ${margin + margin + 4}px)`;
          popup.style.width = pwidth;
          if (!document.querySelector(`html[dir='rtl']`)) {
            popup.style.left = '0px';
            const boxl = popup.getBoundingClientRect().left;
            popup.style.left = `${margin - boxl}px`;
          } else {
            popup.style.right = '0px';
            const boxl = popup.getBoundingClientRect().right;
            popup.style.right = `${boxl - margin}px`;
          }
        }

        // Set top border of npopup to the parent element's y location
        popup.style.top = '0px';
        const popupStart = popup.getBoundingClientRect().top;
        const parentStart = parent.getBoundingClientRect().top;
        popup.style.top = `${parentStart - popupStart}px`;

        // Adjust the popup upward if it would extend beyond the bottom of the text area.
        const margin = 10;
        const box = popup.firstChild as HTMLElement | null;
        const text = ofClass(['atext', 'resultBox'], popup);
        if (box && text) {
          const pupbottom = box.getBoundingClientRect().bottom;
          const textbottom = text.element.getBoundingClientRect().bottom;
          if (pupbottom > textbottom - margin) {
            const adjustment = Math.round(textbottom - pupbottom - margin);
            drag.adjustment = adjustment;
            box.style.top = `${(gap || 0) + adjustment}px`;
          }
        }
        this.setState({ drag });
      }
    }
  }

  // Write popup contents from LibSword, and update state if popup
  // was repositioned.
  update() {
    const { props, loadingRef, renderPromise } = this;
    const { elemdata, isWindow } = props;
    const pts = loadingRef?.current?.getElementsByClassName('popup-text');
    if (!loadingRef.current || !pts)
      throw Error(`Popup.updateContent no npopup.`);
    const pt = pts[0] as HTMLElement;
    const data = elemdata?.[elemdata.length - 1];
    if (data) {
      const { type, reflist, context, location, locationGB } = data;
      let infokey;
      if (location) {
        const { book, chapter } = location;
        infokey = stringHash(type, reflist, book, chapter, context);
      } else if (locationGB) {
        const { otherMod: module, key } = locationGB;
        infokey = stringHash(type, reflist, module, key, context);
      } else {
        infokey = stringHash(type, reflist, context);
      }
      if (infokey) {
        if (!pt.dataset.infokey || pt.dataset.infokey !== infokey) {
          const html = getPopupHTML(data, renderPromise, false);
          if (!renderPromise.waiting()) {
            sanitizeHTML(pt, html);
            libswordImgSrc(pt);
            this.positionPopup(true);
          }
          if (isWindow) this.setTitle();
          else {
            const parent = loadingRef.current.parentNode as HTMLElement | null;
            if (parent) {
              if (html || renderPromise.waiting()) {
                parent.classList.remove('empty');
              } else parent.classList.add('empty');
            }
          }
          if (!renderPromise.waiting()) {
            this.positionPopup();
            pt.dataset.infokey = infokey;
            // Scroll to the top of the newly written popup.
            if (Build.isWebApp && notMouse())
              setTimeout(
                () =>
                  document
                    .querySelector('.popupheader')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                100,
              );
          }
        }
      }
    }
  }

  selector(
    mods: string[],
    selected: string | null,
    module?: string | undefined,
    feature?: string | undefined,
  ) {
    const { props } = this;
    if (!module && !feature) return null;
    return (
      <select
        key={mods
          .concat([selected || '', module || '', feature || ''])
          .join('.')}
        className="popup-mod-select"
        value={selected || undefined}
        data-module={module}
        data-feature={feature}
        onChange={props.onSelectChange}
      >
        {mods.map((mod) => (
          <option
            key={[mod, selected].join('.')}
            className={`pupselect cs-${G.Tab[mod].labelClass}`}
            value={mod}
          >
            {G.Tab[mod].label}
          </option>
        ))}
      </select>
    );
  }

  onMouseLeftPopup(e: React.MouseEvent) {
    const { props, handler } = this;
    const { onMouseLeftPopup } = props;
    handler(e);
    if (typeof onMouseLeftPopup === 'function') onMouseLeftPopup(e);
  }

  render() {
    const { props, state, handler, onMouseLeftPopup, loadingRef } = this;
    const { drag } = state;
    const { elemdata, gap, isWindow } = props;
    const data = elemdata?.[elemdata.length - 1] || null;
    let context: string | undefined;
    let type: string | undefined;
    if (data) ({ context, type } = data);

    const allBibleModules = [];
    for (let t = 0; t < G.Tabs.length; t += 1) {
      if (G.Tabs[t].type === C.BIBLE) allBibleModules.push(G.Tabs[t].module);
    }

    let boxlocation;
    if (!isWindow) {
      const leftd = drag?.x[0] ? drag.x[1] - drag.x[0] : 0;
      const left = windowArguments('type') === 'search' ? leftd : 'auto';
      let top = gap || 0;
      if (drag) top += drag.adjustment + (drag.y[1] || 0) - (drag.y[0] || 0);
      boxlocation = {
        marginTop: `${top}px`,
        marginLeft: `${left}px`,
      };
    }

    let gpfeature: typeof S.prefs.global.popup.feature | undefined;
    if (type === 'sn')
      gpfeature = G.Prefs.getComplexValue(
        'global.popup.feature',
      ) as typeof S.prefs.global.popup.feature;

    const bibleMod = context && getRefBible(context, this.renderPromise);

    let cls = 'cs-locale';
    if (isWindow) cls += ` ownWindow viewport`;

    return (
      <div
        ref={loadingRef}
        {...htmlAttribs(`npopup ${cls}`, props)}
        {...topHandle('onMouseLeave', props.onMouseLeftPopup, props)}
        {...topHandle('onContextMenu', props.onPopupContextMenu, props)}
        onWheel={(e) => {
          e.stopPropagation();
        }}
      >
        <div
          className="npopupTX userFontBase text"
          onClick={props.onPopupClick}
          onMouseDown={handler}
          onMouseMove={handler}
          onMouseUp={handler}
          onMouseOver={handler}
          onMouseLeave={onMouseLeftPopup}
          style={boxlocation}
          data-data={JSON_attrib_stringify(data)}
        >
          <Hbox pack="start" align="center" className="popupheader">
            {!isWindow && Build.isElectronApp && (
              <Button className="towindow" icon="open-application" />
            )}
            <Button className="popupCloseLink" icon="cross" />
            {elemdata && elemdata.length > 1 && (
              <Button className="popupBackLink" icon="arrow-left" />
            )}
            {!isWindow && !notMouse() && (
              <Button
                className={[
                  'draghandle',
                  drag?.dragging ? 'dragging' : '',
                ].join(' ')}
                icon="drag-handle-horizontal"
              />
            )}
            <Box flex="1" />
            {bibleMod &&
              (type === 'cr' || type === 'sr') &&
              this.selector(allBibleModules, bibleMod, bibleMod)}

            {type === 'sn' &&
              data?.className &&
              Object.entries(C.SwordFeatureClasses).map((entry) => {
                const [feature, regex] = entry as [keyof FeatureMods, RegExp];
                if (data.className && regex.test(data.className)) {
                  const fmods = G.FeatureModules[feature];
                  if (fmods?.length && Array.isArray(fmods)) {
                    let selmod: string | null =
                      (gpfeature as any)[feature] || null;
                    if (!selmod && fmods[0]) {
                      [selmod] = fmods;
                      if (gpfeature) {
                        gpfeature[feature] = selmod;
                        G.Prefs.setComplexValue(
                          'global.popup.feature',
                          gpfeature,
                        );
                      }
                    }
                    return this.selector(fmods, selmod, undefined, feature);
                  }
                }
                return null;
              })}
          </Hbox>

          <div className="popup-text" />
        </div>
      </div>
    );
  }
}

export default Popup;
