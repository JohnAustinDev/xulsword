#include <cstdlib>
#include <napi.h>
#include "libxulsword.h"

napi_env xsenv = NULL;

// These are Javascript functions that are run in C++
char *toUpperCase(char *string) {
  napi_value global, toUpperCase;
  napi_status status = napi_get_global(xsenv, &global);
  if (status != napi_ok) return NULL;

  status = napi_get_named_property(xsenv, global, "ToUpperCase", &toUpperCase);
  if (status != napi_ok) return NULL;

  // Convert the string to Javascript type
  napi_value napiString;
  status = napi_create_string_utf8(xsenv, string, NAPI_AUTO_LENGTH, &napiString);

  // Uppercase it using the Javascript function
  napi_value jsUpperCaseResult;
  napi_call_function(xsenv, global, toUpperCase, 1, &napiString, &jsUpperCaseResult);
  if (status != napi_ok) return NULL;

  // Convert the result back to a native type
  size_t buflen;
  size_t outlen;
  status = napi_get_value_string_utf8(xsenv, jsUpperCaseResult, NULL, 0, &buflen);
  if (status != napi_ok) return NULL;
  char *upperCaseBuf = (char *)malloc(buflen + 1);
  status = napi_get_value_string_utf8(xsenv, jsUpperCaseResult, upperCaseBuf, buflen, &outlen);
  if (status != napi_ok) return NULL;

  return upperCaseBuf;
}

Napi::Boolean napiGetXulsword(const Napi::CallbackInfo& info) {
  xsenv = info.Env();

  void *result = GetXulsword(
    (char*) info[0].ToString().Utf8Value().c_str(),
    &toUpperCase,
    NULL
  );

  return Napi::Boolean::New(info.Env(), result);
}

Napi::Boolean napiFreeLibXulsword(const Napi::CallbackInfo& info) {
  FreeLibxulsword();
  xsenv = NULL;
  return Napi::Boolean::New(info.Env(), true);
}

Napi::String napiConvertLocation(const Napi::CallbackInfo& info) {
  char* location = ConvertLocation(
    (char*) info[0].ToString().Utf8Value().c_str(),   // frVS
    (char*) info[1].ToString().Utf8Value().c_str(),   // vkeytext
    (char*) info[2].ToString().Utf8Value().c_str());  // toVS
  Napi::String napiLocation = Napi::String::New(info.Env(), location);
  free(location);
  return napiLocation;
}

Napi::String napiGetAllDictionaryKeys(const Napi::CallbackInfo& info) {
  char* allDictionaryKeys = GetAllDictionaryKeys(
    (char*) info[0].ToString().Utf8Value().c_str());
  Napi::String napiAllDictionaryKeys = Napi::String::New(info.Env(), allDictionaryKeys);
  free(allDictionaryKeys);
  return napiAllDictionaryKeys;
}

Napi::String napiGetChapterText(const Napi::CallbackInfo& info) {
  char* chapterText = GetChapterText(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str());
  Napi::String napiChapterText = Napi::String::New(info.Env(), chapterText);
  free(chapterText);
  return napiChapterText;
}

Napi::String napiGetChapterTextMulti(const Napi::CallbackInfo& info) {
  char* chapterTextMulti = GetChapterTextMulti(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str(),
    (char*) info[2].As<Napi::Boolean>().Value());
  Napi::String napiChapterTextMulti = Napi::String::New(info.Env(), chapterTextMulti);
  free(chapterTextMulti);
  return napiChapterTextMulti;
}

Napi::String napiGetCrossRefs(const Napi::CallbackInfo& info) {
  char* crossRefs = GetCrossRefs();
  Napi::String napiCrossRefs = Napi::String::New(info.Env(), crossRefs);
  free(crossRefs);
  return napiCrossRefs;
}

Napi::String napiGetDictionaryEntry(const Napi::CallbackInfo& info) {
  char* dictionaryEntry = GetDictionaryEntry(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str());
  Napi::String napiDictionaryEntry = Napi::String::New(info.Env(), dictionaryEntry);
  free(dictionaryEntry);
  return napiDictionaryEntry;
}

