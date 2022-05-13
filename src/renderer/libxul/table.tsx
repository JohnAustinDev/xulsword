/* eslint-disable react/jsx-no-bind */
/* eslint-disable import/order */
/* eslint-disable no-nested-ternary */
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/forbid-prop-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable max-classes-per-file */
/* eslint-disable react/jsx-props-no-spreading */
import React from 'react';
import PropTypes from 'prop-types';
import { Intent, Menu, MenuItem } from '@blueprintjs/core';
import {
  Cell,
  Column,
  ColumnHeaderCell,
  EditableCell,
  Region,
  RegionCardinality,
  SelectionModes,
  Table as BPTable,
  Utils,
} from '@blueprintjs/table';
import { addClass, xulDefaultProps, XulProps, xulPropTypes } from './xul';
import '@blueprintjs/table/lib/css/table.css';
import './table.css';

import type { IIndexedResizeCallback } from '@blueprintjs/table/lib/esm/interactions/resizable';
import { Box } from './boxes';

export type TData = TDataRow[];

export type TDataRow = [TCellInfo, ...any];

export type TColInfo = TCellInfo[];

export type TCellInfo = {
  loading?: boolean | ((rowIndex: number, colIndex: number) => boolean);
  editable?: boolean | ((rowIndex: number, colIndex: number) => boolean);
  intent?: Intent | ((rowIndex: number, colIndex: number) => Intent);
  classes?: string[] | ((rowIndex: number, colIndex: number) => string[]);
  tooltip?:
    | string
    | ((rowIndex: number, colIndex: number) => string | undefined);
};

type TCellValidator = (
  rowIndex: number,
  columnIndex: number
) => (val: string) => void;

type TCellSetter = (
  rowIndex: number,
  columnIndex: number
) => (val: string) => void;

type TCellLookup = (
  rowIndex: number,
  columnIndex: number
) => { value: any; info: TCellInfo; dataColumnIndex: number };

type TSortCallback = (
  columnIndex: number,
  comparator: (a: any, b: any) => number
) => void;

interface TSortableColumn {
  getColumn(
    getCellData: TCellLookup,
    sortColumn: TSortCallback,
    cellValidator: TCellValidator,
    cellSetter: TCellSetter,
    state: TableState
  ): JSX.Element;
}

abstract class AbstractSortableColumn implements TSortableColumn {
  constructor(protected name: string, protected index: number) {}

