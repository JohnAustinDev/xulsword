/* eslint-disable react/no-did-update-set-state */
/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/static-property-placement */
import React from 'react';
import {
  bookmarkTreeNodes,
  clone,
  findBookmarkItem,
  findParentOfBookmarkItem,
  randomID,
} from '../../common';
import C, { SPBM } from '../../constant';
import G from '../rg';
import renderToRoot from '../renderer';
import { windowArgument } from '../rutil';
import { getSampleText, newLabel } from '../bookmarks';
import Grid, { Column, Columns, Row, Rows } from '../libxul/grid';
import { Hbox, Vbox } from '../libxul/boxes';
import Label from '../libxul/label';
import Textbox from '../libxul/textbox';
import VKSelect, { SelectVKMType } from '../libxul/vkselect';
import GBSelect, { SelectGBMType } from '../libxul/genbookselect';
import Button from '../libxul/button';
import Spacer from '../libxul/spacer';
import TreeView from '../libxul/treeview';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import './bmProperties.css';

import type {
  BookmarkFolderType,
  BookmarkItem,
  BookmarkType,
  LocationGBType,
} from '../../type';

const Bookmarks = G.Prefs.getComplexValue(
  'manager.bookmarks',
  'bookmarks'
) as BookmarkFolderType;

const bmDefaults: {
  item: BookmarkItem;
  folder: Omit<BookmarkFolderType, keyof BookmarkItem>;
  bookmark: Omit<BookmarkType, keyof BookmarkItem>;
} = {
  item: {
    id: '',
    label: '',
    labelLocale: G.i18n.language,
    note: '',
    noteLocale: '',
    creationDate: Date.now(),
  },
  folder: {
    type: 'folder',
    childNodes: [],
  },
  bookmark: {
    type: 'bookmark',
    tabType: 'Texts',
    location: {
      vkmod: G.Tabs.find((t) => t.isVerseKey)?.module || '',
      book: 'Gen',
      chapter: 1,
      verse: 1,
      lastverse: 1,
      v11n: 'KJV',
    },
    sampleText: '',
  },
};

export type BMPropertiesState = {
  bookmark: BookmarkType | BookmarkFolderType;
  treeSelection: string;
  anyChildSelectable: boolean; // Set to allow bookmark selection, before which bm will be inserted
  hide: ('folder' | 'name' | 'location' | 'note' | 'text')[];
};

const defaultState: BMPropertiesState = {
  bookmark: {
    ...bmDefaults.item,
    ...bmDefaults.bookmark,
    ...bmDefaults.folder,
  },
  treeSelection: SPBM.manager.bookmarks.id,
  anyChildSelectable: true,
  hide: [],
};

// The window argument controls what appears in the bmProperties window and
// to some extent how it operates:
// STATE                  VALUE MEANING
// bookmark.id             ''  -create new bookmark (new id will be created)
// bookmark.id             str -id of bookmark item to which the window will apply.
// bookmark.location     undef -shows folder properties dialog (which has no vk or gb
//                              selector or sampleText)
// bookmark.location      null -shows verse-key properties dialog with default location.
// bookmark.location.v11n  str -shows verse-key properties dialog with the given location.
// bookmark.location.v11n  ''   show general-book properties dialog at given location.
// treeSelection           str -if editing an existing bookmark, this value is ignored.
//                              Otherwise it's the default folder (or bookmark loc-
//                              ation if anyChildSelectable is set) for the new item.
// hide                    []  -hide the input selector(s) with the given id(s)
const initialState = {
  ...defaultState,
  ...(windowArgument('bmPropertiesState') as Partial<BMPropertiesState> | null),
};

const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

type BMPropertiesProps = XulProps;

export default class BMPropertiesWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  constructor(props: BMPropertiesProps) {
    super(props);

    const state: BMPropertiesState = clone(initialState);

    // Select bookmark item's parent folder or location
    if (state.bookmark) {
      const item = state.anyChildSelectable
        ? findBookmarkItem(Bookmarks, state.bookmark.id)
        : findParentOfBookmarkItem(Bookmarks, state.bookmark.id);
      if (item) state.treeSelection = item.id;
    }
    this.state = state;

