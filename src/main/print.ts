import {
  dialog,
  BrowserWindow,
  SaveDialogOptions,
  IpcMainInvokeEvent,
} from 'electron';
import log from 'electron-log';
import i18n from 'i18next';
import { randomID } from '../common';
import LocalFile from './components/localFile';

import type { PrintOverlayOptions } from '../type';

const printPreviewTmps: LocalFile[] = [];
const PrintHandler = async (
  event: IpcMainInvokeEvent,
  printOverlayOptions?: PrintOverlayOptions,
  electronPrintOptions?: Electron.WebContentsPrintOptions,
  electronPDFOptions?: Electron.PrintToPDFOptions & {
    pdfTmpDir: 'prompt-for-file' | string;
  }
): Promise<boolean> => {
  if (event.sender) {
    if (printOverlayOptions !== undefined) {
      // Send printOverlayOptions to the calling window
      event.sender.send('print-preview', printOverlayOptions);
      // null ends the print operation, so delete tmp files
      if (printOverlayOptions === null) {
        printPreviewTmps.forEach((f) => {
          if (f.exists()) f.remove();
        });
      }
    }

    if (electronPrintOptions) {
      // Send to printer and return window to normal
      return new Promise((resolve) => {
        event.sender.print(
          electronPrintOptions,
          (suceeded: boolean, failureReason: string) => {
            if (!suceeded) {
              log.error(failureReason);
            }
            event.sender.send('print-preview', null);
            resolve(suceeded);
          }
        );
      });
    }

    if (electronPDFOptions) {
      const { pdfTmpDir } = electronPDFOptions;
      if (pdfTmpDir === 'prompt-for-file') {
        // Print to a user selected PDF file and return window to normal
        const saveops: SaveDialogOptions = {
          title: i18n.t('printCmd.label'),
          filters: [
            {
              name: 'PDF',
              extensions: ['pdf'],
            },
          ],
          properties: ['createDirectory'],
        };
        let wtp = BrowserWindow.fromWebContents(event.sender);
        const result = await ((wtp && dialog.showSaveDialog(wtp, saveops)) ||
          null);
        wtp = null;
        if (result && !result.canceled && result.filePath) {
          const data = await event.sender.printToPDF(electronPDFOptions);
          if (data) {
            const outfile = new LocalFile(result.filePath);
            outfile.writeFile(data);
            event.sender.send('print-preview');
            return true;
          }
        }
      } else {
        // Print to temporary PDF file and display it in the preview iframe
        printPreviewTmps.forEach((f) => {
          if (f.exists()) f.remove();
        });
        const tmp = new LocalFile(pdfTmpDir);
        if (tmp.exists() && tmp.isDirectory()) {
          tmp.append(`${randomID()}.pdf`);
          const data = await event.sender.printToPDF(electronPDFOptions);
          if (data) {
            tmp.writeFile(data);
            printPreviewTmps.push(tmp);
            const poo: PrintOverlayOptions = {
              modalType: 'off',
              iframePath: tmp.path,
              progress: -1,
            };
            event.sender.send('print-preview', poo);
            return true;
          }
        }
      }
    }
  }
  return false; // failed
};

export default PrintHandler;
