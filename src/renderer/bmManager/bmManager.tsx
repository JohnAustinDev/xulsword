/* eslint-disable react/no-did-update-set-state */
/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/static-property-placement */
import React from 'react';
import { findBookmarkItem, getStatePref, stringHash } from '../../common';
import { SPBM } from '../../constant';
import G from '../rg';
import renderToRoot from '../renderer';
import {
  bookmarkItemIcon,
  registerUpdateStateFromPref,
  setStatePref,
} from '../rutil';
import { bookmarkTreeNodes } from '../bookmarks';
import Table, { TCellInfo, TRowLocation } from '../libxul/table';
import DragSizer, { DragSizerVal } from '../libxul/dragsizer';
import Groupbox from '../libxul/groupbox';
import { Hbox, Vbox } from '../libxul/boxes';
import Label from '../libxul/label';
import TreeView from '../libxul/treeview';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import './bmManager.css';

import type {
  BookmarkFolderType,
  LocationGBType,
  LocationVKType,
} from '../../type';

type CellInfo = TCellInfo & {
  id: string;
  location?: LocationVKType | LocationGBType | null | undefined;
};

type TableRow = [JSX.Element, JSX.Element, JSX.Element, string, CellInfo];

const Col = {
  iName: 0,
  iNote: 1,
  iSampleText: 2,
  iCreationDate: 3,
  iInfo: 4,
} as const;

const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

type BMManagerProps = XulProps;

const defaultNotStatePref = {
  reset: 0 as number,
};

export type BMManagerState = typeof SPBM.manager & typeof defaultNotStatePref;

export default class BMManagerWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  constructor(props: BMManagerProps) {
    super(props);

    const state: BMManagerState = {
      ...defaultNotStatePref,
      ...getStatePref(G.Prefs, 'manager', SPBM.manager, 'bookmarks'),
    };

    this.state = state;

    this.onFolderSelection = this.onFolderSelection.bind(this);
    this.onCellClick = this.onCellClick.bind(this);
    this.tableData = this.tableData.bind(this);
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
  }

  onFolderSelection(ids: (string | number)[]): void {
    if (ids[0]) {
      const clicked = ids[0].toString();
      this.setState((prevState: BMManagerState) => {
        let { selectedFolder } = prevState;
        selectedFolder = selectedFolder === clicked ? '' : clicked;
        const s: Partial<BMManagerState> = {
          selectedFolder,
        };
        return s;
      });
    }
  }

  onCellClick(_e: React.MouseEvent, cell: TRowLocation): void {
    const { dataRowIndex } = cell;
    const data = this.tableData();
    if (data[dataRowIndex]) {
      const s: Partial<BMManagerState> = {
        selectedItem: data[dataRowIndex][Col.iInfo].id,
      };
      this.setState(s);
    }
  }

  tableData(): TableRow[] {
    const state = this.state as BMManagerState;
    const { bookmarks, selectedFolder } = state;
    const data: TableRow[] = [];
    const addItems = (folder: BookmarkFolderType, level = 0) => {
      folder.childNodes.forEach((cn) => {
        const { id, label, note, creationDate, labelLocale, noteLocale } = cn;
        let mclass = 'cs-locale';
        if ('location' in cn && cn.location) {
          if ('v11n' in cn.location) mclass = `cs-${cn.location.vkmod}`;
          else mclass = `cs-${cn.location.module}`;
        }
        const sampleText = 'sampleText' in cn ? cn.sampleText : '';
        data.push([
          <span className="label-cell" key={stringHash(id, label, note)}>
            {[...Array(level).keys()].map((a) => (
              <div key={`ind${a}`} className="indent" />
            ))}
            {bookmarkItemIcon(cn)}
            <Label className={labelLocale} value={label} />
          </span>,
          <span key={note} className={noteLocale}>
            {note}
          </span>,
          <span key={[sampleText, mclass].join('.')} className={mclass}>
            {sampleText}
          </span>,
          new Date(creationDate).toLocaleDateString(G.i18n.language),
          {
            id,
            location: 'location' in cn ? cn.location : undefined,
          },
        ] as TableRow);
        if (cn.type === 'folder') addItems(cn, level + 1);
      });
    };
    const selfolder = findBookmarkItem(
      bookmarks,
      selectedFolder || SPBM.manager.bookmarks.id
    );
    if (selfolder && selfolder.type === 'folder') addItems(selfolder);
    return data;
  }

  render() {
    const {
      bookmarks,
      columns,
      selectedFolder,
      selectedItem,
      treeWidth,
      reset,
    } = this.state as BMManagerState;
    const { onFolderSelection, onCellClick, tableData } = this;

    const folders = bookmarkTreeNodes(
      bookmarks.childNodes,
      'folder',
      selectedFolder || SPBM.manager.bookmarks.id
    );

    const data = tableData();

    let row = data.findIndex((d) => d[Col.iInfo].id === selectedItem);
    if (row === -1) row += 1;
    const selectedRegions = [
      {
        cols: null,
        rows: [row, row],
      },
    ];

    return (
      <Vbox className="bmmanager">
        <Hbox flex="1" pack="start" align="center">
          <Groupbox className="folders" width={treeWidth}>
            <TreeView
              initialState={folders}
              selectedIDs={[selectedFolder || SPBM.manager.bookmarks.id]}
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
            min={150}
          />
          <Groupbox className="items" flex="1">
            <Table
              key={stringHash(columns, reset)}
              data={data}
              selectedRegions={selectedRegions}
              columns={columns}
              enableColumnReordering
              onCellClick={onCellClick}
              onColumnHide={(c) => this.setState({ columns: c })}
              onColumnsReordered={(c) => this.setState({ columns: c })}
              onColumnWidthChanged={(c) => this.setState({ columns: c })}
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
