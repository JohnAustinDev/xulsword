#if ZEND_EXTENSION_API_NO > 20180731
  /* Zend multi-threading no longer needs this macro */
  #define TSRMLS_CC
  /* Zend detects destructor by name (__destruct) and this macro went away.
   * It doesn't hurt to keep it though for 20180731. */
  #define ZEND_ACC_DTOR (1 << 14)
  
/* See: /usr/include/php/20220829/Zend */
/* #define ZEND_BEGIN_ARG_INFO_EX(name, _unused, return_reference, required_num_args)  */
/* #define ZEND_ARG_INFO(pass_by_ref, name) */
/* #define ZEND_ARG_OBJ_INFO(pass_by_ref, name, class_name, allow_null) */
  
ZEND_BEGIN_ARG_INFO_EX(getChapterText, 0, 0, 2)
  ZEND_ARG_INFO(0, vkeymod)
  ZEND_ARG_INFO(0, vkeytext)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(getFootnotes, 0, 0, 0)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(getCrossRefs, 0, 0, 0)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(getNotes, 0, 0, 0)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(getChapterTextMulti, 0, 0, 3)
  ZEND_ARG_INFO(0, vkeymodlist)
  ZEND_ARG_INFO(0, vkeytext)
  ZEND_ARG_INFO(0, keepnotes)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(getVerseText, 0, 0, 2)
  ZEND_ARG_INFO(0, vkeymod)
  ZEND_ARG_INFO(0, vkeytext)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(getMaxChapter, 0, 0, 2)
  ZEND_ARG_INFO(0, v11n)
  ZEND_ARG_INFO(0, vkeytext)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(getMaxVerse, 0, 0, 2)
  ZEND_ARG_INFO(0, v11n)
  ZEND_ARG_INFO(0, vkeytext)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(getVerseSystem, 0, 0, 1)
  ZEND_ARG_INFO(0, module)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(parseVerseKey, 0, 0, 2)
  ZEND_ARG_INFO(0, vkeymod)
  ZEND_ARG_INFO(0, vkeytext)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(convertLocation, 0, 0, 3)
  ZEND_ARG_INFO(0, frVS)
  ZEND_ARG_INFO(0, vkeytext)
  ZEND_ARG_INFO(0, toVS)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(getIntroductions, 0, 0, 3)
  ZEND_ARG_INFO(0, vkeymod)
  ZEND_ARG_INFO(0, bname)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(getDictionaryEntry, 0, 0, 2)
  ZEND_ARG_INFO(0, lexdictmod)
  ZEND_ARG_INFO(0, key)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(getAllDictionaryKeys, 0, 0, 1)
  ZEND_ARG_INFO(0, lexdictmod)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(getGenBookChapterText, 0, 0, 2)
  ZEND_ARG_INFO(0, gbmod)
  ZEND_ARG_INFO(0, treekey)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(getGenBookTableOfContents, 0, 0, 1)
  ZEND_ARG_INFO(0, gbmod)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(luceneEnabled, 0, 0, 1)
  ZEND_ARG_INFO(0, mod)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(search, 0, 0, 6)
  ZEND_ARG_INFO(0, mod)
  ZEND_ARG_INFO(0, srchstr)
  ZEND_ARG_INFO(0, scope)
  ZEND_ARG_INFO(0, type)
  ZEND_ARG_INFO(0, flags)
  ZEND_ARG_INFO(0, newsearch)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(getSearchResults, 0, 0, 5)
  ZEND_ARG_INFO(0, mod)
  ZEND_ARG_INFO(0, first)
  ZEND_ARG_INFO(0, num)
  ZEND_ARG_INFO(0, keepStrongs)
  ZEND_ARG_INFO(0, referencesOnly)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(setGlobalOption, 0, 0, 2)
  ZEND_ARG_INFO(0, option)
  ZEND_ARG_INFO(0, setting)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(getGlobalOption, 0, 0, 1)
  ZEND_ARG_INFO(0, option)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(setCipherKey, 0, 0, 3)
  ZEND_ARG_INFO(0, mod)
  ZEND_ARG_INFO(0, cipherkey)
  ZEND_ARG_INFO(0, useSecModule)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(getModuleList, 0, 0, 0)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(getModuleInformation, 0, 0, 2)
  ZEND_ARG_INFO(0, mod)
  ZEND_ARG_INFO(0, param_name)
ZEND_END_ARG_INFO()

