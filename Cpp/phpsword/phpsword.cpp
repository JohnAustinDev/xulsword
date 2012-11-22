#include "xulsword.h"
#include "phpsword.h"

/********************************************************************
PHPSWORD Extension Glue
*********************************************************************/

zend_object_handlers sword_object_handlers;

struct sword_object {
  zend_object std;
  xulsword *sword;
};

zend_class_entry *sword_ce;

void sword_free_storage(void *object TSRMLS_DC)
{
    sword_object *obj = (sword_object *)object;
    delete obj->sword; 

    zend_hash_destroy(obj->std.properties);
    FREE_HASHTABLE(obj->std.properties);

    efree(obj);
}

zend_object_value sword_create_handler(zend_class_entry *type TSRMLS_DC)
{
    zval *tmp;
    zend_object_value retval;

    sword_object *obj = (sword_object *)emalloc(sizeof(sword_object));
    memset(obj, 0, sizeof(sword_object));
    obj->std.ce = type;

    ALLOC_HASHTABLE(obj->std.properties);
    zend_hash_init(obj->std.properties, 0, NULL, ZVAL_PTR_DTOR, 0);
    zend_hash_copy(obj->std.properties, &type->default_properties, (copy_ctor_func_t)zval_add_ref, (void *)&tmp, sizeof(zval *));

    retval.handle = zend_objects_store_put(obj, NULL, sword_free_storage, NULL TSRMLS_CC);
    retval.handlers = &sword_object_handlers;

    return retval;
}

/********************************************************************
PHPSWORD Functions
*********************************************************************/

PHP_METHOD(phpsword, __construct)
{
  char *path;
  int lpath;
  xulsword *sword = NULL;
  zval *object = getThis();

  if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "s", &path, &lpath) == FAILURE) {
      RETURN_NULL();
  }

  sword = new xulsword(path, NULL, NULL, NULL);
  sword_object *obj = (sword_object *)zend_object_store_get_object(object TSRMLS_CC);
  obj->sword = sword;
}

PHP_METHOD(phpsword, getChapterText)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    const char *vkeymod;
    int l1;
    const char *vkeytext;
    int l2;
    if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "ss", &vkeymod, &l1, &vkeytext, &l2) == FAILURE) {
      RETURN_EMPTY_STRING();
    }
    char *ret = sword->getChapterText(vkeymod, vkeytext);
    if (ret) {RETURN_STRING(ret, 0);}
    else RETURN_EMPTY_STRING();
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getFootnotes)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *ret = sword->getFootnotes();
    if (ret) {RETURN_STRING(ret, 0);}
    else RETURN_EMPTY_STRING();
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getCrossRefs)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *ret = sword->getCrossRefs();
    if (ret) {RETURN_STRING(ret, 0);}
    else RETURN_EMPTY_STRING();
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getNotes)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *ret = sword->getNotes();
    if (ret) {RETURN_STRING(ret, 0);}
    else RETURN_EMPTY_STRING();
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getChapterTextMulti)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *vkeymodlist;
    int l1;
    char *vkeytext;
    int l2;
    bool keepnotes;
    if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "ssb", &vkeymodlist, &l1, &vkeytext, &l2, &keepnotes) == FAILURE) {
      RETURN_EMPTY_STRING();
    }
    char *ret = sword->getChapterTextMulti(vkeymodlist, vkeytext, keepnotes);
    if (ret) {RETURN_STRING(ret, 0);}
    else RETURN_EMPTY_STRING();
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getVerseText)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *vkeymod;
    int l1;
    char *vkeytext;
    int l2;
    if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "ss", &vkeymod, &l1, &vkeytext, &l2) == FAILURE) {
      RETURN_EMPTY_STRING();
    }
    char *ret = sword->getVerseText(vkeymod, vkeytext);
    if (ret) {RETURN_STRING(ret, 0);}
    else RETURN_EMPTY_STRING();
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getMaxChapter)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *mod;
    int l1;
    char *vkeytext;
    int l2;
    if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "ss", &mod, &l1, &vkeytext, &l2) == FAILURE) {
      RETURN_LONG(-1);
    }
    RETURN_LONG(sword->getMaxChapter(mod, vkeytext));
  }
  RETURN_LONG(-1);
}

