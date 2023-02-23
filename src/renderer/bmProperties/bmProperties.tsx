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
  findParentOfBookmark,
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

const { childNodes: rootChildNodes } = G.Prefs.getComplexValue(
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
// treeSelection           str -move to or create item in selected folder,
//                              or before selected bookmark if anyChildSelectable
//                              is set.
// bookmark.id             ''  -create new bookmark (having a new id)
// bookmark.location     undef -show folder properties dialog (no vk or gb
//                              selector or sampleText)
// bookmark.location      null -show default verse-key properties dialog
// bookmark.location.v11n  str -show verse-key properties dialog
// bookmark.location.v11n  ''   show general-book properties dialog
// hide                    []  -hide the inputs with the given id(s)
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

    this.state = clone(initialState);

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
            bookmark.noteLocale = `cs-${G.i18n.language}`;
          } else if (eid === 'label') {
            bookmark.labelLocale = `cs-${G.i18n.language}`;
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
        const { treeSelection, bookmark } = state;
        const { creationDate, id, label, labelLocale, note, noteLocale, type } =
          bookmark;
        let newitem: BookmarkFolderType | BookmarkType | undefined;
        const item: BookmarkItem = {
          id,
          label,
          labelLocale,
          note,
          noteLocale,
          creationDate: initialState.bookmark.label
            ? creationDate
            : new Date().valueOf(),
        };
        if (type === 'folder') {
          const bm = bookmark as BookmarkFolderType;
          const { childNodes: children } = bm;
          newitem = {
            ...item,
            type: 'folder',
            childNodes: children,
          };
        } else if (type === 'bookmark') {
          const bm = bookmark as BookmarkType;
          const { location, sampleText } = bm;
          if (location) {
            if (type === 'bookmark' && 'v11n' in location) {
              newitem = {
                ...item,
                type: 'bookmark',
                tabType: G.Tab[(location as SelectVKMType).vkmod].tabType,
                location,
                sampleText,
              };
            } else if (type === 'bookmark') {
              newitem = {
                ...item,
                type: 'bookmark',
                tabType: G.Tab[(location as LocationGBType).module].tabType,
                location,
                sampleText,
              };
            }
          }
        }

        if (newitem) {
          const bookmarks = G.Prefs.getComplexValue(
            'manager.bookmarks',
            'bookmarks'
          ) as BookmarkFolderType;
          // Delete original bookmark or folder:
          const oldparent = findParentOfBookmark(bookmarks, id);
          const oldindex =
            (oldparent && oldparent.childNodes.findIndex((c) => c.id === id)) ||
            -1;
          if (oldparent && oldindex > -1) {
            oldparent.childNodes.splice(oldindex, 1);
          }
          // Find parent and index where new bookmark or folder will be placed:
          let newparent = oldparent;
          let newindex = oldindex;
          if (treeSelection) {
            const selItem = findBookmarkItem(bookmarks, treeSelection) || null;
            if (selItem && selItem.type === 'bookmark') {
              newparent = findParentOfBookmark(bookmarks, selItem.id);
              if (newparent) {
                newindex = newparent.childNodes.findIndex(
                  (c) => c.id === selItem.id
                );
              }
            } else if (selItem) {
              newparent = selItem;
              newindex = 0;
              if (newparent && oldparent && newparent.id === oldparent.id) {
                newindex = oldindex;
              }
            }
          }
          if (!newparent || newindex === -1) {
            newparent = findBookmarkItem(
              bookmarks,
              SPBM.manager.bookmarks.id
            ) as BookmarkFolderType;
            newindex = 0;
          }
          // Place the new bookmark or folder and save the updated bookmarks.
          newparent.childNodes.splice(newindex, 0, newitem);
          G.Prefs.setComplexValue('manager.bookmarks', bookmarks, 'bookmarks');
          G.Window.reset('all', 'all');
          G.Window.close();
        }
        break;
      }
      default:
        throw new Error(`Unhandled bmProperties id: ${eid}`);
    }
  }

  treeHandler(selection: (string | number)[]) {
    this.setState({ treeSelection: selection[0].toString() });
  }

  gbHandler(selection: SelectGBMType) {
    this.setState((prevState: BMPropertiesState) => {
      const { bookmark } = clone(prevState);
      const bm = bookmark as BookmarkType;
      bm.location = {
        module: selection.gbmod,
        key: [selection.parent, selection.children[0]].join(C.GBKSEP),
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
            {!hide.includes('location') &&
              location &&
              !('v11n' in location) && (
                <Row>
                  <Label value={G.i18n.t('location.label')} />
                  <GBSelect
                    initialGBM={location as LocationGBType}
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
                  value={note}
                  onChange={handler}
                />
              </Row>
            )}
            {!hide.includes('text') && location && (
              <Row>
                <Label value={G.i18n.t('text.label')} />
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
            {!hide.includes('folder') && rootChildNodes.length > 0 && (
              <Row>
                <Label value={G.i18n.t('chooseFolder.label')} />
                <div className="treeview-container">
                  <TreeView
                    initialState={bookmarkTreeNodes(
                      rootChildNodes,
                      anyChildSelectable ? undefined : 'folder',
                      treeSelection || undefined
                    )}
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
