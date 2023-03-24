/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/iframe-has-title */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/forbid-prop-types */
import React, { ReactElement } from 'react';
import PropTypes from 'prop-types';
import Subscription from '../../subscription';
import G from '../rg';
import { Hbox, Vbox } from './boxes';
import Button from './button';
import Spacer from './spacer';
import PrintSettings from './printSettings';
import { xulDefaultProps, XulProps, xulPropTypes } from './xul';
import './printOverlay.css';

import type { RootPrintType } from '../renderer';

const defaultProps = xulDefaultProps;

const propTypes = {
  ...xulPropTypes,
  content: PropTypes.object.isRequired,
  print: PropTypes.object.isRequired,
  iframeFilePath: PropTypes.string.isRequired,
  printDisabled: PropTypes.bool.isRequired,
};

type PrintOverlayProps = XulProps & {
  content: ReactElement; // content to print will be shown in the overlay
  print: RootPrintType;
  printDisabled: boolean;
  iframeFilePath: string; // filepath of a PDF preview of the content
};

export default function PrintOverlay(props: PrintOverlayProps) {
  const { iframeFilePath, content, printDisabled, print } = props;
  let page;
  if (print) ({ page } = print);

  const backHandler = () =>
    Subscription.publish.setRendererRootState({
      showPrintOverlay: true,
      modal: 'outlined',
      iframeFilePath: '',
      printDisabled: false,
      progress: -1,
    });

  return (
    <>
      {iframeFilePath && (
        <Vbox className="pdf-preview" pack="start" align="stretch">
          <Hbox flex="1">
            <iframe key={iframeFilePath} src={G.inlineFile(iframeFilePath)} />
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
        <Hbox className="html-preview" pack="end" align="stretch">
          <Vbox className="preview-flex" pack="center" align="center" flex="1">
            <Spacer orient="horizontal" flex="1" />
            <div id="html-page" className="html-page" ref={page}>
              <div className="scale">
                <div className="content">{content}</div>
              </div>
            </div>
            <Spacer orient="horizontal" flex="1" />
          </Vbox>
          <Vbox className="print-settings">
            <Spacer flex="1" />
            <PrintSettings printDisabled={printDisabled} print={print} />
            <Spacer flex="1" />
          </Vbox>
        </Hbox>
      )}
    </>
  );
}
PrintOverlay.defaultProps = defaultProps;
PrintOverlay.propTypes = propTypes;
