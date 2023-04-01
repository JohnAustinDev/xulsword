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
import {
  Icon,
  IconName,
  Intent,
  Menu,
  MenuDivider,
  MenuItem,
} from '@blueprintjs/core';
import {
  Cell,
  Column,
  ColumnHeaderCell2,
  EditableCell2,
  Region,
  RegionCardinality,
  SelectionModes,
  Table2 as BPTable,
  Utils,
} from '@blueprintjs/table';
import {
  addClass,
  xulDefaultProps,
  XulProps,
  xulPropTypes,
  topHandle,
} from './xul';
import '@blueprintjs/popover2/lib/css/blueprint-popover2.css';
import '@blueprintjs/table/lib/css/table.css';
import './table.css';

import { Box } from './boxes';
import { clone, ofClass } from 'common';

export type TablePropColumn = {
  datacolumn: number;
  heading: string;
  hideable: boolean; // will column be in hide/show menu?
  sortable: boolean; // will column have sort menu?
  width?: number;
  visible?: boolean; // default true
};

export type TinitialRowSort = {
  propColumnIndex: number;
  direction: 'ascending' | 'descending';
};

export type TonRowsReordered = (
  propColumnIndex: number,
  direction: 'ascending' | 'descending',
  tableToDataRowMap: number[]
) => void;

export type TonCellClick = (e: React.MouseEvent, cell: TCellLocation) => void;

export type TonEditableCellChanged = (
  cell: TCellLocation,
  value: string
) => void;

export type TRowLocation = {
  dataRowIndex: number;
  tableRowIndex: number;
};

export type TColLocation = {
  dataColIndex: number;
  tableColIndex: number;
};

export type TCellLocation = TRowLocation & TColLocation;

export type TData = TDataRow[];

export type TDataRow = [...unknown[], TCellInfo];

export type TCellInfo = {
  loading?: boolean | ((dataRowIndex: number, dataColIndex: number) => boolean);
  editable?:
    | boolean
    | ((dataRowIndex: number, dataColIndex: number) => boolean);
  intent?: Intent | ((dataRowIndex: number, dataColIndex: number) => Intent);
  classes?:
    | string[]
    | ((dataRowIndex: number, dataColIndex: number) => string[]);
  tooltip?:
    | string
    | ((dataRowIndex: number, dataColIndex: number) => string | undefined);
};

type ColumnHide = (
  togglePropColIndex: number,
  targetPropColIndex: number
) => void;

type TCellValidator = (
  tableRowIndex: number,
  tableColIndex: number
) => (val: string) => void;

type TCellSetter = (
  tableRowIndex: number,
  tableColIndex: number
) => (val: string) => void;

type TCellLookupResult = {
  value: any;
  info: TCellInfo;
  row: TRowLocation;
  dataColIndex: number;
};

type TCellLookup = (
  tableRowIndex: number,
  tableColIndex: number
) => TCellLookupResult;

type TSortCallback = (
  propColumnIndex: number,
  direction: 'ascending' | 'descending',
  comparator: (a: any, b: any) => number
) => void;

interface TSortableColumn {
  getColumn(
    columnHide: ColumnHide,
    getCellData: TCellLookup,
    sortByColumn: TSortCallback,
    cellValidator: TCellValidator,
    cellSetter: TCellSetter,
    props: TableProps,
    state: TableState
  ): JSX.Element;
}

abstract class AbstractSortableColumn implements TSortableColumn {
  constructor(protected name: string, protected dataColIndex: number) {}

