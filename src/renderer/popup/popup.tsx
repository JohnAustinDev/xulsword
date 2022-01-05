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
  delayHandler,
  xulDefaultProps,
  XulProps,
  xulPropTypes,
} from '../libxul/xul';
import { FeatureType } from '../../type';
import C from '../../constant';
import {
  getContextModule,
  getContextWindow,
  getElementInfo,
  ofClass,
  sanitizeHTML,
  stringHash,
} from '../../common';
import G from '../rg';
import { TextInfo } from '../../textclasses';
import { getCompanionModules } from '../rutil';
// eslint-disable-next-line import/no-cycle
import { getNoteHTML } from '../viewport/zversekey';
import { getDictEntryHTML, getLemmaHTML } from '../viewport/zdictionary';
import '../global-htm.css';
import '../libsword.css';

const POPUPDELAY = 250;
const POPUPDELAY_STRONGS = 1000;

function getPopupElementInfo(elem: HTMLElement): TextInfo {
  let info = getElementInfo(elem);
  if (!info) {
    const c = ofClass(['introlink', 'noticelink'], elem);
    const atext = ofClass(['atext'], elem);
    info = {
      type: c?.type || 'introlink',
      title: elem.title,
      reflist: [''],
      bk: '',
      ch: 0,
      vs: 0,
      lv: 0,
      mod: atext?.element.dataset.module,
      osisref: '',
      nid: 0,
      ntype: '',
    } as TextInfo;
  }
  return info;
}

const defaultProps = {
  ...xulDefaultProps,
  showelem: null,
};

const propTypes = {
  ...xulPropTypes,
  showelem: PropTypes.object,
};

interface PopupProps extends XulProps {
  // showelem is an HTMLElement for a normal popup, or a string
  // (stringified TextInfo) for use in a windowed popup.
  showelem: HTMLElement | string | null;
}

interface PopupState {
  history: (HTMLElement | string)[];
  drag: { x: number[]; y: number[] } | null;
}

