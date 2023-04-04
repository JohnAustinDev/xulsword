/* eslint-disable react/no-did-update-set-state */
/* eslint-disable no-nested-ternary */
/* eslint-disable react/forbid-prop-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { clone, diff, ofClass } from '../../common';
import C from '../../constant';
import G from '../rg';
import { getMaxChapter, getMaxVerse } from '../rutil';
import { addClass, xulDefaultProps, XulProps, xulPropTypes } from './xul';
import { Hbox } from './boxes';
import Label from './label';
import Spacer from './spacer';
import Menulist from './menulist';
import './selectVK.css';

import type {
  BookGroupType,
  LocationVKType,
  OSISBookType,
  V11nType,
} from '../../type';
import ModuleMenu from './modulemenu';

const defaultProps = {
  ...xulDefaultProps,
  options: {
    books: undefined,
    chapters: undefined,
    lastChapters: undefined,
    verses: undefined,
    lastverses: undefined,
    vkmods: undefined,
  },
  disabled: false,
  onSelection: undefined,
};

const propTypes = {
  ...xulPropTypes,
  initialVKM: PropTypes.shape({
    book: PropTypes.string,
    chapter: PropTypes.number,
    verse: PropTypes.number,
    lastchapter: PropTypes.number,
    lastverse: PropTypes.number,
    vkmod: PropTypes.string,
    v11n: PropTypes.string,
  }),
  selectVKM: PropTypes.shape({
    book: PropTypes.string,
    chapter: PropTypes.number,
    verse: PropTypes.number,
    lastchapter: PropTypes.number,
    lastverse: PropTypes.number,
    vkmod: PropTypes.string,
    v11n: PropTypes.string,
  }),
  options: PropTypes.shape({
    books: PropTypes.arrayOf(PropTypes.string),
    chapters: PropTypes.arrayOf(PropTypes.number),
    verses: PropTypes.arrayOf(PropTypes.number),
    lastchapters: PropTypes.arrayOf(PropTypes.number),
    lastverses: PropTypes.arrayOf(PropTypes.number),
    vkmods: PropTypes.arrayOf(PropTypes.string),
  }),
  disabled: PropTypes.bool,
  onSelection: PropTypes.func,
};

export type SelectVKMType = LocationVKType & {
  vkmod: string;
  lastchapter?: number;
  isBible?: boolean;
};

export const defaultVKM = {
  book: 'Gen' as OSISBookType,
  chapter: 1,
  vkmod: '',
  v11n: 'KJV' as V11nType,
};

// The VKSelect will either keep its own location state OR be a
// totally controlled component: If the 'initialVKM' prop is
// undefined, the component will be totally controlled by the
// selectVKM prop and will keep no state of its own. If the
// 'initialVKM' prop is defined, state will be kept internally,
// and any selection prop value will be ignored.

// If options are left undefined, valid lists will be automatically
// created. Otherwise only the listed options (that are valid) will
// be provided. If an option is [] then the corresponding selector
// will be hidden. If the vkmods option is [] its selector will be
// hidden and available selections will include entire verse system,
// otherwise the available selections will include only options
// within the selected vkmod.
export interface SelectVKProps extends XulProps {
  initialVKM: SelectVKMType | undefined;
  selectVKM: SelectVKMType | undefined;
  options: {
    books?: string[];
    chapters?: number[];
    lastchapters?: number[];
    verses?: number[];
    lastverses?: number[];
    vkmods?: string[];
  };
  disabled: boolean;
  onSelection: (selection: SelectVKMType, id: string) => void;
}

interface SelectVKState {
  selection: SelectVKMType | null;
}

export type SelectVKChangeEvents =
  | React.ChangeEvent<HTMLInputElement>
  | React.ChangeEvent<HTMLSelectElement>;

// React Bibleselect
class SelectVK extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  newselection: SelectVKMType | null;

  constructor(props: SelectVKProps) {
    super(props);

    const s: SelectVKState = {
      selection: props.initialVKM || null,
    };
    this.state = s;

    this.newselection = null;

    this.handleChange = this.handleChange.bind(this);
    this.getNumberOptions = this.getNumberOptions.bind(this);
  }

  componentDidUpdate(prevProps: SelectVKProps, prevState: SelectVKState) {
    const { selection: stateVKM } = prevState;
    const { initialVKM } = prevProps;
    const { newselection } = this;
    if (initialVKM !== undefined && newselection) {
      const d = diff(stateVKM, newselection);
      if (d) {
        const s: Partial<SelectVKState> = {
          selection: newselection,
        };
        this.setState(s);
      }
    }
  }

  // Get an updated selection based on last user input, and call onSelection.
  // If the component is keeping its own state, also update that state.
  handleChange(es: React.SyntheticEvent) {
    const state = this.state as SelectVKState;
    const props = this.props as SelectVKProps;
    const { selection: stateVKM } = state;
    const { initialVKM, selectVKM: propsVKM } = props;
    const e = es as SelectVKChangeEvents;
    const cls = ofClass(
      [
        'vk-vkmod',
        'vk-book',
        'vk-chapter',
        'vk-lastchapter',
        'vk-verse',
        'vk-lastverse',
      ],
      e.target
    );
    if (cls) {
      let s = initialVKM === undefined ? propsVKM : stateVKM;
      s = s ? clone(s) : defaultVKM;
      const { onSelection } = this.props as SelectVKProps;
      const { value } = e.target;
      const [, id] = cls.type.split('-');
      switch (id) {
        case 'vkmod': {
          s.vkmod = value;
          s.v11n = (value in G.Tab && G.Tab[value].v11n) || 'KJV';
          break;
        }
        case 'book': {
          if (initialVKM !== undefined) {
            s.chapter = 1;
            s.verse = 1;
            s.lastchapter = 1;
            s.lastverse = 1;
          }
          s.book = value as OSISBookType;
          break;
        }
        default: {
          s[id as 'chapter' | 'lastchapter' | 'verse' | 'lastverse'] =
            Number(value);
          if (initialVKM !== undefined) {
            let updateverse = false;
            if (id === 'chapter') {
              updateverse = true;
              if (!s.lastchapter || s.lastchapter < s.chapter)
                s.lastchapter = s.chapter;
            }
            if (updateverse) s.verse = 1;
            if (id === 'lastchapter') updateverse = true;
            if (updateverse) {
              s.lastverse = getMaxVerse(
                (s.vkmod in G.Tab && G.Tab[s.vkmod].v11n) || s.v11n || 'KJV',
                `${s.book}.${s.lastchapter}`
              );
            }
          }
        }
      }
      if (initialVKM !== undefined) {
        this.setState({ selection: s });
      }
      if (typeof onSelection === 'function') {
        onSelection(s, props.id || '');
      }
    }
  }

  getNumberOptions(
    selector: 'chapter' | 'verse' | 'lastchapter' | 'lastverse',
    selected: number | null | undefined,
    options: number[] | undefined,
    min: number,
    max: number
  ) {
    const props = this.props as SelectVKProps;
    const { initialVKM } = props;
    let oc = options;
    if (!oc) {
      oc = [];
      for (let x = min; x <= max; x += 1) {
        oc.push(x);
      }
    } else if (oc.length === 0) {
      return [];
    }
    const ocf = oc.filter((c) => c >= min && c <= max);
    let nsel = selected;
    if (initialVKM !== undefined) {
      if (nsel && ocf && !ocf.includes(nsel)) {
        [nsel] = ocf;
      }
    }
    if (nsel && this.newselection) this.newselection[selector] = nsel;
    if (nsel && !ocf.includes(nsel)) {
      ocf.push(nsel);
    }
    return ocf
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ));
  }

  render() {
    const props = this.props as SelectVKProps;
    const state = this.state as SelectVKState;

    // Use selectVKM prop if initialVKM is undefined, otherwise use stateVKM.
    const { selectVKM: propsVKM, initialVKM } = props;
    const { selection: stateVKM } = state;
    let selection = initialVKM === undefined ? propsVKM : stateVKM;
    if (!selection) selection = defaultVKM;

    this.newselection = {} as SelectVKMType;
    const { book, chapter, verse, lastverse, lastchapter, vkmod } = selection;
    const { options, disabled } = props;
    const { books, chapters, lastchapters, verses, lastverses, vkmods } =
      options;
    const { handleChange } = this;

    const tab = (vkmod && G.Tab[vkmod]) || null;
    const v11n = (tab && tab.v11n) || selection.v11n || 'KJV';

    // Get the appropriate options for each selector, adjusting selection
    // only if the component is keeping its own selection state and the
    // current selection is not an option.

    // Bible book options are either those passed in the books prop or are
    // all books in the verse system. When the module selector is visible
    // and an installed module is selected, books not present in the module
    // are removed from the list. All books are sorted in v11n order and
    // are unique.
    const bkbgs = (books ||
      G.BkChsInV11n[v11n].map((r) => r[0])) as OSISBookType[];
    const bookset: Set<OSISBookType> = new Set();
    bkbgs.forEach((bkbg: OSISBookType | BookGroupType) => {
      if (C.SupportedBookGroups.includes(bkbg as any)) {
        const bg = bkbg as BookGroupType;
        C.SupportedBooks[bg].forEach((b) => bookset.add(b));
      } else if (G.Book[bkbg]) {
        bookset.add(bkbg as OSISBookType);
      }
    });
    const filteredbooks =
      tab && vkmods?.length !== 0
        ? Array.from(bookset).filter((b) =>
            G.getBooksInModule(tab.module).includes(b)
          )
        : Array.from(bookset);
    let sel = book;
    if (initialVKM !== undefined) {
      if (sel && !filteredbooks.includes(sel)) {
        [sel] = filteredbooks;
      }
    }
    this.newselection.book = sel;
    if (sel && !filteredbooks.includes(sel)) {
      filteredbooks.push(sel);
    }
    const newbooks = filteredbooks
      .sort((a, b) => {
        const aa = G.Book[a];
        const bb = G.Book[b];
        if (!aa) return -1;
        if (!bb) return 1;
        return aa.index > bb.index ? 1 : aa.index < bb.index ? -1 : 0;
      })
      .map((b) => (
        <option key={G.Book[b].code} value={G.Book[b].code}>
          {G.Book[b].name}
        </option>
      ));

    const newchapters = this.getNumberOptions(
      'chapter',
      chapter,
      chapters,
      1,
      v11n && book ? getMaxChapter(v11n, book) : 0
    );

    const newverses = this.getNumberOptions(
      'verse',
      verse,
      verses,
      1,
      v11n ? getMaxVerse(v11n, `${book}.${chapter}`) : 0
    );

    const newlastchapters = this.getNumberOptions(
      'lastchapter',
      lastchapter,
      lastchapters,
      chapter || 1,
      v11n && book ? getMaxChapter(v11n, book) : 0
    );

    const newlastverses = this.getNumberOptions(
      'lastverse',
      lastverse,
      lastverses,
      (newlastchapters.length === 0 && verse) || 1,
      v11n
        ? getMaxVerse(
            v11n,
            `${book}.${newlastchapters.length === 0 ? chapter : lastchapter}`
          )
        : 0
    );

    // Bible module options are either those of the vkmods prop or all installed
    // Bible modules. If the books prop is controlling book options, modules not
    // containing the selected book are removed.
    const controlledBook = (books?.length || 0) > 0 && book;
    const thevkmods =
      vkmods || G.Tabs.filter((t) => t.type === C.BIBLE).map((t) => t.module);
    const newvkmods = thevkmods.filter(
      (m) => !controlledBook || G.getBooksInModule(m).includes(controlledBook)
    );
    let vksel = vkmod;
    if (initialVKM !== undefined) {
      if (!vksel || !newvkmods.includes(vksel)) {
        [vksel] = newvkmods;
      }
    }
    this.newselection.vkmod = vksel;
    this.newselection.v11n = v11n;

    const {
      book: b,
      chapter: c,
      verse: v,
      lastverse: lv,
      lastchapter: lc,
      vkmod: vm,
    } = this.newselection;

    return (
      <Hbox pack="start" align="center" {...addClass('selectvk', this.props)}>
        {newbooks.length > 0 && (
          <Menulist
            className="vk-book"
            value={b}
            options={newbooks}
            disabled={disabled}
            onChange={handleChange}
          />
        )}
        {newchapters.length > 0 && (
          <Menulist
            className="vk-chapter"
            value={(c || 1).toString()}
            options={newchapters}
            disabled={disabled}
            onChange={handleChange}
          />
        )}
        {newverses.length > 0 && (
          <>
            <Label className="colon" value=":" />
            <Menulist
              className="vk-verse"
              value={(v || 1).toString()}
              options={newverses}
              disabled={disabled}
              onChange={handleChange}
            />
          </>
        )}
        {((newverses.length > 0 && newlastverses.length > 0) ||
          (newchapters.length > 0 && newlastchapters.length > 0)) && (
          <Label className="dash" value="&#8211;" />
        )}
        {newlastchapters.length > 0 && (
          <Menulist
            className="vk-lastchapter"
            value={(lc || chapter || 1).toString()}
            options={newlastchapters}
            disabled={disabled}
            onChange={handleChange}
          />
        )}
        {newlastchapters.length > 0 && newlastverses.length > 0 && (
          <Label className="colon" value=":" />
        )}
        {newlastverses.length > 0 && (
          <Menulist
            className="vk-lastverse"
            value={(lv || verse || 1).toString()}
            options={newlastverses}
            disabled={disabled}
            onChange={handleChange}
          />
        )}
        <Spacer flex="1" />
        {newvkmods.length > 0 && (
          <ModuleMenu
            className="vk-vkmod"
            value={vm}
            modules={newvkmods}
            disabled={disabled}
            onChange={handleChange}
          />
        )}
      </Hbox>
    );
  }
}
SelectVK.defaultProps = defaultProps;
SelectVK.propTypes = propTypes;

export default SelectVK;
