/* eslint-disable react/forbid-prop-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable jsx-a11y/iframe-has-title */
/* eslint-disable react/no-did-update-set-state */
/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/static-property-placement */
import React, { ReactElement } from 'react';
import PropTypes from 'prop-types';
import { Icon } from '@blueprintjs/core';
import i18n from 'i18next';
import { clone, diff, drop } from '../../common';
import G from '../rg';
import { getStatePref } from '../rutil';
import { Hbox, Vbox } from './boxes';
import Button from './button';
import Spacer from './spacer';
import { addClass, xulDefaultProps, XulProps, xulPropTypes } from './xul';
import Menulist from './menulist';
import Textbox from './textbox';
import Label from './label';
import Groupbox from './groupbox';
import './printSettings.css';

const paperSizes = [
  { type: 'A3', w: 297, h: 420, u: 'mm' },
  { type: 'A4', w: 210, h: 297, u: 'mm' },
  { type: 'A5', w: 148, h: 210, u: 'mm' },
  { type: 'Letter', w: 8.5, h: 11, u: 'in' },
  { type: 'Legal', w: 8.5, h: 14, u: 'in' },
  { type: 'Tabloid', w: 11, h: 17, u: 'in' },
] as const;

const convertToPx = { in: 96, mm: 96 / 25.4 };

const scaleLimit = { min: 25, max: 150 };

const defaultProps = {
  ...xulDefaultProps,
  control: null,
  columnSelect: false,
  printDisabled: false,
};

const propTypes = {
  ...xulPropTypes,
  control: PropTypes.object,
  columnSelect: PropTypes.bool,
  printDisabled: PropTypes.bool,
};

type PrintProps = XulProps & {
  control: ReactElement;
  columnSelect: boolean;
  printDisabled: boolean;
};

const defaultState = {
  landscape: false as boolean,
  pageSize: 'Letter' as typeof paperSizes[number]['type'],
  twoColumns: false as boolean,
  scale: 100 as number,
  margins: {
    top: 30,
    right: 21,
    bottom: 30,
    left: 21,
  },
};

const notStatePref = {};

export type PrintState = typeof defaultState;

