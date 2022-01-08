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
import {
  getContextModule,
  ofClass,
  sanitizeHTML,
  stringHash,
} from '../../common';
import G from '../rg';
import { getCompanionModules, getPopupInfo } from '../rutil';
import { getNoteHTML } from '../viewport/zversekey';
import { getDictEntryHTML, getLemmaHTML } from '../viewport/zdictionary';
import popupH from './popupH';
import '../global-htm.css';
import '../libsword.css';
import './popup.css';

const defaultProps = {
  ...xulDefaultProps,
  handler: undefined,
};

const propTypes = {
  ...xulPropTypes,
  showelem: PropTypes.oneOfType([PropTypes.object, PropTypes.string])
    .isRequired,
  handler: PropTypes.func,
};

export interface PopupProps extends XulProps {
  // showelem must be an HTMLElement for a normal popup. But
  // it must be a stringified HTMLElement for a windowed popup.
  showelem: HTMLElement | string;
  handler: (e: React.SyntheticEvent) => void | undefined;
}

export interface PopupState {
  history: string[];
  y: number[];
  dragging: boolean;
  drag: { x: number[]; y: number[] };
}

class Popup extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  static POPUPDELAY: number;

  static POPUPDELAY_STRONGS: number;

  npopup: React.RefObject<HTMLDivElement>;

  selectRef: { [i: string]: string }; // Remember selections while popup is open

  lemmaInfo: { snlist: string[]; entry: string; module: string } | undefined;

  handler: (e: React.MouseEvent) => void;

  constructor(props: PopupProps) {
    super(props);

    this.state = {
      history: [],
      y: [],
      dragging: false,
      drag: { x: [], y: [] },
    };

    this.npopup = React.createRef();
    this.selectRef = {};
    this.lemmaInfo = undefined;

    this.handler = popupH.bind(this);
    this.updateContent = this.updateContent.bind(this);
    this.setTitle = this.setTitle.bind(this);
    this.modSelect = this.modSelect.bind(this);
    this.checkPopupPosition = this.checkPopupPosition.bind(this);
    this.select = this.select.bind(this);
    this.selectFeature = this.selectFeature.bind(this);
    this.referenceBible = this.referenceBible.bind(this);
  }

  componentDidMount() {
    this.componentDidUpdate();
  }

  componentDidUpdate() {
    const { showelem } = this.props as PopupProps;
    const isWindow = typeof showelem === 'string';
    if (isWindow) this.setTitle();
    else this.checkPopupPosition();
    this.updateContent();
  }

  setTitle() {
    const { npopup } = this;
    const { showelem } = this.props as PopupProps;
    const popup = npopup?.current;
    if (!showelem && popup) {
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

  // if popup is overflowing the bottom of the window, then move it up
  checkPopupPosition() {
    const { npopup } = this;
    const { showelem } = this.props as PopupProps;
    const popup = npopup?.current;
    const isWindow = typeof showelem === 'string';
    if (!isWindow && showelem && popup) {
      const rls = popup.getElementsByClassName('npopupRL');
      const boxs = popup.getElementsByClassName('npopupBOX');
      if (rls && boxs) {
        const rl = rls[0] as HTMLElement;
        const box = boxs[0] as HTMLElement;
        const margin = 30; // allow margin between bottom of window

        let pupRLtop = Number(
          window.getComputedStyle(rl).top.replace('px', '')
        );
        let pupBOXtop = Number(
          window.getComputedStyle(box).top.replace('px', '')
        );
        if (Number.isNaN(Number(pupRLtop))) pupRLtop = 0;
        if (Number.isNaN(Number(pupBOXtop))) pupBOXtop = 0;

        const parentY = showelem.getBoundingClientRect().y;

        const pupbot = parentY + pupRLtop + pupBOXtop + box.offsetHeight;

        if (pupbot > window.innerHeight) {
          pupBOXtop =
            window.innerHeight - parentY - pupRLtop - box.offsetHeight;
          box.style.top = `${Number(pupBOXtop - margin)}px`;
        }
      }
    }
  }

  updateContent() {
    const { npopup } = this;
    const props = this.props as PopupProps;
    const state = this.state as PopupState;
    const { history } = state;
    const { showelem } = props;
    const tx = npopup?.current?.firstChild?.firstChild?.firstChild as any;
    if (!tx || !npopup.current) return;
    const thiselem = history.length ? history[history.length - 1] : showelem;
    let elem: HTMLElement;
    if (typeof thiselem === 'string') {
      const div = document.createElement('div');
      div.innerHTML = thiselem;
      elem = div.firstChild as HTMLElement;
    } else elem = thiselem;
    const info = getPopupInfo(elem);
    if (!info) return;
    if (tx.lastChild?.dataset.info === stringHash(info)) return;
    const { type, title, reflist, bk, ch, mod } = info;

    const referenceBible = mod ? this.referenceBible(mod) : null;
    const atxt = ofClass(['atext'], elem);
    const n = atxt ? Number(atxt.element.dataset.wnum) : null;

    let html = '';
    switch (type) {
      case 'cr':
      case 'fn':
      case 'un': {
        if (mod && referenceBible) {
          if (n !== null) {
            // must read the entire chapter text before any notes can be read
            G.LibSword.getChapterText(mod, `${bk} ${ch}`);
            const rawnotes = G.LibSword.getNotes();
            if (rawnotes) {
              // TODO! Improve this note search method
              const noteContainer = document.createElement('div');
              sanitizeHTML(noteContainer, rawnotes);
              let myNote = null as HTMLElement | null;
              const notes = noteContainer.getElementsByClassName('nlist');
              Array.from(notes).forEach((nt) => {
                const note = nt as HTMLElement;
                if (!myNote && note?.title === `${type}.${title}`) {
                  myNote = note;
                }
              });
              if (myNote) {
                html = getNoteHTML(
                  myNote,
                  referenceBible,
                  G.Prefs.getComplexValue('xulsword.show'),
                  true,
                  1,
                  false
                );
                html += `<div class="popup-noteAddress is_${type}">${myNote.outerHTML}</div>`;
              }
            }
          }
        }
        break;
      }

      case 'sr': {
        if (mod && referenceBible) {
          let mynote;
          if (!reflist || reflist[0] === 'unavailable') {
            let entry = elem.innerHTML;
            // elem may have npopup as an appended child. So we need to
            // remove it to get the note.
            let i = entry.indexOf('class="npopup ');
            if (i !== -1) {
              i = entry.lastIndexOf('<', i);
              entry = entry.substring(0, i);
            }
          } else mynote = reflist.join(';');
          const myNote = `<div class="nlist" title="cr.1.0.0.0.${referenceBible}">${mynote}</div>`;

          html = getNoteHTML(
            myNote,
            referenceBible,
            G.Prefs.getComplexValue('xulsword.show'),
            true,
            1,
            true
          );
          html += `<div class="popup-noteAddress is_${type}">${myNote}</div>`;
        }
        break;
      }

      case 'dtl':
      case 'dt': {
        if (reflist) {
          const dnames = [];
          let dword = '';
          for (let i = 0; i < reflist.length; i += 1) {
            if (reflist[i]) {
              const colon = reflist[i].indexOf(':');
              if (colon !== -1) dnames.push(reflist[i].substring(0, colon));
              if (!dword) dword = reflist[i].substring(colon + 1);
            }
          }
          html = getDictEntryHTML(dword, dnames.join(';'));
        }
        break;
      }

      case 'sn': {
        const module = elem.dataset.contextModule || getContextModule(elem);
        if (module) {
          const snlist = Array.from(elem.classList);
          if (snlist && snlist.length > 1) {
            snlist.shift();
            let entry = elem.innerHTML;
            // elem may have npopup as an appended child. So we need to remove it to get note.
            let i = entry.indexOf('class="npopup"');
            if (i !== -1) {
              i = entry.lastIndexOf('<', i);
              entry = entry.substring(0, i);
            }
            this.lemmaInfo = { snlist, entry, module };
            html = getLemmaHTML(snlist, entry, module);
          }
        }
        break;
      }

      case 'introlink': {
        if (n) {
          const atext = document.getElementsByClassName(`text${n}`);
          const intros = atext
            ? atext[0].getElementsByClassName('introtext')
            : null;
          if (intros) {
            Array.from(intros).forEach((elx) => {
              const el = elx as HTMLElement;
              if (el.title === elem.title) html = el.innerHTML;
            });
          }
        }
        break;
      }

      case 'noticelink': {
        if (n) {
          const atext = document.getElementsByClassName(`text${n}`);
          const noticelink = atext
            ? atext[0].getElementsByClassName('noticetext')
            : null;
          if (noticelink) html = noticelink[0].innerHTML;
        }
        break;
      }

      default:
        throw Error(`Unhandled popup type '${type}'.`);
    }

    Array.from(tx.getElementsByClassName('popup-text')).forEach((el: any) =>
      el.remove()
    );
    const cont = document.createElement('div');
    cont.classList.add('popup-text');
    cont.dataset.info = stringHash(info);
    sanitizeHTML(cont, html);
    tx.appendChild(cont);
    if (html) npopup.current.classList.remove('empty');
    else npopup.current.classList.add('empty');
  }

  modSelect(
    mods: string[],
    selected: string | null,
    module: string,
    feature: string
  ) {
    const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (module) this.select(e, module);
      else this.selectFeature(e, feature);
    };

    return (
      <select
        className="popup-mod-select"
        value={selected || undefined}
        data-module={module}
        data-feature={feature}
        onChange={onChange}
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

  select(e: React.ChangeEvent<HTMLSelectElement>, msrc: string) {
    const target = e.target as HTMLSelectElement;
    const { npopup } = this;
    const popup = npopup?.current;
    const mod = target.value;
    this.selectRef[msrc] = mod;
    if (popup) {
      const pts = popup.getElementsByClassName('popup-text');
      if (!pts) return false;
      const pt = pts[0] as HTMLElement;
      const ns = pt.getElementsByClassName('popup-noteAddress');
      if (!ns) return false;
      const n = ns[0];
      let h = getNoteHTML(
        n.innerHTML,
        mod,
        G.Prefs.getComplexValue('xulsword.show'),
        true,
        1,
        /(^|\s+)is_sr(\s+|$)/.test(n.className)
      );
      h += `<div class="${n.className}" style="display:none;">${n.innerHTML}</div>`;
      sanitizeHTML(pt, h);
      this.setTitle();
      return true;
    }
    return false;
  }

  selectFeature(e: React.ChangeEvent<HTMLSelectElement>, feature: string) {
    const target = e.target as HTMLSelectElement;
    const { npopup } = this;
    const popup = npopup?.current;
    const mod = target.value;
    if (popup) {
      const pts = popup.getElementsByClassName('popup-text');
      if (!pts) return;
      const pt = pts[0] as HTMLElement;
      G.Prefs.setCharPref(`popup.selection.${feature}`, mod);
      if (this.lemmaInfo) {
        sanitizeHTML(
          pt,
          getLemmaHTML(
            this.lemmaInfo.snlist,
            this.lemmaInfo.entry,
            this.lemmaInfo.module
          )
        );
      }
      this.setTitle();
    }
  }

  referenceBible(mod: string) {
    // Dictionary modules may have a "Companion" conf entry
    let referenceBible;
    if (mod && mod in this.selectRef) {
      referenceBible = this.selectRef[mod];
    } else {
      referenceBible = mod;
      if (
        referenceBible &&
        referenceBible in G.Tab &&
        G.Tab[referenceBible].type === C.DICTIONARY
      ) {
        const aref = getCompanionModules(referenceBible);
        if (aref.length && aref[0] in G.Tab) [referenceBible] = aref;
      }
    }
    return referenceBible;
  }

  render() {
    const props = this.props as PopupProps;
    const state = this.state as PopupState;
    const { handler, npopup } = this;
    const { dragging, drag, history, y } = state;
    const { showelem } = props;

    const thiselem = history.length ? history[history.length - 1] : showelem;
    let elem: HTMLElement;
    if (typeof thiselem === 'string') {
      const div = document.createElement('div');
      div.innerHTML = thiselem;
      elem = div.firstChild as HTMLElement;
    } else elem = thiselem;
    const y2 = y.length ? y[y.length - 1] : 0;
    const info = getPopupInfo(elem);
    if (!info) return null;
    const { type, mod } = info;

    const bmods = [];
    for (let t = 0; t < G.Tabs.length; t += 1) {
      if (G.Tabs[t].type === C.BIBLE) bmods.push(G.Tabs[t].module);
    }

    const textFeature: { [key in keyof FeatureType]?: RegExp } = {
      hebrewDef: /S_H/,
      greekDef: /S_G/,
      greekParse: /SM_G/,
    };

    let boxlocation;
    if (typeof showelem !== 'string') {
      const maxHeight = window.innerHeight / 2;
      const leftd = drag ? drag.x[1] - drag.x[0] : 0;
      const left = window.shell.process.argv()[0] === 'search' ? leftd : 'auto';
      let top = drag ? drag.y[1] - drag.y[0] : 0;
      if (history.length > 1) {
        const y1 = showelem.getBoundingClientRect().y;
        top += y1 - y2;
      }
      top -= 20;
      boxlocation = {
        top: `${top}px`,
        left: `${left}px`,
        maxHeight: `${maxHeight}px`,
      };
    }

    let cls = `userFontSize cs-program`;
    if (typeof showelem === 'string') cls += ` ownWindow`;

    return (
      <div
        className={`npopup ${cls}`}
        ref={npopup}
        onMouseLeave={props.handler}
      >
        <div className="npopupRL">
          <div className="npopupBOX" style={boxlocation}>
            <div
              className="npopupTX cs-Program"
              onClick={handler}
              onMouseDown={handler}
              onMouseMove={handler}
              onMouseUp={handler}
              style={{ cursor: dragging ? 'move' : 'default' }}
            >
              <div className="popupheader">
                {showelem && <div className="towindow" />}
                {history.length > 0 && (
                  <a className="popupBackLink">{i18next.t('back')}</a>
                )}
                {!history.length && (
                  <a className="popupCloseLink">{i18next.t('close')}</a>
                )}
                {showelem && <div className="draghandle" />}
              </div>

              {mod &&
                (type === 'cr' || type === 'sr') &&
                this.modSelect(bmods, this.referenceBible(mod), mod, '')}

              {type === 'sn' &&
                showelem &&
                Object.entries(textFeature).forEach((entry) => {
                  const feature = entry[0] as
                    | 'hebrewDef'
                    | 'greekDef'
                    | 'greekParse';
                  const regex = entry[1];
                  if (regex.test(elem.className)) {
                    this.modSelect(
                      G.FeatureModules[feature],
                      G.Prefs.getCharPref(`popup.selection.${feature}`),
                      '',
                      feature
                    );
                  }
                })}
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
