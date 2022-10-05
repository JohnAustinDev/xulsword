/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'path';
import i18next from 'i18next';
import C from '../constant';
import Dirs from './components/dirs';
import Prefs from './components/prefs';
import Cache from '../cache';
import LocalFile from './components/localFile';
import LibSword from './components/libsword';
import getFontFamily from './fontfamily';

import type { ConfigType, FeatureType, FontFaceType } from '../type';
import Data from './components/data';

// If a module config fontFamily specifies a URL to a font, rather
// than a fontFamily, then parse the URL. Otherwise return null.
function fontURL(mod: string) {
  const url = LibSword.getModuleInformation(mod, 'Font').match(
    /(\w+:\/\/[^"')]+)\s*$/
  );
  return url
    ? { fontFamily: `_${url[1].replace(/[^\w\d]/g, '_')}`, url: url[1] }
    : null;
}

// Link to fonts which are in xulsword's xsFonts directory. Fonts
// listed will appear in font option menus and will be available to
// all modules. The fonts pref is used to cache costly font data.
export function getModuleFonts(): FontFaceType[] {
  if (!Cache.has('ModuleFonts')) {
    // Look for xulsword local fonts, which may be included with some
    // XSM modules.
    const ret = [] as FontFaceType[];
    let fonts = Prefs.getPrefOrCreate('fonts', 'complex', {}, 'fonts') as {
      [i: string]: { fontFamily: string; path: string };
    };
    const fontfiles = Dirs.xsFonts.directoryEntries;
    let reread = true;
    if (
      fontfiles.length === Object.keys(fonts).length &&
      fontfiles?.every((f) => {
        return Object.keys(fonts).includes(f);
      })
    ) {
      reread = false;
    }
    if (reread) {
      fonts = {};
      fontfiles?.forEach((file) => {
        const font = new LocalFile(path.join(Dirs.path.xsFonts, file));
        let fontFamily = 'dir';
        if (!font.isDirectory()) {
          const ff = getFontFamily(font.path);
          if (ff) {
            // replace is for BPG Sans Regular, because otherwise it doesn't load in Chrome
            fontFamily = ff.replace(' GPL&GNU', '');
          } else fontFamily = 'unknown';
        }
        fonts[file] = { fontFamily, path: font.path };
      });
      Prefs.setComplexValue('fonts', fonts, 'fonts');
    }

    Object.values(fonts).forEach((info) => {
      if (info.fontFamily !== 'unknown' && info.fontFamily !== 'dir')
        ret.push({ fontFamily: info.fontFamily, path: info.path });
    });

    // Look for module config Font URL. A module's Font entry may be a URL or a
    // fontFamily or font file name. All available font files were added above.
    // But URLs should also be added if any module requests them.
    const mods = LibSword.getModuleList();
    const disable =
      !Prefs.getBoolPref('global.InternetPermission') &&
      !(
        Data.has('SessionInternetPermission') &&
        Data.read('SessionInternetPermission')
      );
    if (!disable && mods && mods !== C.NOMODULES) {
      const modulelist = mods.split(C.CONFSEP);
      const modules = modulelist.map((m: string) => m.split(';')[0]);
      modules.forEach((m) => {
        const url = fontURL(m);
        if (url) ret.push({ fontFamily: url.fontFamily, url: url.url });
      });
    }
    Cache.write(ret, 'ModuleFonts');
  }
  return Cache.read('ModuleFonts');
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
  C.Locales.forEach((l: any) => {
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
  C.Locales.forEach((l: any) => {
    const [locale] = l;
    const toptions = {
      lng: locale,
      ns: 'common/config',
    };
    if (i18next.t('DefaultModule', toptions).match(regex)) myLocale = locale;
  });

  return myLocale;
}

export function getModuleConfig(mod: string) {
  if (!Cache.has(`moduleConfig${mod}`)) {
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

    // Make any PreferredCSSXHTML into a full path
    if (moduleConfig.PreferredCSSXHTML) {
      const p = LibSword.getModuleInformation(
        mod,
        'AbsoluteDataPath'
      ).replaceAll('\\', '/');
      const p2 = `${p}${p.slice(-1) === '/' ? '' : '/'}`;
      moduleConfig.PreferredCSSXHTML = `${p2}${moduleConfig.PreferredCSSXHTML}`;
    }

    // Assign associated locales
    if (mod !== 'LTR_DEFAULT') {
      const lom = getLocaleOfModule(mod);
      moduleConfig.AssociatedLocale = lom || null;
    } else {
      moduleConfig.AssociatedLocale = i18next.language;
      moduleConfig.AssociatedModules = null;
    }

    // Normalize direction value
    moduleConfig.direction =
      moduleConfig.direction && moduleConfig.direction.search(/RtoL/i) !== -1
        ? 'rtl'
        : 'ltr';

    // Insure there are single quotes around font names and that we have the actual
    // font name and not a file name (which is used in some modules).
    let { fontFamily } = moduleConfig;
    if (fontFamily) {
      const font = getModuleFonts().find(
        (f) => fontFamily && f.path?.split('/').pop()?.includes(fontFamily)
      );
      if (font) fontFamily = font.fontFamily;
      moduleConfig.fontFamily = fontFamily.replace(/"/g, "'");
      if (!/'.*'/.test(moduleConfig.fontFamily))
        moduleConfig.fontFamily = `'${moduleConfig.fontFamily}'`;
    }
    Cache.write(moduleConfig, `moduleConfig${mod}`);
  }

  return Cache.read(`moduleConfig${mod}`);
}

export function getModuleConfigDefault() {
  return getModuleConfig('LTR_DEFAULT');
}

export function localeConfig(locale: string) {
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
  lconfig.AssociatedLocale = locale || null;
  // Module associations...
  const modules: string[] = [];
  const mods = LibSword.getModuleList();
  if (mods && mods !== C.NOMODULES) {
    mods.split(C.CONFSEP).forEach((m) => {
      const [mod] = m.split(';');
      modules.push(mod);
    });
  }
  const { AssociatedModules } = lconfig;
  const ams = (AssociatedModules && AssociatedModules.split(/\s*,\s*/)) || [];
  lconfig.AssociatedModules = null;
  const assocmods: Set<string> = new Set(
    ams.filter((m) => Object.keys(modules).includes(m))
  );
  // Associate with modules having configs that associate with this locale.
  modules.forEach((m) => {
    const config = getModuleConfig(m);
    if ('AssociatedLocale' in config && config.AssociatedLocale === locale) {
      assocmods.add(m);
    }
  });
  // Associate with modules sharing this exact locale
  modules.forEach((m) => {
    if (LibSword.getModuleInformation(m, 'Lang') === locale) {
      assocmods.add(m);
    }
  });
  // Associate with modules sharing this locale's base language
  modules.forEach((m) => {
    if (
      LibSword.getModuleInformation(m, 'Lang').replace(/-.*$/, '') ===
      locale.replace(/-.*$/, '')
    ) {
      assocmods.add(m);
    }
  });
  if (assocmods.size) {
    lconfig.AssociatedModules = Array.from(assocmods).join(',');
  }
  // Insure there are single quotes around font names
  if (lconfig.fontFamily) {
    lconfig.fontFamily = lconfig.fontFamily.replace(/"/g, "'");
    if (!/'.*'/.test(lconfig.fontFamily))
      lconfig.fontFamily = `'${lconfig.fontFamily}'`;
  }
  return lconfig;
}

export function getLocaleConfigs(): { [i: string]: ConfigType } {
  if (!Cache.has('localeConfigs')) {
    const ret = {} as { [i: string]: ConfigType };
    // Default locale config must have all CSS settings in order to
    // override unrelated ancestor config CSS.
    ret.locale = localeConfig(i18next.language);
    Object.entries(C.ConfigTemplate).forEach((entry) => {
      const key = entry[0] as keyof ConfigType;
      const typeobj = entry[1];
      if (typeobj.CSS && !ret.locale[key]) {
        const v = C.LocaleDefaultConfigCSS[key] || 'initial';
        ret.locale[key] = v;
      }
    });
    C.Locales.forEach((l: any) => {
      const [lang] = l;
      ret[lang] = localeConfig(lang);
    });
    Cache.write(ret, 'localeConfigs');
  }
  return Cache.read('localeConfigs');
}

export function getFeatureModules(): FeatureType {
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
      noParagraphs: [] as string[],
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
