import React from 'react';
import PropTypes from 'prop-types';
import { clone, diff, getModuleOfObject, ofClass } from '../../../common.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import verseKey from '../../verseKey.ts';
import { getMaxChapter, getMaxVerse } from '../../common.tsx';
import RenderPromise from '../../renderPromise.ts';
import { addClass, xulPropTypes } from './xul.tsx';
import { Hbox } from './boxes.tsx';
import ModuleMenu from './modulemenu.tsx';
import Label from './label.tsx';
import Spacer from './spacer.tsx';
import Menulist from './menulist.tsx';
import './selectVK.css';

import type {
  BookGroupType,
  LocationVKCommType,
  LocationVKType,
  OSISBookType,
} from '../../../type.ts';
import type {
  RenderPromiseComponent,
  RenderPromiseState,
} from '../../renderPromise.ts';
import type { XulProps } from './xul.tsx';

export type SelectVKType =
  | (LocationVKType & {
      lastchapter?: number;
    })
  | (LocationVKCommType & {
      lastchapter?: number;
    });

// The SelectVK maintains its own state starting at initialVK. So
// onSelection must be used to read component selection. The key
// prop may be used to reset state to initialVK at any time.
//
// If options are left undefined, valid lists will be automatically
// created. Otherwise only the listed options (that are valid) will
// be provided. If an option is [] then the corresponding selector
// will be hidden. If the vkMods option is [] its selector will be
// hidden and available selections will include entire verse system,
// otherwise the available selections will include only options
// within the selected vkMod.
//
// If initialVK or selectVK selects a module that is not installed,
// all selectors but the module selector will be disabled.
export type SelectVKProps = {
  initialVK: SelectVKType;
  options?: {
    books?: string[];
    chapters?: number[];
    lastchapters?: number[];
    verses?: number[];
    lastverses?: number[];
    vkMods?: string[] | 'Texts' | 'Comms';
  };
  language?: boolean;
  description?: boolean;
  disabled?: boolean;
  allowNotInstalled?: boolean;
  onSelection: (selection: SelectVKType | undefined, id?: string) => void;
} & XulProps;

const propTypes = {
  ...xulPropTypes,
  initialVK: PropTypes.shape({
    book: PropTypes.string,
    chapter: PropTypes.number,
    verse: PropTypes.number,
    lastchapter: PropTypes.number,
    lastverse: PropTypes.number,
    vkMod: PropTypes.string,
    v11n: PropTypes.string,
  }).isRequired,
  options: PropTypes.shape({
    books: PropTypes.arrayOf(PropTypes.string),
    chapters: PropTypes.arrayOf(PropTypes.number),
    verses: PropTypes.arrayOf(PropTypes.number),
    lastchapters: PropTypes.arrayOf(PropTypes.number),
    lastverses: PropTypes.arrayOf(PropTypes.number),
    vkMods: PropTypes.oneOfType([
      PropTypes.arrayOf(PropTypes.string),
      PropTypes.string,
    ]),
  }),
  language: PropTypes.bool,
  description: PropTypes.bool,
  disabled: PropTypes.bool,
  allowNotInstalled: PropTypes.bool,
  onSelection: PropTypes.func.isRequired,
};

type SelectVKState = RenderPromiseState & {
  selection: SelectVKType;
};

export type SelectVKChangeEvents =
  | React.ChangeEvent<HTMLInputElement>
  | React.ChangeEvent<HTMLSelectElement>;

// React VerseKey Select
class SelectVK extends React.Component implements RenderPromiseComponent {
  static propTypes: typeof propTypes;

  selectValues: SelectVKType;

  renderPromise: RenderPromise;

  loadingRef: React.RefObject<HTMLDivElement>;

  constructor(props: SelectVKProps) {
    super(props);

    const s: SelectVKState = {
      selection: props.initialVK,
      renderPromiseID: 0,
    };
    this.state = s;

    this.selectValues = props.initialVK;
    this.loadingRef = React.createRef();
    this.renderPromise = new RenderPromise(this, this.loadingRef);

    this.checkSelection = this.checkSelection.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.getNumberOptions = this.getNumberOptions.bind(this);
  }

  componentDidMount() {
    const { renderPromise, checkSelection } = this;
    if (!renderPromise.waiting()) checkSelection();
    renderPromise.dispatch();
  }

  componentDidUpdate(_prevProps: SelectVKProps, prevState: SelectVKState) {
    const { checkSelection, renderPromise } = this;
    if (!renderPromise.waiting()) checkSelection(prevState);
    renderPromise.dispatch();
  }

