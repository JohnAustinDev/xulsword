/* eslint-disable react/no-unused-prop-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import type { ReactElementLike } from 'prop-types';
import { xulDefaultProps, xulPropTypes, XulProps, htmlAttribs } from './xul';
import './xul.css';
import './grid.css';

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

const RowColDefaultProps = {
  flex: undefined,
  span: 1,
  children: undefined,
};
const RowColPropTypes = {
  flex: PropTypes.string,
  span: PropTypes.number,
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.array]),
};
type RowColProps = {
  flex?: string;
  span?: number;
  children?:
    | React.ReactNode
    | React.ReactNode[]
    | PropTypes.ReactElementLike
    | PropTypes.ReactElementLike[];
};

// XUL column
type ColumnProps = RowColProps & {
  width:
    | string
    | 'auto'
    | 'max-content'
    | 'min-content'
    | 'minmax(<min>, <max>)';
};
function Column(props: ColumnProps) {
  return <>{props.children}</>;
}
Column.defaultProps = {
  ...RowColDefaultProps,
  width: 'auto',
};
Column.propTypes = {
  ...RowColPropTypes,
  width: PropTypes.string,
};
Column.displayName = 'Column';

// XUL row
type RowProps = RowColProps & {
  height:
    | string
    | 'auto'
    | 'max-content'
    | 'min-content'
    | 'minmax(<min>, <max>)';
};
function Row(props: RowProps) {
  return <>{props.children}</>;
}
Row.defaultProps = {
  ...RowColDefaultProps,
  height: 'auto',
};
Row.propTypes = {
  ...RowColPropTypes,
  height: PropTypes.string,
};
Row.displayName = 'Row';

export { Columns, Column, Rows, Row };

// XUL grid
const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

function Grid(props: XulProps) {
  function gridCells(
    parent: any,
    parentIndex: number,
    count: { Row: number; Column: number },
    cells: ReactElementLike[],
    template: { Row: string[]; Column: string[] }
  ) {
    const parent2 =
      parent && typeof parent === 'object' && 'type' in parent ? parent : null;
    if (parent2) {
      const parentType: string = parent2.type?.displayName;
      if (parentType === 'Row' || parentType === 'Column') {
        let dim = 'auto';
        const p: RowProps | ColumnProps | null =
          'props' in parent2 ? parent2.props : null;
        if (p) {
          if (p.flex) dim = `${p.flex.replace(/\D/, '')}fr`;
          let x = '';
          if (parentType === 'Column' && 'width' in p && p.width) x = p.width;
          if (parentType === 'Row' && 'height' in p && p.height) x = p.height;
          if (x) dim = /^\d+$/.test(x) ? x.concat('px') : x;
          template[parentType].push(dim);
          const { span: sp, children } = p;
          const span = sp || 1;
          const cellcount = React.Children.count(children);
          React.Children.forEach(children, (cell, i) => {
            let myspan = span;
            if (i === cellcount - 1 && span === 1)
              myspan = count[parentType] - cellcount + 1;
            const rc = parentIndex + 1;
            const cr = i + 1;
            const rcspan = 1;
            const crspan = myspan;
            cells.push(
              <div
                key={[parentType, rc, cr].join('.')}
                className={`grid-cell grid-${parentType.toLowerCase()}-cell`}
                style={{
                  gridArea:
                    parentType === 'Row'
                      ? `${rc} / ${cr} / ${rc + rcspan} / ${cr + crspan}`
                      : `${cr} / ${rc} / ${cr + crspan} / ${rc + rcspan}`,
                }}
              >
                {cell}
              </div>
            );
          });
        }
      }
    }
  }

  const count = { Column: 0, Row: 0 };
  React.Children.forEach(props.children, (c) => {
    const p: any = c && typeof c === 'object' && 'props' in c ? c.props : null;
    const t: any = c && typeof c === 'object' && 'type' in c ? c.type : null;
    if (p && t?.displayName === 'Columns') {
      count.Column = React.Children.count(p.children);
    }
    if (p && t?.displayName === 'Rows') {
      count.Row = React.Children.count(p.children);
    }
  });

  const gridcells: ReactElementLike[] = [];
  const gridtemplate = { Row: [], Column: [] };
  React.Children.forEach(props.children, (gparent) => {
    const p = (
      gparent && typeof gparent === 'object' && 'props' in gparent
        ? gparent.props
        : null
    ) as XulProps | null;
    if (p) {
      React.Children.forEach(p.children, (cellparent, i) => {
        gridCells(cellparent, i, count, gridcells, gridtemplate);
      });
    }
  });

  const gridProps = {
    style: {
      display: 'grid',
      gridTemplateColumns: gridtemplate.Column.join(' '),
      gridTemplateRows: gridtemplate.Row.join(' '),
    },
  };

  return <div {...htmlAttribs('grid', gridProps)}>{gridcells}</div>;
}
Grid.defaultProps = defaultProps;
Grid.propTypes = propTypes;

export default Grid;
