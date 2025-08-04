import React from 'react';
import PropTypes from 'prop-types';
import { Icon, Intent, Menu, MenuDivider, MenuItem } from '@blueprintjs/core';
import {
  Cell,
  Column,
  ColumnHeaderCell,
  EditableCell2,
  Table2 as BPTable,
  Utils,
  SelectionModes,
} from '@blueprintjs/table';
import { clone, localizeString, ofClass } from '../../../common.ts';
import { G } from '../../G.ts';
import { addClass, xulPropTypes, topHandle } from './xul.tsx';
import { Box } from './boxes.tsx';
import '@blueprintjs/table/lib/css/table.css';
import './table.css';

import type { IconName } from '@blueprintjs/core';
import type { Region, CellRenderer } from '@blueprintjs/table';
import type { XulProps } from './xul.tsx';

// This table is a controlled React component with no state of its own.
// Handlers are required for updating external state when table events occur.
// Table updates are not shown to the user until the table's key prop is
// updated or one of the cellRendererDependencies changes. The table's data
// dimensions must be included in the key value, or runtime errors will result
// when the data dimensions change. Some table features become enabled when the
// related event handler prop is set (ie. onColumnsReordered
// onColumnWidthChanged).

type TableState = Record<string, never>;

const propTypes = {
  ...xulPropTypes,
  data: PropTypes.arrayOf(PropTypes.array).isRequired,
  tableColumns: PropTypes.arrayOf(PropTypes.object).isRequired,
  tableToDataRowMap: PropTypes.array.isRequired,
  rowSort: PropTypes.object,
  selectedRegions: PropTypes.array,
  cellRendererDependencies: PropTypes.array,

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
  tableColumns: TableColumnInfo[];
  tableToDataRowMap: number[];
  rowSort?: TableRowSortState;
  selectedRegions?: Region[];
  cellRendererDependencies?: React.DependencyList[];

  onCellClick?: (
    dataRowIndex: number,
    dataColIndex: number,
    e: React.MouseEvent,
  ) => void;
  onEditableCellChanged?: (
    dataRowIndex: number,
    dataColIndex: number,
    value: string,
  ) => void;
  onRowsReordered?: (
    direction: 'ascending' | 'descending',
    dataColIndex: number,
    e: React.MouseEvent,
  ) => void;
  onColumnsReordered?: (tableColumns: TableColumnInfo[]) => void;
  onColumnWidthChanged?: (tableColumns: TableColumnInfo[]) => void;
  onColumnHide?: (tableColumns: TableColumnInfo[]) => void;

  tableCompRef?: React.LegacyRef<BPTable>;
};

export type TableColumnInfo = {
  datacolumn: number;
  heading: string;
  hideable: boolean; // will column be in hide/show menu?
  sortable: boolean; // will column have sort menu?
  width?: number;
  visible?: boolean; // default true
};

export type TableRowSortState = {
  direction: 'ascending' | 'descending';
  propColumnIndex: number;
};

export type TData = TDataRow[];

export type TDataRow = [...unknown[], TCellInfo];

export type TCellInfo = {
  loading?:
    | boolean
    | ((dataRowIndex: number, dataColIndex: number, data: TData) => boolean);
  editable?:
    | boolean
    | ((dataRowIndex: number, dataColIndex: number, data: TData) => boolean);
  intent?:
    | Intent
    | ((dataRowIndex: number, dataColIndex: number, data: TData) => Intent);
  classes?:
    | string[]
    | ((dataRowIndex: number, dataColIndex: number, data: TData) => string[]);
  tooltip?:
    | string
    | ((
        dataRowIndex: number,
        dataColIndex: number,
        data: TData,
      ) => string | undefined);
};

type TCellLookupResult = {
  value: any;
  info: TCellInfo;
  dataRowIndex: number;
  dataColIndex: number;
};

