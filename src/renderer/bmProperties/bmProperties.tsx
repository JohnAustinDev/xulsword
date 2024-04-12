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
  getModuleOfObject,
  keep,
} from '../../common.ts';
import S from '../../defaultPrefs.ts';
import G from '../rg.ts';
import renderToRoot from '../renderer.tsx';
import { verseKey } from '../htmlData.ts';
import { windowArguments } from '../rutil.tsx';
import { bookmarkTreeNode, getSampleText } from '../bookmarks.ts';
import Grid, { Column, Columns, Row, Rows } from '../libxul/grid.tsx';
import { Hbox, Vbox } from '../libxul/boxes.tsx';
import Label from '../libxul/label.tsx';
import Textbox from '../libxul/textbox.tsx';
import SelectAny from '../libxul/selectAny.tsx';
import Button from '../libxul/button.tsx';
import Spacer from '../libxul/spacer.tsx';
import TreeView from '../libxul/treeview.tsx';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul.tsx';
import './bmProperties.css';

import type {
  BMItem,
  BookmarkComm,
  BookmarkItem,
  BookmarkItemType,
  BookmarkOther,
  BookmarkTexts,
  BookmarkType,
  GType,
  LocationORType,
  LocationTypes,
  LocationVKCommType,
  LocationVKType,
  TabTypes,
} from '../../type.ts';
import type { SelectVKType } from '../libxul/selectVK.tsx';

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