#endif

/********************************************************************
PHPSWORD Object Methods
*********************************************************************/

PHP_METHOD(phpsword, getChapterText)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    const char *vkeymod; size_t l1;
    const char *vkeytext; size_t l2;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "ss", &vkeymod, &l1, &vkeytext, &l2) != FAILURE) {
      const char *ret = sword->getChapterText(vkeymod, vkeytext);
      if (ret) {RETURN_STRING(ret);}
    }
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getFootnotes)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    const char *ret = sword->getFootnotes();
    if (ret) {RETURN_STRING(ret);}
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getCrossRefs)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    const char *ret = sword->getCrossRefs();
    if (ret) {RETURN_STRING(ret);}
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getNotes)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    const char *ret = sword->getNotes();
    if (ret) {RETURN_STRING(ret);}
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getChapterTextMulti)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *vkeymodlist; size_t l1;
    char *vkeytext; size_t l2;
    zend_bool keepnotes;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "ssb", &vkeymodlist, &l1, &vkeytext, &l2, &keepnotes) != FAILURE) {
      const char *ret = sword->getChapterTextMulti(vkeymodlist, vkeytext, keepnotes);
      if (ret) {RETURN_STRING(ret);}
    }
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getVerseText)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *vkeymod; size_t l1;
    char *vkeytext; size_t l2;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "ss", &vkeymod, &l1, &vkeytext, &l2) != FAILURE) {
      const char *ret = sword->getVerseText(vkeymod, vkeytext);
      if (ret) {RETURN_STRING(ret);}
    }
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getMaxChapter)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *v11n; size_t l1;
    char *vkeytext; size_t l2;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "ss", &v11n, &l1, &vkeytext, &l2) != FAILURE) {
      RETURN_LONG(sword->getMaxChapter(v11n, vkeytext));
    }
  }
  RETURN_LONG(-1);
}

PHP_METHOD(phpsword, getMaxVerse)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *v11n; size_t l1;
    char *vkeytext; size_t l2;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "ss", &v11n, &l1, &vkeytext, &l2) != FAILURE) {
      RETURN_LONG(sword->getMaxVerse(v11n, vkeytext));
    }
  }
  RETURN_LONG(-1);
}

PHP_METHOD(phpsword, getVerseSystem)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *mod; size_t l1;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "s", &mod, &l1) != FAILURE) {
      const char *ret = sword->getVerseSystem(mod);
      if (ret) {RETURN_STRING(ret);}
    }
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getModuleBooks)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *mod; size_t l1;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "s", &mod, &l1) != FAILURE) {
      const char *ret = sword->getModuleBooks(mod);
      if (ret) {RETURN_STRING(ret);}
    }
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, parseVerseKey)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *vkeymod; size_t l1;
    char *vkeytext; size_t l2;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "ss", &vkeymod, &l1, &vkeytext, &l2) != FAILURE) {
      const char *ret = sword->parseVerseKey(vkeymod, vkeytext);
      if (ret) {RETURN_STRING(ret);}
    }
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, convertLocation)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *frVS; size_t l1;
    char *vkeytext; size_t l2;
    char *toVS; size_t l3;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "sss", &frVS, &l1, &vkeytext, &l2,  &toVS, &l3) != FAILURE) {
      const char *ret = sword->convertLocation(frVS, vkeytext, toVS);
      if (ret) {RETURN_STRING(ret);}
    }
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getIntroductions)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *vkeymod; size_t l1;
    char *bname; size_t l2;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "ss", &vkeymod, &l1, &bname, &l2) != FAILURE) {
      const char *ret = sword->getIntroductions(vkeymod, bname);
      if (ret) {RETURN_STRING(ret);}
    }
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getDictionaryEntry)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *lexdictmod; size_t l1;
    char *key; size_t l2;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "ss", &lexdictmod, &l1, &key, &l2) != FAILURE) {
      const char *ret = sword->getDictionaryEntry(lexdictmod, key);
      if (ret) {RETURN_STRING(ret);}
    }
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getAllDictionaryKeys)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *lexdictmod; size_t l1;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "s", &lexdictmod, &l1) != FAILURE) {
      const char *ret = sword->getAllDictionaryKeys(lexdictmod);
      if (ret) {RETURN_STRING(ret);}
    }
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getGenBookChapterText)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *gbmod; size_t l1;
    char *treekey; size_t l2;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "ss", &gbmod, &l1, &treekey, &l2) != FAILURE) {
      const char *ret = sword->getGenBookChapterText(gbmod, treekey);
      if (ret) {RETURN_STRING(ret);}
    }
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getGenBookTableOfContents)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *gbmod; size_t l1;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "s", &gbmod, &l1) != FAILURE) {
      const char *ret = sword->getGenBookTableOfContents(gbmod);
      if (ret) {RETURN_STRING(ret);}
    }
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, luceneEnabled)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *mod; size_t l1;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "s", &mod, &l1) != FAILURE) {
      RETURN_BOOL(sword->luceneEnabled(mod));
    }
  }
  RETURN_FALSE;
}