    this.treeHandler = this.treeHandler.bind(this);
    this.vkHandler = this.vkHandler.bind(this);
    this.gbHandler = this.gbHandler.bind(this);
    this.handler = this.handler.bind(this);
  }

  componentDidMount() {
    const state = this.state as BMPropertiesState;
    const { bookmark, treeSelection } = clone(state);
    const { id, label } = bookmark;
    let updateState = false;
    // Null location means default location
    if ('location' in bookmark && bookmark.location === null) {
      updateState = true;
      bookmark.location = bmDefaults.bookmark.location;
    }
    // Empty id means create a new bookmark or folder.
    if (!id) {
      updateState = true;
      bookmark.id = randomID();
    }
    // Don't leave label empty.
    if (!label) {
      updateState = true;
      bookmark.label =
        'location' in bookmark
          ? newLabel(bookmark.location as LocationGBType | SelectVKMType)
          : G.i18n.t('menu.folder.add');
    }
    // Don't leave sample text of bookmark empty
    if ('location' in bookmark && bookmark.location) {
      const bm = bookmark as BookmarkType;
      const { sampleText } = bm;
      if (!sampleText) {
        updateState = true;
        bookmark.sampleText = getSampleText(bookmark.location);
      }
    }
    if (updateState) {
      this.setState({
        treeSelection: treeSelection || SPBM.manager.bookmarks.id,
        bookmark,
      });
    }
  }

  handler(ex: React.SyntheticEvent) {
    const { id: eid } = ex.currentTarget;
    switch (eid) {
      case 'note':
      case 'label': {
        const e = ex as React.ChangeEvent<HTMLTextAreaElement>;
        this.setState((prevState: BMPropertiesState) => {
          let { bookmark } = clone(prevState);
          bookmark = bookmark as BookmarkType;
          bookmark[eid] = e.target.value;
          if (eid === 'note') {
            bookmark.noteLocale = G.i18n.language;
          } else if (eid === 'label') {
            bookmark.labelLocale = G.i18n.language;
          }
          return { bookmark };
        });
        break;
      }
      case 'cancel': {
        G.Window.close();
        break;
      }
      case 'ok': {
        const state = this.state as BMPropertiesState;
        const { treeSelection, bookmark, anyChildSelectable } = state;
        const { id } = bookmark;
        if (!initialState.bookmark.id) {
          bookmark.creationDate = new Date().valueOf();
        }
        const bookmarks = G.Prefs.getComplexValue(
          'manager.bookmarks',
          'bookmarks'
        ) as BookmarkFolderType;
        // Delete original bookmark or folder:
        const oldFolder = findParentOfBookmarkItem(bookmarks, id);
        let oldIndex = -1;
        if (oldFolder) {
          oldIndex = oldFolder.childNodes.findIndex((c) => c.id === id);
        }
        if (oldFolder && oldIndex > -1) {
          oldFolder.childNodes.splice(oldIndex, 1);
        }
        // Find parent and index where new bookmark or folder will be placed:
        let newFolder = oldFolder;
        let newIndex = oldIndex > -1 ? oldIndex - 1 : -1;
        const selItem =
          findBookmarkItem(
            bookmarks,
            treeSelection || SPBM.manager.bookmarks.id
          ) || null;
        if (selItem?.type === 'bookmark') {
          newFolder = findParentOfBookmarkItem(bookmarks, selItem.id);
          if (newFolder) {
            newIndex = newFolder.childNodes.findIndex(
              (c) => c.id === selItem.id
            );
          }
        } else if (
          selItem?.type === 'folder' &&
          (anyChildSelectable || selItem.id !== oldFolder?.id)
        ) {
          newFolder = selItem;
          newIndex = -1;
        }
        if (!newFolder) {
          newFolder = bookmarks;
          newIndex = -1;
        }
        // Place the new bookmark or folder and save the updated bookmarks.
        newFolder.childNodes.splice(newIndex + 1, 0, bookmark);
        G.Prefs.setComplexValue('manager.bookmarks', bookmarks, 'bookmarks');
        G.Window.reset('component-reset', 'all');
        G.Window.close();
        break;
      }
      default:
        throw new Error(`Unhandled bmProperties id: ${eid}`);
    }
  }

  treeHandler(selection: (string | number)[]) {
    const ts = selection[0] || '';
    this.setState({ treeSelection: ts.toString() });
  }

  gbHandler(selection: SelectGBMType) {
    this.setState((prevState: BMPropertiesState) => {
      const { bookmark } = clone(prevState);
      const bm = bookmark as BookmarkType;
      bm.location = {
        module: selection.gbmod,
        key: [selection.parent, selection.children[0] || ''].join(C.GBKSEP),
        paragraph: undefined,
      };
      bm.label = newLabel(bm.location);
      bm.sampleText = getSampleText(bm.location);
      return { bookmark };
    });
  }

  vkHandler(selection: SelectVKMType) {
    this.setState((prevState: BMPropertiesState) => {
      const { bookmark } = clone(prevState);
      const bm = bookmark as BookmarkType;
      bm.location = selection;
      bm.label = newLabel(bm.location);
      bm.sampleText = getSampleText(bm.location);
      return { bookmark };
    });
  }

  render() {
    const state = this.state as BMPropertiesState;
    const { treeHandler, gbHandler, handler, vkHandler } = this;
    const { bookmark, hide, treeSelection, anyChildSelectable } = state;
    const { type, label, labelLocale, note, noteLocale } = bookmark;
    let location;
    let sampleText;
    if (type === 'bookmark') {
      const bm = bookmark as BookmarkType;
      ({ location, sampleText } = bm);
      if (location === null) location = bmDefaults.bookmark.location;
    }
    let module = '';
    if (location && 'v11n' in location) module = location.vkmod;
    else if (location) module = location.module;
    let selectGBM: SelectGBMType | undefined;
    if (location && !('v11n' in location)) {
      const { module: gbmod, key } = location;
      const ks = key.split(C.GBKSEP);
      const child = ks.pop();
      ks.push('');
      selectGBM = {
        gbmod,
        parent: ks.join(C.GBKSEP),
        children: child ? [child] : [],
      };
    }

    const childNodes = bookmarkTreeNodes(
      Bookmarks.childNodes,
      anyChildSelectable ? undefined : 'folder',
      treeSelection || undefined
    );

    return (
      <Vbox className="bmProperties">
        <Grid>
          <Columns>
            <Column width="min-content" />
            <Column width="min-content" />
          </Columns>
          <Rows>
            {!hide.includes('location') && location && 'v11n' in location && (
              <Row>
                <Label value={G.i18n.t('location.label')} />
                <VKSelect
                  initialVKM={location}
                  options={{ lastchapters: [] }}
                  onSelection={vkHandler}
                />
              </Row>
            )}
            {!hide.includes('location') && selectGBM && (
              <Row>
                <Label value={G.i18n.t('location.label')} />
                <GBSelect
                  initialGBM={selectGBM}
                  enableParentSelection
                  onSelection={gbHandler}
                />
              </Row>
            )}
            {!hide.includes('name') && (
              <Row>
                <Label value={G.i18n.t('name.label')} />
                <Textbox
                  id="label"
                  className={`cs-${labelLocale}`}
                  maxLength="128"
                  value={label}
                  onChange={handler}
                />
              </Row>
            )}
            {!hide.includes('note') && (
              <Row>
                <Label value={G.i18n.t('note.label')} />
                <Textbox
                  id="note"
                  className={`cs-${noteLocale}`}
                  multiline
                  maxLength="128"
                  value={note.replace(/^\s+(?=\S)/, '')}
                  onChange={handler}
                />
              </Row>
            )}
            {!hide.includes('text') && location && (
              <Row>
                <Textbox
                  id="sampleText"
                  className={`cs-${module}`}
                  multiline
                  readonly
                  maxLength="128"
                  value={sampleText}
                />
              </Row>
            )}
            {!hide.includes('folder') && childNodes.length > 0 && (
              <Row>
                <Label value={G.i18n.t('chooseFolder.label')} />
                <div className="treeview-container">
                  <TreeView
                    initialState={childNodes}
                    enableMultipleSelection={false}
                    onSelection={treeHandler}
                  />
                </div>
              </Row>
            )}
          </Rows>
        </Grid>
        <Hbox className="dialog-buttons" pack="end" align="end">
          <Spacer flex="10" />
          <Button id="cancel" flex="1" fill="x" onClick={handler}>
            {G.i18n.t('cancel.label')}
          </Button>
          <Button id="ok" flex="1" fill="x" onClick={handler}>
            {G.i18n.t('ok.label')}
          </Button>
        </Hbox>
      </Vbox>
    );
  }
}
BMPropertiesWin.defaultProps = defaultProps;
BMPropertiesWin.propTypes = propTypes;

renderToRoot(<BMPropertiesWin />, { resetOnResize: false });
