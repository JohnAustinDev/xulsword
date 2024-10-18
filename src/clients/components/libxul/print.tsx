import React from 'react';
import PropTypes from 'prop-types';
import Subscription from '../../../subscription.ts';
import { b64toBlob, randomID } from '../../../common.ts';
import C from '../../../constant.ts';
import { GI } from '../../G.ts';
import { printRefs } from '../../common.tsx';
import RenderPromise from '../../renderPromise.ts';
import { Hbox, Vbox } from './boxes.tsx';
import Button from './button.tsx';
import Spacer from './spacer.tsx';
import PrintSettings from './printSettings.tsx';
import { htmlAttribs, type XulProps, xulPropTypes } from './xul.tsx';
import './print.css';

import type { PrintOptionsType } from '../../controller.tsx';

// The Print component is the foundation for all print related features.
// It must be rendered to the root of a window and its children (the root
// content) will become available for printing. PrintSettings is rendered
// along with a scaleable PrintContainer (although for pageable content,
// the PrintContainer must instead have been wrapped arround a root content
// pageable descendent BEFORE the root content was passed to Print). For
// Electron apps, iframeFilePath may be set to the path of a local PDF file
// which was created by Electron as a print preview. Then instead of the
// usual Print components, the content of the PDF will be shown in an iframe.
// This provides a print preview which will be completed when the backHandler
// is called by a back button click.

const propTypes = {
  ...xulPropTypes,
  print: PropTypes.object.isRequired,
};

type PrintProps = XulProps & {
  print: PrintOptionsType;
};

export default function Print(props: PrintProps) {
  const { children, print } = props;
  const { pageViewRef, printContainerRef } = printRefs;
  const { pageable, direction, iframeFilePath } = print;

  const backHandler = () => {
    Subscription.publish.setControllerState(
      {
        print: {
          iframeFilePath: '',
        } as PrintOptionsType,
        progress: -1,
      },
      true,
    );
  };

  const renderPromise = new RenderPromise(() =>
    Subscription.publish.setControllerState({
      reset: randomID(),
    }),
  );

  return (
    <>
      {iframeFilePath && (
        <Vbox className="pdf-preview" pack="start" align="stretch">
          <Hbox flex="1">
            <iframe
              key={iframeFilePath}
              src={URL.createObjectURL(
                b64toBlob(
                  GI.inlineFile(
                    '',
                    renderPromise,
                    iframeFilePath,
                    'base64',
                    true,
                  ),
                  'application/pdf',
                ),
              )}
            />
          </Hbox>
          <Hbox className="dialog-buttons" pack="end" align="end">
            <Spacer flex="10" />
            <Button id="back" flex="1" fill="x" onClick={backHandler}>
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
