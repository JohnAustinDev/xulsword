/* eslint-disable no-continue */
/* eslint-disable react/forbid-prop-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable jsx-a11y/iframe-has-title */
/* eslint-disable react/no-did-update-set-state */
/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/static-property-placement */
import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import {
  IToastProps,
  Icon,
  Intent,
  Position,
  Toaster,
} from '@blueprintjs/core';
import Subscription from '../../subscription';
import { clone, diff, keep, randomID } from '../../common';
import S from '../../defaultPrefs';
import C from '../../constant';
import G from '../rg';
import log from '../log';
import { getStatePref, setStatePref } from '../rutil';
import { Hbox, Vbox } from './boxes';
import Button from './button';
import Spacer from './spacer';
import { addClass, xulDefaultProps, XulProps, xulPropTypes } from './xul';
import Menulist from './menulist';
import Textbox from './textbox';
import Label from './label';
import Groupbox from './groupbox';
import './printSettings.css';

import type { RootPrintType, WindowRootState } from '../renderer';

export const paperSizes = [
  { type: 'A3', w: 297, h: 420, u: 'mm' },
  { type: 'A4', w: 210, h: 297, u: 'mm' },
  { type: 'A5', w: 148, h: 210, u: 'mm' },
  { type: 'Letter', w: 8.5, h: 11, u: 'in' },
  { type: 'Legal', w: 8.5, h: 14, u: 'in' },
  { type: 'Tabloid', w: 11, h: 17, u: 'in' },
] as const;

const convertToPx = { in: 96, mm: 96 / 25.4 };

const scaleLimit = { min: 25, max: 150 };

const dark: Partial<WindowRootState> = {
  modal: 'darkened',
  progress: 'indefinite',
};

const normal: Partial<WindowRootState> = {
  modal: 'dropshadow',
  iframeFilePath: '',
  progress: -1,
};

const headerTemplate = '<span></span>';
const footerTemplate = `
  <div style="font-size: 8px; padding-inline-start: 10px;">
    <span class="pageNumber"></span> / <span class="totalPages"></span>
  </div>`;

const defaultProps = {
  ...xulDefaultProps,
  printDisabled: false,
};

const propTypes = {
  ...xulPropTypes,
  print: PropTypes.object.isRequired,
  printDisabled: PropTypes.bool,
  dialogEnd: PropTypes.string,
};

type PrintSettingsProps = XulProps & {
  print: RootPrintType;
  printDisabled: boolean;
};

const notStatePref = {
  page: 0 as number,
  pages: 0 as number,
};

export type PrintSettingsState = typeof S.prefs.print & typeof notStatePref;

export default class PrintSettings extends React.Component {
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

  pagebuttons: React.RefObject<HTMLDivElement>;

  pageScrollW: number;

  resetTO: NodeJS.Timeout | null;

  toaster: Toaster | undefined;

