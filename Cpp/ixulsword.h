/*
 * DO NOT EDIT.  THIS FILE IS GENERATED FROM ixulsword.idl
 */

#ifndef __gen_ixulsword_h__
#define __gen_ixulsword_h__


#ifndef __gen_nsISupports_h__
#include "nsISupports.h"
#endif

/* For IDL files that don't want to include root IDL files. */
#ifndef NS_NO_VTABLE
#define NS_NO_VTABLE
#endif

/* starting interface:    ixulsword */
#define IXULSWORD_IID_STR "12029087-d9db-4688-a032-a560dffbee57"

#define IXULSWORD_IID \
  {0x12029087, 0xd9db, 0x4688, \
    { 0xa0, 0x32, 0xa5, 0x60, 0xdf, 0xfb, 0xee, 0x57 }}

class NS_NO_VTABLE NS_SCRIPTABLE ixulsword : public nsISupports {
 public: 

  NS_DECLARE_STATIC_IID_ACCESSOR(IXULSWORD_IID)

  /* AString setBiblesReference (in ACString Mod, in AString Vkeytext); */
  NS_SCRIPTABLE NS_IMETHOD SetBiblesReference(const nsACString & Mod, const nsAString & Vkeytext, nsAString & _retval NS_OUTPARAM) = 0;

  /* AString setVerse (in ACString Mod, in long firstverse, in long lastverse); */
  NS_SCRIPTABLE NS_IMETHOD SetVerse(const nsACString & Mod, PRInt32 firstverse, PRInt32 lastverse, nsAString & _retval NS_OUTPARAM) = 0;

  /* AString getLocation (in ACString Mod); */
  NS_SCRIPTABLE NS_IMETHOD GetLocation(const nsACString & Mod, nsAString & _retval NS_OUTPARAM) = 0;

  /* AString getBookName (); */
  NS_SCRIPTABLE NS_IMETHOD GetBookName(nsAString & _retval NS_OUTPARAM) = 0;

  /* AString getChapter (in ACString Mod); */
  NS_SCRIPTABLE NS_IMETHOD GetChapter(const nsACString & Mod, nsAString & _retval NS_OUTPARAM) = 0;

  /* long getVerseNumber (in ACString Mod); */
  NS_SCRIPTABLE NS_IMETHOD GetVerseNumber(const nsACString & Mod, PRInt32 *_retval NS_OUTPARAM) = 0;

  /* long getLastVerseNumber (in ACString Mod); */
  NS_SCRIPTABLE NS_IMETHOD GetLastVerseNumber(const nsACString & Mod, PRInt32 *_retval NS_OUTPARAM) = 0;

  /* long getChapterNumber (in ACString Mod); */
  NS_SCRIPTABLE NS_IMETHOD GetChapterNumber(const nsACString & Mod, PRInt32 *_retval NS_OUTPARAM) = 0;

  /* AString getChapterText (in ACString Vkeymod); */
  NS_SCRIPTABLE NS_IMETHOD GetChapterText(const nsACString & Vkeymod, nsAString & _retval NS_OUTPARAM) = 0;

  /* AString getChapterTextMulti (in ACString Vkeymodlist); */
  NS_SCRIPTABLE NS_IMETHOD GetChapterTextMulti(const nsACString & Vkeymodlist, nsAString & _retval NS_OUTPARAM) = 0;

  /* AString getVerseText (in ACString Vkeymod, in AString Vkeytext); */
  NS_SCRIPTABLE NS_IMETHOD GetVerseText(const nsACString & Vkeymod, const nsAString & Vkeytext, nsAString & _retval NS_OUTPARAM) = 0;

  /* long getMaxVerse (in ACString Mod, in AString Vkeytext); */
  NS_SCRIPTABLE NS_IMETHOD GetMaxVerse(const nsACString & Mod, const nsAString & Vkeytext, PRInt32 *_retval NS_OUTPARAM) = 0;

  /* AString getVerseSystem (in ACString Mod); */
  NS_SCRIPTABLE NS_IMETHOD GetVerseSystem(const nsACString & Mod, nsAString & _retval NS_OUTPARAM) = 0;