const bmdefault: BookmarkTexts = {
  type: 'bookmark',
  tabType: 'Texts',
  id: '',
  label: '',
  labelLocale: '',
  note: '',
  noteLocale: '',
  creationDate: Date.now(),
  location: {
    vkMod: '',
    book: 'Gen',
    chapter: 1,
    verse: 1,
    lastverse: 1,
    v11n: 'KJV',
  },
  sampleText: '',
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
const windowArgState = windowArguments('bmPropertiesState') as Parameters<
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

    const state: BMPropertiesState = {
      ...defaultState,
      ...windowArgState,
      bookmark: initialBookmark() || bmdefault,
    };

    if (!state) {
      G.Window.close();
      return;
    }

    // Check that any required module is installed.
    const module = getModuleOfObject(state.bookmark);
    let vkMod;
    if (
      state.bookmark.type === 'bookmark' &&
      'v11n' in state.bookmark.location
    ) {
      ({ vkMod } = state.bookmark.location);
    }
    if (!module || vkMod || module in G.Tab) {
      HasRequiredModule = true;
    }

    // Select bookmark item's parent folder or location
    const item = state.anyChildSelectable
      ? findBookmarkItem(Bookmarks, state.bookmark.id)
      : findParentOfBookmarkItem(Bookmarks, state.bookmark.id);
    if (item) state.treeSelection = item.id;
    this.state = state;

    this.treeHandler = this.treeHandler.bind(this);
    this.locationHandler = this.locationHandler.bind(this);
    this.eventHandler = this.eventHandler.bind(this);
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
                bookmark.location as LocationORType | SelectVKType
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
        bookmark.sampleText = getSampleText(bookmark.location);
      }
      if (updateState) {
        this.setState({
          treeSelection: treeSelection || S.bookmarks.rootfolder.id,
          bookmark,
        });
      }
    }
  }

  eventHandler(ex: React.SyntheticEvent) {
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

  locationHandler(selection: LocationTypes[TabTypes] | undefined) {
    const module = (selection && getModuleOfObject(selection)) || null;
    if (module && selection && HasRequiredModule) {
      this.setState((prevState: BMPropertiesState) => {
        let bookmark: BookmarkItemType;
        if (module !== getModuleOfObject(prevState.bookmark)) {
          bookmark =
            module && module in G.Tab
              ? locationToBookmark(
                  selection,
                  keep(prevState.bookmark, [
                    'id',
                    'note',
                    'noteLocale',
                    'creationDate',
                  ])
                )
              : bmdefault;
        } else {
          const { bookmark: prevbm } = prevState;
          const label = bookmarkLabel(G, verseKey, selection);
          const sampleText = getSampleText(selection);
          if ('commMod' in selection) {
            bookmark = {
              ...(prevbm as BookmarkComm),
              tabType: 'Comms',
              location: selection,
              label,
              sampleText,
            };
          } else if ('v11n' in selection) {
            bookmark = {
              ...(prevbm as BookmarkTexts),
              tabType: 'Texts',
              location: selection,
              label,
              sampleText,
            };
          } else {
            bookmark = {
              ...(prevbm as BookmarkOther),
              location: selection,
              tabType: G.Tab[module].tabType as 'Genbks' | 'Dicts',
              label: bookmarkLabel(G, verseKey, selection),
              sampleText: getSampleText(selection),
            };
          }
        }
        return { bookmark };
      });
    }
  }

  render() {
    const state = this.state as BMPropertiesState;
    const { treeHandler, eventHandler, locationHandler } = this;
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

    let sampleText: string | undefined;
    let sampleModule: string | undefined;
    if (bookmark.type === 'bookmark') {
      ({ sampleText } = bookmark);
    }

    const treeNode = bookmarkTreeNode(
      Bookmarks,
      anyChildSelectable ? undefined : 'folder',
      treeSelection || undefined
    );

    const modules = G.Tabs.map((t) => t.module);
    const module = (location && getModuleOfObject(location)) || '';
    if (module && !modules.includes(module)) modules.unshift(module);

    return (
      <Vbox className="bmproperties">
        <Grid flex="1">
          <Columns>
            <Column width="min-content" />
            <Column width="minmax(min-content, 1fr)" />
          </Columns>
          <Rows>
            {!hide.includes('location') && location && (
              <Row>
                <Label value={G.i18n.t('location.label')} />
                <SelectAny
                  initial={location}
                  modules={modules}
                  disabled={!HasRequiredModule}
                  onSelection={locationHandler}
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
                  onChange={eventHandler}
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
                  onChange={eventHandler}
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
          <Button id="cancel" flex="1" fill="x" onClick={eventHandler}>
            {G.i18n.t('cancel.label')}
          </Button>
          <Button id="ok" flex="1" fill="x" onClick={eventHandler}>
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

function initialBookmark(): BookmarkItemType | undefined {
  let bookmark: BookmarkItemType | undefined;
  if (newitem || !windowArgState?.bookmark) {
    let location:
      | LocationVKType
      | LocationVKCommType
      | LocationORType
      | undefined;
    if (newitem && 'location' in newitem) location = newitem.location;
    const item: BookmarkItem = {
      id: randomID(),
      type: 'folder',
      label: G.i18n.t('newFolder'),
      labelLocale: G.i18n.language as 'en',
      note: '',
      noteLocale: '',
      creationDate: new Date().valueOf(),
    };
    if (location) {
      if ('commMod' in location) {
        bookmark = {
          ...item,
          type: 'bookmark',
          label: '',
          labelLocale: '',
          location,
          sampleText: '',
          tabType: 'Comms',
        };
      } else if ('v11n' in location) {
        bookmark = {
          ...item,
          type: 'bookmark',
          label: '',
          labelLocale: '',
          location,
          sampleText: '',
          tabType: 'Texts',
        };
      } else {
        const { otherMod } = location;
        const tabType = otherMod in G.Tab && G.Tab[otherMod].tabType;
        if (tabType === 'Dicts' || tabType === 'Genbks') {
          bookmark = {
            ...item,
            type: 'bookmark',
            label: '',
            labelLocale: '',
            location,
            sampleText: '',
            tabType,
          };
        }
      }
    } else {
      bookmark = {
        ...item,
        type: 'folder',
        childNodes: [],
      };
    }
  } else if ('bookmark' in windowArgState) {
    const { bookmark: bmid } = windowArgState;
    if (bmid) {
      const item = findBookmarkItem(Bookmarks, bmid) || undefined;
      if (item) bookmark = item;
    }
  }

  return bookmark;
}

// Convert the location of an installed module into a bookmark. If
// copyItem is passed, the new bookmark will have those values copied,
// or else a new values are given.
function locationToBookmark(
  location: LocationVKType | LocationVKCommType | LocationORType,
  copyItem?: Partial<BMItem>
): BookmarkType {
  const item: BookmarkItem = {
    id: randomID(),
    label: '',
    labelLocale: G.i18n.language as 'en',
    note: '',
    noteLocale: '',
    creationDate: new Date().valueOf(),
    ...copyItem,
  };
  let newmb: BookmarkTexts | BookmarkComm | BookmarkOther;
  if ('commMod' in location) {
    newmb = {
      ...item,
      type: 'bookmark',
      tabType: 'Comms',
      location,
      sampleText: getSampleText(location),
    };
  } else if ('v11n' in location) {
    newmb = {
      ...item,
      type: 'bookmark',
      tabType: 'Texts',
      location,
      sampleText: getSampleText(location),
    };
  } else {
    const { otherMod } = location;
    let tabType = (otherMod in G.Tab && G.Tab[otherMod].tabType) || 'Genbks';
    if (tabType === 'Texts' || tabType === 'Comms') {
      tabType = 'Dicts';
      location.key = '';
    }
    newmb = {
      ...item,
      type: 'bookmark',
      tabType,
      location,
      sampleText: getSampleText(location),
    };
  }
  return newmb;
}