  public getColumn(
    columnHide: ColumnHide,
    getCellData: TCellLookup,
    sortByColumn: TSortCallback,
    cellValidator: TCellValidator,
    cellSetter: TCellSetter,
    props: TableProps,
    state: TableState
  ) {
    const cellRenderer = (tableRowIndex: number, tableColIndex: number) => {
      const cellData = getCellData(tableRowIndex, tableColIndex);
      let { value } = cellData;
      const { info, row, dataColIndex } = cellData;
      let { editable, loading, intent, classes, tooltip } = info;
      if (typeof editable === 'function') {
        editable = editable(row.dataRowIndex, dataColIndex);
      }
      if (typeof loading === 'function') {
        loading = loading(row.dataRowIndex, dataColIndex);
      }
      if (typeof intent === 'function') {
        intent = intent(row.dataRowIndex, dataColIndex);
      }
      if (typeof tooltip === 'function') {
        tooltip = tooltip(row.dataRowIndex, dataColIndex);
      }
      if (typeof classes === 'function') {
        classes = classes(row.dataRowIndex, dataColIndex);
      }
      if (!classes) classes = [];
      classes.push(`data-row-${row.dataRowIndex} data-col-${dataColIndex}`);

      if (editable) {
        const dataKey = Table.dataKey(tableRowIndex, tableColIndex);
        value =
          dataKey in state.sparseCellData
            ? state.sparseCellData[dataKey] || ''
            : value || '';
      }

      let tooltipStr = tooltip as string;
      if (tooltipStr === 'VALUE') {
        if (typeof value === 'string') tooltipStr = value;
        else if (typeof value === 'object' && 'toString' in value) {
          tooltipStr = value.toString();
        }
      }

      if (editable) {
        const dataKey = Table.dataKey(tableRowIndex, tableColIndex);
        return (
          <EditableCell2
            className={classes?.join(' ')}
            value={value}
            intent={state.sparseCellIntent[dataKey] || intent || 'none'}
            truncated
            loading={loading}
            tooltip={tooltipStr}
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
          tooltip={tooltipStr}
          loading={loading}
        >
          {value}
        </Cell>
      );
    };
    const menuRenderer = this.renderMenu.bind(
      this,
      columnHide,
      sortByColumn,
      props
    );
    const columnHeaderCellRenderer = () => (
      <ColumnHeaderCell2
        className={[
          `data-col-${this.dataColIndex}`,
          this.name ? '' : 'no-name',
          this.name?.startsWith('icon:') ? 'header-icon' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        name={(this.name?.startsWith('icon:') ? '' : this.name) || ''}
        menuRenderer={menuRenderer}
      >
        {this.name.startsWith('icon:') && (
          <Icon icon={this.name.substring(5) as any} size={20} intent="none" />
        )}
      </ColumnHeaderCell2>
    );
    return (
      <Column
        key={this.dataColIndex}
        cellRenderer={cellRenderer}
        columnHeaderCellRenderer={columnHeaderCellRenderer}
        name={this.name}
      />
    );
  }

  protected abstract renderMenu(
    columnHide: ColumnHide,
    sortByColumn: TSortCallback,
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
    columnHide: ColumnHide,
    sortByColumn: TSortCallback,
    props: TableProps
  ) {
    const { onColumnHide, columns } = props;
    const propColumnIndex = columns.findIndex(
      (c) => c.datacolumn === this.dataColIndex
    );
    const column = columns[propColumnIndex];
    const sortAsc = () => {
      sortByColumn(propColumnIndex, 'ascending', (a, b) =>
        TextSortableColumn.compare(a, b)
      );
    };
    const sortDesc = () => {
      sortByColumn(propColumnIndex, 'descending', (a, b) =>
        TextSortableColumn.compare(b, a)
      );
    };
    const items: JSX.Element[] = [];
    if (column.sortable) {
      items.push(
        <MenuItem
          key={['sort-asc', this.dataColIndex].join('.')}
          icon="sort-asc"
          onClick={sortAsc}
        />
      );
      items.push(
        <MenuItem
          key={['sort-desc', this.dataColIndex].join('.')}
          icon="sort-desc"
          onClick={sortDesc}
        />
      );
    }
    if (onColumnHide) {
      if (column.hideable && columns.filter((c) => c.visible).length > 1) {
        let { heading } = column;
        if (heading.startsWith('icon:')) heading = '';
        items.push(<MenuDivider key="divider.1" />);
        items.push(
          <MenuItem
            key={['delete', this.dataColIndex].join('.')}
            icon="delete"
            text={heading}
            onClick={() => columnHide(propColumnIndex, propColumnIndex)}
          />
        );
      }
      if (columns.some((c) => c.hideable && !c.visible)) {
        items.push(<MenuDivider key="divider.2" />);
      }
      columns.forEach((c) => {
        const { datacolumn, hideable, visible, heading } = c;
        if (hideable && !visible) {
          const dcol = columns.findIndex((x) => x.datacolumn === datacolumn);
          const icon = (
            heading.startsWith('icon:') ? heading.substring(5) : 'plus'
          ) as IconName;
          const text = heading.startsWith('icon:') ? '' : heading;
          items.push(
            <MenuItem
              key={['add', heading].join('.')}
              icon={icon}
              text={text}
              onClick={() => columnHide(dcol, propColumnIndex)}
            />
          );
        }
        return null;
      });
    }
    return items.length ? <Menu>{items}</Menu> : <></>;
  }
}

const defaultProps = {
  ...xulDefaultProps,
  sortRowsByDataColumn: undefined,
  selectedRegions: undefined,
  selectionModes: SelectionModes.ROWS_ONLY,
  enableMultipleSelection: false,
  enableColumnReordering: false,

  onCellClick: undefined,
  onEditableCellChanged: undefined,
  onRowsReordered: undefined,
  onColumnsReordered: undefined,
  onColumnWidthChanged: undefined,
  onColumnHide: undefined,

  tableCompRef: undefined,
};

const propTypes = {
  ...xulPropTypes,
  data: PropTypes.arrayOf(PropTypes.array).isRequired,
  columns: PropTypes.arrayOf(PropTypes.object).isRequired,
  initialRowSort: PropTypes.shape({
    dataColumnIndex: PropTypes.number,
    direction: PropTypes.oneOf(['ascending', 'descending']),
  }),
  selectedRegions: PropTypes.array,
  selectionModes: PropTypes.any,
  enableMultipleSelection: PropTypes.bool,
  enableColumnReordering: PropTypes.bool,

  onCellClick: PropTypes.func,
  onEditableCellChanged: PropTypes.func,
  onRowsReordered: PropTypes.func,
  onColumnsReordered: PropTypes.func,
  onColumnWidthChanged: PropTypes.func,
  onColumnHide: PropTypes.func,

  tableCompRef: PropTypes.object,
};

export type TableProps = XulProps & {
  data: TData;
  columns: TablePropColumn[];
  initialRowSort?: TinitialRowSort;
  selectedRegions?: Region[];
  selectionModes?: RegionCardinality[];
  enableMultipleSelection?: boolean;
  enableColumnReordering?: boolean;

  onCellClick?: TonCellClick;
  onEditableCellChanged?: TonEditableCellChanged;
  onRowsReordered?: TonRowsReordered;
  onColumnsReordered?: (propColumns: TablePropColumn[]) => void;
  onColumnWidthChanged?: (propColumns: TablePropColumn[]) => void;
  onColumnHide?: (propColumns: TablePropColumn[]) => void;

  tableCompRef: React.LegacyRef<BPTable> | undefined;
};

type TableState = {
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

  datacolumns: TextSortableColumn[];

  tableDomRef: React.RefObject<HTMLDivElement>;

  sState: (s: Partial<TableState> | ((prevState: TableState) => void)) => void;

  constructor(props: TableProps) {
    super(props);
    const { columns, initialRowSort } = props;

    const s: TableState = {
      sortedIndexMap: [],
      sparseCellData: {},
      sparseCellIntent: {},
    };
    // Create data columns, one for each data column.
    this.datacolumns = [];
    columns.forEach((c) => {
      const { heading, datacolumn } = c;
      this.datacolumns[datacolumn] = new TextSortableColumn(
        heading || '',
        datacolumn
      );
    });
    if (initialRowSort) {
      const { propColumnIndex: column, direction } = initialRowSort;
      this.sortByColumn(
        column,
        direction,
        direction === 'ascending'
          ? (a, b) => TextSortableColumn.compare(a, b)
          : (a, b) => TextSortableColumn.compare(b, a),
        s
      );
    }
    this.state = s;

    this.tableDomRef = React.createRef();

    this.sState = this.setState.bind(this);
    this.resizeColumns = this.resizeColumns.bind(this);
    this.columnHide = this.columnHide.bind(this);
    this.getCellData = this.getCellData.bind(this);
    this.sortByColumn = this.sortByColumn.bind(this);
    this.cellValidator = this.cellValidator.bind(this);
    this.cellSetter = this.cellSetter.bind(this);
    this.setSparseState = this.setSparseState.bind(this);
    this.onCellClick = this.onCellClick.bind(this);
    this.onColumnsReordered = this.onColumnsReordered.bind(this);
    this.onColumnWidthChanged = this.onColumnWidthChanged.bind(this);
  }

  componentDidMount() {
    const { domref, id } = this.props as TableProps;
    const { resizeColumns } = this;
    // Scroll table to previously saved position.
    const tableRef = domref || this.tableDomRef;
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
      resizeColumns();
    }
  }

  componentWillUnmount() {
    const { id, domref } = this.props as TableProps;
    // Save scroll position.
    const tableRef = domref || this.tableDomRef;
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
    const { data } = this.props as TableProps;
    const { sortedIndexMap } = this.state as TableState;
    const ret: TRowLocation = { dataRowIndex: tableRowIndex, tableRowIndex };
    if (sortedIndexMap.length && sortedIndexMap.length === data.length)
      ret.dataRowIndex = sortedIndexMap[tableRowIndex];
    return ret;
  }

  getCellData(tableRowIndex: number, tableColIndex: number): TCellLookupResult {
    const props = this.props as TableProps;
    const { data, columns } = props;
    const row = this.mapTableRow(tableRowIndex);
    const datarow = data[row.dataRowIndex];
    const propCol = columns.filter((c) => c.visible)[tableColIndex];
    const dataCol = propCol.datacolumn;
    let value = datarow[dataCol];
    if (typeof value === 'function') {
      value = value(row.dataRowIndex, dataCol);
    }
    const info = datarow[datarow.length - 1] as TCellInfo;
    return { value, info, row, dataColIndex: dataCol };
  }

  cellSetter(tableRowIndex: number, tableColIndex: number) {
    const dataKey = Table.dataKey(tableRowIndex, tableColIndex);
    const { onEditableCellChanged } = this.props as TableProps;
    return (value: string) => {
      const props = this.props as TableProps;
      const { columns } = props;
      const intent = this.isValid(value) ? null : Intent.DANGER;
      this.setSparseState('sparseCellData', dataKey, value);
      this.setSparseState('sparseCellIntent', dataKey, intent);
      const propColumn = columns.filter((c) => c.visible)[tableColIndex];
      if (!intent && typeof onEditableCellChanged === 'function')
        onEditableCellChanged(
          {
            ...this.mapTableRow(tableRowIndex),
            tableColIndex,
            dataColIndex: propColumn.datacolumn,
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

  resizeColumns(columnsx?: TablePropColumn[]): TablePropColumn[] {
    const props = this.props as TableProps;
    const { domref, onColumnWidthChanged } = props;
    const columns = clone(columnsx ?? props.columns);
    const { tableDomRef } = this;
    const tableRef = domref || tableDomRef;
    let w1 = 0;
    if (columns && tableRef.current) {
      columns.forEach((c) => {
        c.width = c.width || 50;
      });
      w1 = columns.reduce((p, c) => p + ((c.visible && c.width) || 0), 0);
      const w2 = tableRef.current.clientWidth;
      columns.forEach((c) => {
        (c.width as number) *= w2 / w1;
      });
    }
    const w3 = columns.reduce((p, c) => p + ((c.visible && c.width) || 0), 0);
    if (w1 && Math.abs(w3 - w1) > 5 && !columnsx && onColumnWidthChanged) {
      onColumnWidthChanged(columns);
    }
    return columns;
  }

  columnHide(togglePropColIndex: number, targetPropColIndex: number) {
    const props = this.props as TableProps;
    const { columns, enableColumnReordering, onColumnHide } = props;
    const { resizeColumns } = this;
    let newcolumns = clone(columns);
    const toggle = newcolumns[togglePropColIndex];
    const target = newcolumns[targetPropColIndex];
    if (toggle && toggle.hideable) {
      toggle.visible = !toggle.visible;
      if (newcolumns.filter((c) => c.visible).length > 0) {
        if (enableColumnReordering && toggle.visible && target) {
          const itogg = newcolumns.findIndex(
            (c) => c.datacolumn === toggle.datacolumn
          );
          const togg = newcolumns.splice(itogg, 1);
          const itarg = newcolumns.findIndex(
            (c) => c.datacolumn === target.datacolumn
          );
          newcolumns.splice(itarg + 1, 0, togg[0]);
        }
        newcolumns = resizeColumns(newcolumns);
        if (onColumnHide) onColumnHide(newcolumns);
      }
    }
  }

  onColumnsReordered(oldIndex: number, newIndex: number, length: number) {
    const props = this.props as TableProps;
    const { onColumnsReordered } = props;
    const { resizeColumns } = this;
    const { columns } = props;
    if (onColumnsReordered && oldIndex !== newIndex) {
      const tableColumns =
        Utils.reorderArray(
          columns.filter((c) => c.visible),
          oldIndex,
          newIndex,
          length
        ) || [];
      const newcolumns = resizeColumns(
        tableColumns.concat(columns.filter((c) => !c.visible))
      );
      onColumnsReordered(newcolumns);
    }
  }

  onColumnWidthChanged(tableColumnIndex: number, size: number): void {
    const props = this.props as TableProps;
    const { onColumnWidthChanged } = props;
    const { resizeColumns } = this;
    let { columns } = props;
    if (onColumnWidthChanged) {
      columns = clone(columns);
      const visible = columns.filter((c) => c.visible);
      const nextcol = visible[tableColumnIndex + 1];
      if (nextcol && nextcol.width) {
        const orig = visible[tableColumnIndex].width || 0;
        nextcol.width = Math.round(nextcol.width - size + orig);
        if (nextcol.width < 20) nextcol.width = 20;
      }
      visible[tableColumnIndex].width = Math.round(size);
      columns = resizeColumns(columns);
      onColumnWidthChanged(columns);
    }
  }

  // Unlike column order, which is solely determined by the columns
  // prop, row order is part of the table state as sortedIndexMap. When
  // rows are sorted, the new mapping is reported via onRowsReordered
  // so that ancestor elements may have the new order.
  sortByColumn(
    propColumnIndex: number,
    direction: 'ascending' | 'descending',
    comparator: (a: any, b: any) => number,
    s?: Pick<TableState, 'sortedIndexMap'>
  ) {
    const state = this.state as TableState;
    const sim = state?.sortedIndexMap || [];
    const { data, columns, onRowsReordered } = this.props as TableProps;
    const dataCol = columns[propColumnIndex].datacolumn;
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
        onRowsReordered(propColumnIndex, direction, sortedIndexMap);
      }
    }
  }

  onCellClick(e: React.SyntheticEvent) {
    const props = this.props as TableProps;
    const { columns, onCellClick } = props;
    if (onCellClick) {
      const cell = ofClass(['bp4-table-cell'], e.target);
      if (cell) {
        const rowt = cell.element.className.match(/bp4-table-cell-row-(\d+)\b/);
        const tableRowIndex = rowt ? Number(rowt[1]) : -1;
        const colt = cell.element.className.match(/bp4-table-cell-col-(\d+)\b/);
        const tableColIndex = colt ? Number(colt[1]) : -1;
        const propColumn = columns.filter((c) => c.visible)[tableColIndex];
        onCellClick(e as React.MouseEvent, {
          ...this.mapTableRow(tableRowIndex),
          tableColIndex,
          dataColIndex: propColumn.datacolumn,
        });
      }
    }
    e.stopPropagation();
  }

  render() {
    const state = this.state as TableState;
    const props = this.props as TableProps;
    const {
      data,
      columns,
      selectedRegions,
      selectionModes,
      enableMultipleSelection,
      enableColumnReordering,
      tableCompRef,
    } = props;
    const {
      datacolumns,
      onCellClick,
      onColumnsReordered,
      onColumnWidthChanged,
    } = this;
    let { tableDomRef } = this;
    const numRows = data.length;
    // Column order and visiblity are wholly determined by the columns prop.
    // If the user reorders or hides a column, only the action is reported via
    // onColumnsReordered and onColumnHide, and then the columns prop must be
    // updated to effect the actual change.
    const tableColumns = columns
      .filter((c) => c.visible)
      .map((c) =>
        datacolumns[c.datacolumn].getColumn(
          this.columnHide,
          this.getCellData,
          this.sortByColumn,
          this.cellValidator,
          this.cellSetter,
          props,
          state
        )
      );
    const tableColumnWidths = columns
      .filter((c) => c.visible)
      .map((c) => c.width);

    const classes = ['table'];
    if (props.onColumnWidthChanged) classes.push('width-resizable');

    // If parent uses a domref, don't clobber it, use it.
    if (props.domref) tableDomRef = props.domref;

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
    // - RTL direction tables become completely broken. So direction must be set to
    // 'ltr' or tables will become broken with RTL locales. However, for xulsword,
    // most table data is still LTR even when the locale is not, so forcing all
    // tables to LTR has so far been an acceptable solution.
    return (
      <Box
        {...topHandle('onClick', onCellClick)}
        domref={tableDomRef}
        {...addClass(classes, props)}
        dir="ltr"
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
          ref={tableCompRef}
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