  /* AString convertLocation (in ACString FromVerseSystem, in AString Vkeytext, in ACString ToVerseSystem); */
  NS_SCRIPTABLE NS_IMETHOD ConvertLocation(const nsACString & FromVerseSystem, const nsAString & Vkeytext, const nsACString & ToVerseSystem, nsAString & _retval NS_OUTPARAM) = 0;

  /* AString getBookIntroduction (in ACString Vkeymod, in AString Bname); */
  NS_SCRIPTABLE NS_IMETHOD GetBookIntroduction(const nsACString & Vkeymod, const nsAString & Bname, nsAString & _retval NS_OUTPARAM) = 0;

  /* AString getDictionaryEntry (in ACString Lexdictmod, in AString Key); */
  NS_SCRIPTABLE NS_IMETHOD GetDictionaryEntry(const nsACString & Lexdictmod, const nsAString & Key, nsAString & _retval NS_OUTPARAM) = 0;

  /* AString getAllDictionaryKeys (in ACString Lexdictmod); */
  NS_SCRIPTABLE NS_IMETHOD GetAllDictionaryKeys(const nsACString & Lexdictmod, nsAString & _retval NS_OUTPARAM) = 0;

  /* AString getGenBookChapterText (in ACString Gbmod, in AString Treekey); */
  NS_SCRIPTABLE NS_IMETHOD GetGenBookChapterText(const nsACString & Gbmod, const nsAString & Treekey, nsAString & _retval NS_OUTPARAM) = 0;

  /* AString getGenBookTableOfContents (in ACString Gbmod); */
  NS_SCRIPTABLE NS_IMETHOD GetGenBookTableOfContents(const nsACString & Gbmod, nsAString & _retval NS_OUTPARAM) = 0;

  /* AString getFootnotes (); */
  NS_SCRIPTABLE NS_IMETHOD GetFootnotes(nsAString & _retval NS_OUTPARAM) = 0;

  /* AString getCrossRefs (); */
  NS_SCRIPTABLE NS_IMETHOD GetCrossRefs(nsAString & _retval NS_OUTPARAM) = 0;

  /* AString getNotes (); */
  NS_SCRIPTABLE NS_IMETHOD GetNotes(nsAString & _retval NS_OUTPARAM) = 0;

  /* boolean luceneEnabled (in ACString Mod); */
  NS_SCRIPTABLE NS_IMETHOD LuceneEnabled(const nsACString & Mod, bool *_retval NS_OUTPARAM) = 0;

  /* long search (in ACString Mod, in AString Srchstr, in ACString Scope, in long type, in long flags, in boolean newsearch); */
  NS_SCRIPTABLE NS_IMETHOD Search(const nsACString & Mod, const nsAString & Srchstr, const nsACString & Scope, PRInt32 type, PRInt32 flags, bool newsearch, PRInt32 *_retval NS_OUTPARAM) = 0;

  /* AString getSearchVerses (in ACString Mod); */
  NS_SCRIPTABLE NS_IMETHOD GetSearchVerses(const nsACString & Mod, nsAString & _retval NS_OUTPARAM) = 0;

  /* AString getSearchTexts (in ACString Mod, in long first, in long num, in boolean keepStrongs); */
  NS_SCRIPTABLE NS_IMETHOD GetSearchTexts(const nsACString & Mod, PRInt32 first, PRInt32 num, bool keepStrongs, nsAString & _retval NS_OUTPARAM) = 0;

  /* void searchIndexDelete (in ACString Mod); */
  NS_SCRIPTABLE NS_IMETHOD SearchIndexDelete(const nsACString & Mod) = 0;

  /* long searchIndexBuild (in ACString Mod, in long maxwait); */
  NS_SCRIPTABLE NS_IMETHOD SearchIndexBuild(const nsACString & Mod, PRInt32 maxwait, PRInt32 *_retval NS_OUTPARAM) = 0;

  /* void setGlobalOption (in ACString Option, in ACString Setting); */
  NS_SCRIPTABLE NS_IMETHOD SetGlobalOption(const nsACString & Option, const nsACString & Setting) = 0;

