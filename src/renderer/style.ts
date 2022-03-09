import type { ConfigType } from '../type';
import { createStyleRule } from '../common';
import C from '../constant';
import G from './rg';

export type StyleType = {
  [i in 'locale' | 'module']?: {
    [key in string | 'default']: Partial<ConfigType>;
  };
};

function getConfig(
  styleType?: StyleType,
  type?: keyof StyleType,
  key?: string
): Partial<ConfigType> | null {
  if (!styleType || !type || !key) return null;
  const t0 = type in styleType ? styleType[type] : null;
  if (t0) {
    return key in t0 ? t0[key] : null;
  }
  return null;
}

function insertRule(
  sheet: CSSStyleSheet,
  prefix: string,
  instance: string,
  config?: Partial<ConfigType> | null
) {
  if (config) {
    const r = createStyleRule(`.${prefix}-${instance}`, config);
    if (r) sheet.insertRule(r, sheet.cssRules.length);
  }
}

// Dynamic Style Sheet
// A dynamic style sheet is added to every window, which provides the following
// CSS classes potentially having any/all properties found in ConfigType. The
// stylesheet contains these CSS classes in this order:
//   .cs-<locale> { a class for each installed locale }
//   .cs-<module> { a class for each installed module }
//   .cs-locale { the current program locale class }
//   .cs-LTR_DEFAULT { the default LTR class which can be used for labels etc. }
// When class rules are created, user preferences, if set, are also added in
// the following order:
//   1) User preference defaults for each rule type (module, locale)
//   2) Config values
//   3) User preference values for each instance (of module or locale)
class DynamicStyleSheet {
  sheet: CSSStyleSheet | null;

  style: StyleType;

  constructor(doc: Document) {
    const style = doc.createElement('style');
    doc.head.appendChild(style);
    this.sheet = style.sheet;
    this.style = {
      locale: G.LocaleConfigs,
      module: {
        ...G.ModuleConfigs,
        default: G.ModuleConfigDefault,
      },
    };
  }

  update(styleConfigs?: StyleType) {
    const { sheet } = this;

    // Create CSS classes and rules according to user pref style.
    const prefStyleConfigs = G.Prefs.getPrefOrCreate('style', 'complex', {
      locale: {},
      module: {},
      program: {},
    }) as StyleType;
    const style = styleConfigs || prefStyleConfigs;
    const classPrefixes = ['cs'];
    if (sheet) {
      while (sheet.cssRules.length) {
        sheet.deleteRule(0);
      }
      classPrefixes.forEach((prefix) => {
        Object.entries(this.style).forEach((entry) => {
          const type = entry[0] as keyof StyleType;
          const configobj = entry[1];
          Object.entries(configobj).forEach((entry2) => {
            const [instance, config] = entry2;
            if (instance !== 'default') {
              insertRule(
                sheet,
                prefix,
                instance,
                getConfig(style, type, 'default')
              );
              insertRule(sheet, prefix, instance, config);
              insertRule(
                sheet,
                prefix,
                instance,
                getConfig(style, type, instance)
              );
            }
          });
        });
      });

      // Create LTR_DEFAULT class used for module labels.
      insertRule(sheet, 'cs', 'LTR_DEFAULT', G.ModuleConfigDefault);

      // Create font-face rules for xulsword's fonts.
      Object.entries(G.FontFaceConfigs).forEach((entry) => {
        const [name, src] = entry;
        let src2 = `'${src}'`;
        const match = src.match(/^file:\/\/(.*$)/i);
        if (match) {
          src2 = G.inlineFile(match[1], 'base64');
        }
        const rule = `@font-face {font-family:'${name}'; src:url("${src2}");}`;
        sheet.insertRule(rule, sheet.cssRules.length);
      });

      // Create userFontBase rule according to global user pref.
      const x = G.Prefs.getIntPref('global.fontSize'); // from 0 to 4
      const px = C.UI.Atext.fontSize + C.UI.Atext.fontSizeOptionDelta * (x - 2);
      sheet.insertRule(
        `.userFontBase {font-size:${px}px; line-height:${C.UI.Atext.lineHeight}}`,
        sheet.cssRules.length
      );

      // console.log(sheet);
    }
  }
}

export default new DynamicStyleSheet(document);
