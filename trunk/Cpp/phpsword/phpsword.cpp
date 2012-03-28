#include "phpsword.h"

PHP_MINIT_FUNCTION(phpsword)
{
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
