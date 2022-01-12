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
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import { FeatureType } from '../../type';
import C from '../../constant';
import { deepClone, sanitizeHTML, stringHash } from '../../common';
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
  isWindow: false,
  elemY: undefined,
  onMouseLeftPopup: undefined,
};

const propTypes = {
  ...xulPropTypes,
  elemhtml: PropTypes.arrayOf(PropTypes.string).isRequired,
  eleminfo: PropTypes.arrayOf(PropTypes.object).isRequired,
  elemY: PropTypes.arrayOf(PropTypes.number),
  isWindow: PropTypes.bool,
  onPopupClick: PropTypes.func.isRequired,
  onSelectChange: PropTypes.func.isRequired,
  onMouseLeftPopup: PropTypes.func,
};

export interface PopupProps extends XulProps {
  elemhtml: string[]; // outerHTML of target elements
  eleminfo: TextInfo[]; // overwrite elemhtml info (ie for select options)
  elemY: number[] | undefined; // Screen y position of target elements
  isWindow: boolean; // Windowed mode or normal?
  onPopupClick: (e: React.SyntheticEvent) => void;
  onSelectChange: (e: React.SyntheticEvent) => void;
  onMouseLeftPopup: (e: React.SyntheticEvent) => void | undefined;
}

export interface PopupState {
  dragging: boolean;
  drag: { x: number[]; y: number[] };
  prevElemY: number[] | undefined;
}

