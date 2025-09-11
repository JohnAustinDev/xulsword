import React, { ReactElement } from 'react';
import { component } from '../../common.ts';
import { htmlAttribs } from './xul.tsx';
import './grid.css';

import type { XulProps } from './xul.tsx';

// XUL grid
export default function Grid(props: XulProps) {
  function gridCells(
    parent: any,
    parentIndex: number,
    count: { Row: number; Column: number },
    cells: ReactElement[],
    template: { Row: string[]; Column: string[] },
  ): boolean {
    let success = false;
    const parentComp = component(parent);
    if (parentComp) {
      const rtype = parentComp.displayName;
      if (rtype === 'Row' || rtype === 'Column') {
        const ctype = rtype === 'Row' ? 'Column' : 'Row';
        let dim = 'auto';
        const { flex, width, height, span: sp, children } = parentComp.props;
        const span = sp || 1;
        if (flex) dim = `${flex.replace(/\D/, '')}fr`;
        let x = '';
        if (rtype === 'Column' && width) x = width;
        if (rtype === 'Row' && height) x = height;
        if (x) dim = /^\d+$/.test(x) ? x.concat('px') : x;
        template[rtype].push(dim);
        let cellcount = 0;
        React.Children.forEach(children, (cell) => {
          if (component(cell)) cellcount += 1;
        });
        let i = -1;
        React.Children.forEach(children, (cell) => {
          if (component(cell)) {
            i += 1;
            let myspan = span;
            if (i === cellcount - 1 && span === 1)
              myspan = count[ctype] - cellcount + 1;
            const rc = parentIndex + 1;
            const cr = i + 1;
            const rcspan = 1;
            const crspan = myspan;
            cells.push(
              <div
                key={[rtype, rc, cr].join('.')}
                className={`grid-cell grid-${rtype.toLowerCase()}-cell`}
                style={{
                  gridArea:
                    rtype === 'Row'
                      ? `${rc} / ${cr} / ${rc + rcspan} / ${cr + crspan}`
                      : `${cr} / ${rc} / ${cr + crspan} / ${rc + rcspan}`,
                }}
              >
                {cell}
              </div>,
            );
            success = true;
          }
        });
      }
    }
    return success;
  }

  const count = { Column: 0, Row: 0 };
  React.Children.forEach(props.children, (gparent) => {
    const c = component(gparent);
    if (c) {
      const name = c.displayName;
      if (name === 'Columns' || name === 'Rows') {
        React.Children.forEach(c.props.children, (cellparent) => {
          const cc = component(cellparent);
          if (cc) count[name === 'Rows' ? 'Row' : 'Column'] += 1;
        });
      }
    }
  });

  const gridcells: ReactElement[] = [];
  const gridtemplate = { Row: [], Column: [] };
  const i = { Columns: 0, Rows: 0 };
  React.Children.forEach(props.children, (gparent) => {
    const c = component(gparent);
    if (c) {
      const name = c.displayName;
      if (name === 'Columns' || name === 'Rows') {
        React.Children.forEach(c.props.children, (cellparent) => {
          if (gridCells(cellparent, i[name], count, gridcells, gridtemplate)) {
            i[name] += 1;
          }
        });
      }
    }
  });

  const gridProps = {
    ...props,
    style: {
      display: 'grid',
      gridTemplateColumns: gridtemplate.Column.join(' '),
      gridTemplateRows: gridtemplate.Row.join(' '),
    },
  };

  return <div {...htmlAttribs('grid', gridProps)}>{gridcells}</div>;
}

// XUL columns
function Columns(props: { children: any }) {
  return <>{props.children}</>;
}
Columns.displayName = 'Columns';

// XUL rows
function Rows(props: { children: any }) {
  return <>{props.children}</>;
}
Rows.displayName = 'Rows';

type RowColProps = {
  flex?: string;
  span?: number;
  children?: React.ReactNode | React.ReactNode[];
};

// XUL column
type ColumnProps = RowColProps & {
  width?:
    | string
    | 'auto'
    | 'max-content'
    | 'min-content'
    | 'minmax(<min>, <max>)';
};
function Column({ span = 1, width = 'auto', ...props }: ColumnProps) {
  return <>{props.children}</>;
}
Column.displayName = 'Column';

// XUL row
type RowProps = RowColProps & {
  height?:
    | string
    | 'auto'
    | 'max-content'
    | 'min-content'
    | 'minmax(<min>, <max>)';
};
function Row({ span = 1, height = 'auto', ...props }: RowProps) {
  return <>{props.children}</>;
}
Row.displayName = 'Row';

export { Columns, Column, Rows, Row };
