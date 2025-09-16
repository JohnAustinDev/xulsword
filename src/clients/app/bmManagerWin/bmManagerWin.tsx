import React from 'react';
import { Suggest } from '@blueprintjs/select';
import {
  clone,
  diff,
  keep,
  randomID,
  stringHash,
  tableRowIndexesToBPSelection,
} from '../../../common.ts';
import S from '../../../defaultPrefs.ts';
import { GE as G } from '../../G.ts';
import RenderPromise, { RenderPromiseComponent } from '../../renderPromise.ts';
import renderToRoot from '../../controller.tsx';
import {
  registerUpdateStateFromPref,
  setStatePref,
  getStatePref,
} from '../../common.ts';
import log from '../../log.ts';
import { bookmarkTreeNodes, getSampleText } from '../../bookmarks.tsx';
import Table from '../../components/libxul/table.tsx';
import DragSizer from '../../components/libxul/dragsizer.tsx';
import Groupbox from '../../components/libxul/groupbox.tsx';
import { Hbox, Vbox } from '../../components/libxul/boxes.tsx';
import Label from '../../components/libxul/label.tsx';
import TreeView from '../../components/libxul/treeview.tsx';
import Button from '../../components/libxul/button.tsx';
import { addClass } from '../../components/libxul/xul.tsx';
import { localizeBookmarks } from '../common.ts';
import * as H from './bmManagerWinH.tsx';
import './bmManagerWin.css';
import '@blueprintjs/select/lib/css/blueprint-select.css';

import type { Table2 as BPTable } from '@blueprintjs/table';
import type {
  BookmarkFolderType,
  BookmarkItemType,
  BookmarkTreeNode,
} from '../../../type.ts';
import type { DragSizerVal } from '../../components/libxul/dragsizer.tsx';
import type { XulProps } from '../../components/libxul/xul.tsx';

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