Napi::String napiGetFootnotes(const Napi::CallbackInfo& info) {
  char* footnotes = GetFootnotes();
  Napi::String napiFootnotes = Napi::String::New(info.Env(), footnotes);
  free(footnotes);
  return napiFootnotes;
}

Napi::String napiGetGenBookChapterText(const Napi::CallbackInfo& info) {
  char* genBookChapterText = GetGenBookChapterText(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str());
  Napi::String napiGenBookChapterText = Napi::String::New(info.Env(), genBookChapterText);
  free(genBookChapterText);
  return napiGenBookChapterText;
}

Napi::String napiGetGenBookTableOfContents(const Napi::CallbackInfo& info) {
  char* genBookTableOfContents = GetGenBookTableOfContents(
    (char*) info[0].ToString().Utf8Value().c_str());
  Napi::String napiGenBookTableOfContents = Napi::String::New(info.Env(), genBookTableOfContents);
  free(genBookTableOfContents);
  return napiGenBookTableOfContents;
}

Napi::String napiGetGlobalOption(const Napi::CallbackInfo& info) {
  char* globalOption = GetGlobalOption(
    (char*) info[0].ToString().Utf8Value().c_str());
  Napi::String napiGlobalOption = Napi::String::New(info.Env(), globalOption);
  free(globalOption);
  return napiGlobalOption;
}
Napi::String napiGetIntroductions(const Napi::CallbackInfo& info) {
  char* introductions = GetIntroductions(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str());
  Napi::String napiIntroductions = Napi::String::New(info.Env(), introductions);
  free(introductions);
  return napiIntroductions;
}

Napi::Number napiGetMaxChapter(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), GetMaxChapter(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str()));
}

Napi::Number napiGetMaxVerse(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), GetMaxVerse(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str()));
}

Napi::String napiGetModuleInformation(const Napi::CallbackInfo& info) {
  char* moduleInformation = GetModuleInformation(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str());
  Napi::String napiModuleInformation = Napi::String::New(info.Env(), moduleInformation);
  free(moduleInformation);
  return napiModuleInformation;
}

Napi::String napiGetModuleList(const Napi::CallbackInfo& info) {
  char* moduleList = GetModuleList();
  Napi::String napiModuleList = Napi::String::New(info.Env(), moduleList);
  free(moduleList);
  return napiModuleList;
}

Napi::String napiGetNotes(const Napi::CallbackInfo& info) {
  char* notes = GetNotes();
  Napi::String napiNotes = Napi::String::New(info.Env(), notes);
  free(notes);
  return napiNotes;
}

Napi::String napiGetSearchResults(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), GetSearchResults(
    (char*) info[0].ToString().Utf8Value().c_str(),
            info[1].As<Napi::Number>().Int32Value(),
            info[2].As<Napi::Number>().Int32Value(),
            info[3].As<Napi::Boolean>().Value()
          ));
}

Napi::String napiGetVerseSystem(const Napi::CallbackInfo& info) {
  char* verseSystem = GetVerseSystem(
    (char*) info[0].ToString().Utf8Value().c_str());
  Napi::String napiVerseSystem = Napi::String::New(info.Env(), verseSystem);
  free(verseSystem);
  return napiVerseSystem;
}

Napi::String napiGetVerseText(const Napi::CallbackInfo& info) {
  char* verseText = GetVerseText(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str(),
    (char*) info[2].As<Napi::Boolean>().Value());
  Napi::String napiVerseText = Napi::String::New(info.Env(), verseText);
  free(verseText);
  return napiVerseText;
}

Napi::Boolean napiLuceneEnabled(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), LuceneEnabled(
    (char*) info[0].ToString().Utf8Value().c_str()));
}

Napi::Number napiSearch(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), Search(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str(),
    (char*) info[2].ToString().Utf8Value().c_str(),
            info[3].As<Napi::Number>().Int32Value(),
            info[4].As<Napi::Number>().Int32Value(),
            info[5].As<Napi::Boolean>().Value()));
}

void napiSearchIndexBuild(const Napi::CallbackInfo& info) {
  SearchIndexBuild(
    (char*) info[0].ToString().Utf8Value().c_str());
  return;
}

