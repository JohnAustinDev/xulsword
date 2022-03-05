/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import path from 'path';
import i18next from 'i18next';
import C from '../constant';
import { createStyleRule, deepClone } from '../common';
import Dirs from './modules/dirs';
import Prefs from './modules/prefs';
import Cache from '../cache';
import nsILocalFile from './components/nsILocalFile';
import LibSword from './modules/libsword';
import { jsdump } from './mutil';
// import getFontFamily from './fontfamily';

import type { ConfigType, GType } from '../type';
import getFontFamily from './fontfamily';

function localeConfig(locale: string) {
  const lconfig = {} as ConfigType;
  const toptions = { lng: locale, ns: 'common/config' };

  // All config properties should be present, having a valid value or null.
  // Read any values from locale's config.json file.
  Object.entries(C.ConfigTemplate).forEach((entry) => {
    const prop = entry[0] as keyof typeof C.ConfigTemplate;
    const keyobj = entry[1];
    let r = null;
    if (keyobj.localeConf !== null) {
      r = i18next.exists(keyobj.localeConf, toptions)
        ? i18next.t(keyobj.localeConf, toptions)
        : null;
    }
    lconfig[prop] = r;
  });

  lconfig.AssociatedLocale = locale;

  // Insure there are single quotes around font names
  if (lconfig.fontFamily) {
    lconfig.fontFamily = lconfig.fontFamily.replace(/"/g, "'");
    if (!/'.*'/.test(lconfig.fontFamily))
      lconfig.fontFamily = `'${lconfig.fontFamily}'`;
  }

  // Make the CSS style rules for this locale, which may be appended to CSS stylesheets
  lconfig.StyleRule = createStyleRule(`.cs-${locale}`, lconfig);
  return lconfig;
}

export function getLocaleConfigs(): { [i: string]: ConfigType } {
  if (!Cache.has('localeConfigs')) {
    const ret = {} as { [i: string]: ConfigType };
    ret.current = localeConfig(i18next.language);
    Prefs.getComplexValue('global.locales').forEach((l: any) => {
      const [lang] = l;
      ret[lang] = localeConfig(lang);
    });
    Cache.write(ret, 'localeConfigs');
  }
  return Cache.read('localeConfigs');
}

export function getProgramConfig() {
  const ret = deepClone(localeConfig(i18next.language));
  ret.StyleRule = createStyleRule('.cs-Program', ret);
  return ret;
}

function fontURL(mod: string) {
  // if fontFamily specifies a font URL, rather than a fontFamily, then create a
  // @font-face CSS entry and use it for this module.
  const url = LibSword.getModuleInformation(mod, 'Font').match(
    /(\w+:\/\/[^"')]+)\s*$/
  );
  return url
    ? { name: `_${url[1].replace(/[^\w\d]/g, '_')}`, url: url[1] }
    : null;
}

// Read fonts which are in xulsword's xsFonts directory.
// The pref 'global.fonts' is used to cache costly font data.
// If 'font' is in the pref-value, it is used, otherwise it is added
// to the pref-value. IMPORTANT: If a font is ever updated or removed,
// the global.fonts pref MUST be reset or updated.
export function getFontFaceConfigs(): { [i: string]: string } {
  if (!Cache.has('fontFaceConfigs')) {
    if (!LibSword.libSwordReady('getFontFaceConfigs')) {
      throw Error(
        `getFontFaceConfigs must not be run until LibSword is ready!`
      );
    }

    const ret = {} as { [i: string]: string };
    let fonts = Prefs.getComplexValue('global.fonts') as {
      [i: string]: string;
    };
    const fontdir = Dirs.xsFonts.directoryEntries;
    let reread = false;
    fontdir?.forEach((file) => {
      if (!Object.keys(fonts).includes(file)) {
        reread = true;
      }
    });
    if (reread) {
      fonts = {};
      fontdir?.forEach((file) => {
        const font = new nsILocalFile(path.join(Dirs.path.xsFonts, file));
        if (!font.isDirectory()) {
          const fontFamily = getFontFamily(font.path);
          if (fontFamily) fonts[file] = fontFamily;
          else fonts[file] = 'unknown';
        } else fonts[file] = 'dir';
      });
      Prefs.setComplexValue('global.fonts', fonts);
    }
    Object.entries(fonts).forEach((entry) => {
      const [file, fontFamily] = entry;
      ret[fontFamily] = `file://${file}`;
    });

    // if fontFamily specifies a font URL, rather than a fontFamily, then create a
    // @font-face CSS entry and use it for this module.
    const mods = LibSword.getModuleList();
    const disable =
      !Prefs.getPrefOrCreate(
        'global.HaveInternetPermission',
        'boolean',
        false
      ) &&
      !Prefs.getPrefOrCreate(
        'global.SessionHasInternetPermission',
        'boolean',
        false
      );
    if (!disable && mods && mods !== C.NOMODULES) {
      const modulelist = mods.split(C.CONFSEP);
      const modules = modulelist.map((m: string) => m.split(';')[0]);
      modules.forEach((m) => {
        const url = fontURL(m);
        if (url) ret[url.name] = url.url;
      });
    }
    Cache.write(ret, 'fontFaceConfigs');
  }

  return Cache.read('fontFaceConfigs');
}

// Return a locale (if any) to associate with a module:
//    Return a Locale with exact same language code as module
//    Return a Locale having same base language code as module, prefering current Locale over any others
//    Return a Locale which lists the module as an associated module
//    Return null if no match
function getLocaleOfModule(module: string) {
  let myLocale: string | null = null;

  const progLocale = i18next.language;
  let ml: any = LibSword.getModuleInformation(module, 'Lang').toLowerCase();
  if (ml === C.NOTFOUND) ml = undefined;

  let stop = false;
  Prefs.getComplexValue('global.locales').forEach((l: any) => {
    const [locale] = l;
    if (stop) return;
    const lcs = locale.toLowerCase();

    if (ml && ml === lcs) {
      myLocale = locale;
      stop = true;
      return;
    }
    if (ml && lcs && ml.replace(/-.*$/, '') === lcs.replace(/-.*$/, '')) {
      myLocale = locale;
      if (myLocale === progLocale) stop = true;
    }
  });

  if (myLocale) return myLocale;

  const regex = new RegExp(`(^|s|,)+${module}(,|s|$)+`);
  Prefs.getComplexValue('global.locales').forEach((l: any) => {
    const [locale] = l;
    const toptions = {
      lng: locale,
      ns: 'common/config',
    };
    if (i18next.t('DefaultModule', toptions).match(regex)) myLocale = locale;
  });

  return myLocale;
}

function getModuleConfig(mod: string) {
  if (!LibSword.libSwordReady('getModuleConfig') && mod !== 'LTR_DEFAULT') {
    throw Error(
      `getModuleConfig(modname) must not be called until LibSword is ready!`
    );
  }
  const moduleConfig = {} as ConfigType;

  // All config properties should be present, having a valid value or null.
  // Read values from module's .conf file
  Object.entries(C.ConfigTemplate).forEach((entry) => {
    const prop = entry[0] as keyof typeof C.ConfigTemplate;
    const keyobj = entry[1];
    let r = null;
    if (keyobj.modConf) {
      if (mod !== 'LTR_DEFAULT') {
        r = LibSword.getModuleInformation(mod, keyobj.modConf);
        if (r === C.NOTFOUND) r = null;
      }
    }
    moduleConfig[prop] = r;
  });

  // Assign associated locales
  if (mod !== 'LTR_DEFAULT') {
    const lom = getLocaleOfModule(mod);
    moduleConfig.AssociatedLocale = lom || null;
  } else {
    moduleConfig.AssociatedLocale = C.DEFAULTLOCALE;
    moduleConfig.AssociatedModules = null;
  }

  // Normalize direction value
  moduleConfig.direction =
    moduleConfig.direction && moduleConfig.direction.search(/RtoL/i) !== -1
      ? 'rtl'
      : 'ltr';

  // if fontFamily specifies a font URL, rather than a fontFamily, then create a
  // @font-face CSS entry and use it for this module.
  const url = fontURL(mod);
  if (url) moduleConfig.fontFamily = url.name;

  // Insure there are single quotes around font names
  if (moduleConfig.fontFamily) {
    moduleConfig.fontFamily = moduleConfig.fontFamily.replace(/"/g, "'");
    if (!/'.*'/.test(moduleConfig.fontFamily))
      moduleConfig.fontFamily = `'${moduleConfig.fontFamily}'`;
  }
  // Save the CSS style rules for this module, which can be appended to CSS stylesheets
  moduleConfig.StyleRule = createStyleRule(`.cs-${mod}`, moduleConfig);
  return moduleConfig;
}

export function versionCompare(v1: string | number, v2: string | number) {
  const p1 = String(v1).split('.');
  const p2 = String(v2).split('.');
  do {
    let n1: any = p1.shift();
    let n2: any = p2.shift();
    if (!n1) n1 = 0;
    if (!n2) n2 = 0;
    if (Number(n1) && Number(n2)) {
      if (n1 < n2) return -1;
      if (n1 > n2) return 1;
    } else if (n1 < n2) {
      return -1;
    } else if (n1 > n2) {
      return 1;
    }
  } while (p1.length || p2.length);

  return 0;
}

export function getModuleConfigDefault() {
  return getModuleConfig('LTR_DEFAULT');
}

export function getModuleConfigs(): { [i: string]: ConfigType } {
  if (!Cache.has('moduleConfigs')) {
    if (!LibSword.libSwordReady('getModuleConfigs')) {
      throw Error(
        `getModuleConfigs must not be called until LibSword is ready!`
      );
    }

    const ret: GType['ModuleConfigs'] = {};

    // Gets list of available modules
    const mods = LibSword.getModuleList();
    if (!mods || mods === C.NOMODULES) return ret;
    const modules = mods.split(C.CONFSEP);

    for (let m = 0; m < modules.length; m += 1) {
      const [mod, type] = modules[m].split(';');

      // Weed out unsupported module types
      if (Object.keys(C.SupportedModuleTypes).includes(type)) {
        // Weed out incompatible module versions. The module installer shouldn't
        // allow bad mods, but this is just in case.
        let xsversion = LibSword.getModuleInformation(mod, C.VERSIONPAR);
        xsversion = xsversion !== C.NOTFOUND ? xsversion : C.MINVERSION;
        let modminxsvers;
        try {
          modminxsvers = Prefs.getCharPref('MinXSMversion');
        } catch (er) {
          modminxsvers = C.MINVERSION;
        }
        if (versionCompare(xsversion, modminxsvers) < 0) {
          jsdump(
            `ERROR: Dropping module "${mod}". xsversion:${xsversion} < modminxsvers:${modminxsvers}`
          );
        } else {
          let xsengvers = LibSword.getModuleInformation(mod, 'MinimumVersion');
          xsengvers = xsengvers !== C.NOTFOUND ? xsengvers : '0';
          let enginevers;
          try {
            enginevers = Prefs.getCharPref('EngineVersion');
          } catch (er) {
            enginevers = C.NOTFOUND;
          }
          if (
            enginevers !== C.NOTFOUND &&
            versionCompare(enginevers, xsengvers) < 0
          ) {
            jsdump(
              `ERROR: Dropping module "${mod}". enginevers:${enginevers} < xsengvers:${xsengvers}`
            );
          } else {
            ret[mod] = getModuleConfig(mod);
          }
        }
      } else {
        jsdump(`ERROR: Dropping module "${mod}". Unsupported type "${type}".`);
      }
    }
    Cache.write(ret, 'moduleConfigs');
  }

  return Cache.read('moduleConfigs');
}

export function getFeatureModules() {
  if (!Cache.has('featureModules')) {
    // These are CrossWire SWORD standard module features
    const sword = {
      strongsNumbers: [] as string[],
      greekDef: [] as string[],
      hebrewDef: [] as string[],
      greekParse: [] as string[],
      hebrewParse: [] as string[],
      dailyDevotion: {} as { [i: string]: string },
      glossary: [] as string[],
      images: [] as string[],
      noParagraphs: [] as string[], // should be typeset as verse-per-line
    };
    // These are xulsword features that use certain modules
    const xulsword = {
      greek: [] as string[],
      hebrew: [] as string[],
    };

    const modlist = LibSword.getModuleList();
    if (modlist === C.NOMODULES) return { ...sword, ...xulsword };
    modlist.split(C.CONFSEP).forEach((m) => {
      const [module, type] = m.split(';');
      let mlang = LibSword.getModuleInformation(module, 'Lang');
      const dash = mlang.indexOf('-');
      mlang = mlang.substring(0, dash === -1 ? mlang.length : dash);
      if (module !== 'LXX' && type === C.BIBLE && /^grc$/i.test(mlang))
        xulsword.greek.push(module);
      else if (
        type === C.BIBLE &&
        /^heb?$/i.test(mlang) &&
        !/HebModern/i.test(module)
      )
        xulsword.hebrew.push(module);

      // These Strongs feature modules do not have Strongs number keys, and so cannot be used
      const notStrongsKeyed = new RegExp(
        '^(AbbottSmith|InvStrongsRealGreek|InvStrongsRealHebrew)$',
        'i'
      );
      if (!notStrongsKeyed.test(module)) {
        const feature = LibSword.getModuleInformation(module, 'Feature');
        const features = feature.split(C.CONFSEP);
        Object.keys(sword).forEach((k) => {
          const swordk = k as keyof typeof sword;
          const swordf =
            swordk.substring(0, 1).toUpperCase() + swordk.substring(1);
          if (features.includes(swordf)) {
            if (swordk === 'dailyDevotion') {
              sword[swordk][module] = 'DailyDevotionToday';
            } else {
              sword[swordk].push(module);
            }
          }
        });
      }
    });
    Cache.write({ ...sword, ...xulsword }, 'featureModules');
  }

  return Cache.read('featureModules');
}
