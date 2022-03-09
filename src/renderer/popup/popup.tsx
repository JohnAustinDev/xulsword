/* eslint-disable no-empty */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable max-classes-per-file */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/mouse-events-have-key-events */
/* eslint-disable react/no-did-update-set-state */
/* eslint-disable react/forbid-prop-types */
/* eslint-disable react/static-property-placement */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import i18next from 'i18next';
import PropTypes from 'prop-types';
import {
  topHandle,
  htmlAttribs,
  xulDefaultProps,
  XulProps,
  xulPropTypes,
} from '../libxul/xul';
import { FeatureType } from '../../type';
import C from '../../constant';
import { sanitizeHTML, stringHash } from '../../common';
import { getPopupInfo } from '../../libswordElemInfo';
import G from '../rg';
import { getCompanionModules, libswordImgSrc } from '../rutil';
import { getIntroductions, getNoteHTML } from '../viewport/zversekey';
import { getDictEntryHTML, getLemmaHTML } from '../viewport/zdictionary';
import popupH from './popupH';
import '../libsword.css';
import './popup.css';

import type { ElemInfo } from '../../libswordElemInfo';

function getRefBible(mod: string | null, type: string | null): string | null {
  let refbible = mod;
  if (mod && type === 'sr' && G.Tab[mod]?.type !== C.BIBLE) {
    const aref = getCompanionModules(mod);
    const bible = aref.find((m) => G.Tab[m]?.type === C.BIBLE);
    if (bible) refbible = bible;
  }
  if (refbible && (type === 'cr' || type === 'sr')) {
    // default prefs.js doesn't have this key since mod is unknown
    refbible = G.Prefs.getPrefOrCreate(
      `global.popup.selection.${mod}`,
      'string',
      refbible
    );
  }
  return refbible;
}

const defaultProps = {
  ...xulDefaultProps,
  gap: undefined,
  isWindow: false,
  onMouseLeftPopup: undefined,
};

const propTypes = {
  ...xulPropTypes,
  elemhtml: PropTypes.arrayOf(PropTypes.string),
  eleminfo: PropTypes.arrayOf(PropTypes.object),
  gap: PropTypes.number,
  isWindow: PropTypes.bool,
  onPopupClick: PropTypes.func.isRequired,
  onSelectChange: PropTypes.func.isRequired,
  onMouseLeftPopup: PropTypes.func,
  onPopupContextMenu: PropTypes.func,
};

export interface PopupProps extends XulProps {
  // key must be set correctly for popup to update, like:
  // key={[gap, elemhtml.length, popupReset].join('.')}
  key: string;
  elemhtml: string[] | null; // outerHTML of target element
  eleminfo: ElemInfo[] | null; // extra target element info (ie for select options)
  gap: number | undefined; // Pixel distance between target element and top of popup window
  isWindow: boolean; // Set to true to use popup in windowed mode
  onPopupClick: (e: React.SyntheticEvent) => void;
  onSelectChange: (e: React.SyntheticEvent) => void;
  onMouseLeftPopup: (e: React.SyntheticEvent) => void | undefined;
  onPopupContextMenu: (e: React.SyntheticEvent) => void | undefined;
}

export interface PopupState {
  drag: {
    dragging: boolean;
    adjustment: number; // keep popup bottom edge on the viewport
    x: number[];
    y: number[];
  } | null;
}

// To show/hide a popup, either Popup should be rendered, or not.
// Popup shows information about particular types of elements (a
// list of verses for a cross-reference note, or information about
// a Strong's number for a Strong's link, etc.). The outerHTML
// string of a target element must be supplied on the elemhtml
// prop. Extra information associated with the target element may
// be provided using the eleminfo prop (and this info supercedes any
// ElemInfo from the outerHTML). Both elemhtml and eleminfo props are
// arrays because a Popup may be updated to show information about
// other elements appearing within the popup, and a back link will
// appear when there are previous views to return to. To use Popup as
// a windowed popup, it should be rendered as the child of a visible
// parent element and isWindow should be true. To use as a regular
// popup, Popup should be rendered using a React portal to a target
// element within which it will appear (usually the same element as
// elemhtml[0] but this is not necessary), and isWindow should be
// false (the default).