void napiSearchIndexDelete(const Napi::CallbackInfo& info) {
  SearchIndexDelete(
    (char*) info[0].ToString().Utf8Value().c_str());
  return;
}

void napiSetCipherKey(const Napi::CallbackInfo& info) {
  SetCipherKey(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str(),
            info[2].As<Napi::Boolean>().Value());
  return;
}

void napiSetGlobalOption(const Napi::CallbackInfo& info) {
  SetGlobalOption(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str());
  return;
}

void RunCallback(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Function cb = info[0].As<Napi::Function>();
  cb.Call(env.Global(), {Napi::String::New(env, "hello world")});
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "ConvertLocation"),           Napi::Function::New(env, napiConvertLocation));
  exports.Set(Napi::String::New(env, "FreeLibXulsword"),           Napi::Function::New(env, napiFreeLibXulsword));
  exports.Set(Napi::String::New(env, "GetAllDictionaryKeys"),      Napi::Function::New(env, napiGetAllDictionaryKeys));
  exports.Set(Napi::String::New(env, "GetChapterText"),            Napi::Function::New(env, napiGetChapterText));
  exports.Set(Napi::String::New(env, "GetChapterTextMulti"),       Napi::Function::New(env, napiGetChapterTextMulti));
  exports.Set(Napi::String::New(env, "GetCrossRefs"),              Napi::Function::New(env, napiGetCrossRefs));
  exports.Set(Napi::String::New(env, "GetDictionaryEntry"),        Napi::Function::New(env, napiGetDictionaryEntry));
  exports.Set(Napi::String::New(env, "GetFootnotes"),              Napi::Function::New(env, napiGetFootnotes));
  exports.Set(Napi::String::New(env, "GetGenBookChapterText"),     Napi::Function::New(env, napiGetGenBookChapterText));
  exports.Set(Napi::String::New(env, "GetGenBookTableOfContents"), Napi::Function::New(env, napiGetGenBookTableOfContents));
  exports.Set(Napi::String::New(env, "GetGlobalOption"),           Napi::Function::New(env, napiGetGlobalOption));
  exports.Set(Napi::String::New(env, "GetIntroductions"),          Napi::Function::New(env, napiGetIntroductions));
  exports.Set(Napi::String::New(env, "GetMaxChapter"),             Napi::Function::New(env, napiGetMaxChapter));
  exports.Set(Napi::String::New(env, "GetMaxVerse"),               Napi::Function::New(env, napiGetMaxVerse));
  exports.Set(Napi::String::New(env, "GetModuleInformation"),      Napi::Function::New(env, napiGetModuleInformation));
  exports.Set(Napi::String::New(env, "GetModuleList"),             Napi::Function::New(env, napiGetModuleList));
  exports.Set(Napi::String::New(env, "GetNotes"),                  Napi::Function::New(env, napiGetNotes));
  exports.Set(Napi::String::New(env, "GetSearchResults"),          Napi::Function::New(env, napiGetSearchResults));
  exports.Set(Napi::String::New(env, "GetVerseSystem"),            Napi::Function::New(env, napiGetVerseSystem));
  exports.Set(Napi::String::New(env, "GetVerseText"),              Napi::Function::New(env, napiGetVerseText));
  exports.Set(Napi::String::New(env, "GetXulsword"),               Napi::Function::New(env, napiGetXulsword));
  exports.Set(Napi::String::New(env, "LuceneEnabled"),             Napi::Function::New(env, napiLuceneEnabled));
  exports.Set(Napi::String::New(env, "Search"),                    Napi::Function::New(env, napiSearch));
  exports.Set(Napi::String::New(env, "SearchIndexBuild"),          Napi::Function::New(env, napiSearchIndexBuild));
  exports.Set(Napi::String::New(env, "SearchIndexDelete"),         Napi::Function::New(env, napiSearchIndexDelete));
  exports.Set(Napi::String::New(env, "SetCipherKey"),              Napi::Function::New(env, napiSetCipherKey));
  exports.Set(Napi::String::New(env, "SetGlobalOption"),           Napi::Function::New(env, napiSetGlobalOption));
  exports.Set(Napi::String::New(env, "callback"),                  Napi::Function::New(env, RunCallback));
return exports;
}

NODE_API_MODULE(hello, Init)
