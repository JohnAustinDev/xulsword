/* eslint-disable react/no-did-update-set-state */
/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/static-property-placement */
import React from 'react';
import {
  clone,
  findBookmarkItem,
  findParentOfBookmarkItem,
  moveBookmarkItems,
  randomID,
  replaceBookmarkItem,
  bookmarkLabel,
  localizeBookmark,
  localizeBookmarks,
} from '../../common';
import S from '../../defaultPrefs';
import G from '../rg';
import renderToRoot from '../renderer';
import { verseKey } from '../htmlData';
import { windowArguments } from '../rutil';
import { bookmarkTreeNode, getSampleText } from '../bookmarks';
import Grid, { Column, Columns, Row, Rows } from '../libxul/grid';
import { Hbox, Vbox } from '../libxul/boxes';
import Label from '../libxul/label';
import Textbox from '../libxul/textbox';
import SelectVK, { SelectVKMType } from '../libxul/selectVK';
import SelectOR, { SelectORMType } from '../libxul/selectOR';
import Button from '../libxul/button';
import Spacer from '../libxul/spacer';
import TreeView from '../libxul/treeview';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import './bmProperties.css';

import type {
  BookmarkItem,
  BookmarkItemType,
  BookmarkType,
  GType,
  LocationORType,
  LocationVKType,
} from '../../type';

const Bookmarks = G.Prefs.getComplexValue(
  'rootfolder',
  'bookmarks'
) as typeof S.bookmarks.rootfolder;
localizeBookmarks(G, verseKey, Bookmarks);

let HasRequiredModule = false;

export type BMPropertiesState = {
  bookmark: BookmarkItemType;
  treeSelection: string;
  anyChildSelectable: boolean; // Set to allow bookmark selection, before which bm will be inserted
  hide: ('folder' | 'name' | 'location' | 'note' | 'text')[];
};

export type BMPropertiesStateWinArg = Omit<BMPropertiesState, 'bookmark'> & {
  bookmark: string;
};

const bmdefault: BookmarkType = {
  type: 'bookmark',
  tabType: 'Texts',
  id: '',
  label: '',
  labelLocale: '',
  note: '',
  noteLocale: '',
  creationDate: Date.now(),
  location: {
    vkmod: '',
    book: 'Gen',
    chapter: 1,
    verse: 1,
    lastverse: 1,
    v11n: 'KJV',
  },
  sampleText: '',
  sampleModule: '',
};

const defaultState: BMPropertiesState = {
  bookmark: bmdefault,
  treeSelection: S.bookmarks.rootfolder.id,
  anyChildSelectable: true,
  hide: [],
};

// The window argument controls what appears in the bmProperties window and
// to some extent how it operates:
// STATE                  VALUE MEANING
// bookmark                str -id of bookmark item to which the window will apply.
// bookmark              undef -create new bookmark (new id will be created)
// bookmark.location     undef -shows folder properties dialog (which has no vk or gb
//                              selector or sampleText)
// bookmark.location      null -shows verse-key properties dialog with default location.
// bookmark.location.v11n  str -shows verse-key properties dialog with the given location.
// bookmark.location.v11n  ''   show general-book properties dialog at given location.
// treeSelection           str -if editing an existing bookmark, this value is ignored.
//                              Otherwise it's the default folder (or bookmark loc-
//                              ation if anyChildSelectable is set) for the new item.
// hide                    []  -hide the input selector(s) having the given id(s)
const winState0 = windowArguments('bmPropertiesState') as Parameters<
  GType['Commands']['openBookmarkProperties']
>[1];

const newitem = windowArguments('newitem') as Parameters<
  GType['Commands']['openBookmarkProperties']
>[2];

const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

type BMPropertiesProps = XulProps;

export default class BMPropertiesWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  constructor(props: BMPropertiesProps) {
    super(props);

    const state = initialState();
    if (!state) {
      G.Window.close();
      return;
    }

    // Check if a required module is installed.
    const l = (state.bookmark as BookmarkType).location;
    if (l) {
      let reqmod = '';
      if ('v11n' in l && state.bookmark.tabType === 'Comms') {
        ({ vkmod: reqmod } = l);
      } else if (!('v11n' in l)) {
        ({ module: reqmod } = l);
      }
      if (!reqmod || reqmod in G.Tab) HasRequiredModule = true;
    }