PHP_METHOD(phpsword, getMaxVerse)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *mod;
    int l1;
    char *vkeytext;
    int l2;
    if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "ss", &mod, &l1, &vkeytext, &l2) == FAILURE) {
      RETURN_LONG(-1);
    }
    RETURN_LONG(sword->getMaxVerse(mod, vkeytext));
  }
  RETURN_LONG(-1);
}

PHP_METHOD(phpsword, getVerseSystem)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *mod;
    int l1;
    if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "s", &mod, &l1) == FAILURE) {
      RETURN_EMPTY_STRING();
    }
    char *ret = sword->getVerseSystem(mod);
    if (ret) {RETURN_STRING(ret, 0);}
    else RETURN_EMPTY_STRING();
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, convertLocation)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *frVS;
    int l1;
    char *vkeytext;
    int l2;
    char *toVS;
    int l3;
    if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "sss", &frVS, &l1, &vkeytext, &l2,  &toVS, &l3) == FAILURE) {
      RETURN_EMPTY_STRING();
    }
    char *ret = sword->convertLocation(frVS, vkeytext, toVS);
    if (ret) {RETURN_STRING(ret, 0);}
    else RETURN_EMPTY_STRING();
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getBookIntroduction)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *vkeymod;
    int l1;
    char *bname;
    int l2;
    if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "ss", &vkeymod, &l1, &bname, &l2) == FAILURE) {
      RETURN_EMPTY_STRING();
    }
    char *ret = sword->getBookIntroduction(vkeymod, bname);
    if (ret) {RETURN_STRING(ret, 0);}
    else RETURN_EMPTY_STRING();
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getDictionaryEntry)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *lexdictmod;
    int l1;
    char *key;
    int l2;
    if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "ss", &lexdictmod, &l1, &key, &l2) == FAILURE) {
      RETURN_EMPTY_STRING();
    }
    char *ret = sword->getDictionaryEntry(lexdictmod, key);
    if (ret) {RETURN_STRING(ret, 0);}
    else RETURN_EMPTY_STRING();
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getAllDictionaryKeys)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *lexdictmod;
    int l1;
    if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "s", &lexdictmod, &l1) == FAILURE) {
      RETURN_EMPTY_STRING();
    }
    char *ret = sword->getAllDictionaryKeys(lexdictmod);
    if (ret) {RETURN_STRING(ret, 0);}
    else RETURN_EMPTY_STRING();
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getGenBookChapterText)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *gbmod;
    int l1;
    char *treekey;
    int l2;
    if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "ss", &gbmod, &l1, &treekey, &l2) == FAILURE) {
      RETURN_EMPTY_STRING();
    }
    char *ret = sword->getGenBookChapterText(gbmod, treekey);
    if (ret) {RETURN_STRING(ret, 0);}
    else RETURN_EMPTY_STRING();
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getGenBookTableOfContents)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *gbmod;
    int l1;
    if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "s", &gbmod, &l1) == FAILURE) {
      RETURN_EMPTY_STRING();
    }
    char *ret = sword->getGenBookTableOfContents(gbmod);
    if (ret) {RETURN_STRING(ret, 0);}
    else RETURN_EMPTY_STRING();
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, luceneEnabled)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *mod;
    int l1;
    if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "s", &mod, &l1) == FAILURE) {
      RETURN_FALSE;
    }
    RETURN_BOOL(sword->luceneEnabled(mod));
  }
  RETURN_FALSE;
}

PHP_METHOD(phpsword, search)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *mod;
    int l1;
    char *srchstr;
    int l2;
    char *scope;
    int l3;
    int type, flags;
    bool newsearch;
    if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "sssllb", &mod, &l1, &srchstr, &l2, &scope, &l3, &type, &flags, &newsearch) == FAILURE) {
      RETURN_LONG(0);
    }
    RETURN_LONG(sword->search(mod, srchstr, scope, type, flags, newsearch));
  }
  RETURN_LONG(0);
}

PHP_METHOD(phpsword, getSearchResults)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *mod;
    int l1;
    int first, num;
    bool keepStrongs;
    if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "sllb", &mod, &l1, &first, &num, &keepStrongs) == FAILURE) {
      RETURN_EMPTY_STRING();
    }
    char *ret = sword->getSearchResults(mod, first, num, keepStrongs);
    if (ret) {RETURN_STRING(ret, 0);}
    else RETURN_EMPTY_STRING();
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, setGlobalOption)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *option;
    int l1;
    char *setting;
    int l2;
    if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "ss", &option, &l1, &setting, &l2) == FAILURE) {
      RETURN_NULL();
    }
    sword->setGlobalOption(option, setting);
  }
  RETURN_NULL();
}

