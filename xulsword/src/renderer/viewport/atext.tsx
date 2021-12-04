/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable react/no-did-update-set-state */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import {
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  xulClass,
} from '../libxul/xul';
import { Vbox, Hbox, Box } from '../libxul/boxes';
import G from '../rg';
import C from '../../constant';
import '../libxul/xul.css';
import './atext.css';
import { compareObjects } from '../../common';

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
  maximizeNoteBox: PropTypes.bool.isRequired,
  ownWindow: PropTypes.bool,
};

// Atext's own properties. NOTE: property types are checked, but property values are not.
const AtextOwnProps = {
  handler: (e: any, noteBoxResizing?: number[]) => {},
  anid: '',
  n: 0,
  columns: 0,
  book: '',
  chapter: 0,
  verse: 0,
  lastverse: 0,
  module: undefined,
  ilModule: undefined,
  modkey: '',
  flagHilight: 0,
  flagScroll: 0,
  isPinned: false,
  noteBoxHeight: 0,
  maximizeNoteBox: false,
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
  }

  componentDidMount() {
    if (!this.savePin) return;
    this.setState({ pin: this.savePin });
    this.savePin = null;
  }

  componentDidUpdate() {
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

  bbMouseDown(e: any) {
    e.stopPropagation();
    this.setState({ noteBoxResizing: [e.clientY, e.clientY] });
  }

  bbMouseMove(e: any) {
    e.stopPropagation();
    this.setState((prevState) => {
      const { noteBoxResizing } = prevState as AtextState;
      const { columns, noteBoxHeight } = this.props as AtextProps;
      if (noteBoxResizing === null) return {};
      const [initial] = noteBoxResizing;
      const height = noteBoxHeight + e.clientY - initial;
      if (height < 1) {
        this.bbMouseUp(e, [initial, initial - noteBoxHeight]);
        return {};
      }
      const maxHeight = 200; // TODO! Finish this...
      if (height > maxHeight) {
        if (columns !== 1) {
          this.bbMouseUp(e, [initial, initial]);
          const { handler } = this.props as AtextProps;
          e.type = 'click'; // handle as a maximize click
          handler(e);
        } else {
          this.bbMouseUp(e, [initial, initial - noteBoxHeight + maxHeight]);
        }
        return {};
      }
      return { noteBoxResizing: [initial, e.clientY] };
    });
  }

  bbMouseUp(e: any, nbr?: number[]) {
    e.stopPropagation();
    let { noteBoxResizing } = this.state as AtextState;
    if (nbr) noteBoxResizing = nbr;
    const { handler } = this.props as AtextProps;
    e.type = 'mouseup';
    if (noteBoxResizing !== null) handler(e, noteBoxResizing);
    this.setState({ noteBoxResizing: null });
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

    // Collect props/state combination to use to render content.
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
      noteBoxResizing === null && columns !== 1 && maximizeNoteBox;

    let cls = `text text${n} show${columns} userFontSize`;
    if (module) cls += ` ${G.Tab[module].tabType}`;
    if (module && G.Tab[module].isRTL) cls += ' rtl-text';
    if (isPinned) cls += ' pinned';
    if (doMaximizeNB) cls += ' noteboxMaximized';
    if (!this.lastRead.content.notes) cls += ' noteboxEmpty';

    const nbh = doMaximizeNB ? '100%' : `${noteBoxHeight}px`;
    let nbtop;
    if (noteBoxResizing !== null) {
      const [initial, current] = noteBoxResizing;
      nbtop = { top: `${current - initial}px` };
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
        onMouseMove={this.bbMouseMove}
      >
        <div
          className="sbcontrols"
          style={{ position: 'absolute', top: '0px' }}
        >
          <div className="sbpin" />
          <div className="sbwin" />
        </div>

        <Box className="hd" height="30px">
          {this.lastRead.content.heading}
        </Box>

        <Box className="sb" flex="1">
          {this.lastRead.content.text}
        </Box>

        <Vbox className="nbc" height={nbh}>
          <Hbox height="30px" width="100%">
            <div
              className={`bb ${noteBoxResizing !== null ? 'moving' : ''}`}
              onMouseDown={this.bbMouseDown}
              onMouseUp={this.bbMouseUp}
              style={nbtop}
              data-wnum={n}
            />
            <div className="nbsizer" onClick={handler} data-wnum={n} />
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
