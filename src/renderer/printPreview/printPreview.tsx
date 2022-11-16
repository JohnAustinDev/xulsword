/* eslint-disable jsx-a11y/iframe-has-title */
/* eslint-disable react/no-did-update-set-state */
/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/static-property-placement */
import React from 'react';
import { Icon, Slider } from '@blueprintjs/core';
import i18n from 'i18next';
import { clone } from '../../common';
import G from '../rg';
import renderToRoot from '../rinit';
import { windowArgument } from '../rutil';
import { Hbox, Vbox } from '../libxul/boxes';
import Button from '../libxul/button';
import Spacer from '../libxul/spacer';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import Menulist from '../libxul/menulist';
import Textbox from '../libxul/textbox';
import Label from '../libxul/label';
import Groupbox from '../libxul/groupbox';
import './printPreview.css';

const paperSizes = [
  { type: 'A3', w: 297, h: 420, unit: 'mm' },
  { type: 'A4', w: 210, h: 297, unit: 'mm' },
  { type: 'A5', w: 148, h: 210, unit: 'mm' },
  { type: 'Letter', w: 8.5, h: 11, unit: 'in' },
  { type: 'Legal', w: 8.5, h: 14, unit: 'in' },
  { type: 'Tabloid', w: 11, h: 17, unit: 'in' },
];

const scaleLimit = { max: 150, min: 25 };

const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

type PrintWinProps = XulProps;

const initialState = {
  showPreview: false as boolean,
  landscape: false as boolean,
  pageSize: 'Letter' as string,
  twoColumns: false as boolean,
  scale: 100 as number,
  margins: {
    top: 297,
    right: 210,
    bottom: 297,
    left: 210,
  },
};

export type PrintWinState = typeof initialState;

