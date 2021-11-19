#include <napi.h>
#include "xulsword.h"

using namespace sword;

extern "C" {
  void FreeMemory(void *tofree, const char *memType);
}

xulsword* myXulsword = NULL;
//Napi::Env      env;
Napi::Function toUpperCaseFunction;
Napi::Function throwJsFunction;
Napi::Function reportProgressFunction;
Napi::String buffer = Napi::String();

char* toUpperCase(char* lowerCase) {
  static char* upperCase = NULL;
  if (upperCase != NULL)
    free(upperCase);
  upperCase = (char*) strdup(lowerCase);
  for (size_t index = 0; index < strlen(lowerCase); index++)
    upperCase[index] = isalpha(lowerCase[index]) ? toupper(lowerCase[index]) : lowerCase[index];
  return upperCase;
};

void throwJs(const char* message) {
  // return nullptr;
};

void reportProgress(int progress) { 
  printf("progress: %d\n", progress);
  // return nullptr;
};

Napi::String ConvertLocation(const Napi::CallbackInfo& info) {
  char* location = myXulsword->convertLocation(
    (char*) info[0].ToString().Utf8Value().c_str(),   // frVS
    (char*) info[1].ToString().Utf8Value().c_str(),   // vkeytext
    (char*) info[2].ToString().Utf8Value().c_str());  // toVS
  Napi::String napiLocation = Napi::String::New(info.Env(), location);
  FreeMemory(location, "char");
  return napiLocation;
}

Napi::String GetAllDictionaryKeys(const Napi::CallbackInfo& info) {
  char* allDictionaryKeys = myXulsword->getAllDictionaryKeys(
    (char*) info[0].ToString().Utf8Value().c_str());
  Napi::String napiAllDictionaryKeys = Napi::String::New(info.Env(), allDictionaryKeys);
  FreeMemory(allDictionaryKeys, "char");
  return napiAllDictionaryKeys;
}

Napi::String GetChapterText(const Napi::CallbackInfo& info) {
  char* chapterText = myXulsword->getChapterText(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str());
  Napi::String napiChapterText = Napi::String::New(info.Env(), chapterText);
  FreeMemory(chapterText, "char");
  return napiChapterText;
}

Napi::String GetChapterTextMulti(const Napi::CallbackInfo& info) {
  char* chapterTextMulti = myXulsword->getChapterTextMulti(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str(),
    (char*) info[2].As<Napi::Boolean>().Value());
  Napi::String napiChapterTextMulti = Napi::String::New(info.Env(), chapterTextMulti);
  FreeMemory(chapterTextMulti, "char");
  return napiChapterTextMulti;
}

Napi::String GetCrossRefs(const Napi::CallbackInfo& info) {
  char* crossRefs = myXulsword->getCrossRefs();
  Napi::String napiCrossRefs = Napi::String::New(info.Env(), crossRefs);
  FreeMemory(crossRefs, "char");
  return napiCrossRefs;
}

Napi::String GetDictionaryEntry(const Napi::CallbackInfo& info) {
  char* dictionaryEntry = myXulsword->getDictionaryEntry(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str());
  Napi::String napiDictionaryEntry = Napi::String::New(info.Env(), dictionaryEntry);
  FreeMemory(dictionaryEntry, "char");
  return napiDictionaryEntry;
}

Napi::String GetFootnotes(const Napi::CallbackInfo& info) {
  char* footnotes = myXulsword->getFootnotes();
  Napi::String napiFootnotes = Napi::String::New(info.Env(), footnotes);
  FreeMemory(footnotes, "char");
  return napiFootnotes;
}

Napi::String GetGenBookChapterText(const Napi::CallbackInfo& info) {
  char* genBookChapterText = myXulsword->getGenBookChapterText(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str());
  Napi::String napiGenBookChapterText = Napi::String::New(info.Env(), genBookChapterText);
  FreeMemory(genBookChapterText, "char");
  return napiGenBookChapterText;
}

Napi::String GetGenBookTableOfContents(const Napi::CallbackInfo& info) {
  char* genBookTableOfContents = myXulsword->getGenBookTableOfContents(
    (char*) info[0].ToString().Utf8Value().c_str());
  Napi::String napiGenBookTableOfContents = Napi::String::New(info.Env(), genBookTableOfContents);
  FreeMemory(genBookTableOfContents, "char");
  return napiGenBookTableOfContents;
}

Napi::String GetGlobalOption(const Napi::CallbackInfo& info) {
  char* globalOption = myXulsword->getGlobalOption(
    (char*) info[0].ToString().Utf8Value().c_str());
  Napi::String napiGlobalOption = Napi::String::New(info.Env(), globalOption);
  FreeMemory(globalOption, "char");
  return napiGlobalOption;
}
Napi::String GetIntroductions(const Napi::CallbackInfo& info) {
  char* introductions = myXulsword->getIntroductions(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str());
  Napi::String napiIntroductions = Napi::String::New(info.Env(), introductions);
  FreeMemory(introductions, "char");
  return napiIntroductions;
}

