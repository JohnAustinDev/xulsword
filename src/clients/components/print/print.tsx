import React, { useEffect } from 'react';
import Subscription from '../../../subscription.ts';
import { b64toBlob } from '../../../common.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import { functionalComponentRenderPromise, printRefs } from '../../common.ts';
import { getRootElement, getShadowHost } from '../../rootNode.ts';
import { Hbox, Vbox } from '../libxul/boxes.tsx';
import Button from '../libxul/button.tsx';
import Spacer from '../libxul/spacer.tsx';
import { htmlAttribs } from '../libxul/xul.tsx';
import PrintSettings from './printSettings.tsx';
import './print.css';

import type { PrintOptionsType } from '../../controller.tsx';
import type { XulProps } from '../libxul/xul.tsx';
import type { GType } from '../../../type.ts';

// The Print component is the foundation for all print related features. It
// must be rendered to the root of a window and its children (the root content)
// will become available for printing. PrintSettings is rendered alongside a
// scaleable PrintContainer. NOTE: for pageable content, the PrintContainer
// must contain a root content pageable descendent BEFORE being passed to
// Print. For Electron apps, iframeFilePath may be set to the path of a local
// PDF file which was created by Electron as a print preview. Then instead of
// the usual Print components, the content of the PDF will be shown in an
// iframe. This provides a print preview which will be completed when the
// backHandler is called by a back button click.

type PrintProps = XulProps & {
  print: PrintOptionsType;
};

// The web-app renders into a shadow root attached to an element of a host page
// (see renderToRoot() in controller.tsx) but window.print() always prints the
// whole host document, so the host page would otherwise be printed above, and
// overlapping, the page view. While the print view is showing, this print-only
// stylesheet hides everything in the host document except the web-app, and
// neutralizes the layout of the elements between <html> and the shadow host,
// which would otherwise offset, clip or paginate the printout. It must be added
// to the host document itself, because neither the web-app's stylesheets nor
// its class names can reach out of the shadow root.
const hostChainClass = 'xulsword-print-host';

const hostPrintCSS = `
@media print {
  .${hostChainClass} > *:not(.${hostChainClass}),
  .${hostChainClass}::before,
  .${hostChainClass}::after {
    display: none !important;
  }
  .${hostChainClass} {
    display: block !important;
    visibility: visible !important;
    position: static !important;
    float: none !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    width: auto !important;
    min-width: 0 !important;
    max-width: none !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    transform: none !important;
    box-shadow: none !important;
    background: none !important;
  }
}`;

// Returns a function which undoes everything this one does.
function hideHostPageWhilePrinting(): () => void {
  const host = getShadowHost();
  if (!host) return () => {};
  const chain: Element[] = [];
  for (let elem: Element | null = host; elem; elem = elem.parentElement) {
    elem.classList.add(hostChainClass);
    chain.push(elem);
  }
  const style = document.createElement('style');
  style.textContent = hostPrintCSS;
  document.head.appendChild(style);
  return () => {
    chain.forEach((elem) => {
      elem.classList.remove(hostChainClass);
    });
    style.remove();
  };
}

export default function Print(props: PrintProps) {
  const { children, print } = props;
  const { pageViewRef } = printRefs;
  const { pageable, direction, iframeFilePath } = print;
  const { renderPromise, loadingRef } = functionalComponentRenderPromise();

  // Keep the host page out of the printout for as long as the print view is
  // available (the stylesheet only applies to print media, so it is inert
  // until the printout is actually generated).
  useEffect(() => hideHostPageWhilePrinting(), []);

  // Mirrors whether the .print element (vs. the PDF preview) is showing onto
  // #root, so print.css can react to it without a :has() selector.
  useEffect(() => {
    const root = getRootElement();
    root?.classList.toggle('printing', !iframeFilePath);
    return () => {
      root?.classList.remove('printing');
    };
  }, [iframeFilePath]);

  const backHandler = () => {
    Subscription.publish.setControllerState(
      {
        print: {
          iframeFilePath: '',
        } as PrintOptionsType,
        progress: -1,
      },
      false,
    );
  };

  return (
    <>
      {iframeFilePath && (
        <Vbox className="pdf-preview" pack="start" align="stretch">
          <Hbox flex="1">
            <iframe
              key={iframeFilePath}
              src={
                Build.isElectronApp
                  ? URL.createObjectURL(
                      b64toBlob(
                        (G as GType).inlineFile(iframeFilePath, 'base64', true),
                        'application/pdf',
                      ),
                    )
                  : ''
              }
            />
          </Hbox>
          <Hbox className="dialog-buttons" pack="end" align="end">
            <Spacer flex="10" />
            <Button
              id="back"
              flex="1"
              fill="x"
              onPointerDown={backHandler}
              domref={loadingRef}
            >
              {GI.i18n.t('', renderPromise, 'back.label')}
            </Button>
          </Hbox>
        </Vbox>
      )}
      {!iframeFilePath && (
        <Hbox
          className={`print ${pageable ? 'pageable' : 'not-pageable'}`}
          pack="center"
          align="stretch"
        >
          <Vbox className="pageView-container" pack="center" align="center">
            <div className="pageView" ref={pageViewRef}>
              <div className="scale">
                {pageable && <div className="content">{children}</div>}

                {!pageable && (
                  <PrintContainer className="content" dir={direction || 'auto'}>
                    {children}
                  </PrintContainer>
                )}
              </div>
            </div>
          </Vbox>

          <Spacer width={C.UI.Print.viewMargin} />

          <Vbox className="printsettings-container" pack="center">
            <PrintSettings print={print} />
          </Vbox>
        </Hbox>
      )}
    </>
  );
}

export type PrintContainerProps = XulProps;

export function PrintContainer(props: PrintContainerProps) {
  return (
    <div
      {...htmlAttribs('printContainer userFontBase', props)}
      ref={printRefs.printContainerRef}
    >
      {props.children}
    </div>
  );
}
