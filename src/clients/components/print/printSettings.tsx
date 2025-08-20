import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { Icon, Intent } from '@blueprintjs/core';
import Subscription from '../../../subscription.ts';
import analytics, { BibleBrowserEventInfo } from '../../analytics.ts';
import { clone, randomID } from '../../../common.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import {
  getStatePref,
  printRefs,
  rootRenderPromise,
  setStatePref,
  windowArguments,
  topToaster,
  iframeAutoHeight,
} from '../../common.tsx';
import log from '../../log.ts';
import { Hbox, Vbox } from '../libxul/boxes.tsx';
import Button from '../libxul/button.tsx';
import Spacer from '../libxul/spacer.tsx';
import { addClass, xulPropTypes } from '../libxul/xul.tsx';
import Menulist from '../libxul/menulist.tsx';
import Textbox from '../libxul/textbox.tsx';
import Label from '../libxul/label.tsx';
import Groupbox from '../libxul/groupbox.tsx';
import './printSettings.css';

import type { ToastProps } from '@blueprintjs/core';
import type S from '../../../defaultPrefs.ts';
import type { ControllerState, PrintOptionsType } from '../../controller.tsx';
import type { XulProps } from '../libxul/xul.tsx';

// This PrintSettings component is composed of the following parts:
// - Optional CUSTOM SETTINGS may be rendered elsewhere and provided via the
//   React customSettingsRef. These settings may be applied to the content
//   being printed (such as including footnotes in the printout, or not).
// - If pageable is true, PAGING BUTTONS are rendered, and will appear via
//   React portal within the pageViewRef element.
// - Print format OPTION SELECTORS are rendered, such as page size,
//   orientation, and margin selectors.
// - DIALOG BUTTONS are rendered for print, close or cancel. If used in an
//   Electron app, then PDF and print preview buttons are also provided.
// These parts are arranged in one of two orientations, one for wide screen and
// another for mid to narrow screens. Since print layout is controlled by
// user settings via Javascript, the print container is also sized by
// Javascript.

const WidePrintWidth = 1000;

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

const dark: Partial<ControllerState> = {
  modal: 'darkened',
  progress: 'indefinite',
};

const normal: Partial<ControllerState> = {
  modal: 'dropshadow',
  progress: -1,
};

const headerTemplate = '<span></span>';
const footerTemplate = `
  <div style="font-size: 8px; padding-inline-start: 50px;">
    <span class="pageNumber"></span> / <span class="totalPages"></span>
  </div>`;

const propTypes = {
  ...xulPropTypes,
  print: PropTypes.object.isRequired,
};

type PrintSettingsProps = XulProps & {
  print: PrintOptionsType;
};

const notStatePref = {
  page: 0 as number,
  pages: 0 as number,
};

export type PrintSettingsState = typeof S.prefs.print & typeof notStatePref;

const renderPromise = rootRenderPromise();

export default class PrintSettings extends React.Component {
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
    this.setPages = this.setPages.bind(this);
    this.setPages2 = this.setPages2.bind(this);

    printRefs.setPages = this.setPages;

    this.pageScrollW = 0;
    this.pagebuttons = React.createRef();
    this.iframe = React.createRef();

