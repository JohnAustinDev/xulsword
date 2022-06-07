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

export type TinitialRowSort = {
  column: number;
  direction: 'ascending' | 'descending';
};

export type TonRowsReordered = (
  column: number,
  direction: 'ascending' | 'descending',
  tableToDataRowMap: number[]
) => void;

export type TonColumnsReordered = (
  oldColumn: number,
  newColumn: number,
  length: number
) => void;

export type TonColumnWidthChanged = (column: number, size: number) => void;

export type TonCellClick = (e: React.MouseEvent, cell: TCellLocation) => void;

export type TonEditableCellChanged = (
  cell: TCellLocation,
  value: string
) => void;

export type TonColumnHide = (
  toggleDataColumn: number,
  targetDataColumn: number
) => void;

export type TRowLocation = {
  dataRowIndex: number;
  tableRowIndex: number;
};

export type TCellLocation = TRowLocation & { column: number };

export type TData = TDataRow[];

export type TDataRow = [...unknown[], TCellInfo];

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

type TCellLookupResult = {
  value: any;
  info: TCellInfo;
  row: TRowLocation;
  dataCol: number;
};

type TCellLookup = (rowIndex: number, columnIndex: number) => TCellLookupResult;

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
  constructor(protected name: string, protected dataColIndex: number) {}

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
      const { value, info, row, dataCol } = getCellData(
        tableRowIndex,
        tableColIndex
      );
      let { editable, loading, intent, classes, tooltip } = info;
      if (typeof editable === 'function') {
        editable = editable(row.dataRowIndex, dataCol);
      }
      if (typeof loading === 'function') {
        loading = loading(row.dataRowIndex, dataCol);
      }
      if (typeof intent === 'function') {
        intent = intent(row.dataRowIndex, dataCol);
      }
      if (typeof tooltip === 'function') {
        tooltip = tooltip(row.dataRowIndex, dataCol);
      }
      if (typeof classes === 'function') {
        classes = classes(row.dataRowIndex, dataCol);
      }
      if (!classes) classes = [];
      classes.push(`data-row-${row.dataRowIndex} data-col-${dataCol}`);
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
        key={this.dataColIndex}
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
    if (a === undefined && b !== undefined) return -1;
    if (b === undefined && a !== undefined) return 1;
    if (a === undefined && b === undefined) return 0;
    return a.toString().localeCompare(b);
  }

  protected renderMenu(
    sortColumn: TSortCallback,
    columnHide: TonColumnHide,
    props: TableProps
  ) {
    const { onColumnHide, columnHeadings, visibleColumns } = props;
    const tableColumnIndex =
      visibleColumns?.indexOf(this.dataColIndex) ?? this.dataColIndex;
    const sortAsc = () => {
      sortColumn(tableColumnIndex, 'ascending', (a, b) =>
        TextSortableColumn.compare(a, b)
      );
    };
    const sortDesc = () => {
      sortColumn(tableColumnIndex, 'descending', (a, b) =>
        TextSortableColumn.compare(b, a)
      );
    };
    const items: JSX.Element[] = [];
    if (onColumnHide) {
      if (columnHeadings[this.dataColIndex]) {
        items.push(<MenuDivider key="divider.1" />);
        items.push(
          <MenuItem
            key={['delete', this.dataColIndex].join('.')}
            icon="delete"
            text={columnHeadings[this.dataColIndex]}
            onClick={() => columnHide(this.dataColIndex, this.dataColIndex)}
          />
        );
      }
      if (
        columnHeadings.some((h, i) => h && visibleColumns?.indexOf(i) === -1)
      ) {
        items.push(<MenuDivider key="divider.2" />);
      }
      columnHeadings.forEach((heading, i) => {
        if (heading && visibleColumns?.indexOf(i) === -1) {
          items.push(
            <MenuItem
              key={['add', heading].join('.')}
              icon="plus"
              text={heading}
              onClick={() => columnHide(i, this.dataColIndex)}
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
  visibleColumns: undefined,
  sortRowsByDataColumn: undefined,
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
};

const propTypes = {
  ...xulPropTypes,
  data: PropTypes.arrayOf(PropTypes.array).isRequired,
  columnHeadings: PropTypes.arrayOf(PropTypes.string).isRequired,
  columnWidths: PropTypes.arrayOf(PropTypes.number),
  visibleColumns: PropTypes.arrayOf(PropTypes.number),
  initialRowSort: PropTypes.shape({
    dataColumnIndex: PropTypes.number,
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
  columnWidths?: number[];
  visibleColumns?: number[];
  initialRowSort?: TinitialRowSort;
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

  tableRef: React.RefObject<HTMLDivElement>;

  sState: (s: Partial<TableState> | ((prevState: TableState) => void)) => void;

  constructor(props: TableProps) {
    super(props);
    const { columnHeadings, initialRowSort, visibleColumns } = props;

    // Create new columns, one for each heading.
    const columns = [];
    for (let c = 0; c < columnHeadings.length; c += 1) {
      columns.push(new TextSortableColumn(columnHeadings[c] || '', c));
    }
    const s: TableState = {
      columns,
      sortedIndexMap: [],
      sparseCellData: {},
      sparseCellIntent: {},
    };
    if (initialRowSort) {
      const { column, direction } = initialRowSort;
      const dataCol =
        visibleColumns && column in visibleColumns
          ? visibleColumns[column]
          : column;
      const columnObj = columns[dataCol];
      if (columnObj !== undefined) {
        this.sortColumn(
          column,
          direction,
          direction === 'ascending'
            ? (a, b) => TextSortableColumn.compare(a, b)
            : (a, b) => TextSortableColumn.compare(b, a),
          s
        );
      }
    }
    this.state = s;

    this.tableRef = React.createRef();

    this.sState = this.setState.bind(this);
    this.getCellData = this.getCellData.bind(this);
    this.sortColumn = this.sortColumn.bind(this);
    this.columnHide = this.columnHide.bind(this);
    this.cellValidator = this.cellValidator.bind(this);
    this.cellSetter = this.cellSetter.bind(this);
    this.setSparseState = this.setSparseState.bind(this);
    this.onCellClick = this.onCellClick.bind(this);
  }

  componentDidMount() {
    const { domref, id } = this.props as TableProps;
    // Scroll table to previously saved position.
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

  getCellData(tableRowIndex: number, column: number): TCellLookupResult {
    const props = this.props as TableProps;
    const { data, visibleColumns } = props;
    const row = this.mapTableRow(tableRowIndex);
    const dataCol = (visibleColumns && visibleColumns[column]) ?? column;
    const datarow = data[row.dataRowIndex];
    let value = datarow[dataCol];
    if (typeof value === 'function') {
      value = value(row.dataRowIndex, dataCol);
    }
    const info = datarow[datarow.length - 1] as TCellInfo;
    return { value, info, row, dataCol };
  }

  cellSetter(tableRowindex: number, column: number) {
    const dataKey = Table.dataKey(tableRowindex, column);
    const { onEditableCellChanged } = this.props as TableProps;
    return (value: string) => {
      const intent = this.isValid(value) ? null : Intent.DANGER;
      this.setSparseState('sparseCellData', dataKey, value);
      this.setSparseState('sparseCellIntent', dataKey, intent);
      if (!intent && typeof onEditableCellChanged === 'function')
        onEditableCellChanged(
          {
            ...this.mapTableRow(tableRowindex),
            column,
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

  // Unlike column order, which is solely determined by the visibleColumns
  // prop, row order is part of the table state as sortedIndexMap. When
  // a column is sorted, the new mapping is reported via onRowsReordered
  // so that ancestor elements may have the new order.
  sortColumn(
    tableColumnIndex: number,
    direction: 'ascending' | 'descending',
    comparator: (a: any, b: any) => number,
    s?: Pick<TableState, 'sortedIndexMap'>
  ) {
    const state = this.state as TableState;
    const sim = state?.sortedIndexMap || [];
    const { data, visibleColumns, onRowsReordered } = this.props as TableProps;
    const dataCol =
      visibleColumns && tableColumnIndex in visibleColumns
        ? visibleColumns[tableColumnIndex]
        : tableColumnIndex;
    const sortedIndexMap = Utils.times(data.length, (i: number) => i);
    sortedIndexMap.sort((a: number, b: number) => {
      return comparator(data[a][dataCol], data[b][dataCol]);
    });
    if (
      sim.length !== sortedIndexMap.length ||
      sim.some((sm, i) => sm !== sortedIndexMap[i])
    ) {
      if (s) s.sortedIndexMap = sortedIndexMap;
      else {
        this.sState({ sortedIndexMap });
      }
      if (onRowsReordered) {
        onRowsReordered(tableColumnIndex, direction, sortedIndexMap);
      }
    }
  }

  // Like column order, column hiding is entirely controlled by the
  // visibleColumns prop. So onColumnHide is responsible for updating
  // the columnWidths prop to effect the change to the table.
  columnHide(toggleColumnInstance: number, targetColumnInstance: number) {
    const { visibleColumns, onColumnHide } = this.props as TableProps;
    const toggleDataCol = toggleColumnInstance;
    const targetDataCol = targetColumnInstance;
    if (onColumnHide) {
      const targetColumn =
        visibleColumns?.indexOf(targetDataCol) ?? targetDataCol;
      onColumnHide(toggleDataCol, targetColumn);
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
        const column = colt ? Number(colt[1]) : -1;
        onCellClick(e as React.MouseEvent, {
          ...this.mapTableRow(tableRowIndex),
          column,
        });
      }
    }
    e.stopPropagation();
  }

  render() {
    const state = this.state as TableState;
    const props = this.props as TableProps;
    const { columns } = state;
    const {
      data,
      columnHeadings,
      visibleColumns,
      columnWidths,
      selectedRegions,
      selectionModes,
      enableMultipleSelection,
      enableColumnReordering,
      onColumnsReordered,
      onColumnWidthChanged,
    } = props;
    const { onCellClick } = this;
    let { tableRef } = this;
    const numRows = data.length;
    // Column order and visiblity are wholly determined by the visibleColumns
    // prop. If the user reorders or hides a column, the action is reported via
    // onColumnsReordered and onColumnHide, and the visibleColumns prop must be
    // updated to effect the actual change.
    const tableVisibleColumns =
      visibleColumns || columnHeadings.map((_h, i) => i);
    const tableColumns = tableVisibleColumns.map((cii) =>
      columns[cii].getColumn(
        this.getCellData,
        this.sortColumn,
        this.columnHide,
        this.cellValidator,
        this.cellSetter,
        props,
        state
      )
    );
    let tableColumnWidths: number[] | undefined;
    if (columnWidths) {
      tableColumnWidths = tableVisibleColumns.map((cii) => columnWidths[cii]);
    }

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
          columnWidths={tableColumnWidths}
          selectedRegions={selectedRegions}
          selectionModes={selectionModes}
          enableMultipleSelection={enableMultipleSelection}
          enableColumnReordering={enableColumnReordering}
          enableRowHeader={false}
          enableFocusedCell={false}
          onColumnsReordered={onColumnsReordered}
          onColumnWidthChanged={onColumnWidthChanged}
        >
          {tableColumns}
        </BPTable>
      </Box>
    );
  }
}
Table.defaultProps = defaultProps;
Table.propTypes = propTypes;
Table.scrollTop = {};

export default Table;