export default class BMManagerWin
  extends React.Component<BMManagerProps, BMManagerState>
  implements RenderPromiseComponent
{
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

  printableItem: typeof H.printableItem;

  tableCompRef: React.RefObject<BPTable>;

  renderPromise: RenderPromise;

  loadingRef: React.RefObject<HTMLElement>;

  destroy: (() => void)[];

  constructor(props: BMManagerProps) {
    super(props);

    this.state = {
      ...defaultNotStatePref,
      ...(getStatePref(
        'prefs',
        'bookmarkManager',
      ) as typeof S.prefs.bookmarkManager),
      ...(getStatePref('bookmarks', null) as typeof S.bookmarks),
    };

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
    this.printableItem = H.printableItem.bind(this);

    this.tableCompRef = React.createRef();
    this.loadingRef = React.createRef();
    this.renderPromise = new RenderPromise(this, this.loadingRef);

    this.destroy = [];
  }

  componentDidMount() {
    this.destroy.push(
      registerUpdateStateFromPref('prefs', 'bookmarkManager', this),
    );
    this.destroy.push(registerUpdateStateFromPref('bookmarks', null, this));
  }

  componentDidUpdate(_prevProps: BMManagerProps, prevState: BMManagerState) {
    const { state } = this;
    setStatePref('prefs', 'bookmarkManager', prevState, state);
    setStatePref('bookmarks', null, prevState, state);
    if (diff(prevState, keep(state, ['rootfolder', 'cut', 'copy']))) {
      this.setState({ reset: randomID() });
    }
  }

  componentWillUnmount() {
    this.destroy.forEach((func) => func());
    this.destroy = [];
  }

  render() {
    const { props, state } = this;
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
      printItems,
    } = state;
    const {
      renderPromise,
      tableCompRef,
      loadingRef,
      buttonHandler,
      itemPredicate,
      itemRenderer,
      onQueryChange,
      onItemSelect,
      onFolderSelection,
    } = this;

    if (rootfolder !== this.currentRootFolderObject) {
      // Clone the localized rootfolder so state does not push temporary
      // localization changes to the rest of xulsword (which should not
      // happen until localized bookmarks are edited).
      this.localizedRootFolderClone = clone(rootfolder);
      if (this.localizedRootFolderClone) {
        localizeBookmarks(
          this.localizedRootFolderClone,
          renderPromise,
          getSampleText,
        );
        this.searchableItems = H.getSearchableItems(
          this.localizedRootFolderClone,
        );
        this.folderItems = bookmarkTreeNodes(
          this.localizedRootFolderClone.childNodes,
          renderPromise,
          'folder',
        );
        this.tableData = H.getTableData({
          ...state,
          rootfolder: this.localizedRootFolderClone,
        });
        this.currentRootFolderObject = rootfolder;
      }
    }

    const selectedRegions = tableRowIndexesToBPSelection(
      selectedItems
        .map((id) => this.tableData.findIndex((r) => r[H.Col.iInfo].id === id))
        .filter((i) => i !== -1),
    );

    if (printItems)
      return printItems.map((itemID) =>
        this.printableItem(itemID, renderPromise),
      );

    return (
      <Vbox
        {...addClass(['bmmanager'], props)}
        onKeyDown={(e: React.SyntheticEvent) => {
          const ek = e as React.KeyboardEvent;
          if (ek.key === 'Escape')
            this.setState({
              cut: null,
              copy: null,
              reset: randomID(),
            });
        }}
        domref={loadingRef}
      >
        <Hbox
          className="tools"
          pack="start"
          align="center"
          onPointerDown={buttonHandler}
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
          <Button
            id="button.import"
            icon="import"
            title={`${G.i18n.t('menu.import').replace(/[.…]+$/, '')} ${G.i18n.t(
              'menu.bookmarks',
            )}`}
          />
          <Button
            id="button.export"
            icon="export"
            disabled={S.bookmarks.rootfolder.childNodes.length > 0}
            title={`${G.i18n.t('menu.export').replace(/[.…]+$/, '')} ${G.i18n.t(
              'menu.bookmarks',
            )}`}
          />
          <Button
            id="button.print"
            icon="print"
            disabled={selectedItems.length === 0}
            title={G.i18n.t('menu.print')}
          />
          <Vbox className="search" flex="1" onChange={onQueryChange}>
            <Suggest
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
                onDragEnd={(_e: PointerEvent, v: DragSizerVal) => {
                  this.setState((prevState) => {
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
                'contextData',
              );
            }}
          >
            <Table
              key={stringHash(columns, reset)}
              data={this.tableData}
              tableColumns={columns}
              tableToDataRowMap={[]}
              selectedRegions={selectedRegions}
              onCellClick={this.onCellClick}
              onColumnHide={(c: BMManagerState['columns']) => {
                this.setState({ columns: c });
              }}
              onColumnsReordered={(c: BMManagerState['columns']) => {
                this.setState({ columns: c });
              }}
              onColumnWidthChanged={(c: BMManagerState['columns']) => {
                this.setState({ columns: c });
              }}
              onDoubleClick={this.onDoubleClick}
              tableCompRef={tableCompRef}
            />
          </Groupbox>
        </Hbox>
      </Vbox>
    );
  }
}

renderToRoot(<BMManagerWin id="bookmarkManager" />, {
  onunload: () => {
    G.Prefs.setComplexValue(
      'bookmarkManager.cut',
      null as typeof S.prefs.bookmarkManager.cut,
    );
    G.Prefs.setComplexValue(
      'bookmarkManager.copy',
      null as typeof S.prefs.bookmarkManager.copy,
    );
    G.Prefs.setCharPref(
      'bookmarkManager.selectedFolder',
      S.bookmarks.rootfolder.id,
    );
    G.Prefs.setComplexValue(
      'bookmarkManager.printItems',
      null as typeof S.prefs.bookmarkManager.printItems,
    );
  },
}).catch((er) => {
  log.error(er);
});