PHP_METHOD(phpsword, search)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *mod; size_t l1;
    char *srchstr; size_t l2;
    char *scope; size_t l3;
    zend_long type;
    zend_long flags;
    zend_bool newsearch;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "sssllb", &mod, &l1, &srchstr, &l2, &scope, &l3, &type, &flags, &newsearch) != FAILURE) {
      RETURN_LONG(sword->search(mod, srchstr, scope, type, flags, newsearch));
    }
  }
  RETURN_LONG(0);
}

PHP_METHOD(phpsword, getSearchResults)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *mod; size_t l1;
    zend_long first;
    zend_long num;
    zend_bool keepStrongs;
    zend_bool referencesOnly;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "sllbb", &mod, &l1, &first, &num, &keepStrongs, &referencesOnly) != FAILURE) {
      const char *ret = sword->getSearchResults(mod, first, num, keepStrongs, NULL, referencesOnly);
      if (ret) {RETURN_STRING(ret);}
    }
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, setGlobalOption)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *option; size_t l1;
    char *setting; size_t l2;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "ss", &option, &l1, &setting, &l2) != FAILURE) {
      sword->setGlobalOption(option, setting);
    }
  }
  RETURN_NULL();
}

PHP_METHOD(phpsword, getGlobalOption)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *option; size_t l1;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "s", &option, &l1) != FAILURE) {
      const char *ret = sword->getGlobalOption(option);
      if (ret) {RETURN_STRING(ret);}
    }
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, setCipherKey)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *mod; size_t l1;
    char *cipherkey; size_t l2;
    zend_bool useSecModule;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "ssb", &mod, &l1, &cipherkey, &l2, &useSecModule) != FAILURE) {
      sword->setCipherKey(mod, cipherkey, useSecModule);
    }
  }
  RETURN_NULL();
}


PHP_METHOD(phpsword, getModuleList)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    const char *ret = sword->getModuleList();
    if (ret) {RETURN_STRING(ret);}
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getModuleInformation)
{
  xulsword *sword;
  sword_object *obj = Z_SWORD;
  sword = obj->sword;
  if (sword != NULL) {
    char *mod; size_t l1;
    char *paramname; size_t l2;
    if (zend_parse_parameters_throw(ZEND_NUM_ARGS() TSRMLS_CC, "ss", &mod, &l1, &paramname, &l2) != FAILURE) {
      const char *ret = sword->getModuleInformation(mod, paramname);
      if (ret) {RETURN_STRING(ret);}
    }
  }
  RETURN_EMPTY_STRING();
}

static const zend_function_entry sword_methods[] = {
    PHP_ME(phpsword,  __construct, NULL, ZEND_ACC_PUBLIC | ZEND_ACC_CTOR)
    PHP_ME(phpsword,  __destruct,  NULL, ZEND_ACC_PUBLIC | ZEND_ACC_DTOR)
    PHP_ME(phpsword,  getChapterText,                NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getFootnotes,                  NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getCrossRefs,                  NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getNotes,                      NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getChapterTextMulti,           NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getVerseText,                  NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getMaxChapter,                 NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getMaxVerse,                   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getVerseSystem,                NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getModuleBooks,                NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  parseVerseKey,                 NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  convertLocation,               NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getIntroductions,              NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getDictionaryEntry,            NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getAllDictionaryKeys,          NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getGenBookChapterText,         NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getGenBookTableOfContents,     NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  luceneEnabled,                 NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  search,                        NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getSearchResults,              NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  setGlobalOption,               NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getGlobalOption,               NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  setCipherKey,                  NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getModuleList,                 NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getModuleInformation,          NULL, ZEND_ACC_PUBLIC)
    {NULL, NULL, NULL}
};