// To show/hide a popup, either Popup should be rendered, or not.
// Popup shows information about particular types of elements (a
// list of verses for a cross-reference note, or information about
// a Strong's number for a Strong's link, etc.). The outerHTML
// string of the target element must be supplied on the elemhtml
// prop. Extra information associated with the target element may
// be provided using the eleminfo prop (and this info supercedes any
// TextInfo of the outerHTML). Both elemhtml and eleminfo props are
// arrays because a Popup may be updated to show information about
// other elements that appear within the popup, with a back link
// appearing when there are previous views to return to. To use
// Popup as a windowed popup, it should be rendered as a child of a
// visible parent element and isWindow should be true. To use as a
// regular popup, Popup should be rendered using a React portal to
// a target element in which it will appear (usually the same
// element as elemhtml[0] but this is not necessary), and isWindow
// should be false (the default).

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
      // eslint-disable-next-line react/no-unused-state
      dragging: false,
      drag: { x: [], y: [] },
      prevElemY: [],
    };

    this.npopup = React.createRef();

    this.handler = popupH.bind(this);
    this.updateContent = this.updateContent.bind(this);
    this.popupTop = this.popupTop.bind(this);
    this.element = this.element.bind(this);
    this.setTitle = this.setTitle.bind(this);
    this.selector = this.selector.bind(this);
    this.checkPopupPosition = this.checkPopupPosition.bind(this);
  }

  componentDidMount() {
    this.updateContent();
  }

  componentDidUpdate() {
    this.updateContent();
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
        `Popup elemhtml and eleminfo provided no info: '${elemHTML}'`
      );
    return { info, elem, elemHTML };
  }

  popupTop(type: string | null) {
    const { elemY: y } = this.props as PopupProps;
    const { drag } = this.state as PopupState;
    let top = y && y.length > 1 ? y[y.length - 1] - y[0] : 0;
    // gapInit is gap between mouse and top of popup when it first opens
    const gapInit = type === 'sn' ? 80 : 20;
    // gapMy is the current gap (which may be negative)
    const gapMy = y && y.length > 1 ? -40 : gapInit;
    top += gapMy;
    if (drag.y[0]) top += drag.y[1] - drag.y[0];
    return top;
  }

  // if popup is overflowing the bottom of the window, then drag it up
  checkPopupPosition(newstate: PopupState) {
    const { npopup } = this;
    const { isWindow, elemY } = this.props as PopupProps;
    const { drag, dragging } = this.state as PopupState;
    if (dragging) return;
    const popup = npopup?.current;
    if (!isWindow && popup && elemY) {
      const margin = 22;
      const boxs = popup.getElementsByClassName('npopupBOX');
      if (boxs) {
        const box = boxs[0] as HTMLElement;
        const boxbottom = box.getBoundingClientRect().bottom;
        const viewportHeight = window.innerHeight;
        if (boxbottom > viewportHeight - margin) {
          const dragup = Math.round(boxbottom + margin - viewportHeight);
          if (!drag.y[0]) {
            const handles = box.getElementsByClassName('draghandle');
            const handle = handles[0] as HTMLElement;
            const draghandleY = Math.round(handle.getBoundingClientRect().y);
            newstate.drag.y[0] = draghandleY;
            newstate.drag.y[1] = draghandleY;
          }
          newstate.drag.y[1] -= dragup;
        }
      }
    }
  }

  updateContent() {
    const { npopup } = this;
    const props = this.props as PopupProps;
    const state = this.state as PopupState;
    const { isWindow } = props;
    const pts = npopup?.current?.getElementsByClassName('popup-text');
    if (!npopup.current || !pts) throw Error(`Popup.updateContent no npopup.`);
    const pt = pts[0] as HTMLElement;
    const { info, elem } = this.element();
    const { type, reflist, bk, ch, mod, title } = info;

    const s = {} as PopupState;
    const pelemY = state.prevElemY;
    const telemY = props.elemY;
    if (pelemY && telemY && pelemY.length !== telemY.length) {
      const { drag } = state;
      if (drag.y.length)
        drag.y[0] += telemY[telemY.length - 1] - pelemY[pelemY.length - 1];
      s.drag = deepClone(drag);
      s.prevElemY = deepClone(telemY);
    }

    const infokey = stringHash(type, reflist, bk, ch, mod);
    if (!pt.dataset.infokey || pt.dataset.infokey !== infokey) {
      if (isWindow) this.setTitle();

      let html = '';
      switch (type) {
        case 'cr':
        case 'fn':
        case 'un': {
          if (mod && bk && ch && title) {
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

      this.checkPopupPosition(s);
    }
    if (Object.keys(s).length) this.setState(s);
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
        className="popup-mod-select"
        value={selected || undefined}
        data-module={module}
        data-feature={feature}
        onChange={props.onSelectChange}
      >
        {mods.map((mod) => (
          <option
            key={[mod, selected].join('.')}
            className={`cs-${G.Tab[mod].module}`}
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
    const { elemhtml, isWindow } = props;
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
      // Popup position is kept relative to the element in
      // which it was initially opened.
      const maxHeight = window.innerHeight / 2;
      const leftd = drag.x[0] ? drag.x[1] - drag.x[0] : 0;
      const left = window.shell.process.argv()[0] === 'search' ? leftd : 'auto';
      boxlocation = {
        top: `${this.popupTop(type)}px`,
        left: `${left}px`,
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
    if (isWindow) cls += ` ownWindow`;

    return (
      <div
        className={`npopup ${cls}`}
        ref={npopup}
        onMouseLeave={props.onMouseLeftPopup}
      >
        <div className="npopupRL">
          <div className="npopupBOX" style={boxlocation}>
            <div
              className="npopupTX cs-Program"
              onClick={props.onPopupClick}
              onMouseDown={handler}
              onMouseMove={handler}
              onMouseUp={handler}
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
                Object.entries(textFeature).forEach((entry) => {
                  const feature = entry[0] as
                    | 'hebrewDef'
                    | 'greekDef'
                    | 'greekParse';
                  const regex = entry[1];
                  if (regex.test(elem.className)) {
                    this.selector(
                      G.FeatureModules[feature],
                      G.Prefs.getCharPref(`popup.selection.${feature}`),
                      undefined,
                      feature
                    );
                  }
                })}

              <div className="popup-text" />
            </div>
          </div>
        </div>
      </div>
    );
  }
}
Popup.defaultProps = defaultProps;
Popup.propTypes = propTypes;
Popup.POPUPDELAY = 250;
Popup.POPUPDELAY_STRONGS = 1000;

export default Popup;
