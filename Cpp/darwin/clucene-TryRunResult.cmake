# Preset results for CLucene's TRY_RUN() checks, which cannot run when
# cross-compiling to MacOS. Use with cmake -C. MacOS is POSIX, so these are
# the results of the native Linux build (0 means the check passed).

set( _CL_HAVE_PTHREAD_MUTEX_RECURSIVE_EXITCODE "0" CACHE STRING "Result from TRY_RUN" FORCE)
set( _CL_HAVE_PTHREAD_MUTEX_RECURSIVE_EXITCODE__TRYRUN_OUTPUT "" CACHE STRING "Output from TRY_RUN" FORCE)

set( _CL_HAVE_GCC_ATOMIC_FUNCTIONS_EXITCODE "0" CACHE STRING "Result from TRY_RUN" FORCE)
set( _CL_HAVE_GCC_ATOMIC_FUNCTIONS_EXITCODE__TRYRUN_OUTPUT "" CACHE STRING "Output from TRY_RUN" FORCE)

set( _CL_HAVE_TRY_BLOCKS_EXITCODE "0" CACHE STRING "Result from TRY_RUN" FORCE)
set( _CL_HAVE_TRY_BLOCKS_EXITCODE__TRYRUN_OUTPUT "" CACHE STRING "Output from TRY_RUN" FORCE)

set( _CL_HAVE_NAMESPACES_EXITCODE "0" CACHE STRING "Result from TRY_RUN" FORCE)
set( _CL_HAVE_NAMESPACES_EXITCODE__TRYRUN_OUTPUT "" CACHE STRING "Output from TRY_RUN" FORCE)

set( _CL_HAVE_NO_SNPRINTF_BUG_EXITCODE "0" CACHE STRING "Result from TRY_RUN" FORCE)
set( _CL_HAVE_NO_SNPRINTF_BUG_EXITCODE__TRYRUN_OUTPUT "" CACHE STRING "Output from TRY_RUN" FORCE)

# snwprintf does not exist on MacOS, so this check is skipped.
set( _CL_HAVE_NO_SNWPRINTF_BUG_EXITCODE "0" CACHE STRING "Result from TRY_RUN" FORCE)
set( _CL_HAVE_NO_SNWPRINTF_BUG_EXITCODE__TRYRUN_OUTPUT "" CACHE STRING "Output from TRY_RUN" FORCE)

set( LUCENE_STATIC_CONSTANT_SYNTAX_EXITCODE "0" CACHE STRING "Result from TRY_RUN" FORCE)
set( LUCENE_STATIC_CONSTANT_SYNTAX_EXITCODE__TRYRUN_OUTPUT "" CACHE STRING "Output from TRY_RUN" FORCE)

# The SDK's libSystem still exports the old stat64 functions, so CLucene's
# link checks find them, but the MacOS headers do not declare them. On MacOS
# stat, fstat and lseek are always 64 bit, so mark the 64 bit versions as
# missing.
set( _CL_HAVE_FUNCTION_FSTAT64 "" CACHE INTERNAL "")
set( _CL_HAVE_FUNCTION_STAT64 "" CACHE INTERNAL "")
set( _CL_HAVE_FUNCTION_LSEEK64 "" CACHE INTERNAL "")
set( _CL_HAVE_FUNCTION_TELL64 "" CACHE INTERNAL "")