class Popup extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  npopup: React.RefObject<HTMLDivElement>;

  npopupRL: React.RefObject<HTMLDivElement>;

  npopupBOX: React.RefObject<HTMLDivElement>;

  npopupTX: React.RefObject<HTMLDivElement>;

  delayHandlerTO: number | undefined;

  selectRef: { [i: string]: string };

  lemmaInfo: { snlist: string[]; entry: string; module: string } | undefined;

  constructor(props: PopupProps) {
    super(props);

    this.state = {
      history: [],
      drag: null,
    };

    this.npopup = React.createRef();
    this.npopupRL = React.createRef();
    this.npopupBOX = React.createRef();
    this.npopupTX = React.createRef();
    this.selectRef = {};
    this.lemmaInfo = undefined;

    this.setTitle = this.setTitle.bind(this);
    this.appendModSelect = this.appendModSelect.bind(this);
    this.checkPopupPosition = this.checkPopupPosition.bind(this);
    this.addSelectEventListener = this.addSelectEventListener.bind(this);
    this.select = this.select.bind(this);
    this.selectFeature = this.selectFeature.bind(this);
    this.towindow = this.towindow.bind(this);
  }

  // Update the popup contents.
  componentDidUpdate() {
    const { history } = this.state as PopupState;
    const { showelem } = this.props as PopupProps;
    const { npopup, npopupTX, npopupBOX } = this;
    if (!npopup?.current) return;
    if (!npopupTX?.current) return;
    if (!npopupBOX?.current) return;
    const popup = npopup.current;
    const popupTX = npopupTX.current;
    const popupBOX = npopupBOX.current;
    const isWindow =
      (!history.length && typeof showelem === 'string') ||
      (history.length && typeof history[0] === 'string');

    // If not showing, insure popup is closed and history has been reset.
    if (!showelem) {
      if (window.shell.process.argv()[0] === 'popup')
        window.ipc.renderer.send('window', 'close');
      else if (popup.parentNode) popup.remove();
      if (history.length) this.setState({ history: [] });
      return;
    }

    const info =
      typeof showelem === 'string'
        ? JSON.parse(showelem)
        : getPopupElementInfo(showelem);
    const { type, title, reflist, bk, ch, mod } = info;

    // If showing and popupBackLink was clicked, go back in history.
    if (type === 'popupBackLink') {
      if (history.length > 1) {
        history.pop();
        this.setState({ history });
      }
      return;
    }

    // If already showing this element, do nothing.
    const sh = history.length ? history[history.length - 1] : null;
    if (sh && sh === showelem) return;

    // Otherwise update the popup, make sure it is visible,
    // and add it to the history.
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

    // Get popup HTML content
    let html = '';
    switch (type) {
      case 'cr':
      case 'fn':
      case 'un': {
        if (mod && referenceBible) {
          const w =
            typeof showelem === 'string' ? 0 : getContextWindow(showelem);
          if (w !== null) {
            // must read the entire chapter text before any notes can be read
            G.LibSword.getChapterText(mod, `${bk} ${ch}`);
            const rawnotes = G.LibSword.getNotes();
            if (rawnotes) {
              // TODO! Improve this note search method
              const noteContainer = document.createElement('div');
              sanitizeHTML(noteContainer, rawnotes);
              let myNote = null as HTMLElement | null;
              const notes = noteContainer.getElementsByClassName('nlist');
              Array.from(notes).forEach((n) => {
                const note = n as HTMLElement;
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
        if (mod && referenceBible && typeof showelem !== 'string') {
          let entry = showelem.innerHTML;
          // elem may have npopup as an appended child. So we need to
          // remove it to get real innerHTML. Note: A RegExp does not
          // seem to be able to match innerHTML for some reason?.
          let i = entry.indexOf('id="npopup"');
          if (i !== -1) {
            i = entry.lastIndexOf('<', i);
            entry = entry.substring(0, i);
          }
          const myNote = `<div class="nlist" title="cr.1.0.0.0.${referenceBible}">${
            reflist && reflist[0] !== 'unavailable' ? reflist.join(';') : entry
          }</div>`;

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
        if (typeof showelem !== 'string') {
          const module = getContextModule(showelem);
          if (module) {
            const snlist = Array.from(showelem.classList);
            if (snlist && snlist.length > 1) {
              snlist.shift();
              let entry = showelem.innerHTML;
              // elem may have npopup as an appended child! So we need to remove it to get real innerHTML.
              // Note: A RegExp does not seem to be able to match innerHTML for some reason.
              let i = entry.indexOf('id="npopup"');
              if (i !== -1) {
                i = entry.lastIndexOf('<', i);
                entry = entry.substring(0, i);
              }
              this.lemmaInfo = { snlist, entry, module };
              html = getLemmaHTML(snlist, entry, module);
            }
          }
        }
        break;
      }

      case 'introlink': {
        if (typeof showelem !== 'string') {
          const w = getContextWindow(showelem);
          if (w) {
            const atext = document.getElementsByClassName(`text${w}`);
            const intros = atext
              ? atext[0].getElementsByClassName('introtext')
              : null;
            if (intros) {
              Array.from(intros).forEach((elx) => {
                const el = elx as HTMLElement;
                if (el.title === showelem.title) html = el.innerHTML;
              });
            }
          }
        }
        break;
      }

      case 'noticelink': {
        if (typeof showelem !== 'string') {
          const w = getContextWindow(showelem);
          if (w) {
            const atext = document.getElementsByClassName(`text${w}`);
            const noticelink = atext
              ? atext[0].getElementsByClassName('noticetext')
              : null;
            if (noticelink) html = noticelink[0].innerHTML;
          }
        }
        break;
      }

      default:
        console.log(`Unhandled popup type '${type}'.`);
    }
    popup.dataset.showing = stringHash(info);

    if (typeof showelem !== 'string')
      showelem.style.cursor = html ? 'default' : 'help';

    if (isWindow) this.setTitle();

    // Add popup links and classes etc.
    const popupheader = document.createElement('div');
    popupheader.className = 'popupheader cs-Program';
    if (!isWindow) {
      const towindow = popupheader.appendChild(document.createElement('div'));
      towindow.className = 'towindow';
    }
    const backlink = popupheader.appendChild(document.createElement('a'));
    backlink.className = history.length ? 'popupBackLink' : 'popupCloseLink';
    backlink.textContent = i18next.t(history.length ? 'back' : 'close');
    if (!isWindow) {
      const draghandle = popupheader.appendChild(document.createElement('div'));
      draghandle.className = 'draghandle';
    }
    popupTX.appendChild(popupheader);

    // Add select drop-down for cr and sr
    if (mod && (type === 'cr' || type === 'sr')) {
      const bmods = [];
      for (let t = 0; t < G.Tabs.length; t += 1) {
        if (G.Tabs[t].type === C.BIBLE) bmods.push(G.Tabs[t].module);
      }
      this.appendModSelect(popupheader, bmods, referenceBible, mod, '');
    }

    // Add select drop-down(s) for sn
    if (type === 'sn' && typeof showelem !== 'string') {
      const textFeature: { [key in keyof FeatureType]?: RegExp } = {
        hebrewDef: /S_H/,
        greekDef: /S_G/,
        greekParse: /SM_G/,
      };
      Object.entries(textFeature).forEach((entry) => {
        const feature = entry[0] as 'hebrewDef' | 'greekDef' | 'greekParse';
        const regex = entry[1];
        if (regex.test(showelem.className)) {
          this.appendModSelect(
            popupheader,
            G.FeatureModules[feature],
            G.Prefs.getCharPref(`popup.selection.${feature}`),
            '',
            feature
          );
        }
      });
    }

    // Add popup content
    const newcontent = document.createElement('div');
    newcontent.className = 'popup-text cs-Program';
    sanitizeHTML(newcontent, html);
    if (type) popup.setAttribute('puptype', type);
    popupTX.appendChild(newcontent);

    // Insure the popup is properly visible
    if (isWindow) {
      // Windowed popup...
      const cont = popup.parentNode as HTMLElement | null;
      if (cont) cont.scrollTop = 0;
    } else if (history.length) {
      // Already opened popup...
      popupBOX.scrollTop = 0;
      // adjust popup to insure it's under the current mouse position
      const se = showelem as HTMLElement; // guaranteed since isWindow === false
      const hz = history[0] as HTMLElement; // guaranteed since isWindow === false
      const { drag } = this.state as PopupState;
      const top0 = drag ? drag.y[1] - drag.y[0] : 0;
      const y0 = hz.getBoundingClientRect().y;
      const y1 = se.getBoundingClientRect().y;
      const top = top0 + y1 - y0 - 20;
      popupBOX.style.top = `${top}px`;
      this.checkPopupPosition();
    } else {
      // Open popup...
      const se = showelem as HTMLElement; // guaranteed since isWindow === false
      delayHandler(
        this,
        () => {
          se.insertBefore(popup, se.firstChild);
          this.checkPopupPosition();
        },
        type === 'sn' ? POPUPDELAY_STRONGS : POPUPDELAY
      )();
    }

    history.push(showelem);
    this.setState({ history });
  }

  handler(e: React.MouseEvent) {
    const { npopupTX } = this;
    const popupTX = npopupTX?.current;
    const target = e.target as HTMLElement;

    switch (e.type) {
      case 'mousedown':
        if (target.classList.contains('draghandle') || e.target === popupTX) {
          if (popupTX) popupTX.style.cursor = 'move';
          // the addition to e.clientY helps quick upward drags to not inadvertently leave the popup
          this.setState({
            drag: { x: [e.clientX, 0], y: [e.clientY + 40, 0] },
          });
          e.stopPropagation();
          e.preventDefault();
        }
        break;

      case 'mousemove': {
        const state = this.state as PopupState;
        if (!state.drag) return;
        this.setState((prevState: PopupState) => {
          const { drag } = prevState;
          if (!drag) return null;
          drag.x[1] = e.clientX;
          drag.y[1] = e.clientY;
          return { drag };
        });
        e.stopPropagation();
        e.preventDefault();
        break;
      }

      case 'mouseup':
        if (popupTX) popupTX.style.cursor = '';
        this.setState({ drag: null });
        break;
      default:
    }
  }

  setTitle() {
    const { npopupTX } = this;
    const { history } = this.state as PopupState;
    const { showelem } = this.props as PopupProps;
    const popupTX = npopupTX?.current;
    const isWindow =
      (!history.length && typeof showelem === 'string') ||
      (history.length && typeof history[0] === 'string');
    if (isWindow && popupTX) {
      let title = '';
      const pts = popupTX.getElementsByClassName('popup-text');
      if (pts?.length) {
        const pt = pts[pts.length - 1] as HTMLElement; // the pt we want is the last in the tree
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
    const { npopupRL, npopupBOX } = this;
    const { showelem } = this.props as PopupProps;
    const popupRL = npopupRL?.current;
    const popupBOX = npopupBOX?.current;
    if (showelem && typeof showelem !== 'string' && popupRL && popupBOX) {
      const margin = 30; // allow margin between bottom of window

      let pupRLtop = Number(
        window.getComputedStyle(popupRL).top.replace('px', '')
      );
      let pupBOXtop = Number(
        window.getComputedStyle(popupBOX).top.replace('px', '')
      );
      if (Number.isNaN(Number(pupRLtop))) pupRLtop = 0;
      if (Number.isNaN(Number(pupBOXtop))) pupBOXtop = 0;

      const parentY = showelem.getBoundingClientRect().y;

      const pupbot = parentY + pupRLtop + pupBOXtop + popupBOX.offsetHeight;

      if (pupbot > window.innerHeight) {
        pupBOXtop =
          window.innerHeight - parentY - pupRLtop - popupBOX.offsetHeight;
        popupBOX.style.top = `${Number(pupBOXtop - margin)}px`;
      }
    }
  }

  appendModSelect(
    parent: HTMLElement,
    mods: string[],
    selectMod: string | null,
    module: string,
    feature: string
  ) {
    const select = parent.appendChild(document.createElement('select'));
    select.className = 'popup-mod-select';
    select.setAttribute('data-module', module);
    select.setAttribute('data-feature', feature);
    this.addSelectEventListener(select);
    mods.forEach((mod) => {
      if (G.Tab[mod]) {
        const option = select.appendChild(document.createElement('option'));
        option.className = `cs-${G.Tab[mod].locName}`;
        option.setAttribute('value', mod);
        if (mod === selectMod) option.setAttribute('selected', 'selected');
        option.textContent = G.Tab[mod].label;
      }
    });
  }

  addSelectEventListener(selectelem: HTMLElement) {
    const { module, feature } = selectelem.dataset;
    if (module)
      selectelem.addEventListener('change', (e: Event) => {
        return this.select(e, module);
      });
    if (feature)
      selectelem.addEventListener('change', (e: Event) => {
        this.selectFeature(e, feature);
      });
  }

  select(e: Event, msrc: string) {
    const target = e.target as HTMLSelectElement;
    const { npopupTX } = this;
    const popupTX = npopupTX?.current;
    const mod = target.value;
    this.selectRef[msrc] = mod;
    if (popupTX) {
      const pts = popupTX.getElementsByClassName('popup-text');
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

  selectFeature(e: Event, feature: string) {
    const target = e.target as HTMLSelectElement;
    const { npopupTX } = this;
    const popupTX = npopupTX?.current;
    const mod = target.value;
    if (popupTX) {
      const pts = popupTX.getElementsByClassName('popup-text');
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

  towindow() {
    const { npopup } = this;
    const { showelem } = this.props as PopupProps;
    const popup = npopup?.current;
    if (popup && showelem && typeof showelem !== 'string') {
      const options = {
        title: 'popup',
        webPreferences: {
          additionalArguments: [JSON.stringify(getElementInfo(showelem))],
        },
        boundingClientRect: popup.getBoundingClientRect(),
      };
      G.openWindow('popup', options);
    }
  }

  render() {
    const { handler } = this;
    const { drag, history } = this.state as PopupState;
    const { showelem } = this.props as PopupProps;
    const { npopup, npopupRL, npopupBOX, npopupTX } = this;
    const isWindow =
      (!history.length && typeof showelem === 'string') ||
      (history.length && typeof history[0] === 'string');

    const top = drag ? drag.y[1] - drag.y[0] : 0;
    const leftd = drag ? drag.x[1] - drag.x[0] : 0;
    const left = window.shell.process.argv()[0] === 'search' ? leftd : 'auto';
    const maxHeight = window.innerHeight / 2;

    let cls = `popup userFontSize cs-program`;
    if (isWindow) cls += ` ownWindow`;

    return (
      <div id="npopup" ref={npopup} className={cls}>
        {/* used for relative positioning of popup */}
        <div id="npopupRL" ref={npopupRL}>
          {/* used for absolute positioning of popup box */}
          <div
            id="npopupBOX"
            ref={npopupBOX}
            style={{
              top: `${top}px`,
              left: `${left}px`,
              maxHeight: `${maxHeight}px`,
            }}
          >
            {/* used for popup text container */}
            <div
              id="npopupTX"
              ref={npopupTX}
              onMouseDown={handler}
              onMouseOver={handler}
              onMouseOut={handler}
            />
          </div>
        </div>
      </div>
    );
  }
}
Popup.defaultProps = defaultProps;
Popup.propTypes = propTypes;

export default Popup;
