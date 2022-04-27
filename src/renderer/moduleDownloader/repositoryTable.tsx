/* eslint-disable react/forbid-prop-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable max-classes-per-file */
/* eslint-disable react/jsx-props-no-spreading */
import * as React from 'react';
import PropTypes from 'prop-types';
import { Menu, MenuItem } from '@blueprintjs/core';
import {
  Cell,
  Column,
  ColumnHeaderCell,
  Region,
  SelectionModes,
  Table,
  Utils,
} from '@blueprintjs/table';
import { xulDefaultProps, xulPropTypes } from '../libxul/xul';
import '@blueprintjs/table/lib/css/table.css';

export type ICellLookup = (
  rowIndex: number,
  columnIndex: number
) => { value: any; loading: boolean };
export type ISortCallback = (
  columnIndex: number,
  comparator: (a: any, b: any) => number
) => void;
export interface ISortableColumn {
  getColumn(getCellData: ICellLookup, sortColumn: ISortCallback): JSX.Element;
}

abstract class AbstractSortableColumn implements ISortableColumn {
  constructor(protected name: string, protected index: number) {}

  public getColumn(getCellData: ICellLookup, sortColumn: ISortCallback) {
    const cellRenderer = (rowIndex: number, columnIndex: number) => {
      const { value, loading } = getCellData(rowIndex, columnIndex);
      return (
        <Cell truncated loading={loading}>
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

export const DataColumns = ['name', 'domain', 'path', 'status'] as const;

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
  data: PropTypes.arrayOf(
    PropTypes.arrayOf(PropTypes.oneOf([PropTypes.string, PropTypes.number]))
  ).isRequired,
  loading: PropTypes.arrayOf(PropTypes.bool),
  selectedRegions: PropTypes.object,
};

type TableProps = {
  data: (string | number)[][];
  loading: boolean[];
  selectedRegions: Region[];
};

type TableState = {
  columns: ISortableColumn[];
  sortedIndexMap: number[];
};

class RepositoryTable extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  constructor(props: TableProps) {
    super(props);

    const s: TableState = {
      columns: DataColumns.map((nm, ix) => {
        return new TextSortableColumn(nm, ix);
      }) as ISortableColumn[],
      sortedIndexMap: [] as number[],
    };
    this.state = s;

    this.getCellData = this.getCellData.bind(this);
    this.sortColumn = this.sortColumn.bind(this);
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
    };
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
    const { columns: cols } = this.state as TableState;
    const { data, selectedRegions } = this.props as TableProps;
    const numRows = data.length;
    const columns = cols.map((col) =>
      col.getColumn(this.getCellData, this.sortColumn)
    );
    return (
      <Table
        numRows={numRows}
        selectedRegions={selectedRegions}
        selectionModes={SelectionModes.ROWS_ONLY}
        enableMultipleSelection
        enableRowResizing={false}
        enableRowHeader={false}
      >
        {columns}
      </Table>
    );
  }
}
RepositoryTable.defaultProps = defaultProps;
RepositoryTable.propTypes = propTypes;

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