export default class Printsettings extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  iframe: React.RefObject<HTMLIFrameElement>;

  selectRefs: {
    margins: {
      top: React.RefObject<HTMLSelectElement>;
      right: React.RefObject<HTMLSelectElement>;
      bottom: React.RefObject<HTMLSelectElement>;
      left: React.RefObject<HTMLSelectElement>;
    };
    scale: React.RefObject<HTMLSelectElement>;
  };

  resetTO: NodeJS.Timeout | null;

  constructor(props: PrintProps) {
    super(props);

    const s: PrintState = {
      ...defaultState,
      ...(getStatePref('print') as PrintState),
    };
    this.state = s;

    this.handler = this.handler.bind(this);

    this.selectRefs = {
      margins: {
        top: React.createRef(),
        right: React.createRef(),
        bottom: React.createRef(),
        left: React.createRef(),
      },
      scale: React.createRef(),
    };

    this.iframe = React.createRef();

    this.resetTO = null;
  }

  componentDidUpdate(_prevProps: PrintProps, prevState: PrintState) {
    const d = diff(prevState, drop(this.state as PrintState, notStatePref));
    if (d) {
      G.Prefs.mergeValue('print', d);
      setTimeout(() => G.Window.reset('component-reset'), 500);
    }
  }

  async handler(e: React.SyntheticEvent<any, any>) {
    const state = this.state as PrintState;
    const props = this.props as PrintProps;
    const { control } = props;
    const { selectRefs } = this;
    const target = e.currentTarget as HTMLElement;
    const [id, id2] = target.id.split('.');
    switch (e.type) {
      case 'click': {
        switch (id) {
          case 'page': {
            // TODO! remove if not needed
            const c = this.getContainer();
            if (c) {
              const { iframe, container } = c;
              const pagewidth = iframe.offsetWidth;
              let { scrollLeft } = container;
              if (id2 === 'first') scrollLeft = 0;
              else if (id2 === 'prev') scrollLeft -= pagewidth;
              else if (id2 === 'next') scrollLeft += pagewidth;
              else scrollLeft = container.offsetWidth - pagewidth;
              container.scrollLeft = scrollLeft;
            }
            break;
          }
          case 'portrait':
          case 'landscape': {
            const s: Partial<PrintState> = {
              landscape: id === 'landscape',
            };
            this.setState(s);
            break;
          }
          case 'columns': {
            const s: Partial<PrintState> = {
              twoColumns: id2 === '2',
            };
            this.setState(s);
            break;
          }
          case 'margin': {
            this.setState((prevState: PrintState) => {
              const s = {
                margins: clone(prevState.margins),
              } as PrintState;
              const input = e.target as HTMLInputElement;
              s.margins[id2 as keyof PrintState['margins']] = Number(
                input.value
              );
              return s;
            });
            break;
          }
          case 'printPreview': {
            window.ipc.renderer.printPreview({
              progress: 'undefined',
              modalType: 'darkened',
            });
            setTimeout(
              () =>
                window.ipc.renderer.printPreview(undefined, undefined, {
                  pdfTmpDir: G.Window.tmpDir(),
                }),
              1000
            );
            break;
          }
          case 'printToPDF': {
            window.ipc.renderer.printPreview(
              { progress: 'undefined', modalType: 'darkened' },
              undefined,
              { pdfTmpDir: 'prompt-for-file' }
            );
            break;
          }
          case 'print': {
            const { landscape, margins, pageSize } = state;
            window.ipc.renderer.printPreview(
              { progress: 'undefined', modalType: 'darkened' },
              {
                silent: false,
                margins,
                landscape,
                pageSize,
              }
            );
            break;
          }
          case 'cancel': {
            // If the window includes a control component, close the
            // entire window, otherwise, close the print overlay.
            if (control) G.Window.close();
            else window.ipc.renderer.printPreview(null);
            break;
          }
          default:
            throw new Error(`Unhandled click event ${id} in print.tsx`);
        }
        break;
      }

      case 'change': {
        switch (id) {
          case 'pageSize': {
            const select = e.target as HTMLSelectElement;
            const s: Partial<PrintState> = {
              pageSize: select.value as any,
            };
            this.setState(s);
            break;
          }

          default:
            throw new Error(`Unhandled change event ${id} in print.tsx`);
        }
        break;
      }

      case 'blur':
      case 'keydown': {
        const ek = e as React.KeyboardEvent;
        if (e.type === 'blur' || ek.key === 'Enter') {
          switch (id) {
            case 'margins': {
              const id2x = id2 as keyof Printsettings['selectRefs']['margins'];
              const select = selectRefs.margins[id2x].current;
              if (select) {
                const s: Partial<PrintState> = {
                  margins: { ...state.margins, [id2]: Number(select.value) },
                };
                this.setState(s);
              }
              break;
            }
            case 'font': {
              const select = selectRefs.scale.current;
              if (select) {
                let scale = Number(select.value);
                if (scale > scaleLimit.max) scale = scaleLimit.max;
                if (scale < scaleLimit.min) scale = scaleLimit.min;
                const s: Partial<PrintState> = { scale };
                this.setState(s);
              }
              break;
            }
            default:
              throw new Error(`Unhandled change event ${id} in print.tsx`);
          }
          break;
        }
        break;
      }

      default:
        throw new Error(`Unhandled event type ${e.type} in print.tsx`);
    }
  }

  getContainer() {
    const { iframe } = this;
    if (iframe && iframe.current) {
      const container =
        iframe.current.contentDocument?.getElementById('container');
      if (container) {
        return {
          iframe: iframe.current,
          container,
        };
      }
    }
    return null;
  }

  render() {
    const props = this.props as PrintProps;
    const state = this.state as PrintState;
    const { landscape, pageSize, twoColumns, scale, margins } = state;
    const { columnSelect, control, printDisabled } = props;
    const { handler, selectRefs } = this;

    const psize = paperSizes.find(
      (p) => p.type === pageSize
    ) as typeof paperSizes[number];

    const pwidth = psize[landscape ? 'h' : 'w'];
    const pheight = psize[landscape ? 'w' : 'h'];

    const maxh = window.innerHeight - 30;

    // html-page width can be anything, it just must be known before render
    const maxControlW = 500;
    let htmlpageW = window.innerWidth - maxControlW;
    if (htmlpageW < 100) htmlpageW = 100;
    let htmlpageH = htmlpageW * (pheight / pwidth);
    let hpscale = htmlpageW / (pwidth * convertToPx[psize.u]);
    let pleft = 0;
    if (htmlpageH > maxh) {
      htmlpageH = maxh;
      const contpageW = htmlpageH * (pwidth / pheight);
      hpscale = htmlpageH / (pheight * convertToPx[psize.u]);
      pleft = -20 + (htmlpageW - hpscale * contpageW) / 2;
      if (pleft < 0) pleft = 0;
    }

    // To center page vertically and allow the overflowing outline/shadow
    // to be visible, the top offset is manually set.
    const ptop = (maxh - htmlpageH) / (2 * hpscale);

    return (
      <Vbox {...addClass('printsettings', props)}>
        <style>{`
          .html-page {
            width: ${htmlpageW}px;
          }
          .scale {
            transform: scale(${hpscale});
          }
          .content {
            width: ${pwidth}${psize.u};
            height: ${pheight}${psize.u};
            padding-top: ${margins.top}mm;
            padding-right: ${margins.right}mm;
            padding-bottom: ${margins.bottom}mm;
            padding-left: ${margins.left}mm;
            top: ${ptop}px;
            left: ${pleft}px;
          }
          .userFontBase {
            font-size: ${scale / 100}em;
          }
          @media print {
            @page {
              size: ${pwidth}${psize.u} ${pheight}${psize.u};
              margin-top: ${margins.top}mm;
              margin-right: ${margins.right}mm;
              margin-bottom: ${margins.bottom}mm;
              margin-left: ${margins.left}mm;
            }
            .html-page {
              width: unset;
            }
            .scale {
              transform: scale(1);
            }
            .content {
              top: unset;
              left: unset;
              width: unset;
              height: unset
              padding-top: unset;
              padding-right: unset;
              padding-bottom: unset;
              padding-left: unset;
            }
          }
        `}</style>
        {control}
        <Groupbox caption={i18n.t('printCmd.label')}>
          <Vbox pack="center" align="center">
            <Hbox align="center">
              <Menulist
                id="pageSize"
                value={pageSize}
                options={paperSizes.map((p) => (
                  <option key={p.type} value={p.type}>
                    {p.type}
                  </option>
                ))}
                onChange={handler}
              />
              <Spacer width="15" />
              <Button
                id="portrait"
                checked={!landscape}
                icon="document"
                onClick={handler}
              />
              <Button
                id="landscape"
                checked={landscape}
                icon="document"
                onClick={handler}
              />
              {columnSelect && (
                <>
                  <Spacer width="10" />
                  <Button
                    id="columns.1"
                    checked={!twoColumns}
                    icon="one-column"
                    onClick={handler}
                  />
                  <Button
                    id="columns.2"
                    checked={twoColumns}
                    icon="two-columns"
                    onClick={handler}
                  />
                </>
              )}
            </Hbox>
            <Vbox className="margins" pack="center" align="center">
              <Hbox align="center" pack="start">
                <Icon icon="bring-data" />
                <Textbox
                  id="margins.top"
                  value={margins.top.toString()}
                  maxLength="3"
                  pattern={/^\d*$/}
                  onBlur={handler}
                  onKeyDown={handler}
                  inputRef={selectRefs.margins.top}
                />
                <Label value="mm" />
              </Hbox>
              <Hbox>
                <Hbox align="center" pack="start">
                  <Icon icon="bring-data" />
                  <Textbox
                    id="margins.left"
                    value={margins.left.toString()}
                    maxLength="3"
                    pattern={/^\d*$/}
                    onBlur={handler}
                    onKeyDown={handler}
                    inputRef={selectRefs.margins.left}
                  />
                  <Label value="mm" />
                </Hbox>
                <Spacer />
                <Hbox align="center" pack="start">
                  <Icon icon="bring-data" />
                  <Textbox
                    id="margins.right"
                    value={margins.right.toString()}
                    maxLength="3"
                    pattern={/^\d*$/}
                    onBlur={handler}
                    onKeyDown={handler}
                    inputRef={selectRefs.margins.right}
                  />
                  <Label value="mm" />
                </Hbox>
              </Hbox>
              <Hbox align="center" pack="start">
                <Icon icon="bring-data" />
                <Textbox
                  id="margins.bottom"
                  value={margins.bottom.toString()}
                  maxLength="3"
                  pattern={/^\d*$/}
                  onBlur={handler}
                  onKeyDown={handler}
                  inputRef={selectRefs.margins.bottom}
                />
                <Label value="mm" />
              </Hbox>
            </Vbox>
            <Hbox align="center" pack="start">
              <Icon icon="font" />
              <Textbox
                id="font.size"
                value={scale.toString()}
                maxLength="3"
                timeout="500"
                pattern={/^\d*$/}
                onBlur={handler}
                onKeyDown={handler}
                inputRef={selectRefs.scale}
              />
              <Label value="%" />
            </Hbox>
          </Vbox>
        </Groupbox>
        <Hbox className="dialog-buttons" pack="end" align="end">
          <Button
            id="print"
            icon="print"
            flex="1"
            fill="x"
            disabled={printDisabled}
            onClick={handler}
          >
            {i18n.t('printCmd.label')}
          </Button>
          <Button
            id="printToPDF"
            icon="document"
            flex="1"
            fill="x"
            disabled={printDisabled}
            onClick={handler}
          >
            PDF
          </Button>
          <Button
            id="printPreview"
            flex="1"
            fill="x"
            disabled={printDisabled}
            onClick={handler}
          >
            {i18n.t('printPreviewCmd.label')}
          </Button>
          <Spacer flex="10" />
          <Button id="cancel" flex="1" fill="x" onClick={handler}>
            {i18n.t('cancel.label')}
          </Button>
        </Hbox>
      </Vbox>
    );
  }
}
Printsettings.defaultProps = defaultProps;
Printsettings.propTypes = propTypes;