class Popup extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  npopup: React.RefObject<HTMLDivElement>;

  handler: (e: React.MouseEvent) => void;

  constructor(props: PopupProps) {
    super(props);

    this.state = {
      drag: null,
    };

    this.npopup = React.createRef();

    this.handler = popupH.bind(this);
    this.update = this.update.bind(this);
    this.element = this.element.bind(this);
    this.setTitle = this.setTitle.bind(this);
    this.selector = this.selector.bind(this);
    this.positionPopup = this.positionPopup.bind(this);
  }

  componentDidMount() {
    this.update();
  }

  componentDidUpdate() {
    this.update();
  }

  setTitle() {
    const { npopup } = this;
    const { isWindow } = this.props as PopupProps;
    const popup = npopup?.current;
    if (isWindow && popup) {
      const search = ['crref', 'lemma-header', 'popup-text'];
      let title;
      for (let x = 0; !title && x < search.length; x += 1) {
        const els = popup.getElementsByClassName(search[x]);
        if (els && els[0]) {
          const elem = els[0] as HTMLElement;
          title = elem?.textContent;
          title = title?.replace(/[\n\s]+/g, ' ');
          if (title && title.length > 24) {
            title = `${title.substring(0, title.indexOf(' ', 24))}…`;
          }
        }
      }
      if (title) window.ipc.renderer.send('window', 'title', title);
    }
  }

  element() {
    const props = this.props as PopupProps;
    const { elemhtml, eleminfo } = props;
    if (!elemhtml || !elemhtml.length) return null;
    const elemHTML = elemhtml[elemhtml.length - 1];
    const reninfo =
      eleminfo && eleminfo.length === elemhtml.length
        ? eleminfo[eleminfo.length - 1]
        : {};
    const div = sanitizeHTML(document.createElement('div'), elemHTML);
    const elem = div.firstChild as HTMLElement | null;
    if (!elem)
      throw Error(`Popup was given a malformed element: '${elemHTML}'`);
    const info = { ...getPopupInfo(elem), ...reninfo };
    if (!info)
      throw Error(
        `Neither Popup elemhtml or eleminfo provided info: '${elemHTML}'`
      );
    return { info, elem, elemHTML };
  }

  // Set root location of popup, and if it is overflowing the bottom of
  // the viewport, then drag it up.
  positionPopup() {
    const { npopup } = this;
    const { isWindow, gap } = this.props as PopupProps;
    const state = this.state as PopupState;
    if (!state.drag && !isWindow) {
      const popup = npopup?.current;
      const parent = popup?.parentNode as HTMLElement | null;
      if (popup && parent) {
        const drag = {
          dragging: false,
          adjustment: 0,
          y: [],
          x: [],
        };
        // Set top border of npopup to the parent element's y location
        let scrolltop = 0;
        let test = parent as any;
        while (test) {
          if (test.scrollTop) {
            scrolltop += test.scrollTop;
            test = null;
          } else test = test.parentNode;
        }
        popup.style.top = `${parent.offsetTop - scrolltop}px`;
        // Adjust the popup upward if it would extend beyond the bottom of the screen
        const margin = 22;
        const box = popup.firstChild as HTMLElement | null;
        if (box) {
          const boxbottom = box.getBoundingClientRect().bottom;
          const viewportHeight = window.innerHeight;
          if (boxbottom > viewportHeight - margin) {
            const adjustment = Math.round(viewportHeight - boxbottom - margin);
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
    const { npopup } = this;
    const props = this.props as PopupProps;
    const { isWindow } = props;
    const pts = npopup?.current?.getElementsByClassName('popup-text');
    if (!npopup.current || !pts) throw Error(`Popup.updateContent no npopup.`);
    const pt = pts[0] as HTMLElement;
    const element = this.element();
    if (!element) return;
    const { info, elem } = element;
    const { type, reflist, bk, ch, mod, title } = info;

    const infokey = stringHash(type, reflist, bk, ch, mod);
    if (!pt.dataset.infokey || pt.dataset.infokey !== infokey) {
      let html = '';
      switch (type) {
        case 'cr':
        case 'fn':
        case 'un': {
          if (mod && bk && ch && title) {
            // getChapterText must be called before getNotes
            G.LibSword.getChapterText(mod, `${bk}.${ch}`);
            const notes = G.LibSword.getNotes();
            // a note element's title does not include type, but its nlist does
            html = getNoteHTML(
              notes,
              type === 'cr' ? getRefBible(mod, type) || mod : mod,
              null,
              0,
              true,
              true,
              `${type}.${title}`
            );
          }
          break;
        }

        case 'sr': {
          if (mod) {
            const refbible = getRefBible(mod, type) || mod;
            const mynote =
              reflist && reflist[0] !== 'unavailable'
                ? reflist.join(';')
                : elem.innerHTML;
            html = getNoteHTML(
              `<div class="nlist" data-title="cr.1.0.0.0.${refbible}">${mynote}</div>`,
              refbible,
              null,
              0,
              true,
              true
            );
          }
          break;
        }

        case 'sn': {
          if (mod) {
            const snlist = Array.from(elem.classList);
            if (snlist && snlist.length > 1) {
              snlist.shift();
              html = getLemmaHTML(snlist, elem.innerHTML, mod);
            }
          }
          break;
        }

        case 'dtl':
        case 'dt': {
          if (reflist) {
            const dnames: string[] = [];
            let dword = '';
            reflist.forEach((ref) => {
              if (ref) {
                const colon = ref.indexOf(':');
                if (colon !== -1) dnames.push(ref.substring(0, colon));
                if (!dword) dword = ref.substring(colon + 1);
              }
            });
            html = getDictEntryHTML(dword, dnames.join(';'));
          }
          break;
        }

        case 'introlink': {
          if (mod && bk && ch) {
            const intro = getIntroductions(mod, `${bk}.${ch}`);
            if (intro && intro.textHTML) html = intro.textHTML;
          }
          break;
        }

        case 'noticelink': {
          if (mod) html = G.LibSword.getModuleInformation(mod, 'NoticeText');
          break;
        }

        case 'unknown': {
          console.log(`Unknown popup: '${elem.className}'`);
          break;
        }

        default:
          throw Error(`Unhandled popup type '${type}'.`);
      }

      pt.dataset.infokey = infokey;
      sanitizeHTML(pt, html);
      libswordImgSrc(pt);

      const parent = npopup.current.parentNode as HTMLElement | null;
      if (!isWindow && parent) {
        if (html) parent.classList.remove('empty');
        else parent.classList.add('empty');
      }

      if (isWindow) this.setTitle();

      this.positionPopup();
    }
  }

  selector(
    mods: string[],
    selected: string | null,
    module?: string | undefined,
    feature?: string | undefined
  ) {
    const props = this.props as PopupProps;
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
            className={`pupselect cs-${G.Tab[mod].module}`}
            value={mod}
          >
            {G.Tab[mod].label}
          </option>
        ))}
      </select>
    );
  }

  render() {
    const props = this.props as PopupProps;
    const state = this.state as PopupState;
    const { handler, npopup } = this;
    const { drag } = state;
    const { elemhtml, gap, isWindow } = props;
    const element = this.element();
    const { info, elem } = element || {
      info: { mod: '', type: '' },
      elem: null,
    };
    const { mod, type } = info;

    const allBibleModules = [];
    for (let t = 0; t < G.Tabs.length; t += 1) {
      if (G.Tabs[t].type === C.BIBLE) allBibleModules.push(G.Tabs[t].module);
    }

    const textFeature: { [key in keyof FeatureType]?: RegExp } = {
      hebrewDef: /S_H/,
      greekDef: /S_G/,
      greekParse: /SM_G/,
    };

    let boxlocation;
    if (!isWindow) {
      const maxHeight = window.innerHeight / 2;
      const leftd = drag && drag.x[0] ? drag.x[1] - drag.x[0] : 0;
      const left = window.shell.process.argv()[0] === 'search' ? leftd : 'auto';
      let top = gap || 0;
      if (drag) top += drag.adjustment + (drag.y[1] || 0) - (drag.y[0] || 0);
      boxlocation = {
        marginTop: `${top}px`,
        marginLeft: `${left}px`,
        maxHeight: `${maxHeight}px`,
      };
    }

    const refbible = getRefBible(mod, type);

    let cls = `userFontBase`;
    if (isWindow) cls += ` ownWindow viewport`;

    return (
      <div
        {...htmlAttribs(`npopup ${cls}`, props)}
        {...topHandle('onMouseLeave', props.onMouseLeftPopup, props)}
        {...topHandle('onContextMenu', props.onPopupContextMenu, props)}
        onWheel={(e) => e.stopPropagation()}
        ref={npopup}
      >
        <div
          className="npopupTX"
          onClick={props.onPopupClick}
          onMouseDown={handler}
          onMouseMove={handler}
          onMouseUp={handler}
          onMouseLeave={props.onMouseLeftPopup}
          style={boxlocation}
        >
          <div className="popupheader">
            {!isWindow && <div className="towindow" />}
            {elemhtml && elemhtml.length > 1 && (
              <a className="popupBackLink">{i18next.t('back')}</a>
            )}
            {elemhtml && elemhtml.length === 1 && (
              <a className="popupCloseLink">{i18next.t('close')}</a>
            )}
            {!isWindow && <div className="draghandle" />}

            {refbible &&
              (type === 'cr' || type === 'sr') &&
              this.selector(allBibleModules, refbible, refbible)}

            {type === 'sn' &&
              elem &&
              Object.entries(textFeature).map((entry) => {
                const feature = entry[0] as
                  | 'hebrewDef'
                  | 'greekDef'
                  | 'greekParse';
                const regex = entry[1];
                if (regex.test(elem.className)) {
                  const fmods = G.FeatureModules[feature];
                  if (fmods?.length) {
                    let selmod = G.Prefs.getCharPref(
                      `global.popup.selection.${feature}`
                    );
                    if (!selmod) {
                      [selmod] = fmods;
                      G.Prefs.setCharPref(
                        `global.popup.selection.${feature}`,
                        selmod
                      );
                    }
                    return this.selector(fmods, selmod, undefined, feature);
                  }
                }
                return null;
              })}
          </div>

          <div className="popup-text" />
        </div>
      </div>
    );
  }
}
Popup.defaultProps = defaultProps;
Popup.propTypes = propTypes;

export default Popup;
