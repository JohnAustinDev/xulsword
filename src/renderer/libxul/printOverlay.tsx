/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/iframe-has-title */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/forbid-prop-types */
import React, { ReactElement } from 'react';
import PropTypes from 'prop-types';
import Subscription from '../../subscription.ts';
import { b64toBlob } from '../../common.ts';
import C from '../../constant.ts';
import G from '../rg.ts';
import { Hbox, Vbox } from './boxes.tsx';
import Button from './button.tsx';
import Spacer from './spacer.tsx';
import PrintSettings from './printSettings.tsx';
import { xulDefaultProps, XulProps, xulPropTypes } from './xul.tsx';
import './printOverlay.css';

import type { RootPrintType } from '../renderer.tsx';

const defaultProps = xulDefaultProps;

const propTypes = {
  ...xulPropTypes,
  content: PropTypes.object.isRequired,
  print: PropTypes.object.isRequired,
  iframeFilePath: PropTypes.string.isRequired,
  printDisabled: PropTypes.bool.isRequired,
};

type PrintOverlayProps = XulProps & {
  content: ReactElement; // content to be shown in the print overlay
  print: RootPrintType;
  // Is content also the printContainer? (pageable content currently provides
  // its own printContainer, but not sure if that's always required)
  isPrintContainer: boolean;
  printDisabled: boolean;
  iframeFilePath: string; // filepath of a PDF preview of the content
};

export default function PrintOverlay(props: PrintOverlayProps) {
  const { iframeFilePath, content, printDisabled, print, isPrintContainer } =
    props;
  const { pageable, pageView, printContainer } = print;

  const backHandler = () =>
    Subscription.publish.setRendererRootState({
      showPrintOverlay: true,
      modal: 'dropshadow',
      iframeFilePath: '',
      printDisabled: false,
      progress: -1,
    });

  return (
    <>
      {iframeFilePath && (
        <Vbox className="pdf-preview" pack="start" align="stretch">
          <Hbox flex="1">
            <iframe
              key={iframeFilePath}
              src={URL.createObjectURL(
                b64toBlob(
                  G.inlineFile(iframeFilePath, 'base64', true),
                  'application/pdf'
                )
              )}
            />
          </Hbox>
          <Hbox className="dialog-buttons" pack="end" align="end">
            <Spacer flex="10" />
            <Button id="back" flex="1" fill="x" onClick={backHandler}>
              {G.i18n.t('back.label')}
            </Button>
          </Hbox>
        </Vbox>
      )}
      {!iframeFilePath && (
        <Hbox
          className={`printoverlay ${pageable ? 'pageable' : 'not-pageable'}`}
          pack="center"
          align="stretch"
        >
          <Vbox className="pageView-container" pack="center" align="center">
            <div className="pageView" ref={pageView}>
              <div className="scale">
                {!isPrintContainer && <div className="content">{content}</div>}
                {isPrintContainer && (
                  <div
                    className="content printContainer userFontBase"
                    ref={printContainer}
                  >
                    {content}
                  </div>
                )}
              </div>
            </div>
          </Vbox>
          <Spacer width={C.UI.Print.viewMargin} />
          <Vbox className="printsettings-container" pack="center">
            <PrintSettings printDisabled={printDisabled} print={print} />
          </Vbox>
        </Hbox>
      )}
    </>
  );
}
PrintOverlay.defaultProps = defaultProps;
PrintOverlay.propTypes = propTypes;
