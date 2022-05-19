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
import { Intent, Menu, MenuDivider, MenuItem } from '@blueprintjs/core';
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
) => {
  value: any;
  info: TCellInfo;
  dataRowIndex: number;
  dataColumnIndex: number;
};

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
    props: TableProps,
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
    props: TableProps,
    state: TableState
  ) {
    const cellRenderer = (rowIndex: number, columnIndex: number) => {
      const { value, info, dataRowIndex, dataColumnIndex } = getCellData(
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
      classes.push(`data-row-${dataRowIndex} data-col-${dataColumnIndex}`);
      tooltip = (
        tooltip !== 'VALUE' ? tooltip : typeof value === 'string' ? value : ''
      ) as string;
      if (editable) {
        const dataKey = Table.dataKey(rowIndex, columnIndex);
        const val =
          dataKey in state.sparseCellData
            ? state.sparseCellData[dataKey] || ''
            : value || '';
        tooltip = (
          tooltip !== 'VALUE' ? tooltip : typeof val === 'string' ? val : ''
        ) as string;
        return (
          <EditableCell
            className={classes?.join(' ')}
            value={val}
            intent={state.sparseCellIntent[dataKey] || intent || 'none'}
            truncated
            loading={loading}
            tooltip={tooltip}
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
          tooltip={tooltip}
          loading={loading}
        >
          {value}
        </Cell>
      );
    };
    const menuRenderer = this.renderMenu.bind(this, sortColumn, props);
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

  protected abstract renderMenu(
    sortColumn: TSortCallback,
    props: TableProps
  ): JSX.Element;
}

class TextSortableColumn extends AbstractSortableColumn {
  static compare(a: any, b: any) {
    if (!a && b) return -1;
    if (a && !b) return 1;
    if (!a && !b) return 0;
    return a.toString().localeCompare(b);
  }

  protected renderMenu(sortColumn: TSortCallback, props: TableProps) {
    const { onColumnToggle, onRowSort, columnHeadings, columnWidths } = props;
    const sortAsc = () => {
      sortColumn(this.index, (a, b) => TextSortableColumn.compare(a, b));
      if (onRowSort) onRowSort(this.index, 'ascending');
    };
    const sortDesc = () => {
      sortColumn(this.index, (a, b) => TextSortableColumn.compare(b, a));
      if (onRowSort) onRowSort(this.index, 'descending');
    };
    const items: JSX.Element[] = [];
    if (columnWidths && onColumnToggle) {
      items.push(<MenuDivider key="divider.1" />);
      items.push(
        <MenuItem
          key={['delete', this.index].join('.')}
          icon="delete"
          text={columnHeadings[this.index]}
          onClick={() => onColumnToggle(this.index, this.index)}
        />
      );
      if (columnHeadings.some((h, i) => h && columnWidths[i] === -1)) {
        items.push(<MenuDivider key="divider.2" />);
      }
      columnHeadings.forEach((heading, i) => {
        if (heading && columnWidths[i] === -1) {
          items.push(
            <MenuItem
              key={['add', heading].join('.')}
              icon="plus"
              text={heading}
              onClick={() => onColumnToggle(i, this.index)}
            />
          );
        }
        return null;
      });
    }
    return (
      <Menu>
        <MenuItem icon="sort-asc" onClick={sortAsc} />
        <MenuItem icon="sort-desc" onClick={sortDesc} />
        {items}
      </Menu>
    );
  }
}

const defaultProps = {
  ...xulDefaultProps,
  columnHeadings: undefined,
  columnInfo: undefined,
  columnWidths: undefined,
  columnOrder: undefined,
  rowSort: undefined,
  cellInfo: undefined,
  selectedRegions: undefined,
  selectionModes: SelectionModes.ROWS_ONLY,
  enableMultipleSelection: false,
  enableColumnReordering: false,
  onColumnsReordered: undefined,
  onColumnWidthChanged: undefined,
  onColumnToggle: undefined,
  onRowSort: undefined,
  onEditableCellChanged: undefined,
};

const propTypes = {
  ...xulPropTypes,
  columnHeadings: PropTypes.arrayOf(PropTypes.string).isRequired,
  columnInfo: PropTypes.arrayOf(PropTypes.object),
  columnWidths: PropTypes.arrayOf(PropTypes.number),
  columnOrder: PropTypes.arrayOf(PropTypes.number),
  rowSort: PropTypes.arrayOf(PropTypes.object),
  // rowHeadings: PropTypes.arrayOf(PropTypes.string),
  data: PropTypes.arrayOf(PropTypes.array).isRequired,
  cellInfo: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)),
  selectedRegions: PropTypes.array,
  selectionModes: PropTypes.any,
  enableMultipleSelection: PropTypes.bool,
  enableColumnReordering: PropTypes.bool,
  onColumnsReordered: PropTypes.func,
  onColumnWidthChanged: PropTypes.func,
  onColumnToggle: PropTypes.func,
  onRowSort: PropTypes.func,
  onEditableCellChanged: PropTypes.func,
};