  constructor(props: PrintSettingsProps) {
    super(props);

    const s: PrintSettingsState = {
      ...(getStatePref('prefs', 'print') as typeof S.prefs.print),
      ...notStatePref,
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

    this.addToast = this.addToast.bind(this);
    this.getPageInfo = this.getPageInfo.bind(this);
    this.scrollToPage = this.scrollToPage.bind(this);

    this.pageScrollW = 0;
    this.pagebuttons = React.createRef();
    this.iframe = React.createRef();

    this.resetTO = null;
  }

  componentDidMount() {
    this.forceUpdate(); // to re-render now with print.settings
  }

  componentDidUpdate(
    prevProps: PrintSettingsProps,
    prevState: PrintSettingsState
  ) {
    const { pages } = this.state as PrintSettingsState;
    const { printDisabled, print } = this.props as PrintSettingsProps;
    const { pageable } = print;
    setStatePref('prefs', 'print', prevState, this.state);
    // If we're multi-page and certain state prefs were changed, reset root now,
    // so content can be redrawn, because the page limit means content will change.
    if (
      pageable &&
      diff(
        prevState,
        keep(this.state as PrintSettingsState, [
          'landscape',
          'margins',
          'pageSize',
          'scale',
          'twoColumns',
        ])
      )
    ) {
      Subscription.publish.setRendererRootState({ reset: randomID() });
    } else if (!pages || (prevProps.printDisabled && !printDisabled)) {
      // Update number of pages if printDisabled was just set to false.
      this.setPages();
    }
  }

  async handler(e: React.SyntheticEvent<any, any>) {
    const state = this.state as PrintSettingsState;
    const { selectRefs, scrollToPage } = this;
    const target = e.currentTarget as HTMLElement;
    const [id, id2] = target.id.split('.');
    const round = (n: number): number => {
      return Math.round(n * 100) / 100;
    };
    switch (e.type) {
      case 'click': {
        const { landscape, pageSize, margins, page, pages } = state;
        const electronOptions: Electron.PrintToPDFOptions = {
          landscape,
          displayHeaderFooter: true,
          printBackground: true,
          scale: 1,
          pageSize,
          margins: {
            top: round((margins.top * convertToPx.mm) / convertToPx.in),
            right: round((margins.right * convertToPx.mm) / convertToPx.in),
            bottom: round((margins.bottom * convertToPx.mm) / convertToPx.in),
            left: round((margins.left * convertToPx.mm) / convertToPx.in),
          },
          pageRanges: `1-${pages}`,
          headerTemplate,
          footerTemplate,
          preferCSSPageSize: false,
        };
        switch (id) {
          case 'pagefirst': {
            scrollToPage(1);
            this.setState({
              page: 1,
            } as Partial<PrintSettingsState>);
            break;
          }
          case 'pageprev': {
            const newPage = page > 1 ? page - 1 : page;
            scrollToPage(newPage);
            this.setState({
              page: newPage,
            } as Partial<PrintSettingsState>);
            break;
          }
          case 'pagenext': {
            const newPage = page < pages ? page + 1 : page;
            scrollToPage(newPage);
            this.setState({
              page: newPage,
            } as Partial<PrintSettingsState>);
            break;
          }
          case 'pagelast': {
            scrollToPage(pages);
            this.setState({
              page: pages,
            } as Partial<PrintSettingsState>);
            break;
          }
          case 'portrait':
          case 'landscape': {
            const s: Partial<PrintSettingsState> = {
              landscape: id === 'landscape',
              pages: 0,
            };
            this.setState(s);
            break;
          }
          case 'columns': {
            const s: Partial<PrintSettingsState> = {
              twoColumns: id2 === '2',
              pages: 0,
            };
            this.setState(s);
            break;
          }
          case 'margin': {
            this.setState((prevState: PrintSettingsState) => {
              const s = {
                margins: clone(prevState.margins),
                pages: 0,
              } as PrintSettingsState;
              const input = e.target as HTMLInputElement;
              s.margins[id2 as keyof PrintSettingsState['margins']] = Number(
                input.value
              );
              return s;
            });
            break;
          }
          case 'print': {
            Subscription.publish.setRendererRootState(dark);
            window.print();
            Subscription.publish.setRendererRootState(normal);
            /* See print.ts - seems to be Electron bug?
            const path = window.ipcTS
              .printOrPreview(
                electronOptions as Electron.WebContentsPrintOptions
              )
              .catch((er) => {
                if (this.toaster) {
                  this.toaster.show({
                    message: er,
                    intent: Intent.WARNING,
                  });
                }
              })
              .finally(() => {
                Subscription.publish.setRendererRootState(normal);
              });
              */
            break;
          }
          case 'printToPDF': {
            Subscription.publish.setRendererRootState(dark);
            window.ipcTS
              .printOrPreview({
                destination: 'prompt-for-file',
                ...electronOptions,
              })
              .then(() => {
                return Subscription.publish.setRendererRootState(normal);
              })
              .catch((er) => {
                this.toaster?.show({
                  message: er,
                  intent: Intent.WARNING,
                });
              });
            break;
          }
          case 'printPreview': {
            Subscription.publish.setRendererRootState(dark);
            window.ipcTS
              .printOrPreview({
                destination: 'iframe',
                ...electronOptions,
              })
              .then((iframeFilePath: string) => {
                return Subscription.publish.setRendererRootState({
                  iframeFilePath,
                  modal: 'off',
                  printDisabled: false,
                  progress: -1,
                });
              })
              .catch((er) => {
                this.toaster?.show({
                  message: er,
                  intent: Intent.WARNING,
                });
              });
            break;
          }
          case 'close': {
            G.Window.close();
            break;
          }
          case 'ok':
          case 'cancel': {
            Subscription.publish.setRendererRootState({
              showPrintOverlay: false,
              modal: 'off',
              iframeFilePath: '',
              printDisabled: false,
              progress: -1,
            });
            G.publishSubscription('asyncTaskComplete', {
              renderers: { type: 'all' },
              main: true,
            });
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
            const s: Partial<PrintSettingsState> = {
              pageSize: select.value as any,
              pages: 0,
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
              const id2x = id2 as keyof PrintSettings['selectRefs']['margins'];
              const select = selectRefs.margins[id2x].current;
              if (select) {
                const s: Partial<PrintSettingsState> = {
                  margins: { ...state.margins, [id2]: Number(select.value) },
                  pages: 0,
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
                const s: Partial<PrintSettingsState> = { scale, pages: 0 };
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

  getPageInfo(): {
    paperSize: typeof paperSizes[number];
    initialPageViewW: number;
    pageViewW: number;
    pageViewH: number;
    contentW: number;
    contentH: number;
    pageViewToContentScale: number;
    realPaperW: number;
    realPaperH: number;
    pageViewMaxH: number;
    pagebuttonsW: number;
    pageToContentScale: number;
  } {
    const { landscape, pageSize, margins } = this.state as PrintSettingsState;
    const { print } = this.props as PrintSettingsProps;
    const { pageable, settings, printContainer } = print;
    const { pagebuttons } = this;
    if (settings.current && printContainer.current) {
      const settingsW = (settings.current.parentElement as HTMLDivElement)
        .clientWidth;
      // initialPageViewW can be anything, but it must be known
      let initialPageViewW =
        window.innerWidth - settingsW - 3 * C.UI.Print.viewMargin;
      if (initialPageViewW < 100) initialPageViewW = 100;

      const paperSize = paperSizes.find(
        (p) => p.type === pageSize
      ) as typeof paperSizes[number];
      const realPaperW = paperSize[landscape ? 'h' : 'w'];
      const realPaperH = paperSize[landscape ? 'w' : 'h'];

      const pageViewMaxH = window.innerHeight - 2 * C.UI.Print.viewMargin;
      const pagebuttonsW = pagebuttons?.current?.offsetWidth || 200;

      let pageToContentScale = 1;
      if (!pageable) {
        const contentOnlyW = window.innerWidth;
        const realContentOnlyW =
          realPaperW * convertToPx[paperSize.u] -
          margins.left * convertToPx.mm -
          margins.right * convertToPx.mm;
        pageToContentScale = realContentOnlyW / contentOnlyW;
      }

      const contentMarginLeft =
        (margins.left * convertToPx.mm) / pageToContentScale;
      const contentMarginRight =
        (margins.right * convertToPx.mm) / pageToContentScale;
      const contentW = pageable
        ? realPaperW * convertToPx[paperSize.u]
        : window.innerWidth + contentMarginLeft + contentMarginRight;
      const contentH = pageable
        ? realPaperH * convertToPx[paperSize.u]
        : contentW * (realPaperH / realPaperW);

      let pageViewW = initialPageViewW;
      let pageViewH = pageViewW * (realPaperH / realPaperW);
      let pageViewToContentScale = pageViewW / contentW;
      if (pageViewH > pageViewMaxH) {
        pageViewH = pageViewMaxH;
        pageViewW = pageViewH * (realPaperW / realPaperH);
        pageViewToContentScale = pageViewW / contentW;
      }

      return {
        paperSize,
        initialPageViewW,
        pageViewH,
        realPaperW,
        realPaperH,
        pageViewMaxH,
        pagebuttonsW,
        pageViewToContentScale,
        pageViewW,
        pageToContentScale,
        contentW,
        contentH,
      };
    }
    return {
      paperSize: paperSizes[0],
      initialPageViewW: 0,
      pageViewH: 0,
      realPaperW: 0,
      realPaperH: 0,
      pageViewMaxH: 0,
      pagebuttonsW: 0,
      pageViewToContentScale: 0,
      pageViewW: 0,
      pageToContentScale: 0,
      contentW: 0,
      contentH: 0,
    };
  }

  setPages() {
    const { twoColumns } = this.state as PrintSettingsState;
    const { print } = this.props as PrintSettingsProps;
    const { printContainer } = print;
    if (!printContainer.current) return;
    const { offsetWidth } = printContainer.current;
    const lastColumn = document.getElementById('adjustLastColumn');
    if (lastColumn) lastColumn.remove();
    printContainer.current.scrollLeft = 0;
    const { pageViewToContentScale } = this.getPageInfo();
    // Find the exact distance required to scroll between adjacent pages. Do this
    // by examining all printContainer children and measuring the difference between
    // the left side of the left-most client-rectangle and the left side of the
    // left-most client-rectangle that is greater than the page's offsetWidth.
    let xleft = -1;
    let xright = -1;
    const descendants = printContainer.current.querySelectorAll(
      ':scope *'
    ) as NodeListOf<HTMLElement>;
    descendants.forEach((n) => {
      const { left } = n.getBoundingClientRect();
      if (left && (left < xleft || xleft === -1)) {
        xleft = left;
      } else if ((left - xleft) / pageViewToContentScale > offsetWidth) {
        if (left < xright || xright === -1) xright = left;
      }
    });
    this.pageScrollW = (xright - xleft) / pageViewToContentScale;
    // If the final two-column page has only one column, we need to make an
    // adjustment or else the second to last column appears duplicated.
    if (twoColumns) {
      let xlast = 0;
      descendants.forEach((n) => {
        const { left } = n.getBoundingClientRect();
        if (left > xlast) xlast = left;
      });
      const perc = (xlast - xleft) / pageViewToContentScale / this.pageScrollW;
      const over = perc - Math.floor(perc);
      if (over > 0 && over < 0.5) {
        const div = document.createElement('div');
        div.id = 'adjustLastColumn';
        printContainer.current.insertBefore(div, null);
      }
    }
    // Set and report results.
    const pages =
      this.pageScrollW > 1
        ? Math.ceil(printContainer.current.scrollWidth / this.pageScrollW)
        : 1;
    this.setState({ page: 1, pages });
    if (pages > C.UI.Print.maxPages) {
      this.addToast({
        message: `${G.i18n.t('maximumPages')}: 1-${pages}`,
        timeout: 5000,
        intent: Intent.WARNING,
      });
    }
  }

  addToast(toast: IToastProps) {
    if (this.toaster) this.toaster.show(toast);
  }

  scrollToPage(page?: number) {
    const { print } = this.props as PrintSettingsProps;
    const { printContainer } = print;
    const { pageScrollW } = this;
    if (printContainer.current) {
      printContainer.current.scrollLeft = page ? (page - 1) * pageScrollW : 0;
    }
  }

  render() {
    const { landscape, pageSize, twoColumns, scale, margins, page, pages } =
      this.state as PrintSettingsState;
    const { print, printDisabled } = this.props as PrintSettingsProps;
    const {
      pageable,
      pageView,
      controls,
      printContainer,
      settings,
      dialogEnd,
    } = print;
    const { selectRefs, pagebuttons, getPageInfo, handler } = this;

    let style = '';
    const i = getPageInfo();
    if (i.realPaperW) {
      // Page margins for multi-page (pageable) printouts must use print margins (not
      // content margins) in order to work properly. But print HTML must use content
      // margins in order to show a preview of the printout.
      // NOTE: pageable content width and height must not be set for print to work!
      style = `
      .pageView {
        width: ${i.pageViewW}px;
        height: ${i.pageViewH}px;
      }
      .page-buttons {
        left: ${i.pageViewW / 2 - 0.5 * i.pagebuttonsW}px;
      }
      .scale {
        transform: scale(${i.pageViewToContentScale});
      }
      .content {
        width: ${i.contentW}px;
        height: ${i.contentH}px;
        padding-top: ${(margins.top * convertToPx.mm) / i.pageToContentScale}px;
        padding-right: ${
          (margins.right * convertToPx.mm) / i.pageToContentScale
        }px;
        padding-bottom: ${
          (margins.bottom * convertToPx.mm) / i.pageToContentScale
        }px;
        padding-left: ${
          (margins.left * convertToPx.mm) / i.pageToContentScale
        }px;
      }
      .userFontBase {
        font-size: ${scale / 100}em;
      }
      .pageable .printContainer {
        column-count: ${twoColumns ? 2 : 1}
      }

      @media print {
        .pageView {
          width: unset;
          height: unset;
        }
        .scale {
          transform: scale(${i.pageToContentScale});
        }
        .content  {
          width: ${100 / i.pageToContentScale}vw;
          height: ${100 / i.pageToContentScale}vh;
          padding-top: unset;
          padding-right: unset;
          padding-bottom: unset;
          padding-left: unset;
        }
        .pageable .content {
          width: unset !important;
          height: unset !important;
        }
      }
    `;
    }
    // log.debug('style: ', style);

    const showpaging =
      pageable &&
      (printContainer.current?.scrollWidth ?? 0) >
        (printContainer.current?.clientWidth ?? 0);

    return (
      <Vbox {...addClass('printsettings', this.props)}>
        <Toaster
          canEscapeKeyClear
          position={Position.TOP}
          usePortal
          ref={(ref: Toaster) => {
            this.toaster = ref;
          }}
        />
        {pageView?.current &&
          showpaging &&
          ReactDOM.createPortal(
            <Hbox className="page-buttons" align="center" domref={pagebuttons}>
              <Button
                id="pagefirst"
                icon="double-chevron-left"
                onClick={handler}
              />
              <Spacer flex="1" />
              <Button id="pageprev" icon="chevron-left" onClick={handler} />
              <Button id="pagenext" icon="chevron-right" onClick={handler} />
              <Spacer flex="1" />
              <Button
                id="pagelast"
                icon="double-chevron-right"
                onClick={handler}
              />
              {page > 0 && (
                <div className="label-container">
                  <Label value={`( ${page} / ${pages})`} />
                </div>
              )}
            </Hbox>,
            pageView.current
          )}
        <style>{style}</style>
        <div className="printControls" ref={controls} />
        <Groupbox
          className="printSettings"
          caption={G.i18n.t('menu.print')}
          domref={settings}
        >
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
              {pageable && (
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
            {G.i18n.t('menu.print')}
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
            {G.i18n.t('printPreviewCmd.label')}
          </Button>
          <Spacer flex="10" />
          <Button id={dialogEnd} flex="1" fill="x" onClick={handler}>
            {G.i18n.t(`${dialogEnd}.label`)}
          </Button>
        </Hbox>
      </Vbox>
    );
  }
}
PrintSettings.defaultProps = defaultProps;
PrintSettings.propTypes = propTypes;
