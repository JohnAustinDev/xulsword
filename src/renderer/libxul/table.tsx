/* eslint-disable react/sort-comp */
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
import {
  addClass,
  xulDefaultProps,
  XulProps,
  xulPropTypes,
  topHandle,
} from './xul';
import '@blueprintjs/table/lib/css/table.css';
import './table.css';

import { Box } from './boxes';
import { ofClass } from 'common';

export type TsortRowsByColumn = {
  tableColIndex: number;
  direction: 'ascending' | 'descending';
};

export type TonRowsReordered = (
  byColumn: TColumnLocation,
  direction: 'ascending' | 'descending',
  tableToDataRowMap: number[]
) => void;

export type TonColumnsReordered = (
  oldTableColIndex: number,
  newTableColIndex: number,
  length: number
) => void;

export type TonColumnWidthChanged = (
  column: TColumnLocation,
  size: number
) => void;

export type TonCellClick = (e: React.MouseEvent, cell: TCellLocation) => void;

export type TonEditableCellChanged = (
  cell: TCellLocation,
  value: string
) => void;

export type TonColumnHide = (
  toggleDataColumn: number,
  targetTableColumn: number
) => void;

export type TRowLocation = {
  dataRowIndex: number;
  tableRowIndex: number;
};

export type TColumnLocation = {
  dataColIndex: number;
  tableColIndex: number;
};

export type TCellLocation = TRowLocation & TColumnLocation;

export type TData = TDataRow[];

export type TDataRow = [TCellInfo, ...any];

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
  row: TRowLocation;
  col: TColumnLocation;
};

type TSortCallback = (
  columnIndex: number,
  direction: 'ascending' | 'descending',
  comparator: (a: any, b: any) => number
) => void;

