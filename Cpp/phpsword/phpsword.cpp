#include "xulsword.h"
#include "phpsword.h"

/* See https://www.zend.com/embedding-c-data-into-php-objects */

/* Z_SWORD returns the sword-object pointer within PHP_METHOD */
#define Z_SWORD \
    ((sword_object*)((char*)(Z_OBJ(EX(This))) - XtOffsetOf(sword_object, std)))

static zend_class_entry *sword_ce;

/* This sword_object_handlers will override the standard zend_object 
 * handlers with one that will free an entire sword_object. */
static zend_object_handlers sword_object_handlers;

/* The sword_object structure must have C-data first, with a
 * standard zend_object last. */
typedef struct sword_object {
  xulsword *sword;
  zend_object std;
} sword_object;

/* Replace the sword_ce class entry's create_object method with one that
 * will create a sword_object rather than standard zend_object. */
static zend_object *sword_create_object(zend_class_entry *ce TSRMLS_DC) {
  sword_object *phpsword = (sword_object *)zend_object_alloc(sizeof(sword_object), ce);
  
  zend_object_std_init(&phpsword->std, ce);
  object_properties_init(&phpsword->std, ce);
  
  phpsword->std.handlers = &sword_object_handlers;
  
  return &phpsword->std;
}

/* Initialize and save xulsword object */
PHP_METHOD(phpsword, __construct) {
  char *path;
  size_t lpath;
  
	if (zend_parse_parameters_throw(ZEND_NUM_ARGS(), "s", &path, &lpath) == FAILURE) {
    return;
  }

  sword_object *phpsword = Z_SWORD;
  xulsword *sword;
  sword = new xulsword(path, NULL, NULL, NULL);
  
  phpsword->sword = sword;
}

PHP_METHOD(phpsword, __destruct) {
  sword_object *phpsword = Z_SWORD;
  
  xulsword *tmp = phpsword->sword;
  phpsword->sword = NULL;
  delete (tmp);
}

#include "phpmethods.cpp"

/* Initialize the sword_ce class entry. Also init the sword_object_handlers
 * offset, so PHP knows the actual sword_object address. Zend will use 
 * this to deallocate the entire sword_object at the appropriate time. 
 * The xulsword object itself is deleted in __destruct. */
static PHP_MINIT_FUNCTION(phpsword) {
  zend_class_entry ce;
  INIT_CLASS_ENTRY(ce, "phpsword", sword_methods);
  sword_ce = zend_register_internal_class(&ce TSRMLS_DC);
  sword_ce->create_object = sword_create_object;

  memcpy(&sword_object_handlers, zend_get_std_object_handlers(), sizeof(zend_object_handlers));
  sword_object_handlers.offset = XtOffsetOf(sword_object, std);

  return SUCCESS;
}

zend_module_entry phpsword_module_entry = {
    STANDARD_MODULE_HEADER,
    PHP_PHPSWORD_EXTNAME,
    NULL,                  /* Functions */
    PHP_MINIT(phpsword),   /* Class entry, methods and handlers init */
    NULL,                  /* MSHUTDOWN */
    NULL,                  /* RINIT */
    NULL,                  /* RSHUTDOWN */
    NULL,                  /* MINFO */
    PHP_PHPSWORD_EXTVER,
    STANDARD_MODULE_PROPERTIES
};

#ifdef COMPILE_DL_PHPSWORD
extern "C" {ZEND_GET_MODULE(phpsword)}
#endif
