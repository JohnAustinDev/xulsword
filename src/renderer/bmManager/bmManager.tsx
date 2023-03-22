/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/no-unused-state */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
import type { Table2 as BPTable } from '@blueprintjs/table';
import React from 'react';
import { Suggest2 } from '@blueprintjs/select';
import {
  clone,
  diff,
  keep,
  localizeBookmarks,
  randomID,
  stringHash,
  tableRowsToSelection,
} from '../../common';
import S from '../../defaultPrefs';
import G from '../rg';
import renderToRoot from '../renderer';
import {
  registerUpdateStateFromPref,
  setStatePref,
  getStatePref,
} from '../rutil';
import { bookmarkTreeNodes, getSampleText } from '../bookmarks';
import { verseKey } from '../htmlData';
import Table from '../libxul/table';
import DragSizer, { DragSizerVal } from '../libxul/dragsizer';
import Groupbox from '../libxul/groupbox';
import { Hbox, Vbox } from '../libxul/boxes';
import Label from '../libxul/label';
import TreeView from '../libxul/treeview';
import Button from '../libxul/button';
import {
  xulDefaultProps,
  XulProps,
  xulPropTypes,
  addClass,
} from '../libxul/xul';
import * as H from './bmManagerH';
import './bmManager.css';
import '@blueprintjs/select/lib/css/blueprint-select.css';

import type {
  BookmarkFolderType,
  BookmarkItemType,
  BookmarkTreeNode,
} from '../../type';

// TODO!: Add print feature
// TODO!: add move to context menu and allow multiple moves
// TODO!: Add import/export buttons

const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

type BMManagerProps = XulProps;

const defaultNotStatePref = {
  selectedItems: [] as string[],
  query: '' as string,
  cut: null as string[] | null,
  copy: null as string[] | null,
  reset: '' as string,
};

export type BMManagerState = typeof S.prefs.bookmarkManager &
  typeof defaultNotStatePref & {
    rootfolder: typeof S.bookmarks.rootfolder;
  };