    // Select bookmark item's parent folder or location
    const item = state.anyChildSelectable
      ? findBookmarkItem(Bookmarks, state.bookmark.id)
      : findParentOfBookmarkItem(Bookmarks, state.bookmark.id);
    if (item) state.treeSelection = item.id;
    this.state = state;

    this.treeHandler = this.treeHandler.bind(this);
    this.vkHandler = this.vkHandler.bind(this);
    this.gbHandler = this.gbHandler.bind(this);
    this.handler = this.handler.bind(this);
  }

  componentDidMount() {
    const state = this.state as BMPropertiesState;
    const { bookmark, treeSelection } = clone(state);
    const { label } = bookmark;
    if (HasRequiredModule) {
      let updateState = false;
      // Null location means default location
      if ('location' in bookmark && bookmark.location === null) {
        updateState = true;
        bookmark.location = bmdefault.location;
      }
      // Don't leave label empty.
      if (!label) {
        updateState = true;
        bookmark.label =
          'location' in bookmark
            ? bookmarkLabel(
                G,
                verseKey,
                bookmark.location as LocationORType | SelectVKMType
              )
            : G.i18n.t('menu.folder.add');
      }
      // Don't leave sampleText empty
      if (
        bookmark.type === 'bookmark' &&
        !bookmark.sampleText &&
        bookmark.location
      ) {
        updateState = true;
        const st = getSampleText(bookmark.location, G.i18n.language as 'en');
        bookmark.sampleText = st.sampleText;
        bookmark.sampleModule = st.sampleModule;
      }
      if (updateState) {
        this.setState({
          treeSelection: treeSelection || S.bookmarks.rootfolder.id,
          bookmark,
        });
      }
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
            bookmark.noteLocale = G.i18n.language as 'en';
          } else if (eid === 'label') {
            bookmark.labelLocale = G.i18n.language as 'en';
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
        const rootfolder = G.Prefs.getComplexValue(
          'rootfolder',
          'bookmarks'
        ) as typeof S.bookmarks.rootfolder;
        const state = this.state as BMPropertiesState;
        const { treeSelection, bookmark } = state;
        const isNew = !replaceBookmarkItem(rootfolder, bookmark);
        const itemOrID = isNew ? [bookmark] : [bookmark.id];
        const moved = moveBookmarkItems(
          rootfolder,
          itemOrID,
          treeSelection || rootfolder.id
        );
        if (moved) {
          G.Prefs.setComplexValue('rootfolder', rootfolder, 'bookmarks');
          G.Window.reset('component-reset', 'all');
          G.Window.close();
        }
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

  gbHandler(selection: SelectORMType) {
    const { ormod: module, keys } = selection;
    const key = keys[0];
    if (key && HasRequiredModule) {
      this.setState((prevState: BMPropertiesState) => {
        const { bookmark } = clone(prevState);
        const bm = bookmark as BookmarkType;
        bm.location = {
          module,
          key,
          paragraph: undefined,
        };
        bm.label = bookmarkLabel(G, verseKey, bm.location);
        const st = getSampleText(bm.location, G.i18n.language as 'en');
        bm.sampleText = st.sampleText;
        bm.sampleModule = st.sampleModule;
        return { bookmark };
      });
    }
  }

  vkHandler(selection: SelectVKMType) {
    if (HasRequiredModule) {
      this.setState((prevState: BMPropertiesState) => {
        const { bookmark } = clone(prevState);
        const bm = bookmark as BookmarkType;
        bm.location = selection;
        bm.label = bookmarkLabel(G, verseKey, bm.location);
        const st = getSampleText(bm.location, G.i18n.language as 'en');
        bm.sampleText = st.sampleText;
        bm.sampleModule = st.sampleModule;
        return { bookmark };
      });
    }
  }

  render() {
    const state = this.state as BMPropertiesState;
    const { treeHandler, gbHandler, handler, vkHandler } = this;
    const { bookmark, hide, treeSelection, anyChildSelectable } = state;
    const { label, labelLocale, note, noteLocale } = localizeBookmark(
      G,
      verseKey,
      bookmark
    );
    let location;
    if (bookmark.type === 'bookmark') {
      ({ location } = bookmark);
      if (location === null) location = bmdefault.location;
    }
    let selectORM: SelectORMType | undefined;
    if (location && !('v11n' in location)) {
      const { module: ormod, key } = location;
      const child = key;
      selectORM = {
        ormod,
        keys: child ? [child] : [],
      };
    }

    let sampleText: string | undefined;
    let sampleModule: string | undefined;
    if (bookmark.type === 'bookmark') {
      ({ sampleText, sampleModule } = bookmark);
    }

    const treeNode = bookmarkTreeNode(
      Bookmarks,
      anyChildSelectable ? undefined : 'folder',
      treeSelection || undefined
    );

    return (
      <Vbox className="bmproperties">
        <Grid flex="1">
          <Columns>
            <Column width="min-content" />
            <Column width="minmax(min-content, 1fr)" />
          </Columns>
          <Rows>
            {!hide.includes('location') && location && 'v11n' in location && (
              <Row>
                <Label value={G.i18n.t('location.label')} />
                <SelectVK
                  initialVKM={location}
                  options={{ lastchapters: [] }}
                  disabled={!HasRequiredModule}
                  onSelection={vkHandler}
                />
              </Row>
            )}
            {!hide.includes('location') && selectORM && (
              <Row>
                <Label value={G.i18n.t('location.label')} />
                <SelectOR
                  initialORM={selectORM}
                  enableParentSelection
                  disabled={!HasRequiredModule}
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
              <Row height="1fr">
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
              <Row height="1fr">
                <div />
                <Textbox
                  id="sampleText"
                  className={`cs-${sampleModule}`}
                  multiline
                  readonly
                  maxLength="128"
                  value={sampleText}
                />
              </Row>
            )}
            {!hide.includes('folder') && treeNode && (
              <Row>
                <Label value={G.i18n.t('chooseFolder.label')} />
                <div className="treeview-container xsinput">
                  <TreeView
                    className="bookmark-item-tree"
                    initialState={[treeNode]}
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

renderToRoot(<BMPropertiesWin />, { initialState: { resetOnResize: false } });

function initialState(): BMPropertiesState | null {
  const winarg = winState0 as Partial<BMPropertiesState>;
  let bookmark: BookmarkItemType = clone(bmdefault);
  if (newitem || !winState0?.bookmark) {
    let location = bmdefault.location as
      | LocationVKType
      | LocationORType
      | undefined;
    if (newitem && 'location' in newitem) {
      location = newitem.location || undefined;
    }
    let module = G.Tabs.find((t) => t.isVerseKey)?.module || '';
    if (newitem && 'module' in newitem && newitem.module) {
      module = newitem.module;
    }
    const item: BookmarkItem = {
      id: randomID(),
      type: 'folder',
      label: G.i18n.t('newFolder'),
      labelLocale: G.i18n.language as 'en',
      note: '',
      noteLocale: G.i18n.language as 'en',
      creationDate: new Date().valueOf(),
    };
    if (location) {
      if (module && 'v11n' in location) {
        const t = (module in G.Tab && G.Tab[module]) || null;
        bookmark = {
          ...item,
          type: 'bookmark',
          label: '',
          labelLocale: '',
          location: {
            ...location,
            vkmod: module || '',
            v11n: t?.v11n || 'KJV',
          },
          sampleText: '',
          sampleModule: '',
          tabType: t?.tabType || 'Texts',
        };
      } else if (!('v11n' in location)) {
        const { module: ormod } = location;
        const t = (ormod in G.Tab && G.Tab[ormod]) || null;
        bookmark = {
          ...item,
          type: 'bookmark',
          label: '',
          labelLocale: '',
          location,
          sampleText: '',
          sampleModule: '',
          tabType: t?.tabType || 'Genbks',
        };
      }
    } else {
      bookmark = {
        ...item,
        type: 'folder',
        childNodes: [],
      };
    }
  } else if ('bookmark' in winState0) {
    const { bookmark: bmid } = winState0;
    if (bmid) {
      const item = findBookmarkItem(Bookmarks, bmid) || undefined;
      if (item) bookmark = item;
    } else return null;
  } else return null;

  const s: BMPropertiesState = {
    ...defaultState,
    ...winarg,
    bookmark,
  };
  return s;
}