    this.resetTO = null;
  }

  componentDidMount() {
    this.forceUpdate(); // to re-render now with print.settings
    setTimeout(() => this.setPages(), 1);
  }

  componentDidUpdate(
    _prevProps: PrintSettingsProps,
    prevState: PrintSettingsState,
  ) {
    iframeAutoHeight('.print'); // print height is not constrained
    setStatePref('prefs', 'print', prevState, this.state);
  }

  handler(e: React.SyntheticEvent<any, any>) {
    const state = this.state as PrintSettingsState;
    const { print } = this.props as PrintSettingsProps;
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
          pageRanges: `1-${pages || 1}`,
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
            this.setPages2();
            break;
          }
          case 'columns': {
            const s: Partial<PrintSettingsState> = {
              twoColumns: id2 === '2',
              pages: 0,
            };
            this.setState(s);
            this.setPages2();
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
                input.value,
              );
              return s;
            });
            this.setPages2();
            break;
          }
          case 'print': {
            analytics.record(getAnalyticInfo());
            window.print();
            break;
          }
          case 'printToPDF': {
            analytics.record(getAnalyticInfo());
            Subscription.publish.setControllerState(dark);
            G.Window.printToPDF({
              destination: 'prompt-for-file',
              ...electronOptions,
            })
              .then(() => {
                return Subscription.publish.setControllerState({
                  reset: randomID(),
                  ...normal,
                  print: {
                    iframeFilePath: '',
                  } as PrintOptionsType,
                });
              })
              .catch((er) => {
                this.addToast({
                  message: er
                    .toString()
                    .replace(/^error: promise rejection.*?:([^:]+)$/is, '$1'),
                  intent: Intent.DANGER,
                  timeout: -1,
                }).catch((er) => log.error(er));
              });
            break;
          }
          case 'printPreview': {
            analytics.record(getAnalyticInfo());
            Subscription.publish.setControllerState(dark);
            G.Window.printToPDF({
              destination: 'iframe',
              ...electronOptions,
            })
              .then((iframeFilePath: string) => {
                return Subscription.publish.setControllerState({
                  reset: randomID(),
                  print: {
                    iframeFilePath,
                    printDisabled: false,
                  } as PrintOptionsType,
                  modal: 'off',
                  progress: -1,
                });
              })
              .catch((er) => {
                this.addToast({
                  message: er
                    .toString()
                    .replace(/^error: promise rejection.*?:([^:]+)$/is, '$1'),
                  intent: Intent.DANGER,
                  timeout: -1,
                }).catch((er) => log.error(er));
              });
            break;
          }
          case 'close':
          case 'ok':
          case 'cancel': {
            if (Build.isElectronApp && id === 'close') {
              G.Window.close();
            } else {
              Subscription.publish.setControllerState({
                reset: randomID(),
                card: null,
                print: null,
                modal: 'off',
                progress: -1,
              });
              if (Build.isElectronApp) {
                G.publishSubscription('asyncTaskComplete', {
                  renderers: { type: 'all' },
                  main: true,
                });
              }
            }
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
            this.setPages2();
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
                this.setPages2();
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
                this.setPages2();
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
    paperSize: (typeof paperSizes)[number];
    initialPageViewW: number;
    pageViewW: number;
    pageViewH: number;
    realPaperW: number;
    realPaperH: number;
    contentW: number;
    contentH: number;
    pageViewMaxH: number;
    pagebuttonsW: number;
    pageViewToContentScale: number;
    pageToContentScale: number;
  } {
    const { landscape, pageSize, margins } = this.state as PrintSettingsState;
    const { print } = this.props as PrintSettingsProps;
    const { printContainerRef } = printRefs;
    const { pageable } = print;
    const { pagebuttons } = this;
    const settingsRef = document.querySelector(
      '#root .printsettings-container',
    );
    if (settingsRef && printContainerRef.current) {
      const isWideScreen = window.innerWidth >= WidePrintWidth;
      const settingsW = settingsRef.clientWidth;
      // initialPageViewW can be anything, but it must have a known value.
      let initialPageViewW =
        window.innerWidth - settingsW - 3 * C.UI.Print.viewMargin;
      if (!isWideScreen) initialPageViewW = settingsW - 20;
      if (initialPageViewW < 100) initialPageViewW = 100;

      const paperSize = paperSizes.find(
        (p) => p.type === pageSize,
      ) as (typeof paperSizes)[number];
      const realPaperW = paperSize[landscape ? 'h' : 'w'];
      const realPaperH = paperSize[landscape ? 'w' : 'h'];

      // Print container's height is only constrained in wide screen mode.
      const rootH = document.getElementById('root');
      const winHeight = rootH ? rootH.offsetHeight : window.innerHeight;
      const pageViewMaxH = isWideScreen
        ? winHeight - 2 * C.UI.Print.viewMargin
        : 0;
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
      if (pageViewMaxH && pageViewH > pageViewMaxH) {
        pageViewH = pageViewMaxH;
        pageViewW = pageViewH * (realPaperW / realPaperH);
        pageViewToContentScale = pageViewW / contentW;
      }

      return {
        paperSize,
        initialPageViewW,
        pageViewW,
        pageViewH,
        realPaperW,
        realPaperH,
        contentW,
        contentH,
        pageViewMaxH,
        pagebuttonsW,
        pageViewToContentScale,
        pageToContentScale,
      };
    }
    return {
      paperSize: paperSizes[0],
      initialPageViewW: 0,
      pageViewW: 0,
      pageViewH: 0,
      realPaperW: 0,
      realPaperH: 0,
      contentW: 0,
      contentH: 0,
      pageViewMaxH: 0,
      pagebuttonsW: 0,
      pageViewToContentScale: 0,
      pageToContentScale: 0,
    };
  }

  setPages() {
    const { twoColumns } = this.state as PrintSettingsState;
    const { current } = printRefs.printContainerRef;
    if (!current) return;
    const { offsetWidth } = current;
    const lastColumn = document.getElementById('adjustLastColumn');
    if (lastColumn) lastColumn.remove();
    current.scrollLeft = 0;
    const scrollLeftMax = current.scrollWidth - current.offsetWidth;
    // Find the exact distance required to scroll between adjacent pages.
    const { paddingLeft, paddingRight, columnGap } = getComputedStyle(current);
    this.pageScrollW =
      offsetWidth -
      Number(paddingLeft.slice(0, -2)) -
      Number(paddingRight.slice(0, -2)) +
      Number(columnGap.slice(0, -2));
    let pages = 1 + scrollLeftMax / this.pageScrollW;
    // If the final two-column page has only one column, we need to make an
    // adjustment or else the second to last column appears duplicated.
    const over = pages - Math.floor(pages);
    if (twoColumns && over > 0.25) {
      pages = Math.ceil(pages);
      const div = document.createElement('div');
      div.id = 'adjustLastColumn';
      current.insertBefore(div, null);
    } else pages = Math.round(pages);
    // Set and report results.
    this.setState({ page: 1, pages });
    if (pages > C.UI.Print.maxPages) {
      this.addToast({
        message: `${GI.i18n.t('', renderPromise, 'printPages.label')}: 1-${pages}`,
        timeout: 5000,
        intent: Intent.WARNING,
      }).catch((er) => log.error(er));
    }
  }

  setPages2() {
    const { print } = this.props as PrintSettingsProps;
    if (print.pageable) setTimeout(() => this.setPages(), 1);
    else Subscription.publish.setControllerState({ reset: randomID() });
  }

  async addToast(message: ToastProps) {
    (await topToaster).show(message);
  }

  scrollToPage(page?: number) {
    const { current } = printRefs.printContainerRef;
    const { pageScrollW } = this;
    if (current) {
      let scrollLeft = 0;
      if (page) {
        scrollLeft = (page - 1) * pageScrollW;
        if (current.getAttribute('dir') === 'rtl') scrollLeft *= -1;
      }
      current.scrollLeft = scrollLeft;
    }
  }

  render() {
    const { landscape, pageSize, twoColumns, scale, margins, page, pages } =
      this.state as PrintSettingsState;
    const { print } = this.props as PrintSettingsProps;
    const { pageable, printDisabled, dialogEnd } = print;
    const { pageViewRef, customSettingsRef, printContainerRef, settingsRef } =
      printRefs;
    const { selectRefs, pagebuttons, getPageInfo, handler } = this;

    let style = '';
    const i = getPageInfo();
    if (i.realPaperW) {
      // Page margins for multi-page (pageable) printouts must use print margins (not
      // CSS content margins) in order to work properly. But print HTML must use CSS
      // content margins in order to show a preview of the printout. Print margins and
      // page size and orientation can be passed as options to webContents print and
      // printToPDF methods, or else CSS print media @page properties may be used. In
      // printSettings, BOTH methods are used, with the same values. This is because
      // only one or the other seems to work in certain cases, and specifying both
      // doesn't seem to cause problems.
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
        @page {
          size: ${i.realPaperW}${i.paperSize.u} ${i.realPaperH}${i.paperSize.u};
          margin-top: ${margins.top}mm;
          margin-right: ${margins.right}mm;
          margin-bottom: ${margins.bottom}mm;
          margin-left: ${margins.left}mm;
        }
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
      !printDisabled &&
      pageable &&
      (printContainerRef.current?.scrollWidth ?? 0) >
        (printContainerRef.current?.clientWidth ?? 0);

    return (
      <Vbox {...addClass('printsettings', this.props)}>
        {/* PRINT CONTAINER */}
        {pageViewRef?.current &&
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
            pageViewRef.current,
          )}

        <style>{style}</style>

        {/* CUSTOM SETTINGS */}
        <div className="printControls" ref={customSettingsRef} />

        {/* PRINT SETTINGS */}
        <Groupbox
          className="printSettings"
          caption={GI.i18n.t('', renderPromise, 'menu.print')}
          domref={settingsRef}
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
                pattern={/^\d*$/}
                onBlur={handler}
                onKeyDown={handler}
                inputRef={selectRefs.scale}
              />
              <Label value="%" />
            </Hbox>
          </Vbox>
        </Groupbox>

        {/* DIALOG BUTTONS */}
        <Hbox className="dialog-buttons" pack="end" align="end">
          {
            <Button
              id="print"
              icon="print"
              flex="1"
              fill="x"
              disabled={printDisabled}
              onClick={handler}
            >
              {GI.i18n.t('', renderPromise, 'menu.print')}
            </Button>
          }

          {Build.isElectronApp && (
            <>
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
                {GI.i18n.t('', renderPromise, 'printPreviewCmd.label')}
              </Button>
            </>
          )}
          <Spacer flex="10" />
          <Button id={dialogEnd} flex="1" fill="x" onClick={handler}>
            {GI.i18n.t('', renderPromise, `${dialogEnd}.label`)}
          </Button>
        </Hbox>
      </Vbox>
    );
  }
}
PrintSettings.propTypes = propTypes;

function getAnalyticInfo() {
  const info = { event: 'print' } as BibleBrowserEventInfo;

  const [appState] = Subscription.publish.getControllerState();
  const { type } = windowArguments();
  if (
    type === 'printPassageWin' ||
    (appState && appState.card && appState.card.name === 'printPassage')
  ) {
    info.setting = 'printPassage';
  } else {
    // This is assuming we're printing the viewport!
    const { panels, location } = G.Prefs.getComplexValue(
      'xulsword',
    ) as typeof S.prefs.xulsword;
    info.module = panels[0] || '';
    info.locationvk = `${location?.book || 'book?'} ${location?.chapter || 'chapter?'}`;
  }

  return info;
}
