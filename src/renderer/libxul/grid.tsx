/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import type { ReactElementLike } from 'prop-types';
import { xulDefaultProps, xulPropTypes, XulProps, htmlAttribs } from './xul';
import './xul.css';

// XUL grid
const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

function Grid(props: XulProps) {
  const { children } = props;
  const gtcols: string[] = [];
  const gtrows: string[] = [];

  function gridArea(
    row: number,
    col: number,
    rowspan = 1,
    colspan = 1
  ): string {
    return `${row} / ${col} / ${row + rowspan} / ${col + colspan}`;
  }

  const gridchildren: ReactElementLike[] = [];
  let numColumns = 0;
  let numRows = 0;
  React.Children.forEach(children, (c) => {
    const p: any = c && typeof c === 'object' && 'props' in c ? c.props : null;
    const t: any = c && typeof c === 'object' && 'type' in c ? c.type : null;
    if (p && t?.displayName === 'Columns') {
      numColumns = React.Children.count(p.children);
    }
    if (p && t?.displayName === 'Rows') {
      numRows = React.Children.count(p.children);
    }
  });

  React.Children.forEach(children, (rowscols) => {
    const rcprops = (
      rowscols && typeof rowscols === 'object' && 'props' in rowscols
        ? rowscols.props
        : null
    ) as XulProps | null;
    if (rcprops) {
      let rowcolIndex = -1;
      React.Children.forEach(rcprops.children, (ch) => {
        const rowcol = ch && typeof ch === 'object' && 'type' in ch ? ch : null;
        if (rowcol) {
          rowcolIndex += 1;
          const type: any = rowcol?.type;
          if (type?.displayName === 'Column') {
            let gcw = 'auto';
            const p: XulProps | null = 'props' in rowcol ? rowcol.props : null;
            if (p?.flex) gcw = `${p.flex.replace(/\D/, '')}fr`;
            if (p?.width) gcw = p.width;
            gtcols.push(gcw);
            const chdrn = p?.children;
            const ccount = React.Children.count(chdrn);
            React.Children.forEach(chdrn, (cell, i) => {
              gridchildren.push(
                <div
                  className="grid-cell grid-column-cell"
                  style={{
                    gridArea: gridArea(
                      i + 1,
                      rowcolIndex + 1,
                      i === ccount - 1 ? numRows - ccount + 1 : 1,
                      1
                    ),
                  }}
                >
                  {cell}
                </div>
              );
            });
          }
          if (type?.displayName === 'Row') {
            let grh = 'auto';
            const p: XulProps | null = 'props' in rowcol ? rowcol.props : null;
            if (p?.flex) grh = `${p.flex.replace(/\D/, '')}fr`;
            if (p?.height) grh = p.height;
            gtrows.push(grh);
            const chdrn = p?.children;
            const ccount = React.Children.count(chdrn);
            React.Children.forEach(chdrn, (cell, i) => {
              gridchildren.push(
                <div
                  className="grid-cell grid-row-cell"
                  style={{
                    gridArea: gridArea(
                      rowcolIndex + 1,
                      i + 1,
                      1,
                      i === ccount - 1 ? numColumns - ccount + 1 : 1
                    ),
                  }}
                >
                  {cell}
                </div>
              );
            });
          }
        }
      });
    }
  });
  const gridProps = {
    style: {
      display: 'grid',
      gridTemplateColumns: gtcols.join(' '),
      gridTemplateRows: gtrows.join(' '),
    },
  };
  return <div {...htmlAttribs('grid', gridProps)}>{gridchildren}</div>;
}
Grid.defaultProps = defaultProps;
Grid.propTypes = propTypes;

// XUL columns
function Columns(props: XulProps) {
  return <>{props.children}</>;
}
Columns.defaultProps = defaultProps;
Columns.propTypes = propTypes;
Columns.displayName = 'Columns';

// XUL rows
function Rows(props: XulProps) {
  return <>{props.children}</>;
}
Rows.defaultProps = defaultProps;
Rows.propTypes = propTypes;
Rows.displayName = 'Rows';

// XUL column
function Column(props: XulProps) {
  return <>{props.children}</>;
}
Column.defaultProps = defaultProps;
Column.propTypes = propTypes;
Column.displayName = 'Column';

// XUL row
function Row(props: XulProps) {
  return <>{props.children}</>;
}
Row.defaultProps = defaultProps;
Row.propTypes = propTypes;
Row.displayName = 'Row';

export default Grid;
export { Columns, Column, Rows, Row };
