/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import C from '../../constant';
import { compareObjects, ofClass } from '../../common';
import {
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  xulClass,
} from '../libxul/xul';
import { Vbox, Hbox, Box } from '../libxul/boxes';
import G from '../rg';
import '../libxul/xul.css';
import './atext.css';

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
  modkey: PropTypes.string.isRequired,
  flagHilight: PropTypes.number.isRequired,
  flagScroll: PropTypes.number.isRequired,
  isPinned: PropTypes.bool.isRequired,
  noteBoxHeight: PropTypes.number.isRequired,
  maximizeNoteBox: PropTypes.number.isRequired,
  ownWindow: PropTypes.bool,
};

// Atext's own properties. NOTE: property types are checked, but property values are not.
const AtextOwnProps = {
  handler: (e: any, noteBoxResizing?: number[], maximize?: boolean) => {},
  anid: '',
  n: 0,
  columns: 0,
  book: '',
  chapter: 0,
  verse: 0,
  lastverse: 0,
  module: '' as string | undefined,
  ilModule: '' as string | undefined,
  modkey: '',
  flagHilight: 0,
  flagScroll: 0,
  isPinned: false,
  noteBoxHeight: 0,
  maximizeNoteBox: 0,
  ownWindow: false,
};

// These props can be 'pinned' to become independant state properties.
// NOTE: property types are checked, but property values are not.
const PinProps = {
  book: '',
  chapter: 0,
  verse: 0,
  lastverse: 0,
  module: '',
  ilModule: '',
  modkey: '',
};

// These props may change the content. If these props have all the same
// values as the previous rendering, the content will also be the same.
// NOTE: property types are checked, but property values are not.
const ContentProps = {
  book: '',
  chapter: 0,
  verse: 0,
  lastverse: 0,
  module: '',
  ilModule: '',
  modkey: '',
  ownWindow: false,
};

type AtextProps = XulProps & typeof AtextOwnProps;

type Content = {
  heading: string;
  text: string;
  notes: string;
};

interface AtextState {
  pin: typeof PinProps | null;
  noteBoxResizing: number[] | null;
  scrollDelta: number;
  footnotes: string;
  introFootnotes: string;
}

// XUL Atext
class Atext extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  static copyProps(template: any, source: any) {
    const p: any = {};
    Object.keys(template).forEach((k) => {
      p[k] = k in source ? source[k] : undefined;
    });
    return p;
  }

  lastRead: { props: typeof ContentProps | null; content: Content | null };

  savePin: typeof PinProps | null;

  constructor(props: AtextProps) {
    super(props);

    this.state = {
      pin: Atext.copyProps(PinProps, props),
      noteBoxResizing: null,
      // scrollDelta: 0,
      // footnotes: '',
      // introFootnotes: '',
    };

    this.lastRead = { props: null, content: null };

    this.savePin = null;

    this.getContent = this.getContent.bind(this);
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

  onUpdate() {
    if (!this.savePin) return;
    this.setState({ pin: this.savePin });
    this.savePin = null;
  }

  getContent(props: typeof ContentProps & typeof PinProps): Content {
    const { module } = this.props as AtextProps;
    return {
      heading: `<div style="color:green">Heading</div>`,
      text: `<div style="color:red">${props.toString()}</div>`,
      notes: `<div style="color:blue">Notes</div>`,
    };
    /*
    switch (G.Tab[module].tabType) {
      case C.BIBLE:
        return this.getBibleContent(props);
      case C.COMMENTARY:
        return this.getCommentaryContent(props);
      case C.DICTIONARY:
        return this.getDictionaryContent(props);
      case C.GENBOOK:
        return this.getGenBookContent(props);
      default:
        throw Error(`bad type ${G.Tab[module].tabType}`);
    } */
  }

  getBibleContent(props: typeof ContentProps & typeof PinProps): Content {
    const { columns } = this.props as AtextProps;
    const prev = {
      htmlText: '',
      htmlNotes: '',
      footnotes: '',
      introFootnotes: '',
    };
    const next = {
      htmlText: '',
      htmlNotes: '',
      footnotes: '',
      introFootnotes: '',
    };
    if (columns > 1) {
      // TODO! Read multiple chapters somehow
    }

    const bt = { htmlHead: '', htmlText: '', htmlNotes: '' }; // BibleTexts.read(this, props);

    return {
      heading: bt.htmlHead,
      text:
        prev.htmlText +
        (bt.htmlText.length > 64 ? bt.htmlText : '') +
        next.htmlText,
      notes: prev.htmlNotes + bt.htmlNotes + next.htmlNotes,
    };
  }

  getCommentaryContent(props: typeof ContentProps & typeof PinProps): Content {
    const { columns } = this.props as AtextProps;
    return {
      heading: '',
      text: '',
      notes: '',
    };
  }

  getDictionaryContent(props: typeof ContentProps & typeof PinProps): Content {
    const { columns } = this.props as AtextProps;
    return {
      heading: '',
      text: '',
      notes: '',
    };
  }

  getGenBookContent(props: typeof ContentProps & typeof PinProps): Content {
    const { columns } = this.props as AtextProps;
    return {
      heading: '',
      text: '',
      notes: '',
    };
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
    const { noteBoxResizing } = state;
    const {
      columns,
      isPinned,
      handler,
      maximizeNoteBox,
      module,
      n,
      noteBoxHeight,
    } = props;

    // Collect props/state combination used to render content.
    const pinSource = isPinned ? state.pin : props;
    const pin = Atext.copyProps(PinProps, pinSource);
    if (!compareObjects(pin, state.pin)) this.savePin = pin;
    const contentProps = Atext.copyProps(ContentProps, {
      ...props,
      ...pin,
    });

    // Only read from Libsword if the result will be different from the previous read.
    if (
      this.lastRead.content === null ||
      this.lastRead.props === null ||
      !Object.entries(contentProps).every((en) => {
        const name = en[0] as keyof typeof ContentProps;
        const val = en[1];
        return (
          this.lastRead.props !== null && val === this.lastRead.props[name]
        );
      })
    ) {
      this.lastRead.props = contentProps;
      this.lastRead.content = this.getContent(contentProps);
    }

    const doMaximizeNB =
      noteBoxResizing === null && columns !== 1 && maximizeNoteBox > 0;

    let cls = `text text${n} show${columns} userFontSize`;
    if (module) cls += ` ${G.Tab[module].tabType}`;
    if (module && G.Tab[module].isRTL) cls += ' rtl-text';
    if (isPinned) cls += ' pinned';
    if (doMaximizeNB) cls += ' noteboxMaximized';
    if (!this.lastRead.content.notes) cls += ' noteboxEmpty';

    let bbtop;
    if (noteBoxResizing !== null) {
      const [initial, current] = noteBoxResizing;
      bbtop = { top: `${current - initial}px` };
    }

    /*
    onClick={handler}
    onDoubleClick={handler}
    onMouseOver={handler}
    onMouseOut={handler}
    onMouseMove={handler}
    onMouseUp={handler}
    */

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
          {this.lastRead.content.heading}
        </Box>

        <Box className="sb" flex="1">
          {this.lastRead.content.text}
        </Box>

        <Vbox className="nbc" height={`${noteBoxHeight}px`}>
          <Hbox>
            <div className={`bb ${bbtop ? 'moving' : ''}`} style={bbtop} />
            <div className="notebox-maximizer" />
          </Hbox>
          <Box className="nb" flex="1">
            {this.lastRead.content.notes}
          </Box>
        </Vbox>
      </Vbox>
    );
  }
}
Atext.defaultProps = defaultProps;
Atext.propTypes = propTypes;

export default Atext;
