import React from 'react';
import PropTypes from 'prop-types';
import Subscription from '../../../subscription.ts';
import { b64toBlob } from '../../../common.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import {
  functionalComponentRenderPromise,
  printRefs,
  rootRenderPromise,
} from '../../common.tsx';
import { Hbox, Vbox } from '../libxul/boxes.tsx';
import Button from '../libxul/button.tsx';
import Spacer from '../libxul/spacer.tsx';
import { htmlAttribs, type XulProps, xulPropTypes } from '../libxul/xul.tsx';
import PrintSettings from './printSettings.tsx';
import './print.css';

import type { PrintOptionsType } from '../../controller.tsx';

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

const propTypes = {
  ...xulPropTypes,
  print: PropTypes.object.isRequired,
};

type PrintProps = XulProps & {
  print: PrintOptionsType;
};

export default function Print(props: PrintProps) {
  const { children, print } = props;
  const { pageViewRef } = printRefs;
  const { pageable, direction, iframeFilePath } = print;
  const { renderPromise, loadingRef } = functionalComponentRenderPromise();

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
                        G.inlineFile(iframeFilePath, 'base64', true),
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
              onClick={backHandler}
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
Print.propTypes = propTypes;

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
