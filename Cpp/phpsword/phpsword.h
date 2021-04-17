#ifndef PHP_PHPSWORD_H
#define PHP_PHPSWORD_H

#define PHP_PHPSWORD_EXTNAME  "phpsword"
#define PHP_PHPSWORD_EXTVER   "7.3.0"

#ifdef HAVE_CONFIG_H
#include "config.h"
#endif 

extern "C" {
#include "php.h"
}

extern zend_module_entry phpsword_module_entry;
#define phpext_phpsword_ptr &phpsword_module_entry;

#endif /* PHP_PHPSWORD_H */