  // Record the updated selection caused by an input event by updating state and
  // calling onSelection.
  handleChange(es: React.SyntheticEvent) {
    const state = this.state as SelectVKState;
    const props = this.props as SelectVKProps;
    const { selection } = state;
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
      e.target,
    );
    if (cls) {
      const s: SelectVKType = clone(selection);
      const { onSelection } = this.props as SelectVKProps;
      const { value } = e.target;
      const [, id] = cls.type.split('-');
      switch (id) {
        case 'vkmod': {
          const isComm = value in G.Tab && G.Tab[value].tabType === 'Comms';
          if (isComm) {
            (s as LocationVKCommType).commMod = value;
            s.vkMod = undefined;
          } else {
            if ('commMod' in s) delete (s as any).commMod;
            s.vkMod = value;
          }
          s.v11n = (value in G.Tab && G.Tab[value].v11n) || 'KJV';
          break;
        }
        case 'book': {
          s.chapter = 1;
          s.verse = 1;
          s.lastchapter = 1;
          s.lastverse = 1;
          s.book = value as OSISBookType;
          break;
        }
        default: {
          s[id as 'chapter' | 'lastchapter' | 'verse' | 'lastverse'] =
            Number(value);
          if (id === 'chapter' || id === 'lastchapter') {
            s.verse = 1;
            s.lastverse = 1;
          }
        }
      }
      this.setState((prevState: SelectVKState) => {
        if (diff(prevState.selection, s)) {
          if (typeof onSelection === 'function') {
            onSelection(s, props.id);
          }
          return { selection: s } as SelectVKState;
        }
        return null;
      });
    }
  }

  // After a selectVK render caused by a handleChange() event, the resulting
  // select values are compared to the state values from before the render. They
  // will not be the same if the render resulted in an invalid selection that
  // was corrected. In such case, state must be updated and onSelection called,
  // with the resulting valid selection.
  checkSelection(prevState?: SelectVKState) {
    const props = this.props as SelectVKProps;
    const { id, onSelection } = props;
    const { selection } = prevState || {};
    const { selectValues } = this;
    if (!prevState || selectValues) {
      const d = diff(selection, selectValues);
      if (d) {
        const s: Partial<SelectVKState> = {
          selection: selectValues,
        };
        if (onSelection) onSelection(selectValues, id?.toString());
        this.setState(s);
      }
    }
  }

  getNumberOptions(
    selector: 'chapter' | 'verse' | 'lastchapter' | 'lastverse',
    selected: number | null | undefined,
    options: number[] | undefined,
    min: number,
    max: number,
  ) {
    const props = this.props as SelectVKProps;
    const { initialVK } = props;
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
    if (initialVK !== undefined) {
      if (nsel && ocf && !ocf.includes(nsel)) {
        [nsel] = ocf;
      }
    }
    if (nsel && this.selectValues) this.selectValues[selector] = nsel;
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
    const { handleChange, renderPromise, loadingRef } = this;
    let { selection } = state;
    const vkMod = getModuleOfObject(selection);
    // Selection must share the same v11n as vkMod.
    if (
      selection.v11n &&
      vkMod &&
      vkMod in G.Tab &&
      G.Tab[vkMod].v11n &&
      selection.v11n !== G.Tab[vkMod].v11n
    ) {
      selection = verseKey(selection, renderPromise).location(
        G.Tab[vkMod].v11n,
      );
      if (renderPromise.waiting()) return null;
    }
    this.selectValues = clone(selection);
    const { book, chapter, verse, lastverse, lastchapter } = selection;
    const { options, disabled, allowNotInstalled, language, description } =
      props;
    const { books, chapters, lastchapters, verses, lastverses, vkMods } =
      options || {};
    const Book = G.Book(G.i18n.language);

    const tab = (vkMod && G.Tab[vkMod]) || null;
    const v11n = (tab && tab.v11n) || selection.v11n || 'KJV';
    const isComm = tab && tab.tabType === 'Comms';
    let modules: string[];
    if (Array.isArray(vkMods)) {
      modules = vkMods.filter((m) => m && m in G.Tab && G.Tab[m].isVerseKey);
    } else if (vkMods === 'Texts' || vkMods === 'Comms') {
      modules = G.Tabs.filter((t) => t.tabType === vkMods).map((t) => t.module);
    } else {
      modules = G.Tabs.filter((t) => t.isVerseKey).map((t) => t.module);
    }

    // Arrive at the appropriate options for each selector, adjusting selection
    // to insure all selectors show valid options. Important: if a selector
    // is excluded (hidden by a [] prop) any value is considered valid for
    // that selector. Note: the books selector cannot be hidden.

    // Bible book options start as either those passed in the books prop or all
    // books in the verse system. Either way, when the module selector is
    // visible and an installed module is selected, books not present in the
    // module are removed from the list. All books are sorted in v11n order.
    // Similarly, when the books prop lists particular books, only modules
    // containing those books will be included in the module selector.
    const rp = GI.getBkChsInV11n([], renderPromise, v11n);
    const bkChsInV11n = renderPromise.waiting()
      ? G.Books().map((b) => b.code)
      : rp;
    const bkbgs = (books || bkChsInV11n?.map((r) => r[0])) as OSISBookType[];
    const bookset = new Set<OSISBookType>();
    bkbgs.forEach((bkbg: OSISBookType | BookGroupType) => {
      if (C.SupportedBookGroups.includes(bkbg as never)) {
        const bg = bkbg as BookGroupType;
        C.SupportedBooks[bg].forEach((b) => bookset.add(b));
      } else if (bkbg in Book && (Book as any)[bkbg]) {
        bookset.add(bkbg as OSISBookType);
      }
    });
    const filteredbooks =
      tab && modules?.length !== 0
        ? Array.from(bookset).filter((b) =>
            GI.getBooksInVKModule(
              G.Books().map((b) => b.code),
              renderPromise,
              tab.module,
            ).includes(b),
          )
        : Array.from(bookset);
    let sel = book;
    if (sel && !filteredbooks.includes(sel)) {
      [sel] = filteredbooks;
    }
    this.selectValues.book = sel;
    if (sel && !filteredbooks.includes(sel)) {
      filteredbooks.push(sel);
    }
    const newbooks = filteredbooks
      .sort((a, b) => {
        const aa = Book[a];
        const bb = Book[b];
        if (!aa) return -1;
        if (!bb) return 1;
        return aa.index > bb.index ? 1 : aa.index < bb.index ? -1 : 0;
      })
      .map((b) => (
        <option key={Book[b].code} value={Book[b].code}>
          {Book[b].name}
        </option>
      ));

    const newchapters = this.getNumberOptions(
      'chapter',
      chapter,
      chapters,
      1,
      v11n && book ? getMaxChapter(v11n, book, renderPromise) : 0,
    );

    const newlastchapters = this.getNumberOptions(
      'lastchapter',
      lastchapter,
      lastchapters,
      chapter || 1,
      v11n && book ? getMaxChapter(v11n, book, renderPromise) : 0,
    );

    const newverses = this.getNumberOptions(
      'verse',
      verse,
      verses,
      1,
      v11n ? getMaxVerse(v11n, `${book}.${chapter}`, renderPromise) : 0,
    );

    const newlastverses = this.getNumberOptions(
      'lastverse',
      lastverse,
      lastverses,
      (newlastchapters.length === 0 && verse) || 1,
      v11n
        ? getMaxVerse(
            v11n,
            `${book}.${newlastchapters.length === 0 ? chapter : lastchapter}`,
            renderPromise,
          )
        : 0,
    );

    // Module options are either those of the vkMods prop or all installed VerseKey
    // modules. If the books prop is controlling book options, modules not containing
    // the selected book are removed.
    if ((books?.length || 0) > 0) {
      modules = modules.filter((m) =>
        GI.getBooksInVKModule(
          G.Books().map((b) => b.code),
          renderPromise,
          m,
        ).includes(book),
      );
    }
    let vkSel = vkMod;
    if (!vkSel || !modules.includes(vkSel)) {
      [vkSel] = modules;
    }
    if (vkMod && isComm) {
      (this.selectValues as LocationVKCommType).commMod = vkMod;
      this.selectValues.vkMod = undefined;
    } else {
      delete (this.selectValues as any).commMod;
      this.selectValues.vkMod = vkMod || undefined;
    }
    this.selectValues.v11n = v11n;

    const {
      book: b,
      chapter: c,
      verse: v,
      lastverse: lv,
      lastchapter: lc,
    } = this.selectValues;
    const vkmod = getModuleOfObject(this.selectValues);
    const selectedModuleIsInstalled =
      allowNotInstalled || (vkmod && vkmod in G.Tab);

    return (
      <Hbox
        domref={loadingRef}
        pack="start"
        align="center"
        {...addClass('selectvk', this.props)}
      >
        {newbooks.length > 0 && (
          <Menulist
            className="vk-book"
            value={b}
            options={newbooks}
            disabled={disabled || !selectedModuleIsInstalled}
            onChange={handleChange}
          />
        )}
        {newchapters.length > 0 && (
          <Menulist
            className="vk-chapter"
            value={(c || 1).toString()}
            options={newchapters}
            disabled={disabled || !selectedModuleIsInstalled}
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
              disabled={disabled || !selectedModuleIsInstalled}
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
            disabled={disabled || !selectedModuleIsInstalled}
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
            disabled={disabled || !selectedModuleIsInstalled}
            onChange={handleChange}
          />
        )}
        <div className="mod-select">
          {modules.length > 0 && (
            <>
              <Spacer orient="horizontal" flex="1" />
              <ModuleMenu
                className="vk-vkmod"
                value={vkmod || modules[0]}
                modules={modules}
                language={language}
                description={description}
                disabled={disabled}
                allowNotInstalled={allowNotInstalled}
                onChange={handleChange}
              />
            </>
          )}
        </div>
      </Hbox>
    );
  }
}
SelectVK.propTypes = propTypes;

export default SelectVK;