// Napi::String GetLocation(const Napi::CallbackInfo& info) {
//   char* location = myXulsword->getLocation(
//     (char*) info[0].ToString().Utf8Value().c_str());
//   Napi::String napiLocation = Napi::String::New(info.Env(), location);
//   FreeMemory(location, "char");
//   return napiLocation;
// }

Napi::Number GetMaxChapter(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), myXulsword->getMaxChapter(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str()));
}

Napi::Number GetMaxVerse(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), myXulsword->getMaxVerse(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str()));
}

Napi::String GetModuleInformation(const Napi::CallbackInfo& info) {
  char* moduleInformation = myXulsword->getModuleInformation(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str());
  Napi::String napiModuleInformation = Napi::String::New(info.Env(), moduleInformation);
  FreeMemory(moduleInformation, "char");
  return napiModuleInformation;
}

Napi::String GetModuleList(const Napi::CallbackInfo& info) {
  char* moduleList = myXulsword->getModuleList();
  Napi::String napiModuleList = Napi::String::New(info.Env(), moduleList);
  FreeMemory(moduleList, "char");
  return napiModuleList;
}

Napi::String GetNotes(const Napi::CallbackInfo& info) {
  char* notes = myXulsword->getNotes();
  Napi::String napiNotes = Napi::String::New(info.Env(), notes);
  FreeMemory(notes, "char");
  return napiNotes;
}

//  char *getSearchResults(const char *mod, int first, int num, bool keepStrongs, ListKey *searchPointer = NULL, bool referencesOnly = false);

Napi::String GetSearchResults(const Napi::CallbackInfo& info) {
  char* searchResults = myXulsword->getSearchResults(
    (char*) info[0].ToString().Utf8Value().c_str(),
            info[1].As<Napi::Number>().Int32Value(),
            info[2].As<Napi::Number>().Int32Value(),
            info[3].As<Napi::Boolean>().Value()
            // TODO: get the ListKey searchPointer
            // info[4]
            // info[5].As<Napi::Boolean>().Value()
          );
  Napi::String napiSearchResults = Napi::String::New(info.Env(), searchResults);
  FreeMemory(searchResults, "char");
  return napiSearchResults;
}

Napi::String GetVerseSystem(const Napi::CallbackInfo& info) {
  char* verseSystem = myXulsword->getVerseSystem(
    (char*) info[0].ToString().Utf8Value().c_str());
  Napi::String napiVerseSystem = Napi::String::New(info.Env(), verseSystem);
  FreeMemory(verseSystem, "char");
  return napiVerseSystem;
}

Napi::String GetVerseText(const Napi::CallbackInfo& info) {
  char* verseText = myXulsword->getVerseText(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str(),
    (char*) info[2].As<Napi::Boolean>().Value());
  Napi::String napiVerseText = Napi::String::New(info.Env(), verseText);
  FreeMemory(verseText, "char");
  return napiVerseText;
}

Napi::Boolean GetXulsword(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 4) {
    Napi::TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return Napi::Boolean::New(env, false);
  }

  if (!info[0].IsString()) {
    Napi::TypeError::New(env, "Pathname not found").ThrowAsJavaScriptException();
      return Napi::Boolean::New(env, false);
  }

  if (!info[1].IsFunction() || !info[2].IsFunction() || !info[3].IsFunction()) {
    Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
      return Napi::Boolean::New(env, false);
 }

  //TODO: fill out the callback functions
  toUpperCaseFunction    = info[1].As<Napi::Function>();
  throwJsFunction        = info[2].As<Napi::Function>();
  reportProgressFunction = info[3].As<Napi::Function>();
  
  myXulsword = new xulsword(
    (char*) info[0].ToString().Utf8Value().c_str(),
    toUpperCase,
    throwJs,
    reportProgress,
    NULL,
    false);

  return Napi::Boolean::New(env, (myXulsword == NULL) ? false : true);
}

Napi::Boolean LuceneEnabled(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), myXulsword->luceneEnabled(
    (char*) info[0].ToString().Utf8Value().c_str()));
}

Napi::Number Search(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), myXulsword->search(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str(),
    (char*) info[2].ToString().Utf8Value().c_str(),
            info[3].As<Napi::Number>().Int32Value(),
            info[4].As<Napi::Number>().Int32Value(),
            info[5].As<Napi::Boolean>().Value()));
}