  public getColumn(
    getCellData: TCellLookup,
    sortColumn: TSortCallback,
    cellValidator: TCellValidator,
    cellSetter: TCellSetter,
    state: TableState
  ) {
    const cellRenderer = (rowIndex: number, columnIndex: number) => {
      const { value, info, dataColumnIndex } = getCellData(
        rowIndex,
        columnIndex
      );
      let { editable, loading, intent, classes, tooltip } = info;
      if (typeof editable === 'function') {
        editable = editable(rowIndex, dataColumnIndex);
      }
      if (typeof loading === 'function') {
        loading = loading(rowIndex, dataColumnIndex);
      }
      if (typeof intent === 'function') {
        intent = intent(rowIndex, dataColumnIndex);
      }
      if (typeof tooltip === 'function') {
        tooltip = tooltip(rowIndex, dataColumnIndex);
      }
      if (typeof classes === 'function') {
        classes = classes(rowIndex, dataColumnIndex);
      }
      if (!classes) classes = [];
      classes.push(`data-column-${dataColumnIndex}`);
      if (editable) {
        const dataKey = Table.dataKey(rowIndex, columnIndex);
        const val =
          dataKey in state.sparseCellData
            ? state.sparseCellData[dataKey] || ''
            : value || '';
        return (
          <EditableCell
            className={classes?.join(' ')}
            value={val}
            intent={state.sparseCellIntent[dataKey] || info.intent || 'none'}
            truncated
            loading={loading}
            tooltip={tooltip === 'VALUE' ? val : tooltip}
            onCancel={cellValidator(rowIndex, columnIndex)}
            onChange={cellValidator(rowIndex, columnIndex)}
            onConfirm={cellSetter(rowIndex, columnIndex)}
          />
        );
      }
      return (
        <Cell
          className={classes?.join(' ')}
          intent={intent || 'none'}
          truncated
          tooltip={tooltip === 'VALUE' ? value.toString() : tooltip}
          loading={loading}
        >
          {value}
        </Cell>
      );
    };
    const menuRenderer = this.renderMenu.bind(this, sortColumn);
    const columnHeaderCellRenderer = () => (
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

  protected abstract renderMenu(sortColumn: TSortCallback): JSX.Element;
}

class TextSortableColumn extends AbstractSortableColumn {
  static compare(a: any, b: any) {
    if (!a && b) return -1;
    if (a && !b) return 1;
    if (!a && !b) return 0;
    return a.toString().localeCompare(b);
  }

  protected renderMenu(sortColumn: TSortCallback) {
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
  columnHeadings: undefined,
  columnInfo: undefined,
  columnWidths: undefined,
  cellInfo: undefined,
  selectedRegions: undefined,
  selectionModes: SelectionModes.ROWS_ONLY,
  enableMultipleSelection: false,
  onColumnWidthChanged: undefined,
  onEditableCellChanged: undefined,
};

const propTypes = {
  ...xulPropTypes,
  columnHeadings: PropTypes.arrayOf(PropTypes.string).isRequired,
  columnInfo: PropTypes.arrayOf(PropTypes.object),
  columnWidths: PropTypes.arrayOf(PropTypes.number),
  // rowHeadings: PropTypes.arrayOf(PropTypes.string),
  data: PropTypes.arrayOf(PropTypes.array).isRequired,
  cellInfo: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)),
  selectedRegions: PropTypes.array,
  selectionModes: PropTypes.any,
  enableMultipleSelection: PropTypes.bool,
  onColumnWidthChanged: PropTypes.func,
  onEditableCellChanged: PropTypes.func,
};

type TableProps = XulProps & {
  columnHeadings: string[];
  columnInfo?: TColInfo;
  columnWidths?: number[]; // -1 = hide column
  // rowHeadings?: string[];
  data: TData;
  cellInfo?: TCellInfo[][]; // sparse arrays
  selectedRegions?: Region[];
  selectionModes: RegionCardinality[];
  enableMultipleSelection: boolean;
  onColumnWidthChanged?: IIndexedResizeCallback;
  onEditableCellChanged?: (row: number, col: number, value: string) => void;
};

type TableState = {
  columns: TSortableColumn[];
  rowIndexMap: number[];
  sparseCellData: { [i: string]: string };
  sparseCellIntent: { [i: string]: Intent };
};

class Table extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  static scrollTop: { [id: string]: number };

  static dataKey = (rowIndex: number, columnIndex: number) => {
    return `${rowIndex}-${columnIndex}`;
  };

  columnIndexToDataMap: number[];

  tableRef: React.RefObject<HTMLDivElement>;

  constructor(props: TableProps) {
    super(props);
    const { columnHeadings } = props;

    // Create new columns, one for each column of data (minus
    // the data's info column).
    const columns = [];
    for (let c = 0; c < columnHeadings.length; c += 1) {
      columns.push(
        new TextSortableColumn((columnHeadings && columnHeadings[c]) || '', c)
      );
    }
    const s: TableState = {
      columns,
      rowIndexMap: [],
      sparseCellData: {},
      sparseCellIntent: {},
    };
    this.state = s;

    this.columnIndexToDataMap = [];

    this.tableRef = React.createRef();

    this.getCellData = this.getCellData.bind(this);
    this.sortColumn = this.sortColumn.bind(this);
    this.cellValidator = this.cellValidator.bind(this);
    this.cellSetter = this.cellSetter.bind(this);
    this.setArrayState = this.setArrayState.bind(this);
    this.setSparseState = this.setSparseState.bind(this);
  }

  componentDidMount() {
    const { domref, id } = this.props as TableProps;
    // Scroll table to last position.
    const tableRef = domref || this.tableRef;
    const t = tableRef.current;
    if (t) {
      const parent = t.getElementsByClassName(
        'bp4-table-quadrant-scroll-container'
      )[0];
      if (parent) {
        let top = 0;
        if (id && id in Table.scrollTop) top = Table.scrollTop[id] - 30;
        parent.scrollTop = top;
      }
    }
  }