type TableProps = XulProps & {
  columnHeadings: string[];
  columnInfo?: TColInfo;
  columnWidths?: number[]; // -1 = hide column
  columnOrder?: number[];
  rowSort?: { index: number; direction: 'ascending' | 'descending' };
  // rowHeadings?: string[];
  data: TData;
  cellInfo?: TCellInfo[][]; // sparse arrays
  selectedRegions?: Region[];
  selectionModes: RegionCardinality[];
  enableMultipleSelection: boolean;
  enableColumnReordering: boolean;
  onColumnsReordered?: (
    oldIndex: number,
    newIndex: number,
    length: number
  ) => void;
  onColumnWidthChanged?: IIndexedResizeCallback;
  onColumnToggle?: (toggleColumnIndex: number, menuColumnIndex: number) => void;
  onRowSort?: (column: number, direction: 'ascending' | 'descending') => void;
  onEditableCellChanged?: (row: number, col: number, value: string) => void;
};

type TableState = {
  columns: TSortableColumn[];
  sortedIndexMap: number[];
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

  sState: (s: Partial<TableState> | ((prevState: TableState) => void)) => void;

  constructor(props: TableProps) {
    super(props);
    const { columnHeadings, rowSort } = props;

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
      sortedIndexMap: [],
      sparseCellData: {},
      sparseCellIntent: {},
    };
    if (rowSort) {
      const { index, direction } = rowSort;
      const col = columns[index];
      if (col !== undefined) {
        if (direction === 'ascending') {
          this.sortColumn(index, (a, b) => TextSortableColumn.compare(a, b), s);
        } else {
          this.sortColumn(index, (a, b) => TextSortableColumn.compare(b, a), s);
        }
      }
    }
    this.state = s;

    this.columnIndexToDataMap = [];

    this.tableRef = React.createRef();

    this.sState = this.setState.bind(this);
    this.getCellData = this.getCellData.bind(this);
    this.sortColumn = this.sortColumn.bind(this);
    this.cellValidator = this.cellValidator.bind(this);
    this.cellSetter = this.cellSetter.bind(this);
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
    const { sortedIndexMap } = this.state as TableState;
    const { data, columnInfo, cellInfo } = props;
    const sortedRowIndex = sortedIndexMap[rowIndex];
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
      dataRowIndex,
      dataColumnIndex,
    };
  }

  setSparseState<T>(stateKey: string, dataKey: string, value: T) {
    const stateData = (this.state as any)[stateKey] as { [key: string]: T };
    const values = { ...stateData, [dataKey]: value };
    this.sState({ [stateKey]: values });
  }

  cellSetter(rowIndex: number, columnIndex: number) {
    const dataKey = Table.dataKey(rowIndex, columnIndex);
    const { onEditableCellChanged } = this.props as TableProps;
    return (value: string) => {
      const intent = this.isValid(value) ? null : Intent.DANGER;
      this.setSparseState('sparseCellData', dataKey, value);
      this.setSparseState('sparseCellIntent', dataKey, intent);
      if (!intent && typeof onEditableCellChanged === 'function')
        onEditableCellChanged(rowIndex, columnIndex, value);
    };
  }

  cellValidator(rowIndex: number, columnIndex: number) {
    const dataKey = Table.dataKey(rowIndex, columnIndex);
    return (value: string) => {
      const intent = this.isValid(value) ? null : Intent.DANGER;
      this.setSparseState('sparseCellData', dataKey, value);
      this.setSparseState('sparseCellIntent', dataKey, intent);
    };
  }

  isValid(value: string) {
    return /^[a-zA-Z0-9/ :/._-]*$/.test(value);
  }

  sortColumn(
    columnIndex: number,
    comparator: (a: any, b: any) => number,
    s?: Pick<TableState, 'sortedIndexMap'>
  ) {
    const { data } = this.props as TableProps;
    const sortedIndexMap = Utils.times(data.length, (i: number) => i);
    sortedIndexMap.sort((a: number, b: number) => {
      return comparator(data[a][columnIndex + 1], data[b][columnIndex + 1]);
    });
    if (s) s.sortedIndexMap = sortedIndexMap;
    else {
      this.sState({ sortedIndexMap });
    }
  }

  render() {
    const state = this.state as TableState;
    const props = this.props as TableProps;
    const { columns: cols } = state;
    const { columnOrder, selectionModes } = props;
    const {
      data,
      selectedRegions,
      enableMultipleSelection,
      enableColumnReordering,
      columnWidths,
      onColumnsReordered,
      onColumnWidthChanged,
    } = props;
    let { tableRef } = this;
    const numRows = data.length;
    const order = columnOrder?.slice();
    const columns: JSX.Element[] = [];
    this.columnIndexToDataMap = [];
    cols.forEach((_c, i) => {
      if (!columnWidths || columnWidths[i] !== -1) {
        const io = order && order.length ? (order.shift() as number) : i;
        columns.push(
          cols[io].getColumn(
            this.getCellData,
            this.sortColumn,
            this.cellValidator,
            this.cellSetter,
            props,
            state
          )
        );
        this.columnIndexToDataMap.push(io + 1);
      }
    });

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
          enableColumnReordering={enableColumnReordering}
          onColumnsReordered={onColumnsReordered}
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