void SearchIndexBuild(const Napi::CallbackInfo& info) {
  myXulsword->searchIndexBuild(
    (char*) info[0].ToString().Utf8Value().c_str());
  return;
}

void SearchIndexDelete(const Napi::CallbackInfo& info) {
  myXulsword->searchIndexDelete(
    (char*) info[0].ToString().Utf8Value().c_str());
  return;
}

void SetCipherKey(const Napi::CallbackInfo& info) {
  myXulsword->setCipherKey(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str(),
            info[2].As<Napi::Boolean>().Value());
  return;
}

void SetGlobalOption(const Napi::CallbackInfo& info) {
  myXulsword->setGlobalOption(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str());
  return;
}

void UncompressTarGz(const Napi::CallbackInfo& info) {
  myXulsword->uncompressTarGz(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str());
  return;
}

Napi::String Translate(const Napi::CallbackInfo& info) {
  char* translate = myXulsword->translate(
    (char*) info[0].ToString().Utf8Value().c_str(),
    (char*) info[1].ToString().Utf8Value().c_str());
  Napi::String napiTranslate = Napi::String::New(info.Env(), translate);
  FreeMemory(translate, "char");
  return napiTranslate;
}


Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "ConvertLocation"),           Napi::Function::New(env, ConvertLocation));
  exports.Set(Napi::String::New(env, "GetAllDictionaryKeys"),      Napi::Function::New(env, GetAllDictionaryKeys));
  exports.Set(Napi::String::New(env, "GetChapterText"),            Napi::Function::New(env, GetChapterText));
  exports.Set(Napi::String::New(env, "GetChapterTextMulti"),       Napi::Function::New(env, GetChapterTextMulti));
  exports.Set(Napi::String::New(env, "GetCrossRefs"),              Napi::Function::New(env, GetCrossRefs));
  exports.Set(Napi::String::New(env, "GetDictionaryEntry"),        Napi::Function::New(env, GetDictionaryEntry));
  exports.Set(Napi::String::New(env, "GetFootnotes"),              Napi::Function::New(env, GetFootnotes));
  exports.Set(Napi::String::New(env, "GetGenBookChapterText"),     Napi::Function::New(env, GetGenBookChapterText));
  exports.Set(Napi::String::New(env, "GetGenBookTableOfContents"), Napi::Function::New(env, GetGenBookTableOfContents));
  exports.Set(Napi::String::New(env, "GetGlobalOption"),           Napi::Function::New(env, GetGenBookTableOfContents));
  exports.Set(Napi::String::New(env, "GetIntroductions"),          Napi::Function::New(env, GetGlobalOption));
  // exports.Set(Napi::String::New(env, "GetLocation"),               Napi::Function::New(env, GetLocation));
  exports.Set(Napi::String::New(env, "GetMaxChapter"),             Napi::Function::New(env, GetMaxChapter));
  exports.Set(Napi::String::New(env, "GetMaxVerse"),               Napi::Function::New(env, GetMaxVerse));
  exports.Set(Napi::String::New(env, "GetModuleInformation"),      Napi::Function::New(env, GetModuleInformation));
  exports.Set(Napi::String::New(env, "GetModuleList"),             Napi::Function::New(env, GetModuleList));
  exports.Set(Napi::String::New(env, "GetNotes"),                  Napi::Function::New(env, GetNotes));
  exports.Set(Napi::String::New(env, "GetSearchResults"),          Napi::Function::New(env, GetSearchResults));
  exports.Set(Napi::String::New(env, "GetVerseSystem"),            Napi::Function::New(env, GetVerseSystem));
  exports.Set(Napi::String::New(env, "GetVerseText"),              Napi::Function::New(env, GetVerseText));
  exports.Set(Napi::String::New(env, "GetXulsword"),               Napi::Function::New(env, GetXulsword));
  exports.Set(Napi::String::New(env, "LuceneEnabled"),             Napi::Function::New(env, LuceneEnabled));
  exports.Set(Napi::String::New(env, "Search"),                    Napi::Function::New(env, Search));
  exports.Set(Napi::String::New(env, "SearchIndexBuild"),          Napi::Function::New(env, SearchIndexBuild));
  exports.Set(Napi::String::New(env, "SearchIndexDelete"),         Napi::Function::New(env, SearchIndexDelete));
  exports.Set(Napi::String::New(env, "SetCipherKey"),              Napi::Function::New(env, SetCipherKey));
  exports.Set(Napi::String::New(env, "SetGlobalOption"),           Napi::Function::New(env, SetGlobalOption));
  exports.Set(Napi::String::New(env, "Translate"),                 Napi::Function::New(env, Translate));
  exports.Set(Napi::String::New(env, "UncompressTarGz"),           Napi::Function::New(env, UncompressTarGz));
return exports;
}

NODE_API_MODULE(hello, Init)