  /* AString getGlobalOption (in ACString Option); */
  NS_SCRIPTABLE NS_IMETHOD GetGlobalOption(const nsACString & Option, nsAString & _retval NS_OUTPARAM) = 0;

  /* void setCipherKey (in ACString Mod, in AString Cipherkey, in boolean useSecModule); */
  NS_SCRIPTABLE NS_IMETHOD SetCipherKey(const nsACString & Mod, const nsAString & Cipherkey, bool useSecModule) = 0;

  /* AString getModuleList (); */
  NS_SCRIPTABLE NS_IMETHOD GetModuleList(nsAString & _retval NS_OUTPARAM) = 0;

  /* AString getModuleInformation (in ACString Mod, in ACString Paramname); */
  NS_SCRIPTABLE NS_IMETHOD GetModuleInformation(const nsACString & Mod, const nsACString & Paramname, nsAString & _retval NS_OUTPARAM) = 0;

};

  NS_DEFINE_STATIC_IID_ACCESSOR(ixulsword, IXULSWORD_IID)

/* Use this macro when declaring classes that implement this interface. */
#define NS_DECL_IXULSWORD \
  NS_SCRIPTABLE NS_IMETHOD SetBiblesReference(const nsACString & Mod, const nsAString & Vkeytext, nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD SetVerse(const nsACString & Mod, PRInt32 firstverse, PRInt32 lastverse, nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetLocation(const nsACString & Mod, nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetBookName(nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetChapter(const nsACString & Mod, nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetVerseNumber(const nsACString & Mod, PRInt32 *_retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetLastVerseNumber(const nsACString & Mod, PRInt32 *_retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetChapterNumber(const nsACString & Mod, PRInt32 *_retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetChapterText(const nsACString & Vkeymod, nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetChapterTextMulti(const nsACString & Vkeymodlist, nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetVerseText(const nsACString & Vkeymod, const nsAString & Vkeytext, nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetMaxVerse(const nsACString & Mod, const nsAString & Vkeytext, PRInt32 *_retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetVerseSystem(const nsACString & Mod, nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD ConvertLocation(const nsACString & FromVerseSystem, const nsAString & Vkeytext, const nsACString & ToVerseSystem, nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetBookIntroduction(const nsACString & Vkeymod, const nsAString & Bname, nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetDictionaryEntry(const nsACString & Lexdictmod, const nsAString & Key, nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetAllDictionaryKeys(const nsACString & Lexdictmod, nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetGenBookChapterText(const nsACString & Gbmod, const nsAString & Treekey, nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetGenBookTableOfContents(const nsACString & Gbmod, nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetFootnotes(nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetCrossRefs(nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetNotes(nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD LuceneEnabled(const nsACString & Mod, bool *_retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD Search(const nsACString & Mod, const nsAString & Srchstr, const nsACString & Scope, PRInt32 type, PRInt32 flags, bool newsearch, PRInt32 *_retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetSearchVerses(const nsACString & Mod, nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetSearchTexts(const nsACString & Mod, PRInt32 first, PRInt32 num, bool keepStrongs, nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD SearchIndexDelete(const nsACString & Mod); \
  NS_SCRIPTABLE NS_IMETHOD SearchIndexBuild(const nsACString & Mod, PRInt32 maxwait, PRInt32 *_retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD SetGlobalOption(const nsACString & Option, const nsACString & Setting); \
  NS_SCRIPTABLE NS_IMETHOD GetGlobalOption(const nsACString & Option, nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD SetCipherKey(const nsACString & Mod, const nsAString & Cipherkey, bool useSecModule); \
  NS_SCRIPTABLE NS_IMETHOD GetModuleList(nsAString & _retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetModuleInformation(const nsACString & Mod, const nsACString & Paramname, nsAString & _retval NS_OUTPARAM); 

/* Use this macro to declare functions that forward the behavior of this interface to another object. */
#define NS_FORWARD_IXULSWORD(_to) \
  NS_SCRIPTABLE NS_IMETHOD SetBiblesReference(const nsACString & Mod, const nsAString & Vkeytext, nsAString & _retval NS_OUTPARAM) { return _to SetBiblesReference(Mod, Vkeytext, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD SetVerse(const nsACString & Mod, PRInt32 firstverse, PRInt32 lastverse, nsAString & _retval NS_OUTPARAM) { return _to SetVerse(Mod, firstverse, lastverse, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetLocation(const nsACString & Mod, nsAString & _retval NS_OUTPARAM) { return _to GetLocation(Mod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetBookName(nsAString & _retval NS_OUTPARAM) { return _to GetBookName(_retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetChapter(const nsACString & Mod, nsAString & _retval NS_OUTPARAM) { return _to GetChapter(Mod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetVerseNumber(const nsACString & Mod, PRInt32 *_retval NS_OUTPARAM) { return _to GetVerseNumber(Mod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetLastVerseNumber(const nsACString & Mod, PRInt32 *_retval NS_OUTPARAM) { return _to GetLastVerseNumber(Mod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetChapterNumber(const nsACString & Mod, PRInt32 *_retval NS_OUTPARAM) { return _to GetChapterNumber(Mod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetChapterText(const nsACString & Vkeymod, nsAString & _retval NS_OUTPARAM) { return _to GetChapterText(Vkeymod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetChapterTextMulti(const nsACString & Vkeymodlist, nsAString & _retval NS_OUTPARAM) { return _to GetChapterTextMulti(Vkeymodlist, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetVerseText(const nsACString & Vkeymod, const nsAString & Vkeytext, nsAString & _retval NS_OUTPARAM) { return _to GetVerseText(Vkeymod, Vkeytext, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetMaxVerse(const nsACString & Mod, const nsAString & Vkeytext, PRInt32 *_retval NS_OUTPARAM) { return _to GetMaxVerse(Mod, Vkeytext, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetVerseSystem(const nsACString & Mod, nsAString & _retval NS_OUTPARAM) { return _to GetVerseSystem(Mod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD ConvertLocation(const nsACString & FromVerseSystem, const nsAString & Vkeytext, const nsACString & ToVerseSystem, nsAString & _retval NS_OUTPARAM) { return _to ConvertLocation(FromVerseSystem, Vkeytext, ToVerseSystem, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetBookIntroduction(const nsACString & Vkeymod, const nsAString & Bname, nsAString & _retval NS_OUTPARAM) { return _to GetBookIntroduction(Vkeymod, Bname, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetDictionaryEntry(const nsACString & Lexdictmod, const nsAString & Key, nsAString & _retval NS_OUTPARAM) { return _to GetDictionaryEntry(Lexdictmod, Key, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetAllDictionaryKeys(const nsACString & Lexdictmod, nsAString & _retval NS_OUTPARAM) { return _to GetAllDictionaryKeys(Lexdictmod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetGenBookChapterText(const nsACString & Gbmod, const nsAString & Treekey, nsAString & _retval NS_OUTPARAM) { return _to GetGenBookChapterText(Gbmod, Treekey, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetGenBookTableOfContents(const nsACString & Gbmod, nsAString & _retval NS_OUTPARAM) { return _to GetGenBookTableOfContents(Gbmod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetFootnotes(nsAString & _retval NS_OUTPARAM) { return _to GetFootnotes(_retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetCrossRefs(nsAString & _retval NS_OUTPARAM) { return _to GetCrossRefs(_retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetNotes(nsAString & _retval NS_OUTPARAM) { return _to GetNotes(_retval); } \
  NS_SCRIPTABLE NS_IMETHOD LuceneEnabled(const nsACString & Mod, bool *_retval NS_OUTPARAM) { return _to LuceneEnabled(Mod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD Search(const nsACString & Mod, const nsAString & Srchstr, const nsACString & Scope, PRInt32 type, PRInt32 flags, bool newsearch, PRInt32 *_retval NS_OUTPARAM) { return _to Search(Mod, Srchstr, Scope, type, flags, newsearch, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetSearchVerses(const nsACString & Mod, nsAString & _retval NS_OUTPARAM) { return _to GetSearchVerses(Mod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetSearchTexts(const nsACString & Mod, PRInt32 first, PRInt32 num, bool keepStrongs, nsAString & _retval NS_OUTPARAM) { return _to GetSearchTexts(Mod, first, num, keepStrongs, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD SearchIndexDelete(const nsACString & Mod) { return _to SearchIndexDelete(Mod); } \
  NS_SCRIPTABLE NS_IMETHOD SearchIndexBuild(const nsACString & Mod, PRInt32 maxwait, PRInt32 *_retval NS_OUTPARAM) { return _to SearchIndexBuild(Mod, maxwait, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD SetGlobalOption(const nsACString & Option, const nsACString & Setting) { return _to SetGlobalOption(Option, Setting); } \
  NS_SCRIPTABLE NS_IMETHOD GetGlobalOption(const nsACString & Option, nsAString & _retval NS_OUTPARAM) { return _to GetGlobalOption(Option, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD SetCipherKey(const nsACString & Mod, const nsAString & Cipherkey, bool useSecModule) { return _to SetCipherKey(Mod, Cipherkey, useSecModule); } \
  NS_SCRIPTABLE NS_IMETHOD GetModuleList(nsAString & _retval NS_OUTPARAM) { return _to GetModuleList(_retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetModuleInformation(const nsACString & Mod, const nsACString & Paramname, nsAString & _retval NS_OUTPARAM) { return _to GetModuleInformation(Mod, Paramname, _retval); } 

/* Use this macro to declare functions that forward the behavior of this interface to another object in a safe way. */
#define NS_FORWARD_SAFE_IXULSWORD(_to) \
  NS_SCRIPTABLE NS_IMETHOD SetBiblesReference(const nsACString & Mod, const nsAString & Vkeytext, nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->SetBiblesReference(Mod, Vkeytext, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD SetVerse(const nsACString & Mod, PRInt32 firstverse, PRInt32 lastverse, nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->SetVerse(Mod, firstverse, lastverse, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetLocation(const nsACString & Mod, nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetLocation(Mod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetBookName(nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetBookName(_retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetChapter(const nsACString & Mod, nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetChapter(Mod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetVerseNumber(const nsACString & Mod, PRInt32 *_retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetVerseNumber(Mod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetLastVerseNumber(const nsACString & Mod, PRInt32 *_retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetLastVerseNumber(Mod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetChapterNumber(const nsACString & Mod, PRInt32 *_retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetChapterNumber(Mod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetChapterText(const nsACString & Vkeymod, nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetChapterText(Vkeymod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetChapterTextMulti(const nsACString & Vkeymodlist, nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetChapterTextMulti(Vkeymodlist, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetVerseText(const nsACString & Vkeymod, const nsAString & Vkeytext, nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetVerseText(Vkeymod, Vkeytext, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetMaxVerse(const nsACString & Mod, const nsAString & Vkeytext, PRInt32 *_retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetMaxVerse(Mod, Vkeytext, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetVerseSystem(const nsACString & Mod, nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetVerseSystem(Mod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD ConvertLocation(const nsACString & FromVerseSystem, const nsAString & Vkeytext, const nsACString & ToVerseSystem, nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->ConvertLocation(FromVerseSystem, Vkeytext, ToVerseSystem, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetBookIntroduction(const nsACString & Vkeymod, const nsAString & Bname, nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetBookIntroduction(Vkeymod, Bname, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetDictionaryEntry(const nsACString & Lexdictmod, const nsAString & Key, nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetDictionaryEntry(Lexdictmod, Key, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetAllDictionaryKeys(const nsACString & Lexdictmod, nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetAllDictionaryKeys(Lexdictmod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetGenBookChapterText(const nsACString & Gbmod, const nsAString & Treekey, nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetGenBookChapterText(Gbmod, Treekey, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetGenBookTableOfContents(const nsACString & Gbmod, nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetGenBookTableOfContents(Gbmod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetFootnotes(nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetFootnotes(_retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetCrossRefs(nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetCrossRefs(_retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetNotes(nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetNotes(_retval); } \
  NS_SCRIPTABLE NS_IMETHOD LuceneEnabled(const nsACString & Mod, bool *_retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->LuceneEnabled(Mod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD Search(const nsACString & Mod, const nsAString & Srchstr, const nsACString & Scope, PRInt32 type, PRInt32 flags, bool newsearch, PRInt32 *_retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->Search(Mod, Srchstr, Scope, type, flags, newsearch, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetSearchVerses(const nsACString & Mod, nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetSearchVerses(Mod, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetSearchTexts(const nsACString & Mod, PRInt32 first, PRInt32 num, bool keepStrongs, nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetSearchTexts(Mod, first, num, keepStrongs, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD SearchIndexDelete(const nsACString & Mod) { return !_to ? NS_ERROR_NULL_POINTER : _to->SearchIndexDelete(Mod); } \
  NS_SCRIPTABLE NS_IMETHOD SearchIndexBuild(const nsACString & Mod, PRInt32 maxwait, PRInt32 *_retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->SearchIndexBuild(Mod, maxwait, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD SetGlobalOption(const nsACString & Option, const nsACString & Setting) { return !_to ? NS_ERROR_NULL_POINTER : _to->SetGlobalOption(Option, Setting); } \
  NS_SCRIPTABLE NS_IMETHOD GetGlobalOption(const nsACString & Option, nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetGlobalOption(Option, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD SetCipherKey(const nsACString & Mod, const nsAString & Cipherkey, bool useSecModule) { return !_to ? NS_ERROR_NULL_POINTER : _to->SetCipherKey(Mod, Cipherkey, useSecModule); } \
  NS_SCRIPTABLE NS_IMETHOD GetModuleList(nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetModuleList(_retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetModuleInformation(const nsACString & Mod, const nsACString & Paramname, nsAString & _retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetModuleInformation(Mod, Paramname, _retval); } 

#if 0
/* Use the code below as a template for the implementation class for this interface. */

/* Header file */
class _MYCLASS_ : public ixulsword
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_IXULSWORD

  _MYCLASS_();

private:
  ~_MYCLASS_();

protected:
  /* additional members */
};

/* Implementation file */
NS_IMPL_ISUPPORTS1(_MYCLASS_, ixulsword)

_MYCLASS_::_MYCLASS_()
{
  /* member initializers and constructor code */
}

_MYCLASS_::~_MYCLASS_()
{
  /* destructor code */
}

/* AString setBiblesReference (in ACString Mod, in AString Vkeytext); */
NS_IMETHODIMP _MYCLASS_::SetBiblesReference(const nsACString & Mod, const nsAString & Vkeytext, nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString setVerse (in ACString Mod, in long firstverse, in long lastverse); */
NS_IMETHODIMP _MYCLASS_::SetVerse(const nsACString & Mod, PRInt32 firstverse, PRInt32 lastverse, nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getLocation (in ACString Mod); */
NS_IMETHODIMP _MYCLASS_::GetLocation(const nsACString & Mod, nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getBookName (); */
NS_IMETHODIMP _MYCLASS_::GetBookName(nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getChapter (in ACString Mod); */
NS_IMETHODIMP _MYCLASS_::GetChapter(const nsACString & Mod, nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* long getVerseNumber (in ACString Mod); */
NS_IMETHODIMP _MYCLASS_::GetVerseNumber(const nsACString & Mod, PRInt32 *_retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* long getLastVerseNumber (in ACString Mod); */
NS_IMETHODIMP _MYCLASS_::GetLastVerseNumber(const nsACString & Mod, PRInt32 *_retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* long getChapterNumber (in ACString Mod); */
NS_IMETHODIMP _MYCLASS_::GetChapterNumber(const nsACString & Mod, PRInt32 *_retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getChapterText (in ACString Vkeymod); */
NS_IMETHODIMP _MYCLASS_::GetChapterText(const nsACString & Vkeymod, nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getChapterTextMulti (in ACString Vkeymodlist); */
NS_IMETHODIMP _MYCLASS_::GetChapterTextMulti(const nsACString & Vkeymodlist, nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getVerseText (in ACString Vkeymod, in AString Vkeytext); */
NS_IMETHODIMP _MYCLASS_::GetVerseText(const nsACString & Vkeymod, const nsAString & Vkeytext, nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* long getMaxVerse (in ACString Mod, in AString Vkeytext); */
NS_IMETHODIMP _MYCLASS_::GetMaxVerse(const nsACString & Mod, const nsAString & Vkeytext, PRInt32 *_retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getVerseSystem (in ACString Mod); */
NS_IMETHODIMP _MYCLASS_::GetVerseSystem(const nsACString & Mod, nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString convertLocation (in ACString FromVerseSystem, in AString Vkeytext, in ACString ToVerseSystem); */
NS_IMETHODIMP _MYCLASS_::ConvertLocation(const nsACString & FromVerseSystem, const nsAString & Vkeytext, const nsACString & ToVerseSystem, nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getBookIntroduction (in ACString Vkeymod, in AString Bname); */
NS_IMETHODIMP _MYCLASS_::GetBookIntroduction(const nsACString & Vkeymod, const nsAString & Bname, nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getDictionaryEntry (in ACString Lexdictmod, in AString Key); */
NS_IMETHODIMP _MYCLASS_::GetDictionaryEntry(const nsACString & Lexdictmod, const nsAString & Key, nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getAllDictionaryKeys (in ACString Lexdictmod); */
NS_IMETHODIMP _MYCLASS_::GetAllDictionaryKeys(const nsACString & Lexdictmod, nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getGenBookChapterText (in ACString Gbmod, in AString Treekey); */
NS_IMETHODIMP _MYCLASS_::GetGenBookChapterText(const nsACString & Gbmod, const nsAString & Treekey, nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getGenBookTableOfContents (in ACString Gbmod); */
NS_IMETHODIMP _MYCLASS_::GetGenBookTableOfContents(const nsACString & Gbmod, nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getFootnotes (); */
NS_IMETHODIMP _MYCLASS_::GetFootnotes(nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getCrossRefs (); */
NS_IMETHODIMP _MYCLASS_::GetCrossRefs(nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getNotes (); */
NS_IMETHODIMP _MYCLASS_::GetNotes(nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* boolean luceneEnabled (in ACString Mod); */
NS_IMETHODIMP _MYCLASS_::LuceneEnabled(const nsACString & Mod, bool *_retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* long search (in ACString Mod, in AString Srchstr, in ACString Scope, in long type, in long flags, in boolean newsearch); */
NS_IMETHODIMP _MYCLASS_::Search(const nsACString & Mod, const nsAString & Srchstr, const nsACString & Scope, PRInt32 type, PRInt32 flags, bool newsearch, PRInt32 *_retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getSearchVerses (in ACString Mod); */
NS_IMETHODIMP _MYCLASS_::GetSearchVerses(const nsACString & Mod, nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getSearchTexts (in ACString Mod, in long first, in long num, in boolean keepStrongs); */
NS_IMETHODIMP _MYCLASS_::GetSearchTexts(const nsACString & Mod, PRInt32 first, PRInt32 num, bool keepStrongs, nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* void searchIndexDelete (in ACString Mod); */
NS_IMETHODIMP _MYCLASS_::SearchIndexDelete(const nsACString & Mod)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* long searchIndexBuild (in ACString Mod, in long maxwait); */
NS_IMETHODIMP _MYCLASS_::SearchIndexBuild(const nsACString & Mod, PRInt32 maxwait, PRInt32 *_retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* void setGlobalOption (in ACString Option, in ACString Setting); */
NS_IMETHODIMP _MYCLASS_::SetGlobalOption(const nsACString & Option, const nsACString & Setting)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getGlobalOption (in ACString Option); */
NS_IMETHODIMP _MYCLASS_::GetGlobalOption(const nsACString & Option, nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* void setCipherKey (in ACString Mod, in AString Cipherkey, in boolean useSecModule); */
NS_IMETHODIMP _MYCLASS_::SetCipherKey(const nsACString & Mod, const nsAString & Cipherkey, bool useSecModule)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getModuleList (); */
NS_IMETHODIMP _MYCLASS_::GetModuleList(nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* AString getModuleInformation (in ACString Mod, in ACString Paramname); */
NS_IMETHODIMP _MYCLASS_::GetModuleInformation(const nsACString & Mod, const nsACString & Paramname, nsAString & _retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* End of implementation class template. */
#endif


#endif /* __gen_ixulsword_h__ */
