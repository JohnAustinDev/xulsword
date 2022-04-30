/* eslint-disable import/order */
/* eslint-disable no-nested-ternary */
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/forbid-prop-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable max-classes-per-file */
/* eslint-disable react/jsx-props-no-spreading */
import * as React from 'react';
import PropTypes from 'prop-types';
import { Intent, Menu, MenuItem } from '@blueprintjs/core';
import {
  Cell,
  Column,
  ColumnHeaderCell,
  EditableCell,
  Region,
  SelectionModes,
  Table,
  Utils,
} from '@blueprintjs/table';
import { xulDefaultProps, xulPropTypes } from '../libxul/xul';
import '@blueprintjs/table/lib/css/table.css';

import type { IIndexedResizeCallback } from '@blueprintjs/table/lib/esm/interactions/resizable';

export type RepoDataInfo = {
  custom: boolean;
  off: boolean; // required even though RepoDataType[3] is similar (but it may also be 'loading')
  failed: boolean;
};

export type RepoDataType = [string, string, string, string, RepoDataInfo];

type ICellValidator = (
  rowIndex: number,
  columnIndex: number
) => (val: string) => void;
type ICellSetter = (
  rowIndex: number,
  columnIndex: number
) => (val: string) => void;
type ICellLookup = (
  rowIndex: number,
  columnIndex: number
) => { value: any; loading: boolean; info: RepoDataInfo };
type ISortCallback = (
  columnIndex: number,
  comparator: (a: any, b: any) => number
) => void;
interface ISortableColumn {
  getColumn(
    getCellData: ICellLookup,
    sortColumn: ISortCallback,
    cellValidator: ICellValidator,
    cellSetter: ICellSetter,
    state: TableState
  ): JSX.Element;
}

abstract class AbstractSortableColumn implements ISortableColumn {
  constructor(protected name: string, protected index: number) {}

  public getColumn(
    getCellData: ICellLookup,
    sortColumn: ISortCallback,
    cellValidator: ICellValidator,
    cellSetter: ICellSetter,
    state: TableState
  ) {
    const cellRenderer = (rowIndex: number, columnIndex: number) => {
      const { value, loading, info } = getCellData(rowIndex, columnIndex);
      let intent: Intent = 'none';
      if (columnIndex === 3) {
        if (!info.off) intent = 'success';
        if (info.failed) intent = 'danger';
      }
      const classes = info.custom ? 'repo-custom' : '';
      if (columnIndex < 3 && info.custom) {
        const dataKey = RepositoryTable.dataKey(rowIndex, columnIndex);
        const val =
          dataKey in state.sparseCellData
            ? state.sparseCellData[dataKey]
            : value;
        return (
          <EditableCell
            className={classes}
            value={val == null ? '' : val}
            intent={state.sparseCellIntent[dataKey] || intent}
            truncated
            loading={loading}
            onCancel={cellValidator(rowIndex, columnIndex)}
            onChange={cellValidator(rowIndex, columnIndex)}
            onConfirm={cellSetter(rowIndex, columnIndex)}
          />
        );
      }
      return (
        <Cell className={classes} intent={intent} truncated loading={loading}>
          {value}
        </Cell>
      );
    };
    const menuRenderer = this.renderMenu.bind(this, sortColumn);
    const columnHeaderCellRenderer = () => (
      // eslint-disable-next-line react/jsx-no-bind
      <ColumnHeaderCell name={this.name} menuRenderer={menuRenderer} />
    );
    return (
      <Column
        cellRenderer={cellRenderer}
        columnHeaderCellRenderer={columnHeaderCellRenderer}
        key={this.index}
        name={this.name}
      />
    );
  }

  protected abstract renderMenu(sortColumn: ISortCallback): JSX.Element;
}

class TextSortableColumn extends AbstractSortableColumn {
  static compare(a: any, b: any) {
    if (!a && b) return -1;
    if (a && !b) return 1;
    if (!a && !b) return 0;
    return a.toString().localeCompare(b);
  }

  protected renderMenu(sortColumn: ISortCallback) {
    const sortAsc = () =>
      sortColumn(this.index, (a, b) => TextSortableColumn.compare(a, b));
    const sortDesc = () =>
      sortColumn(this.index, (a, b) => TextSortableColumn.compare(b, a));
    return (
      <Menu>
        <MenuItem icon="sort-asc" onClick={sortAsc} />
        <MenuItem icon="sort-desc" onClick={sortDesc} />
      </Menu>
    );
  }
}

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
  data: PropTypes.arrayOf(PropTypes.array).isRequired,
  loading: PropTypes.arrayOf(PropTypes.bool),
  selectedRegions: PropTypes.array,
  columnWidths: PropTypes.arrayOf(PropTypes.number),
  onColumnWidthChanged: PropTypes.func,
  onCellChange: PropTypes.func,
};

type TableProps = {
  data: RepoDataType[];
  loading: boolean[];
  selectedRegions: Region[];
  columnWidths: number[];
  onColumnWidthChanged: IIndexedResizeCallback;
  onCellChange: (row: number, col: number, value: string) => void;
};