PHP_METHOD(phpsword, getGlobalOption)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *option;
    int l1;
    if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "s", &option, &l1) == FAILURE) {
      RETURN_EMPTY_STRING();
    }
    char *ret = sword->getGlobalOption(option);
    if (ret) {RETURN_STRING(ret, 0);}
    else RETURN_EMPTY_STRING();
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, setCipherKey)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *mod;
    int l1;
    char *cipherkey;
    int l2;
    bool useSecModule;
    if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "ssb", &mod, &l1, &cipherkey, &l2, &useSecModule) == FAILURE) {
      RETURN_NULL();
    }
    sword->setCipherKey(mod, cipherkey, useSecModule);
  }
  RETURN_NULL();
}


PHP_METHOD(phpsword, getModuleList)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *ret = sword->getModuleList();
    if (ret) {RETURN_STRING(ret, 0);}
    else RETURN_EMPTY_STRING();
  }
  RETURN_EMPTY_STRING();
}

PHP_METHOD(phpsword, getModuleInformation)
{
  xulsword *sword;
  sword_object *obj = (sword_object *)zend_object_store_get_object(getThis() TSRMLS_CC);
  sword = obj->sword;
  if (sword != NULL) {
    char *mod;
    int l1;
    char *paramname;
    int l2;
    if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "ss", &mod, &l1, &paramname, &l2) == FAILURE) {
      RETURN_EMPTY_STRING();
    }
    char *ret = sword->getModuleInformation(mod, paramname);
    if (ret) {RETURN_STRING(ret, 0);}
    else RETURN_EMPTY_STRING();
  }
  RETURN_EMPTY_STRING();
}


/********************************************************************
More PHPSWORD Extension Glue
*********************************************************************/

function_entry sword_methods[] = {
    PHP_ME(phpsword,  __construct,     NULL, ZEND_ACC_PUBLIC | ZEND_ACC_CTOR)
    PHP_ME(phpsword,  getChapterText,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getFootnotes,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getCrossRefs,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getNotes,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getChapterTextMulti,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getVerseText,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getMaxChapter,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getMaxVerse,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getVerseSystem,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  convertLocation,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getBookIntroduction,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getDictionaryEntry,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getAllDictionaryKeys,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getGenBookChapterText,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getGenBookTableOfContents,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  luceneEnabled,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  search,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getSearchResults,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  setGlobalOption,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getGlobalOption,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  setCipherKey,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getModuleList,   NULL, ZEND_ACC_PUBLIC)
    PHP_ME(phpsword,  getModuleInformation,   NULL, ZEND_ACC_PUBLIC)
    {NULL, NULL, NULL}
};

PHP_MINIT_FUNCTION(phpsword)
{
  zend_class_entry ce;
  INIT_CLASS_ENTRY(ce, "phpsword", sword_methods);
  sword_ce = zend_register_internal_class(&ce TSRMLS_CC);
  sword_ce->create_object = sword_create_handler;
  memcpy(&sword_object_handlers, zend_get_std_object_handlers(), sizeof(zend_object_handlers));
  sword_object_handlers.clone_obj = NULL;
  return SUCCESS;
}

zend_module_entry phpsword_module_entry = {
#if ZEND_MODULE_API_NO >= 20010901
    STANDARD_MODULE_HEADER,
#endif
    PHP_PHPSWORD_EXTNAME,
    NULL,                  /* Functions */
    PHP_MINIT(phpsword),
    NULL,                  /* MSHUTDOWN */
    NULL,                  /* RINIT */
    NULL,                  /* RSHUTDOWN */
    NULL,                  /* MINFO */
#if ZEND_MODULE_API_NO >= 20010901
    PHP_PHPSWORD_EXTVER,
#endif
    STANDARD_MODULE_PROPERTIES
};

#ifdef COMPILE_DL_PHPSWORD
extern "C" {
ZEND_GET_MODULE(phpsword)
}
#endif