  componentWillUnmount() {
    const { id, domref } = this.props as TableProps;
    // Save scroll position.
    const tableRef = domref || this.tableRef;
    const t = tableRef.current;
    if (t) {
      const parent = t.getElementsByClassName(
        'bp4-table-quadrant-scroll-container'
      )[0];
      if (parent && id) {
        Table.scrollTop[id] = parent.scrollTop;
      }
    }
  }

  getCellData(rowIndex: number, columnIndex: number) {
    const props = this.props as TableProps;
    const { rowIndexMap } = this.state as TableState;
    const { data, columnInfo, cellInfo } = props;
    const sortedRowIndex = rowIndexMap[rowIndex];
    let dataRowIndex = rowIndex;
    let dataColumnIndex = columnIndex;
    if (sortedRowIndex != null) dataRowIndex = sortedRowIndex;
    dataColumnIndex = this.columnIndexToDataMap[columnIndex];
    let value = data[dataRowIndex][dataColumnIndex];
    if (typeof value === 'function') {
      value = value(dataRowIndex, dataColumnIndex);
    }
    return {
      value,
      info: {
        ...((columnInfo && columnInfo[dataColumnIndex]) || {}),
        ...data[dataRowIndex][0],
        ...((cellInfo && cellInfo[dataRowIndex][dataColumnIndex]) || {}),
      },
      dataColumnIndex,
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
    const dataKey = Table.dataKey(rowIndex, columnIndex);
    const { onEditableCellChanged: onCellChange } = this.props as TableProps;
    return (value: string) => {
      const intent = this.isValidValid(value) ? null : Intent.DANGER;
      this.setSparseState('sparseCellData', dataKey, value);
      this.setSparseState('sparseCellIntent', dataKey, intent);
      if (!intent && typeof onCellChange === 'function')
        onCellChange(rowIndex, columnIndex, value);
    };
  }

  cellValidator(rowIndex: number, columnIndex: number) {
    const dataKey = Table.dataKey(rowIndex, columnIndex);
    return (value: string) => {
      const intent = this.isValidValid(value) ? null : Intent.DANGER;
      this.setSparseState('sparseCellData', dataKey, value);
      this.setSparseState('sparseCellIntent', dataKey, intent);
    };
  }

  isValidValid(value: string) {
    return /^[a-zA-Z0-9/ :/._-]*$/.test(value);
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
    const { selectionModes } = props;
    const {
      data,
      selectedRegions,
      enableMultipleSelection,
      columnWidths,
      onColumnWidthChanged,
    } = props;
    let { tableRef } = this;
    const numRows = data.length;
    const columns = cols
      .map((col, i) => {
        if (columnWidths && columnWidths[i] === -1) return null;
        return col.getColumn(
          this.getCellData,
          this.sortColumn,
          this.cellValidator,
          this.cellSetter,
          state
        );
      })
      .filter(Boolean) as JSX.Element[];
    if (columnWidths) {
      this.columnIndexToDataMap = [];
      columnWidths?.forEach((w, i) => {
        if (w !== -1) this.columnIndexToDataMap.push(i + 1);
      });
    } else this.columnIndexToDataMap = columns.map((_c, i) => i + 1);

    const classes = ['table'];
    if (onColumnWidthChanged) classes.push('width-resizable');

    // If parent uses domref, don't clobber it, use it.
    if (props.domref) tableRef = props.domref;

    return (
      <Box domref={tableRef} {...addClass(classes, props)}>
        <BPTable
          numRows={numRows}
          columnWidths={columnWidths?.filter((w) => w !== -1)}
          selectedRegions={selectedRegions}
          selectionModes={selectionModes}
          enableMultipleSelection={enableMultipleSelection}
          enableRowResizing={false}
          enableRowHeader={false}
          onColumnWidthChanged={onColumnWidthChanged}
        >
          {columns}
        </BPTable>
      </Box>
    );
  }
}
Table.defaultProps = defaultProps;
Table.propTypes = propTypes;
Table.scrollTop = {};

export default Table;
