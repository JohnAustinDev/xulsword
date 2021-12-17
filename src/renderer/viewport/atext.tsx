/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import i18next from 'i18next';
import {
  PlaceType,
  ShowType,
  SwordFilterType,
  SwordFilterValueType,
} from '../../type';
import C from '../../constant';
import G from '../rg';
import { compareObjects, dString, stringHash, ofClass } from '../../common';
import {
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  xulClass,
} from '../libxul/xul';
import { Vbox, Hbox, Box } from '../libxul/boxes';
import getNoteHTML, { getChapterHeading } from './tversekey';
import '../libxul/xul.css';
import './atext.css';
import './texts-htm.css';
import './text-htm.css';
import { getDictEntryHTML, getDictSortedKeyList } from './tdictionary';

const memoize = require('memoizee');

const defaultProps = {
  ...xulDefaultProps,
  anid: undefined,
  ownWindow: false,
};

const propTypes = {
  ...xulPropTypes,
  handler: PropTypes.func.isRequired,
  anid: PropTypes.string,
  n: PropTypes.number.isRequired,
  columns: PropTypes.number.isRequired,
  book: PropTypes.string.isRequired,
  chapter: PropTypes.number.isRequired,
  verse: PropTypes.number.isRequired,
  lastverse: PropTypes.number.isRequired,
  module: PropTypes.string,
  ilModule: PropTypes.string,
  ilModuleOption: PropTypes.arrayOf(PropTypes.string).isRequired,
  modkey: PropTypes.string.isRequired,
  flagHilight: PropTypes.number.isRequired,
  flagScroll: PropTypes.number.isRequired,
  isPinned: PropTypes.bool.isRequired,
  noteBoxHeight: PropTypes.number.isRequired,
  maximizeNoteBox: PropTypes.number.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  show: PropTypes.object.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  place: PropTypes.object.isRequired,
  ownWindow: PropTypes.bool,
};

// Atext's own properties. NOTE: property types are checked, but property values are not.
const atextProps = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handler: (_e: any, _noteBoxResizing?: number[], _maximize?: boolean) => {},
  anid: '',
  n: 0,
  columns: 0,
  book: '',
  chapter: 0,
  verse: 0,
  lastverse: 0,
  module: '' as string | undefined,
  ilModule: '' as string | undefined,
  ilModuleOption: [] as string[],
  modkey: '',
  flagHilight: 0,
  flagScroll: 0,
  isPinned: false,
  noteBoxHeight: 0,
  maximizeNoteBox: 0,
  show: {} as ShowType,
  place: {} as PlaceType,
  ownWindow: false,
};

type AtextProps = XulProps & typeof atextProps;

type LibSwordResponse = {
  textHTML: string;
  noteHTML: string;
  notes: string;
  intronotes: string;
};

interface AtextState {
  pin: typeof C.PinProps | null;
  noteBoxResizing: number[] | null;
}