function bpColumn(
  heading: string,
  dataColIndex: number,
  cellRenderer: CellRenderer,
  menuRenderer?: ((index?: number) => React.JSX.Element) | undefined,
) {
  let showHeading = heading;
  if (showHeading.startsWith('icon:')) showHeading = '';
  else showHeading = localizeString(G, showHeading);
  const columnHeaderCellRenderer = () => (
    <ColumnHeaderCell
      className={[
        `data-col-${dataColIndex}`,
        heading ? '' : 'no-name',
        heading.startsWith('icon:') ? 'header-icon' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      name={showHeading}
      menuRenderer={menuRenderer}
    >
      {heading.startsWith('icon:') && (
        <Icon icon={heading.substring(5) as any} size={20} intent="none" />
      )}
    </ColumnHeaderCell>
  );

  return (
    <Column
      key={dataColIndex}
      cellRenderer={cellRenderer}
      columnHeaderCellRenderer={columnHeaderCellRenderer}
      name={heading}
    />
  );
}

class Table extends React.Component {
  static propTypes: typeof propTypes;

  static scrollTop: Record<string, number>;

  tableDomRef: React.RefObject<HTMLDivElement>;

  constructor(props: TableProps) {
    super(props);

    this.state = {} as TableState;

    this.tableDomRef = React.createRef();

    this.cellRenderer = this.cellRenderer.bind(this);
    this.menuRenderer = this.menuRenderer.bind(this);
    this.resizeColumns = this.resizeColumns.bind(this);
    this.columnHide = this.columnHide.bind(this);
    this.getCellData = this.getCellData.bind(this);
    this.cellSetter = this.cellSetter.bind(this);
    this.onCellClick = this.onCellClick.bind(this);
    this.onColumnsReordered = this.onColumnsReordered.bind(this);
    this.onColumnWidthChanged = this.onColumnWidthChanged.bind(this);
  }

  componentDidMount() {
    const { domref, id } = this.props as TableProps;
    const { tableDomRef, resizeColumns } = this;
    // Scroll table to previously saved position.
    const tableRef = domref || tableDomRef;
    const t = tableRef.current;
    if (t) {
      const [parent] = t.getElementsByClassName(
        'bp5-table-quadrant-scroll-container',
      );
      if (parent) {
        let top = 0;
        if (id && id in Table.scrollTop) top = Table.scrollTop[id];
        parent.scrollTop = top;
      }
      resizeColumns();
    }
  }

  componentDidUpdate() {
    // Adjust column widths to table width if difference is more than margin.
    const margin = 5;
    const { tableDomRef, resizeColumns } = this;
    const { tableColumns, domref } = this.props as TableProps;
    const tableRef = domref ?? tableDomRef;
    if (tableRef?.current) {
      const tableWidth = tableRef.current.clientWidth;
      const columnsWidth: number = tableColumns.reduce(
        (p, c) => p + ((c.visible && c.width) || 0),
        0,
      );
      if (tableWidth < columnsWidth - margin) resizeColumns();
      if (tableWidth > columnsWidth + margin) resizeColumns();
    }
  }

  componentWillUnmount() {
    const { id, domref } = this.props as TableProps;
    // Save scroll position.
    const tableRef = domref || this.tableDomRef;
    const t = tableRef.current;
    if (t) {
      const [parent] = t.getElementsByClassName(
        'bp5-table-quadrant-scroll-container',
      );
      if (parent && id) {
        Table.scrollTop[id] = parent.scrollTop;
      }
    }
  }

  menuRenderer(internalColIndex?: number) {
    const items: JSX.Element[][] = [];
    if (typeof internalColIndex !== 'undefined') {
      const props = this.props as TableProps;
      const { tableColumns, onRowsReordered, onColumnHide } = props;
      const { columnHide } = this;
      const tableColumn = tableColumns.filter((tc) => tc.visible)[
        internalColIndex
      ];
      const tableColIndex = tableColumns.indexOf(tableColumn);
      const dataColIndex = tableColumn.datacolumn;
      if (
        onRowsReordered &&
        typeof dataColIndex !== 'undefined' &&
        tableColumn.sortable
      ) {
        items.push([
          <MenuItem
            key={['sort-asc', dataColIndex].join('.')}
            icon="sort-asc"
            onClick={(e: React.MouseEvent) =>
              onRowsReordered('ascending', dataColIndex, e)
            }
            text=""
          />,
          <MenuItem
            key={['sort-desc', dataColIndex].join('.')}
            icon="sort-desc"
            onClick={(e: React.MouseEvent) =>
              onRowsReordered('descending', dataColIndex, e)
            }
            text=""
          />,
        ]);
      }
      if (onColumnHide) {
        if (
          tableColumn.hideable &&
          tableColumns.filter((c) => c.visible).length > 1
        ) {
          let { heading } = tableColumn;
          if (heading.startsWith('icon:')) heading = '';
          else heading = localizeString(G, heading);
          items.push([
            <MenuItem
              key={['delete', dataColIndex].join('.')}
              icon="delete"
              text={heading}
              onClick={() => {
                columnHide(tableColIndex, tableColIndex);
              }}
            />,
          ]);
        }
        const hideableItems: JSX.Element[] = [];
        tableColumns.forEach((c) => {
          const { datacolumn, hideable, visible, heading } = c;
          if (hideable && !visible) {
            const tcol = tableColumns.findIndex(
              (x) => x.datacolumn === datacolumn,
            );
            const icon = (
              heading.startsWith('icon:') ? heading.substring(5) : 'plus'
            ) as IconName;
            let text = heading;
            if (heading.startsWith('icon:')) text = '';
            else text = localizeString(G, heading);
            hideableItems.push(
              <MenuItem
                key={['add', heading].join('.')}
                icon={icon}
                text={text}
                onClick={() => {
                  columnHide(tcol, tableColIndex);
                }}
              />,
            );
          }
          return null;
        });
        if (hideableItems.length) items.push(hideableItems);
        for (let i = items.length - 1; i > 0; i -= 1) {
          items.splice(i, 0, [<MenuDivider key={`divider.${i}`} />]);
        }
      }
    }
    return items.length ? <Menu>{items.flat()}</Menu> : <></>;
  }

  cellRenderer(tableRowIndex: number, internalColIndex: number) {
    const props = this.props as TableProps;
    const { data, tableColumns } = props;
    const { getCellData, cellSetter } = this;
    const tableColumn = tableColumns.filter((tc) => tc.visible)[
      internalColIndex
    ];
    const tableColIndex = tableColumns.indexOf(tableColumn);
    const cellData = getCellData(tableRowIndex, tableColIndex);
    const { value } = cellData;
    const { info, dataRowIndex, dataColIndex } = cellData;
    let { editable, loading, intent, classes, tooltip } = info;
    if (typeof editable === 'function') {
      editable = editable(dataRowIndex, dataColIndex, data);
    }
    if (typeof loading === 'function') {
      loading = loading(dataRowIndex, dataColIndex, data);
    }
    if (typeof intent === 'function') {
      intent = intent(dataRowIndex, dataColIndex, data);
    }
    if (typeof tooltip === 'function') {
      tooltip = tooltip(dataRowIndex, dataColIndex, data);
    }
    if (typeof classes === 'function') {
      classes = classes(dataRowIndex, dataColIndex, data);
    }
    if (!classes) classes = [];
    classes.push(`data-row-${dataRowIndex} data-col-${dataColIndex}`);

    let tooltipStr = tooltip as string;
    if (tooltipStr === 'VALUE') {
      if (typeof value === 'string') tooltipStr = value;
      else if (typeof value === 'object' && 'toString' in value) {
        tooltipStr = value.toString();
      }
    }

    if (editable) {
      return (
        <EditableCell2
          className={classes?.join(' ')}
          value={value}
          intent={intent || 'none'}
          truncated
          loading={loading}
          tooltip={tooltipStr}
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
  }

  getCellData(tableRowIndex: number, tableColIndex: number): TCellLookupResult {
    const props = this.props as TableProps;
    const { data, tableColumns, tableToDataRowMap } = props;
    const dataRowIndex = tableToDataRowMap[tableRowIndex] ?? tableRowIndex;
    const datarow = data[dataRowIndex];
    const tableColumn = tableColumns[tableColIndex];
    const dataColIndex = tableColumn.datacolumn;
    let value = datarow[dataColIndex];
    if (typeof value === 'function') {
      value = value(dataRowIndex, dataColIndex, data);
    }
    const info = datarow[datarow.length - 1] as TCellInfo;
    return { value, info, dataRowIndex, dataColIndex };
  }

  cellSetter(tableRowIndex: number, tableColIndex: number) {
    return (value: string) => {
      const { tableColumns, tableToDataRowMap, onEditableCellChanged } = this
        .props as TableProps;
      const tableColumn = tableColumns[tableColIndex];
      if (onEditableCellChanged)
        onEditableCellChanged(
          tableToDataRowMap[tableRowIndex] ?? tableRowIndex,
          tableColumn.datacolumn,
          value,
        );
    };
  }

  resizeColumns(tableColumnsx?: TableColumnInfo[]): TableColumnInfo[] {
    const props = this.props as TableProps;
    const { domref, onColumnWidthChanged } = props;
    const tableColumns = clone(tableColumnsx ?? props.tableColumns);
    const { tableDomRef } = this;
    const tableRef = domref || tableDomRef;
    let w1 = 0;
    if (tableColumns && tableRef.current) {
      tableColumns.forEach((c) => {
        c.width = c.width || 50;
      });
      w1 = tableColumns.reduce((p, c) => p + ((c.visible && c.width) || 0), 0);
      const w2 = tableRef.current.clientWidth;
      tableColumns.forEach((c) => {
        (c.width as number) *= w2 / w1;
      });
    }
    const w3 = tableColumns.reduce(
      (p, c) => p + ((c.visible && c.width) || 0),
      0,
    );
    if (w1 && Math.abs(w3 - w1) > 5 && !tableColumnsx && onColumnWidthChanged) {
      onColumnWidthChanged(tableColumns);
    }
    return tableColumns;
  }

  columnHide(toggleTableColIndex: number, targetTableColIndex: number) {
    const props = this.props as TableProps;
    const { tableColumns, onColumnsReordered, onColumnHide } = props;
    const { resizeColumns } = this;
    let newTableColumns = clone(tableColumns);
    const toggle = newTableColumns[toggleTableColIndex];
    const target = newTableColumns[targetTableColIndex];
    if (toggle && toggle.hideable) {
      toggle.visible = !toggle.visible;
      if (newTableColumns.filter((c) => c.visible).length > 0) {
        if (onColumnsReordered && toggle.visible && target) {
          const [togRemoved] = newTableColumns.splice(toggleTableColIndex, 1);
          const targTableColIndex = newTableColumns.findIndex(
            (c) => c.datacolumn === target.datacolumn,
          );
          newTableColumns.splice(targTableColIndex + 1, 0, togRemoved);
        }
        newTableColumns = resizeColumns(newTableColumns);
        if (onColumnHide) onColumnHide(newTableColumns);
      }
    }
  }

  onColumnsReordered(
    oldInternalColIndex: number,
    newInternalColIndex: number,
    length: number,
  ) {
    const props = this.props as TableProps;
    const { onColumnsReordered } = props;
    const { resizeColumns } = this;
    const { tableColumns } = props;
    if (onColumnsReordered && oldInternalColIndex !== newInternalColIndex) {
      const internalTableColumns = tableColumns.filter((c) => c.visible);
      const sortedInternalTableColumns =
        Utils.reorderArray(
          internalTableColumns,
          oldInternalColIndex,
          newInternalColIndex,
          length,
        ) || [];
      const newTableColumns = resizeColumns(
        sortedInternalTableColumns.concat(
          tableColumns.filter((c) => !c.visible),
        ),
      );
      onColumnsReordered(newTableColumns);
    }
  }

  onColumnWidthChanged(internalColumnIndex: number, size: number): void {
    const props = this.props as TableProps;
    const { onColumnWidthChanged } = props;
    const { resizeColumns } = this;
    let { tableColumns } = props;
    if (onColumnWidthChanged) {
      tableColumns = clone(tableColumns);
      const visible = tableColumns.filter((c) => c.visible);
      const nextcol = visible[internalColumnIndex + 1];
      if (nextcol?.width) {
        const orig = visible[internalColumnIndex].width || 0;
        nextcol.width = Math.round(nextcol.width - size + orig);
        if (nextcol.width < 20) nextcol.width = 20;
      }
      visible[internalColumnIndex].width = Math.round(size);
      tableColumns = resizeColumns(tableColumns);
      onColumnWidthChanged(tableColumns);
    }
  }

  onCellClick(e: React.SyntheticEvent) {
    const props = this.props as TableProps;
    const { tableColumns, tableToDataRowMap, onCellClick } = props;
    if (onCellClick) {
      const cell = ofClass(['bp5-table-cell'], e.target);
      if (cell) {
        const rowt = cell.element.className.match(/bp5-table-cell-row-(\d+)\b/);
        const tableRowIndex = rowt ? Number(rowt[1]) : -1;
        const colt = cell.element.className.match(/bp5-table-cell-col-(\d+)\b/);
        const internalColIndex = colt ? Number(colt[1]) : -1;
        const tableColumn = tableColumns.filter((c) => c.visible)[
          internalColIndex
        ];
        const dataColIndex = tableColumn.datacolumn;
        onCellClick(
          tableToDataRowMap[tableRowIndex] ?? tableRowIndex,
          dataColIndex,
          e as React.MouseEvent,
        );
      }
    }
    e.stopPropagation();
  }

  render() {
    const props = this.props as TableProps;
    const {
      data,
      tableColumns,
      selectedRegions,
      tableCompRef,
      cellRendererDependencies,
      onColumnsReordered: propOnColumnsReordered,
      onColumnWidthChanged: propOnColumnWidthChanged,
    } = props;
    const {
      tableDomRef,
      onCellClick,
      onColumnsReordered,
      onColumnWidthChanged,
      cellRenderer,
      menuRenderer,
    } = this;

    const bpColumns = tableColumns
      .filter((tc) => tc.visible)
      .map((tc) =>
        bpColumn(tc.heading, tc.datacolumn, cellRenderer, menuRenderer),
      );

    const tableColumnWidths = tableColumns
      .filter((c) => c.visible)
      .map((c) => c.width);

    const classes = ['table'];
    if (props.onColumnWidthChanged) classes.push('width-resizable');

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
          numRows={data.length}
          columnWidths={tableColumnWidths}
          selectedRegions={selectedRegions}
          selectionModes={SelectionModes.ROWS_ONLY}
          enableMultipleSelection={true} // selection is controlled by parent
          enableColumnReordering={!!propOnColumnsReordered}
          enableColumnResizing={!!propOnColumnWidthChanged}
          enableRowHeader={false}
          enableFocusedCell={false}
          cellRendererDependencies={cellRendererDependencies}
          onColumnsReordered={onColumnsReordered}
          onColumnWidthChanged={onColumnWidthChanged}
          ref={tableCompRef}
        >
          {bpColumns}
        </BPTable>
      </Box>
    );
  }
}
Table.propTypes = propTypes;
Table.scrollTop = {};

export default Table;
