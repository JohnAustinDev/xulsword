/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable import/no-cycle */
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
  htmlAttribs,
  xulDefaultProps,
  XulProps,
  xulPropTypes,
} from '../libxul/xul';
import { FeatureType } from '../../type';
import C from '../../constant';
import { sanitizeHTML, stringHash } from '../../common';
import { TextInfo } from '../../textclasses';
import G from '../rg';
import { getCompanionModules, getPopupInfo } from '../rutil';
import { getIntroductions, getNoteHTML } from '../viewport/zversekey';
import { getDictEntryHTML, getLemmaHTML } from '../viewport/zdictionary';
import popupH from './popupH';
import '../libsword.css';
import './popup.css';

const defaultProps = {
  ...xulDefaultProps,
  gap: undefined,
  isWindow: false,
  onMouseLeftPopup: undefined,
};

const propTypes = {
  ...xulPropTypes,
  elemhtml: PropTypes.arrayOf(PropTypes.string).isRequired,
  eleminfo: PropTypes.arrayOf(PropTypes.object).isRequired,
  gap: PropTypes.number,
  isWindow: PropTypes.bool,
  onPopupClick: PropTypes.func.isRequired,
  onSelectChange: PropTypes.func.isRequired,
  onMouseLeftPopup: PropTypes.func,
};

export interface PopupProps extends XulProps {
  key: string; // key must be properly set to insure popup gets updated
  elemhtml: string[]; // outerHTML of target element
  eleminfo: TextInfo[]; // extra target element info (ie for select options)
  gap: number | undefined; // Pixel distance between target element and top of popup window
  isWindow: boolean; // True to use an opsys window as popup
  onPopupClick: (e: React.SyntheticEvent) => void;
  onSelectChange: (e: React.SyntheticEvent) => void;
  onMouseLeftPopup: (e: React.SyntheticEvent) => void | undefined;
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
// TextInfo from the outerHTML). Both elemhtml and eleminfo props are
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

  static POPUPDELAY: number;

  static POPUPDELAY_STRONGS: number;

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
      let title = '';
      const pts = popup.getElementsByClassName('popup-text');
      if (pts?.length) {
        const pt = pts[0] as HTMLElement;
        let html = pt.innerHTML.replace(/(\s*&nbsp;\s*)+/g, ' ');
        html = html.replace(/^.*?class="cs-[^>]*>/, ''); // find module text
        html = html.replace(/<[^>]*>/g, ''); // remove all tags
        title = `${html.substring(0, html.indexOf(' ', 24))}…`; // shortens it
        window.ipc.renderer.send('window', 'title', title);
      }
    }
  }

  element() {
    const props = this.props as PopupProps;
    const { elemhtml, eleminfo } = props;
    if (!elemhtml.length) throw Error(`Popup has no element.`);
    const elemHTML = elemhtml[elemhtml.length - 1];
    const reninfo =
      eleminfo && eleminfo.length === elemhtml.length
        ? eleminfo[eleminfo.length - 1]
        : {};
    const div = document.createElement('div');
    div.innerHTML = elemHTML;
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
  // is repositioned.
  update() {
    const { npopup } = this;
    const props = this.props as PopupProps;
    const { isWindow } = props;
    const pts = npopup?.current?.getElementsByClassName('popup-text');
    if (!npopup.current || !pts) throw Error(`Popup.updateContent no npopup.`);
    const pt = pts[0] as HTMLElement;
    const { info, elem } = this.element();
    // ntype is used to store cross-reference display module
    const { type, reflist, bk, ch, mod, title, ntype } = info;

    const infokey = stringHash(type, reflist, bk, ch, mod);
    if (!pt.dataset.infokey || pt.dataset.infokey !== infokey) {
      if (isWindow) this.setTitle();

      let html = '';
      switch (type) {
        case 'cr':
        case 'fn':
        case 'un': {
          if (mod && bk && ch && title) {
            const displaymod = ntype || mod;
            // getChapterText must be called before getNotes
            G.LibSword.getChapterText(mod, `${bk}.${ch}`);
            const notes = G.LibSword.getNotes();
            // note element's title does not include type, but note's nlist does
            html = getNoteHTML(
              notes,
              mod,
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
            let refbible = mod;
            if (G.Tab[mod]?.type !== C.BIBLE) {
              const aref = getCompanionModules(mod);
              if (aref.length) {
                const bible = aref.find((m) => G.Tab[m]?.type === C.BIBLE);
                if (bible) [refbible] = bible;
              }
            }
            const mynote =
              reflist && reflist[0] !== 'unavailable'
                ? reflist.join(';')
                : elem.innerHTML;

            html = getNoteHTML(
              `<div class="nlist" title="cr.1.0.0.0.${refbible}">${mynote}</div>`,
              refbible,
              null,
              0,
              true,
              true
            );
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

        default:
          throw Error(`Unhandled popup type '${type}'.`);
      }

      pt.dataset.infokey = infokey;
      sanitizeHTML(pt, html);

      const parent = npopup.current.parentNode as HTMLElement | null;
      if (!isWindow && parent) {
        if (html) parent.classList.remove('empty');
        else parent.classList.add('empty');
      }

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
    const { info, elem } = this.element();
    const { type, mod } = info;

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

    let refbible = mod;
    if (mod && type === 'sr' && G.Tab[mod]?.type !== C.BIBLE) {
      const aref = getCompanionModules(mod);
      const bible = aref.find((m) => G.Tab[m]?.type === C.BIBLE);
      if (bible) [refbible] = bible;
    }

    let cls = `userFontSize cs-program`;
    if (isWindow) cls += ` ownWindow viewport`;

    return (
      <div
        {...htmlAttribs(`npopup ${cls}`, props)}
        ref={npopup}
        onMouseLeave={props.onMouseLeftPopup}
      >
        <div
          className="npopupTX cs-Program"
          onClick={props.onPopupClick}
          onMouseDown={handler}
          onMouseMove={handler}
          onMouseUp={handler}
          onMouseLeave={props.onMouseLeftPopup}
          style={boxlocation}
        >
          <div className="popupheader">
            {!isWindow && <div className="towindow" />}
            {elemhtml.length > 1 && (
              <a className="popupBackLink">{i18next.t('back')}</a>
            )}
            {elemhtml.length === 1 && (
              <a className="popupCloseLink">{i18next.t('close')}</a>
            )}
            {!isWindow && <div className="draghandle" />}
          </div>

          {refbible &&
            (type === 'cr' || type === 'sr') &&
            this.selector(allBibleModules, refbible, refbible)}

          {type === 'sn' &&
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
                    `popup.selection.${feature}`
                  );
                  if (!selmod) {
                    [selmod] = fmods;
                    G.Prefs.setCharPref(`popup.selection.${feature}`, selmod);
                  }
                  return this.selector(fmods, selmod, undefined, feature);
                }
              }
              return null;
            })}

          <div className="popup-text" />
        </div>
      </div>
    );
  }
}
Popup.defaultProps = defaultProps;
Popup.propTypes = propTypes;
Popup.POPUPDELAY = 250;
Popup.POPUPDELAY_STRONGS = 600;

export default Popup;