interface TSortableColumn {
  getColumn(
    getCellData: TCellLookup,
    sortColumn: TSortCallback,
    columnHide: TonColumnHide,
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
    columnHide: TonColumnHide,
    cellValidator: TCellValidator,
    cellSetter: TCellSetter,
    props: TableProps,
    state: TableState
  ) {
    const cellRenderer = (tableRowIndex: number, tableColIndex: number) => {
      const { value, info, row, col } = getCellData(
        tableRowIndex,
        tableColIndex
      );
      let { editable, loading, intent, classes, tooltip } = info;
      if (typeof editable === 'function') {
        editable = editable(row.dataRowIndex, col.dataColIndex);
      }
      if (typeof loading === 'function') {
        loading = loading(row.dataRowIndex, col.dataColIndex);
      }
      if (typeof intent === 'function') {
        intent = intent(row.dataRowIndex, col.dataColIndex);
      }
      if (typeof tooltip === 'function') {
        tooltip = tooltip(row.dataRowIndex, col.dataColIndex);
      }
      if (typeof classes === 'function') {
        classes = classes(row.dataRowIndex, col.dataColIndex);
      }
      if (!classes) classes = [];
      classes.push(`data-row-${row.dataRowIndex} data-col-${col.dataColIndex}`);
      tooltip = (
        tooltip !== 'VALUE' ? tooltip : typeof value === 'string' ? value : ''
      ) as string;
      if (editable) {
        const dataKey = Table.dataKey(tableRowIndex, tableColIndex);
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
            onCancel={cellValidator(tableRowIndex, tableColIndex)}
            onChange={cellValidator(tableRowIndex, tableColIndex)}
            onConfirm={cellSetter(tableRowIndex, tableColIndex)}
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
    const menuRenderer = this.renderMenu.bind(
      this,
      sortColumn,
      columnHide,
      props
    );
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
    columnHide: TonColumnHide,
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

  protected renderMenu(
    sortColumn: TSortCallback,
    columnHide: TonColumnHide,
    props: TableProps
  ) {
    const { onColumnHide, columnHeadings, columnWidths } = props;
    const sortAsc = () => {
      sortColumn(this.index, 'ascending', (a, b) =>
        TextSortableColumn.compare(a, b)
      );
    };
    const sortDesc = () => {
      sortColumn(this.index, 'descending', (a, b) =>
        TextSortableColumn.compare(b, a)
      );
    };
    const items: JSX.Element[] = [];
    if (columnWidths && onColumnHide) {
      items.push(<MenuDivider key="divider.1" />);
      items.push(
        <MenuItem
          key={['delete', this.index].join('.')}
          icon="delete"
          text={columnHeadings[this.index]}
          onClick={() => columnHide(this.index, this.index)}
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
              onClick={() => columnHide(i, this.index)}
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
  columnWidths: undefined,
  columnOrder: undefined,
  sortRowsByColumn: undefined,
  selectedRegions: undefined,
  selectionModes: SelectionModes.ROWS_ONLY,
  enableMultipleSelection: false,
  enableColumnReordering: false,

  onRowsReordered: undefined,
  onColumnsReordered: undefined,
  onColumnWidthChanged: undefined,
  onColumnHide: undefined,
  onEditableCellChanged: undefined,
  onCellClick: undefined,
  onSelection: undefined,
};

const propTypes = {
  ...xulPropTypes,
  data: PropTypes.arrayOf(PropTypes.array).isRequired,
  columnHeadings: PropTypes.arrayOf(PropTypes.string).isRequired,
  columnWidths: PropTypes.arrayOf(PropTypes.number),
  columnOrder: PropTypes.arrayOf(PropTypes.number),
  sortRowsByColumn: PropTypes.shape({
    tableColumnIndex: PropTypes.number,
    direction: PropTypes.oneOf(['ascending', 'descending']),
  }),
  selectedRegions: PropTypes.array,
  selectionModes: PropTypes.any,
  enableMultipleSelection: PropTypes.bool,
  enableColumnReordering: PropTypes.bool,

  onRowsReordered: PropTypes.func,
  onColumnsReordered: PropTypes.func,
  onColumnWidthChanged: PropTypes.func,
  onColumnHide: PropTypes.func,
  onEditableCellChanged: PropTypes.func,
  onCellClick: PropTypes.func,
};

type TableProps = XulProps & {
  data: TData;
  columnHeadings: string[];
  columnWidths?: number[]; // -1 = hide column
  columnOrder?: number[]; // tableColIndex[]
  // sortRowsByColumn effects constructor sort only
  sortRowsByColumn?: TsortRowsByColumn;
  selectedRegions?: Region[];
  selectionModes?: RegionCardinality[];
  enableMultipleSelection?: boolean;
  enableColumnReordering?: boolean;

  onRowsReordered?: TonRowsReordered;
  onColumnsReordered?: TonColumnsReordered;
  onColumnWidthChanged?: TonColumnWidthChanged;
  onColumnHide?: TonColumnHide;
  onEditableCellChanged?: TonEditableCellChanged;
  onCellClick?: TonCellClick;
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
    const { columnHeadings, sortRowsByColumn: rowSort } = props;

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
      const { tableColIndex: index, direction } = rowSort;
      const col = columns[index];
      if (col !== undefined) {
        if (direction === 'ascending') {
          this.sortColumn(
            index,
            direction,
            (a, b) => TextSortableColumn.compare(a, b),
            s
          );
        } else {
          this.sortColumn(
            index,
            direction,
            (a, b) => TextSortableColumn.compare(b, a),
            s
          );
        }
      }
    }
    this.state = s;

    this.columnIndexToDataMap = [];

    this.tableRef = React.createRef();

    this.sState = this.setState.bind(this);
    this.getCellData = this.getCellData.bind(this);
    this.sortColumn = this.sortColumn.bind(this);
    this.columnHide = this.columnHide.bind(this);
    this.cellValidator = this.cellValidator.bind(this);
    this.cellSetter = this.cellSetter.bind(this);
    this.setSparseState = this.setSparseState.bind(this);
    this.onColumnWidthChangedXS = this.onColumnWidthChangedXS.bind(this);
    this.onCellClick = this.onCellClick.bind(this);
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

  mapTableRow(tableRowIndex: number): TRowLocation {
    const { sortedIndexMap } = this.state as TableState;
    const ret: TRowLocation = { dataRowIndex: tableRowIndex, tableRowIndex };
    if (sortedIndexMap.length) ret.dataRowIndex = sortedIndexMap[tableRowIndex];
    return ret;
  }

  mapTableColumn(tableColIndex: number): TColumnLocation {
    const { columnIndexToDataMap } = this;
    const ret: TColumnLocation = {
      dataColIndex: tableColIndex,
      tableColIndex,
    };
    if (columnIndexToDataMap.length) {
      ret.dataColIndex = columnIndexToDataMap[tableColIndex];
    }
    return ret;
  }

  getCellData(tableRowIndex: number, tableColumnIndex: number) {
    const props = this.props as TableProps;
    const { data } = props;
    const row = this.mapTableRow(tableRowIndex);
    const col = this.mapTableColumn(tableColumnIndex);
    let value = data[row.dataRowIndex][col.dataColIndex];
    if (typeof value === 'function') {
      value = value(row.dataRowIndex, col.dataColIndex);
    }
    return {
      value,
      info: data[row.dataRowIndex][0],
      row,
      col,
    };
  }

  cellSetter(tableRowindex: number, tableColumnIndex: number) {
    const dataKey = Table.dataKey(tableRowindex, tableColumnIndex);
    const { onEditableCellChanged } = this.props as TableProps;
    return (value: string) => {
      const intent = this.isValid(value) ? null : Intent.DANGER;
      this.setSparseState('sparseCellData', dataKey, value);
      this.setSparseState('sparseCellIntent', dataKey, intent);
      if (!intent && typeof onEditableCellChanged === 'function')
        onEditableCellChanged(
          {
            ...this.mapTableRow(tableRowindex),
            ...this.mapTableColumn(tableColumnIndex),
          },
          value
        );
    };
  }

  cellValidator(tableRowIndex: number, tableColumnIndex: number) {
    const dataKey = Table.dataKey(tableRowIndex, tableColumnIndex);
    return (value: string) => {
      const intent = this.isValid(value) ? null : Intent.DANGER;
      this.setSparseState('sparseCellData', dataKey, value);
      this.setSparseState('sparseCellIntent', dataKey, intent);
    };
  }

  isValid(value: string) {
    return /^[a-zA-Z0-9/ :/._-]*$/.test(value);
  }

  setSparseState<T>(stateKey: string, dataKey: string, value: T) {
    const stateData = (this.state as any)[stateKey] as { [key: string]: T };
    const values = { ...stateData, [dataKey]: value };
    this.sState({ [stateKey]: values });
  }

  onColumnWidthChangedXS(tableColIndex: number, size: number) {
    const { onColumnWidthChanged } = this.props as TableProps;
    if (onColumnWidthChanged) {
      onColumnWidthChanged(this.mapTableColumn(tableColIndex), size);
    }
  }

  // Unlike column order, which is solely determined by the columnOrder
  // prop, row order is part of the table state as sortedIndexMap. When
  // a column is sorted, the new mapping is returned via onRowsReordered
  // so that ancestor elements may have the new order.
  sortColumn(
    columnInstanceIndex: number,
    direction: 'ascending' | 'descending',
    comparator: (a: any, b: any) => number,
    s?: Pick<TableState, 'sortedIndexMap'>
  ) {
    const { data, onRowsReordered } = this.props as TableProps;
    const sortedIndexMap = Utils.times(data.length, (i: number) => i);
    sortedIndexMap.sort((a: number, b: number) => {
      return comparator(
        data[a][columnInstanceIndex + 1],
        data[b][columnInstanceIndex + 1]
      );
    });
    if (s) s.sortedIndexMap = sortedIndexMap;
    else {
      this.sState({ sortedIndexMap });
    }
    if (onRowsReordered) {
      const tableColIndex = sortedIndexMap.indexOf(columnInstanceIndex + 1);
      onRowsReordered(
        { tableColIndex, dataColIndex: columnInstanceIndex + 1 },
        direction,
        sortedIndexMap
      );
    }
  }

  // Like column order, column hiding is entirely controlled by the
  // columnWidths prop (a value of -1 hides a column). So onColumnHide
  // is responsible for updating the columnWidths prop to effect the
  // change to the table.
  columnHide(toggleColumnInstance: number, targetColumnInstance: number) {
    const { onColumnHide } = this.props as TableProps;
    const { columnIndexToDataMap } = this;
    if (onColumnHide) {
      const targetTableColumn = columnIndexToDataMap.indexOf(
        targetColumnInstance + 1
      );
      onColumnHide(
        toggleColumnInstance + 1,
        this.mapTableColumn(targetTableColumn).tableColIndex
      );
    }
  }

  onCellClick(e: React.SyntheticEvent) {
    const { onCellClick } = this.props as TableProps;
    if (onCellClick) {
      const cell = ofClass(['bp4-table-cell'], e.target);
      if (cell) {
        const rowt = cell.element.className.match(/bp4-table-cell-row-(\d+)\b/);
        const tableRowIndex = rowt ? Number(rowt[1]) : -1;
        const colt = cell.element.className.match(/bp4-table-cell-col-(\d+)\b/);
        const tableColIndex = colt ? Number(colt[1]) : -1;
        onCellClick(e as React.MouseEvent, {
          ...this.mapTableRow(tableRowIndex),
          ...this.mapTableColumn(tableColIndex),
        });
      }
    }
  }

  render() {
    const state = this.state as TableState;
    const props = this.props as TableProps;
    const { columns: cols } = state;
    const { columnOrder, selectionModes, onColumnsReordered } = props;
    const {
      data,
      selectedRegions,
      enableMultipleSelection,
      enableColumnReordering,
      columnWidths,
      onColumnWidthChanged,
    } = props;
    const { onColumnWidthChangedXS, onCellClick } = this;
    let { tableRef } = this;
    const numRows = data.length;
    // Column order is wholly determined by the columnOrder prop. If the user
    // reorders a column, the action is reported via onColumnsReordered and
    // then the columnOrder prop must be updated to effect the actual change.
    const order = columnOrder?.slice();
    const columns: JSX.Element[] = [];
    this.columnIndexToDataMap = [];
    const orderedColumnWidths: number[] | undefined = columnWidths
      ? []
      : undefined;
    cols.forEach((_c, i) => {
      if (!columnWidths || columnWidths[i] !== -1) {
        const io = order && order.length ? (order.shift() as number) : i;
        if (orderedColumnWidths && columnWidths) {
          orderedColumnWidths.push(columnWidths[io]);
        }
        columns.push(
          cols[io].getColumn(
            this.getCellData,
            this.sortColumn,
            this.columnHide,
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

    // If parent uses a domref, don't clobber it, use it.
    if (props.domref) tableRef = props.domref;

    // Notes on BluePrintJS Tables:
    // - Row and column selection is only possible by clicking on a row or col
    // heading, but row headings are not always enabled. So controlled selection
    // has been used.
    // - Selection modes and onSelection do not seem to work right (even without
    // controlled selection). Selection modes to not have the expected effect,
    // and onSelection does not return the current selection but an empty array.
    // - Cell focus puts a blue border around a focused cell and there is always
    // a focused cell at all times, like a spreadsheet. But we want a table containing
    // interactive components and onFocusedCell doesn't seem to work well for that.
    // So a click handler is used, which also provides the event.
    return (
      <Box
        {...topHandle('onClick', onCellClick)}
        domref={tableRef}
        {...addClass(classes, props)}
      >
        <BPTable
          numRows={numRows}
          columnWidths={orderedColumnWidths}
          selectedRegions={selectedRegions}
          selectionModes={selectionModes}
          enableMultipleSelection={enableMultipleSelection}
          enableColumnReordering={enableColumnReordering}
          enableRowHeader={false}
          enableFocusedCell={false}
          onColumnsReordered={onColumnsReordered}
          onColumnWidthChanged={onColumnWidthChangedXS}
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