export default class BMManagerWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  localizedRootFolderClone: BookmarkFolderType | null;

  currentRootFolderObject: BookmarkFolderType | null;

  searchableItems: BookmarkItemType[];

  folderItems: BookmarkTreeNode[];

  tableData: H.TableRow[];

  itemPredicate: typeof H.itemPredicate;

  itemRenderer: typeof H.itemRenderer;

  buttonHandler: typeof H.buttonHandler;

  onFolderSelection: typeof H.onFolderSelection;

  onCellClick: typeof H.onCellClick;

  onItemSelect: typeof H.onItemSelect;

  onQueryChange: typeof H.onQueryChange;

  onDoubleClick: typeof H.onDoubleClick;

  bmContextData: typeof H.bmContextData;

  scrollToItem: typeof H.scrollToItem;

  tableCompRef: React.RefObject<BPTable>;

  constructor(props: BMManagerProps) {
    super(props);

    const state: BMManagerState = {
      ...defaultNotStatePref,
      ...(getStatePref(
        'prefs',
        'bookmarkManager'
      ) as typeof S.prefs.bookmarkManager),
      ...(getStatePref('bookmarks', null) as typeof S.bookmarks),
    };
    this.state = state;

    this.localizedRootFolderClone = null;
    this.searchableItems = [];
    this.folderItems = [];
    this.tableData = [];
    this.currentRootFolderObject = null;

    this.itemPredicate = H.itemPredicate.bind(this);
    this.itemRenderer = H.itemRenderer.bind(this);
    this.buttonHandler = H.buttonHandler.bind(this);
    this.onFolderSelection = H.onFolderSelection.bind(this);
    this.onCellClick = H.onCellClick.bind(this);
    this.onItemSelect = H.onItemSelect.bind(this);
    this.onQueryChange = H.onQueryChange.bind(this);
    this.onDoubleClick = H.onDoubleClick.bind(this);
    this.bmContextData = H.bmContextData.bind(this);
    this.scrollToItem = H.scrollToItem.bind(this);

    this.tableCompRef = React.createRef();
  }

  componentDidMount() {
    registerUpdateStateFromPref('prefs', 'bookmarkManager', this);
    registerUpdateStateFromPref('bookmarks', null, this);
  }

  componentDidUpdate(_prevProps: BMManagerProps, prevState: BMManagerState) {
    const state = this.state as BMManagerState;
    setStatePref('prefs', 'bookmarkManager', prevState, state);
    setStatePref('bookmarks', null, prevState, state);
    if (diff(prevState, keep(state, ['rootfolder', 'cut', 'copy']))) {
      this.setState({ reset: randomID() } as Partial<BMManagerState>);
    }
  }

  render() {
    const state = this.state as BMManagerState;
    const {
      rootfolder,
      columns,
      selectedFolder,
      selectedItems,
      treeWidth,
      query,
      cut,
      copy,
      reset,
    } = state;

    const {
      tableCompRef,
      buttonHandler,
      itemPredicate,
      itemRenderer,
      onQueryChange,
      onItemSelect,
      onFolderSelection,
    } = this;

    if (rootfolder !== this.currentRootFolderObject) {
      // Clone the localized rootfolder so state does not to push temporary
      // localization state changes to the rest of xulsword.
      this.localizedRootFolderClone = clone(rootfolder);
      localizeBookmarks(
        G,
        verseKey,
        this.localizedRootFolderClone,
        getSampleText
      );
      this.searchableItems = H.getSearchableItems(
        this.localizedRootFolderClone
      );
      this.folderItems = bookmarkTreeNodes(
        this.localizedRootFolderClone.childNodes,
        'folder'
      );
      this.tableData = H.getTableData({
        ...state,
        rootfolder: this.localizedRootFolderClone,
      });
      this.currentRootFolderObject = rootfolder;
    }

    const selectedRegions = tableRowsToSelection(
      selectedItems
        .map((id) => this.tableData.findIndex((r) => r[H.Col.iInfo].id === id))
        .filter((i) => i !== -1)
    );

    return (
      <Vbox
        {...addClass(['bmmanager'], this.props)}
        onKeyDown={(e: React.SyntheticEvent) => {
          const ek = e as React.KeyboardEvent;
          if (ek.key === 'Escape')
            this.setState({
              cut: null,
              copy: null,
              reset: randomID(),
            } as BMManagerState);
        }}
      >
        <Hbox
          className="tools"
          pack="start"
          align="center"
          onClick={buttonHandler}
        >
          <Button
            id="button.newFolder"
            icon="folder-new"
            title={G.i18n.t('menu.folder.add')}
          />
          <Button
            id="button.add"
            icon="add"
            title={G.i18n.t('menu.bookmark.add')}
          />
          <Button
            id="button.properties"
            icon="properties"
            disabled={
              selectedItems.length !== 1 ||
              selectedItems.includes(S.bookmarks.rootfolder.id)
            }
            title={G.i18n.t('menu.edit.properties')}
          />
          <Button
            id="button.delete"
            icon="delete"
            disabled={
              selectedItems.length === 0 ||
              selectedItems.includes(S.bookmarks.rootfolder.id)
            }
            title={G.i18n.t('menu.edit.delete')}
          />
          <Button
            id="button.cut"
            icon="cut"
            disabled={
              selectedItems.length === 0 ||
              selectedItems.includes(S.bookmarks.rootfolder.id)
            }
            title={G.i18n.t('menu.edit.cut')}
          />
          <Button
            id="button.copy"
            icon="duplicate"
            disabled={
              selectedItems.length === 0 ||
              selectedItems.includes(S.bookmarks.rootfolder.id)
            }
            title={G.i18n.t('menu.edit.copy')}
          />
          <Button
            id="button.paste"
            icon="clipboard"
            disabled={!(cut || copy) || selectedItems.length !== 1}
            title={G.i18n.t('menu.edit.paste')}
          />
          <Button
            id="button.move"
            icon="drawer-left"
            disabled={
              selectedItems.length !== 1 ||
              selectedItems.includes(S.bookmarks.rootfolder.id)
            }
            title={G.i18n.t('menu.edit.move')}
          />
          <Button
            id="button.undo"
            icon="undo"
            disabled={!G.canUndo()}
            title={G.i18n.t('menu.edit.undo')}
          />
          <Button
            id="button.redo"
            icon="redo"
            disabled={!G.canRedo()}
            title={G.i18n.t('menu.edit.redo')}
          />
          <Vbox className="search" flex="1" onChange={onQueryChange}>
            <Suggest2
              fill
              query={query}
              items={this.searchableItems}
              itemsEqual="id"
              inputProps={{ placeholder: `${G.i18n.t('Search')}…` }}
              inputValueRenderer={H.inputValueRenderer}
              itemPredicate={itemPredicate}
              itemRenderer={itemRenderer}
              initialContent={
                <Label
                  value={G.i18n.t('Searching', {
                    v1: G.i18n.t('menu.bookmarks'),
                  })}
                />
              }
              noResults={
                <Label value={G.i18n.t('searchStatusAll', { v1: 0 })} />
              }
              onItemSelect={onItemSelect}
            />
          </Vbox>
        </Hbox>
        <Hbox className="tables" flex="1" pack="start" align="stretch">
          {this.folderItems.length > 0 && (
            <>
              <Groupbox className="folders" width={treeWidth}>
                <TreeView
                  className="bookmark-item-tree"
                  key={reset}
                  initialState={this.folderItems}
                  selectedIDs={[selectedFolder]}
                  enableMultipleSelection={false}
                  onSelection={onFolderSelection}
                />
              </Groupbox>
              <DragSizer
                orient="vertical"
                onDragStart={() => treeWidth}
                onDragEnd={(_e: React.MouseEvent, v: DragSizerVal) => {
                  this.setState((prevState: BMManagerState) => {
                    return {
                      treeWidth: v.sizerPos,
                      reset: prevState.reset + 1,
                    };
                  });
                }}
                min={1}
              />
            </>
          )}
          <Groupbox
            className="items"
            flex="1"
            onContextMenu={(e: React.SyntheticEvent) => {
              G.Data.write(
                this.bmContextData(e.target as HTMLElement),
                'contextData'
              );
            }}
          >
            <Table
              key={stringHash(columns, reset)}
              data={this.tableData}
              selectedRegions={selectedRegions}
              columns={columns}
              enableColumnReordering
              enableMultipleSelection
              onCellClick={this.onCellClick}
              onColumnHide={(c) => this.setState({ columns: c })}
              onColumnsReordered={(c) => this.setState({ columns: c })}
              onColumnWidthChanged={(c) => this.setState({ columns: c })}
              onDoubleClick={this.onDoubleClick}
              tableCompRef={tableCompRef}
            />
          </Groupbox>
        </Hbox>
      </Vbox>
    );
  }
}
BMManagerWin.defaultProps = defaultProps;
BMManagerWin.propTypes = propTypes;

renderToRoot(<BMManagerWin id="bookmarkManager" />);

window.ipc.once('close', () => {
  G.Prefs.setComplexValue(
    'bookmarkManager.cut',
    null as typeof S.prefs.bookmarkManager.cut
  );
  G.Prefs.setComplexValue(
    'bookmarkManager.copy',
    null as typeof S.prefs.bookmarkManager.copy
  );
  G.Prefs.setCharPref(
    'bookmarkManager.selectedFolder',
    S.bookmarks.rootfolder.id as typeof S.prefs.bookmarkManager.selectedFolder
  );
});
