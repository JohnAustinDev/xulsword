/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
import React from 'react';
import { Suggest2 } from '@blueprintjs/select';
import {
  diff,
  getStatePref,
  keep,
  randomID,
  stringHash,
  tableRowsToSelection,
} from '../../common';
import { SPBM } from '../../constant';
import G from '../rg';
import renderToRoot from '../renderer';
import { registerUpdateStateFromPref, setStatePref } from '../rutil';
import { bookmarkTreeNodes } from '../bookmarks';
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

import type { BookmarkFolderType, BookmarkType } from '../../type';

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

export type BMManagerState = typeof SPBM.manager & typeof defaultNotStatePref;

export default class BMManagerWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  buttonHandler: typeof H.buttonHandler;

  onFolderSelection: typeof H.onFolderSelection;

  onCellClick: typeof H.onCellClick;

  onItemSelect: typeof H.onItemSelect;

  onQueryChange: typeof H.onQueryChange;

  tableData: typeof H.tableData;

  bmContextData: typeof H.bmContextData;

  onDoubleClick: typeof H.onDoubleClick;

  constructor(props: BMManagerProps) {
    super(props);

    const state: BMManagerState = {
      ...defaultNotStatePref,
      ...getStatePref(G.Prefs, 'manager', SPBM.manager, 'bookmarks'),
    };
    this.state = state;

    this.buttonHandler = H.buttonHandler.bind(this);
    this.onFolderSelection = H.onFolderSelection.bind(this);
    this.onCellClick = H.onCellClick.bind(this);
    this.onItemSelect = H.onItemSelect.bind(this);
    this.onQueryChange = H.onQueryChange.bind(this);
    this.tableData = H.tableData.bind(this);
    this.bmContextData = H.bmContextData.bind(this);
    this.onDoubleClick = H.onDoubleClick.bind(this);
  }

  componentDidMount() {
    registerUpdateStateFromPref('manager', this, SPBM.manager, 'bookmarks');
  }

  componentDidUpdate(_prevProps: BMManagerProps, prevState: BMManagerState) {
    const state = this.state as BMManagerState;
    setStatePref(
      'manager',
      prevState,
      state,
      Object.keys(SPBM.manager),
      'bookmarks'
    );
    if (diff(prevState, keep(state, ['bookmarks', 'cut', 'copy']))) {
      const s: Partial<BMManagerState> = { reset: randomID() };
      this.setState(s);
    }
  }

  render() {
    const {
      bookmarks,
      columns,
      selectedFolder,
      selectedItems,
      treeWidth,
      query,
      cut,
      copy,
      reset,
    } = this.state as BMManagerState;

    const folders = bookmarkTreeNodes(
      bookmarks.childNodes,
      'folder',
      selectedFolder || SPBM.manager.bookmarks.id
    );

    const data = this.tableData();

    const selectedRegions = tableRowsToSelection(
      selectedItems
        .map((id) => data.findIndex((r) => r[H.Col.iInfo].id === id))
        .filter((i) => i !== -1)
    );

    const searchableItems: (BookmarkFolderType | BookmarkType)[] = [];
    const getItems = (folder: BookmarkFolderType) => {
      if (folder.id !== bookmarks.id) searchableItems.push(folder);
      folder.childNodes.forEach((n) => {
        if (n.type === 'bookmark') searchableItems.push(n);
        else getItems(n);
      });
    };
    getItems(bookmarks);

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
          onClick={this.buttonHandler}
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
            disabled={selectedItems.length !== 1}
            title={G.i18n.t('menu.edit.properties')}
          />
          <Button
            id="button.delete"
            icon="delete"
            disabled={selectedItems.length === 0}
            title={G.i18n.t('menu.edit.delete')}
          />
          <Button
            id="button.cut"
            icon="cut"
            disabled={selectedItems.length === 0}
            title={G.i18n.t('menu.edit.cut')}
          />
          <Button
            id="button.copy"
            icon="duplicate"
            disabled={selectedItems.length === 0}
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
            disabled={selectedItems.length !== 1}
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
          <Vbox className="search" flex="1" onChange={this.onQueryChange}>
            <Suggest2
              fill
              query={query}
              items={searchableItems}
              itemsEqual="id"
              inputValueRenderer={H.inputValueRenderer}
              itemPredicate={H.itemPredicate}
              itemRenderer={H.itemRenderer}
              noResults={<Label value="SEARCHING" />}
              onItemSelect={this.onItemSelect}
            />
          </Vbox>
        </Hbox>
        <Hbox className="tables" flex="1" pack="start" align="stretch">
          <Groupbox className="folders" width={treeWidth}>
            <TreeView
              key={reset}
              initialState={folders}
              selectedIDs={[selectedFolder || SPBM.manager.bookmarks.id]}
              enableMultipleSelection={false}
              onSelection={this.onFolderSelection}
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
            min={150}
          />
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
              data={data}
              selectedRegions={selectedRegions}
              columns={columns}
              enableColumnReordering
              enableMultipleSelection
              onCellClick={this.onCellClick}
              onColumnHide={(c) => this.setState({ columns: c })}
              onColumnsReordered={(c) => this.setState({ columns: c })}
              onColumnWidthChanged={(c) => this.setState({ columns: c })}
              onDoubleClick={this.onDoubleClick}
            />
          </Groupbox>
        </Hbox>
      </Vbox>
    );
  }
}
BMManagerWin.defaultProps = defaultProps;
BMManagerWin.propTypes = propTypes;

renderToRoot(<BMManagerWin />);

window.ipc.once('close', () => {
  G.Prefs.setComplexValue('manager.cut', null, 'bookmarks');
  G.Prefs.setComplexValue('manager.copy', null, 'bookmarks');
});