// XUL Atext
class Atext extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  static cache: any;

  static libswordResponseMemoized: (
    props: typeof C.LibSwordProps,
    n: number
  ) => LibSwordResponse;

  static cacheReset() {
    Atext.cache = { keyList: [], keyHTML: [] };
  }

  static copyProps(source: any, which: any) {
    const p: any = {};
    Object.keys(which).forEach((k) => {
      p[k] = k in source ? source[k] : undefined;
    });
    return p;
  }

  static libswordResponse(
    props: typeof C.LibSwordProps,
    n: number
  ): LibSwordResponse {
    const { module, ilModule, book, chapter, modkey, place, show } = props;

    const r = {
      headHTML: '',
      textHTML: '',
      noteHTML: '',
      notes: '',
      intronotes: '',
    };

    if (!module) return r;

    const { type } = G.Tab[module];
    let moduleLocale = G.ModuleConfigs[props.module].AssociatedLocale;
    if (moduleLocale === C.NOTFOUND) moduleLocale = '';

    // Set SWORD filter options
    const options = {} as { [key in SwordFilterType]: SwordFilterValueType };
    Object.entries(C.SwordFilters).forEach((entry) => {
      const sword = entry[0] as SwordFilterType;
      let showi = show[entry[1]] ? 1 : 0;
      if (C.AlwaysOn[type].includes(sword)) showi = 1;
      options[sword] = C.SwordFilterValues[showi];
    });
    if (ilModule) {
      const [, on] = C.SwordFilterValues;
      options["Strong's Numbers"] = on;
      options['Morphological Tags'] = on;
    }
    G.LibSword.setGlobalOptions(options);

    // Read Libsword according to module type
    switch (type) {
      case C.BIBLE: {
        if (ilModule) {
          r.textHTML += G.LibSword.getChapterTextMulti(
            `${module},${ilModule}`,
            `${book}.${chapter}`
          ).replace(/interV2/gm, `cs-${ilModule}`);
        } else {
          r.textHTML += G.LibSword.getChapterText(module, `${book}.${chapter}`);
          r.notes += G.LibSword.getNotes();
        }
        break;
      }
      case C.COMMENTARY: {
        r.textHTML += G.LibSword.getChapterText(module, `${book}.${chapter}`);
        r.notes += G.LibSword.getNotes();
        break;
      }
      case C.DICTIONARY: {
        // For dictionaries, noteHTML is a key selector. Cache both
        // the keyList and the key selector for a big speedup.
        if (!Atext.cache.keyList || !(module in Atext.cache.keyList)) {
          let list = G.LibSword.getAllDictionaryKeys(module).split('<nx>');
          list.pop();
          const sort = G.LibSword.getModuleInformation(module, 'KeySort');
          if (sort !== C.NOTFOUND) {
            list = getDictSortedKeyList(list, `${sort}0123456789`);
          }
          Atext.cache.keyList[module] = list;
        }

        // Get the actual key.
        let key = modkey;
        if (!key) [key] = Atext.cache.keyList[module];
        if (key === 'DailyDevotionToday') {
          const today = new Date();
          const mo = today.getMonth() + 1;
          const dy = today.getDate();
          key = `${mo < 10 ? '0' : ''}${String(mo)}.${dy < 10 ? '0' : ''}${dy}`;
        }

        // Build and cache the selector list.
        if (!Atext.cache.keyHTML || !(module in Atext.cache.keyHTML)) {
          let html = '';
          Atext.cache.keyList[module].forEach((k1: any) => {
            const k2 = encodeURIComponent(k1);
            html += `<div class="key ${k2} title="${k2}">${k1}</div>`;
          });
          Atext.cache.keyHTML[module] = html;
        }

        // Return the results
        r.textHTML += `<div class="dictentry">${getDictEntryHTML(
          key,
          module,
          true
        )}</div>`;

        r.noteHTML += `<div class="dictlist">
            <div class="textboxparent"><input type="text" value="${key}" class="cs-${module} keytextbox"/ ></div>
            <div class="keylist">${Atext.cache.keyHTML[module]}</div>
          </div>`;
        break;
      }
      case C.GENBOOK: {
        r.textHTML += G.LibSword.getGenBookChapterText(module, modkey);
        break;
      }
      default:
    }

    // Add usernotes to text
    if (props.show.usernotes) Atext.addUserNotes(r, props);

    // handle footnotes.
    // NOTE: This step is by far the slowest part of Atext render,
    // particularly when crossrefs include many links.
    if (G.Tab[module].isVerseKey) {
      const notetypes: (keyof PlaceType)[] = [
        'footnotes',
        'crossrefs',
        'usernotes',
      ];
      const shownb: any = {};
      notetypes.forEach((nt) => {
        shownb[nt] = show[nt] && place[nt] === 'notebox';
      });
      if (
        Object.keys(shownb).some((s) => {
          return shownb[s];
        })
      )
        r.noteHTML += getNoteHTML(
          r.notes,
          props.module,
          shownb,
          false,
          n,
          false
        );
    }

    // Localize verse numbers to match the module
    if (
      G.Tab[module].isVerseKey &&
      moduleLocale &&
      dString(1, moduleLocale) !== dString(1, 'en')
    ) {
      const verseNm = new RegExp('(<sup class="versenum">)(\\d+)(</sup>)', 'g');
      r.textHTML = r.textHTML.replace(verseNm, (str, p1, p2, p3) => {
        return p1 + dString(p2, moduleLocale) + p3;
      });
    }

    // Add chapter heading and intronotes
    if (G.Tab[module].isVerseKey && show.headings && r.textHTML) {
      const headInfo = getChapterHeading(props);
      r.textHTML = headInfo.textHTML + r.textHTML;
      r.intronotes = headInfo.intronotes;
    }

    return r;
  }

  static addUserNotes(
    content: LibSwordResponse,
    props: typeof C.LibSwordProps
  ) {}

  sbref: React.RefObject<HTMLDivElement>;

  nbref: React.RefObject<HTMLDivElement>;

  constructor(props: AtextProps) {
    super(props);

    this.state = {
      pin: null,
      noteBoxResizing: null,
    };

    this.sbref = React.createRef();

    this.nbref = React.createRef();

    this.bbMouseDown = this.bbMouseDown.bind(this);
    this.bbMouseMove = this.bbMouseMove.bind(this);
    this.bbMouseUp = this.bbMouseUp.bind(this);
    this.bbMouseLeave = this.bbMouseLeave.bind(this);
    this.onUpdate = this.onUpdate.bind(this);
  }

  componentDidMount() {
    this.onUpdate();
  }

  componentDidUpdate() {
    this.onUpdate();
  }

  // Check if sb already contains the current LibSword response
  // and if not, memoize LibSword response and update sb. Also
  // update pin state whenever it changes. NOTE: the LibSword hash
  // must be stored on the sb HTML element itself, because the sb
  // element may be silently replaced by React and storing to it
  // there insures the hash is invalidated at that time.
  onUpdate() {
    const props = this.props as AtextProps;
    const { isPinned, n } = props;
    const { pin } = this.state as AtextState;
    const { sbref, nbref } = this;

    const newPin = Atext.copyProps(pin && isPinned ? pin : props, C.PinProps);
    if (!compareObjects(newPin, pin)) this.setState({ pin: newPin });

    const sbe = sbref !== null ? sbref.current : null;
    const nbe = nbref !== null ? nbref.current : null;
    if (sbe && nbe) {
      const newLibSword = Atext.copyProps(
        {
          ...props,
          ...newPin,
        },
        C.LibSwordProps
      );
      const key = stringHash(newLibSword, n);
      if (key !== sbe.dataset.libsword) {
        sbe.dataset.libsword = key;
        const response = Atext.libswordResponseMemoized(newLibSword, n);
        sbe.innerHTML = response.textHTML;
        nbe.innerHTML = response.noteHTML;
        const nbc = nbe.parentNode as any;
        if (!nbe.innerHTML && !nbc.classList.contains('noteboxEmpty'))
          nbc.classList.add('noteboxEmpty');
        if (nbe.innerHTML && nbc.classList.contains('noteboxEmpty'))
          nbc.classList.remove('noteboxEmpty');
      }
    }
  }

  // start dragging the notebox resizing bar?
  bbMouseDown(e: any) {
    e.stopPropagation();
    const { noteBoxResizing } = this.state as AtextState;
    const targ = ofClass('bb', e.target);
    if (targ !== null) {
      this.setState({ noteBoxResizing: [e.clientY, e.clientY] });
    } else if (noteBoxResizing !== null)
      this.setState({ noteBoxResizing: null });
  }

  // notebox resize bar dragging...
  bbMouseMove(e: any) {
    const { noteBoxResizing } = this.state as AtextState;
    const { handler, noteBoxHeight, maximizeNoteBox } = this
      .props as AtextProps;
    if (noteBoxResizing === null) return;

    const targ = ofClass('atext', e.target);
    if (targ === null) return;

    e.stopPropagation();
    e.preventDefault();

    if (maximizeNoteBox > 0) handler(e);

    const [initial] = noteBoxResizing;

    // moved above the top?
    const height = noteBoxHeight + initial - e.clientY;
    const stopHeight = targ.element.clientHeight - C.TextHeaderHeight;
    if (height >= stopHeight - C.TextBBTopMargin) {
      this.bbMouseUp(
        e,
        [initial, noteBoxHeight + initial - stopHeight + C.TextBBTopMargin + 5],
        true
      );
      return;
    }

    // moved below the bottom?
    if (height <= C.TextBBBottomMargin) {
      this.bbMouseUp(
        e,
        [initial, noteBoxHeight + initial - C.TextBBBottomMargin - 5],
        false
      );
      return;
    }

    // otherwise follow the mouse...
    this.setState({ noteBoxResizing: [initial, e.clientY] });
  }

  bbMouseLeave() {
    this.setState({ noteBoxResizing: null });
  }

  // stop notebox resizing?
  bbMouseUp(e: any, nbr?: number[], maximize?: boolean) {
    const { noteBoxResizing } = this.state as AtextState;
    const { handler } = this.props as AtextProps;
    if (noteBoxResizing === null) return;
    e.stopPropagation();
    const newnbr = nbr || noteBoxResizing;
    this.setState({ noteBoxResizing: null });
    e.type = 'mouseup';
    handler(e, newnbr, maximize);
  }

  render() {
    const state = this.state as AtextState;
    const props = this.props as AtextProps;
    const { noteBoxResizing, pin } = state;
    const {
      columns,
      isPinned,
      handler,
      maximizeNoteBox,
      module,
      n,
      noteBoxHeight,
    } = props;

    // Check isPinned and collect the props/state combination to render.
    const newPin = Atext.copyProps(pin && isPinned ? pin : props, C.PinProps);

    // Header logic etc.
    const textIsVerseKey = module && G.Tab[module].isVerseKey;
    const appIsRTL = G.ProgramConfig?.direction === 'rtl';
    const prevArrow = appIsRTL
      ? String.fromCharCode(8594)
      : String.fromCharCode(8592);
    const nextArrow = appIsRTL
      ? String.fromCharCode(8592)
      : String.fromCharCode(8594);
    const disablePrev = textIsVerseKey && newPin?.chapter < 2;
    const disableNext = false;

    // Notebox logic etc.
    const doMaximizeNB =
      noteBoxResizing === null && columns !== 1 && maximizeNoteBox > 0;
    let bbtop;
    if (noteBoxResizing !== null) {
      const [initial, current] = noteBoxResizing;
      bbtop = { top: `${current - initial}px` };
    }

    // Class list
    let cls = `text text${n} show${columns} userFontSize`;
    if (module) cls += ` ${G.Tab[module].tabType}`;
    if (module && G.Tab[module].isRTL) cls += ' rtl-text';
    if (appIsRTL) cls += ' chromedir-rtl';
    if (isPinned) cls += ' pinned';
    if (doMaximizeNB) cls += ' noteboxMaximized';

    return (
      <Vbox
        {...props}
        className={xulClass(`atext ${cls}`, props)}
        style={{ ...props.style, position: 'relative' }}
        data-wnum={n}
        onClick={handler}
        onMouseDown={this.bbMouseDown}
        onMouseMove={this.bbMouseMove}
        onMouseUp={this.bbMouseUp}
        onMouseLeave={this.bbMouseLeave}
      >
        <div
          className="sbcontrols"
          style={{ position: 'absolute', top: '0px' }}
        >
          <div className="text-pin" />
          <div className="text-win" />
        </div>

        <Box className="hd" height={`${C.TextHeaderHeight}px`}>
          <div className="navlink">
            <span className="navlink-span">{prevArrow}</span>
            <a className={`prevchaplink ${disablePrev ? 'disabled' : ''}`}>
              {i18next.t('PrevChaptext')}
            </a>{' '}
            <a className={`nextchaplink ${disableNext ? 'disabled' : ''}`}>
              {i18next.t('NextChaptext')}
            </a>{' '}
            <span className="navlink-span">{nextArrow}</span>
          </div>
        </Box>

        <Vbox
          className={`sb cs-${module}`}
          domref={this.sbref}
          pack="start"
          flex="1"
        />

        <Vbox className="nbc" height={`${noteBoxHeight}px`}>
          <Hbox>
            <div className={`bb ${bbtop ? 'moving' : ''}`} style={bbtop} />
            <div className="notebox-maximizer" />
          </Hbox>
          <Box className="nb" domref={this.nbref} flex="1" />
        </Vbox>
      </Vbox>
    );
  }
}
Atext.defaultProps = defaultProps;
Atext.propTypes = propTypes;
Atext.cacheReset();
Atext.libswordResponseMemoized = memoize(Atext.libswordResponse, {
  max: 20, // remember up to 20 LibSword responses
  normalizer: (...args: any) =>
    args.map((arg: any) => stringHash(arg)).join('+'),
});
window.ipc.renderer.on('reset', () => {
  const m = Atext.libswordResponseMemoized as any;
  m.clear();
  Atext.cacheReset();
});

export default Atext;