export default class PrintWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  iframe: React.RefObject<HTMLIFrameElement>;

  constructor(props: PrintWinProps) {
    super(props);

    const argState = windowArgument(
      'printWinState'
    ) as Partial<PrintWinState> | null;

    const s: PrintWinState = {
      ...initialState,
      ...(argState || {}),
    };
    this.state = s;

    this.handler = this.handler.bind(this);

    this.iframe = React.createRef();
  }

  async handler(e: React.SyntheticEvent) {
    const state = this.state as PrintWinState;
    const target = e.currentTarget as HTMLElement;
    const [id, id2] = target.id.split('.');
    switch (e.type) {
      case 'click': {
        switch (id) {
          case 'page': {
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
            const s: Partial<PrintWinState> = {
              landscape: id === 'landscape',
            };
            this.setState(s);
            break;
          }
          case 'columns': {
            const s: Partial<PrintWinState> = {
              twoColumns: id2 === '2',
            };
            this.setState(s);
            break;
          }
          case 'margin': {
            this.setState((prevState: PrintWinState) => {
              const s = {
                margins: clone(prevState.margins),
              } as PrintWinState;
              const input = e.target as HTMLInputElement;
              s.margins[id2 as keyof PrintWinState['margins']] = Number(
                input.value
              );
              return s;
            });
            break;
          }
          case 'printPreview': {
            const { landscape, pageSize } = state;
            const options: Electron.PrintToPDFOptions = {
              landscape,
              marginsType: 1,
              pageSize,
            };
            this.setState((prevState: PrintWinState) => {
              const s: Partial<PrintWinState> = {
                showPreview: !prevState.showPreview,
              };
              if (s.showPreview) {
                window.ipc.renderer.invoke(
                  'print-preview',
                  options,
                  G.Window.tmpDir()
                );
              } else {
                // Need way to switch preview off
              }
              return s;
            });
            break;
          }
          case 'printToPDF': {
            const { landscape, pageSize } = state;
            const options: Electron.PrintToPDFOptions = {
              landscape,
              marginsType: 1,
              pageSize,
            };
            const success = await window.ipc.renderer.invoke(
              'print-preview',
              options,
              'printToPDF'
            );
            if (success) G.Window.close();
            break;
          }
          case 'print': {
            const { landscape, margins, pageSize } = state;
            const options: Electron.WebContentsPrintOptions = {
              silent: false,
              margins,
              landscape,
              pageSize,
            };
            const success = await window.ipc.renderer.invoke(
              'print-preview',
              options
            );
            if (success) {
              G.Window.close();
            }
            break;
          }
          case 'cancel': {
            G.Window.close();
            break;
          }
          default:
            throw new Error(`Unhandled click event ${id} in printPreview.tsx`);
        }
        break;
      }
      default:
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
    const state = this.state as PrintWinState;
    const { showPreview, landscape, pageSize, twoColumns, scale, margins } =
      state;
    const { handler } = this;

    return (
      <Vbox id="printPreview">
        <Groupbox caption={i18n.t('printCmd.label')}>
          <Vbox pack="center" align="center">
            <Hbox>
              <Button
                id="portrait"
                checked={!landscape}
                icon="document"
                disabled={showPreview}
                onClick={handler}
              />
              <Button
                id="landscape"
                checked={landscape}
                icon="document"
                disabled={showPreview}
                onClick={handler}
              />
            </Hbox>
            <Menulist
              id="pageSize"
              value={pageSize}
              options={paperSizes.map((p) => (
                <option key={p.type} value={p.type}>
                  {p.type}
                </option>
              ))}
              disabled={showPreview}
              onChange={handler}
            />
            <Hbox>
              <Button
                id="columns.1"
                checked={!twoColumns}
                icon="one-column"
                disabled={showPreview}
                onClick={handler}
              />
              <Button
                id="columns.2"
                checked={twoColumns}
                icon="two-columns"
                disabled={showPreview}
                onClick={handler}
              />
            </Hbox>
            <Slider
              min={scaleLimit.min}
              max={scaleLimit.max}
              value={scale}
              disabled={showPreview}
              onChange={(n: number) => {
                this.setState({ scale: n });
              }}
            />
            <Vbox className="margins" pack="center" align="center">
              <Hbox align="center" pack="start">
                <Icon icon="bring-data" />
                <Textbox
                  id="margin.top"
                  value={margins.top.toString()}
                  maxLength="3"
                  pattern={/^\d*$/}
                  disabled={showPreview}
                  onChange={handler}
                />
                <Label value="mm" />
              </Hbox>
              <Hbox>
                <Hbox align="center" pack="start">
                  <Icon icon="bring-data" />
                  <Textbox
                    id="margin.left"
                    value={margins.left.toString()}
                    maxLength="3"
                    pattern={/^\d*$/}
                    disabled={showPreview}
                    onChange={handler}
                  />
                  <Label value="mm" />
                </Hbox>
                <Spacer />
                <Hbox align="center" pack="start">
                  <Icon icon="bring-data" />
                  <Textbox
                    id="margin.right"
                    value={margins.right.toString()}
                    maxLength="3"
                    pattern={/^\d*$/}
                    disabled={showPreview}
                    onChange={handler}
                  />
                  <Label value="mm" />
                </Hbox>
              </Hbox>
              <Hbox align="center" pack="start">
                <Icon icon="bring-data" />
                <Textbox
                  id="margin.bottom"
                  value={margins.bottom.toString()}
                  maxLength="3"
                  pattern={/^\d*$/}
                  disabled={showPreview}
                  onChange={handler}
                />
                <Label value="mm" />
              </Hbox>
            </Vbox>
          </Vbox>
        </Groupbox>
        <Hbox className="dialog-buttons" pack="end" align="end">
          <Button
            id="print"
            icon="print"
            flex="1"
            fill="x"
            disabled={showPreview}
            onClick={handler}
          >
            {i18n.t('printCmd.label')}
          </Button>
          <Button
            id="printToPDF"
            icon="document"
            flex="1"
            fill="x"
            disabled={showPreview}
            onClick={handler}
          >
            PDF
          </Button>
          <Button
            id="printPreview"
            flex="1"
            fill="x"
            checked={showPreview}
            disabled={showPreview}
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
PrintWin.defaultProps = defaultProps;
PrintWin.propTypes = propTypes;

renderToRoot(<PrintWin />, null, () => {
  window.ipc.renderer.invoke('print-preview');
});