type TableState = {
  columns: ISortableColumn[];
  sortedIndexMap: number[];
  sparseCellData: { [i: string]: string };
  sparseCellIntent: { [i: string]: Intent };
};

class RepositoryTable extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  static columns: ['', '', '', ''];

  static on: '☑';

  static off: '☐';

  static loading: 'loading';

  static failed: 'failed';

  static dataKey = (rowIndex: number, columnIndex: number) => {
    return `${rowIndex}-${columnIndex}`;
  };

  constructor(props: TableProps) {
    super(props);

    const s: TableState = {
      columns: RepositoryTable.columns.map((nm, ix) => {
        return new TextSortableColumn(nm, ix);
      }) as ISortableColumn[],
      sortedIndexMap: [],
      sparseCellData: {},
      sparseCellIntent: {},
    };
    this.state = s;

    this.getCellData = this.getCellData.bind(this);
    this.sortColumn = this.sortColumn.bind(this);
    this.cellValidator = this.cellValidator.bind(this);
    this.cellSetter = this.cellSetter.bind(this);
    this.setArrayState = this.setArrayState.bind(this);
    this.setSparseState = this.setSparseState.bind(this);
  }

  getCellData(rowIndex: number, columnIndex: number) {
    const { sortedIndexMap } = this.state as TableState;
    const { data, loading } = this.props as TableProps;
    const sortedRowIndex = sortedIndexMap[rowIndex];
    let srowIndex = rowIndex;
    if (sortedRowIndex != null) {
      srowIndex = sortedRowIndex;
    }
    return {
      value: data[srowIndex][columnIndex],
      loading: loading[srowIndex] && columnIndex === 3,
      info: data[srowIndex][4],
    };
  }

  setArrayState<T>(key: string, index: number, value: T) {
    this.setState((prevState: any) => {
      const values = prevState[key].slice() as T[];
      values[index] = value;
      return { [key]: values };
    });
  }

  setSparseState<T>(stateKey: string, dataKey: string, value: T) {
    const stateData = (this.state as any)[stateKey] as { [key: string]: T };
    const values = { ...stateData, [dataKey]: value };
    this.setState({ [stateKey]: values });
  }

  cellSetter(rowIndex: number, columnIndex: number) {
    const dataKey = RepositoryTable.dataKey(rowIndex, columnIndex);
    const { onCellChange } = this.props as TableProps;
    return (value: string) => {
      const intent = this.isValidValid(value) ? null : Intent.DANGER;
      this.setSparseState('sparseCellData', dataKey, value);
      this.setSparseState('sparseCellIntent', dataKey, intent);
      if (!intent && typeof onCellChange === 'function')
        onCellChange(rowIndex, columnIndex, value);
    };
  }

  cellValidator(rowIndex: number, columnIndex: number) {
    const dataKey = RepositoryTable.dataKey(rowIndex, columnIndex);
    return (value: string) => {
      const intent = this.isValidValid(value) ? null : Intent.DANGER;
      this.setSparseState('sparseCellData', dataKey, value);
      this.setSparseState('sparseCellIntent', dataKey, intent);
    };
  }

  isValidValid(value: string) {
    return /^[a-zA-Z0-9/._-]*$/.test(value);
  }

  sortColumn(columnIndex: number, comparator: (a: any, b: any) => number) {
    const { data } = this.props as TableProps;
    const sortedIndexMap = Utils.times(data.length, (i: number) => i);
    sortedIndexMap.sort((a: number, b: number) => {
      return comparator(data[a][columnIndex], data[b][columnIndex]);
    });
    this.setState({ sortedIndexMap });
  }

  render() {
    const state = this.state as TableState;
    const props = this.props as TableProps;
    const { columns: cols } = state;
    const { data, selectedRegions, columnWidths, onColumnWidthChanged } = props;
    const numRows = data.length;
    const columns = cols.map((col) =>
      col.getColumn(
        this.getCellData,
        this.sortColumn,
        this.cellValidator,
        this.cellSetter,
        state
      )
    );
    return (
      <Table
        className="repositorytable"
        numRows={numRows}
        columnWidths={columnWidths}
        selectedRegions={selectedRegions}
        selectionModes={SelectionModes.ROWS_ONLY}
        enableMultipleSelection
        enableRowResizing={false}
        enableRowHeader={false}
        onColumnWidthChanged={onColumnWidthChanged}
      >
        {columns}
      </Table>
    );
  }
}
RepositoryTable.defaultProps = defaultProps;
RepositoryTable.propTypes = propTypes;
RepositoryTable.columns = ['', '', '', ''];
RepositoryTable.on = '☑';
RepositoryTable.off = '☐';
RepositoryTable.loading = 'loading';
RepositoryTable.failed = 'failed';

export default RepositoryTable;

/*
export const DataConfColumns: (keyof SwordConfType)[] = [
  'moduleType',
  'Description',
  'module',
  'sourceRepository',
  'Version',
  'InstallSize',
  'Feature',
  'Versification',
  'Scope',
  'Copyright',
  'DistributionLicense',
  'SourceType',
]; */
