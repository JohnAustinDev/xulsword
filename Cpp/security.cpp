#include "windows.h"
//#include "winnt.h"
#include <stdio.h>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <algorithm>

#define MOZILLA_STRICT_API
#include "nsXPCOM.h"
#include "nsISupportsUtils.h"
#include "nsStringAPI.h"
#include "nsEmbedString.h"
#include "nsCOMPtr.h"
#include "nsIProperties.h"
#include "nsServiceManagerUtils.h"
#include "nsISimpleEnumerator.h"
#include "nsISupportsImpl.h"
#include "nsILocalFile.h"

#include "Crc32Static.h"
#include "security.h"
#include "swcipher.h"

#define NOTFOUND "Not Found"

using namespace std;
using namespace sword;

#include "../../extra/Cpp/getcodes.cpp"

bool security::PassedIntegrityCheck = false;

void EncodeDWORD(DWORD * data, SWCipher * cipher) {
    DWORD dbuf[2] = {0x00000000,0x00000000};  
    unsigned long crclen = sizeof(DWORD);
    char * enc;
    enc = cipher->Buf((char *)data, crclen);
    enc = cipher->cipherBuf(&crclen);
    DWORD * encdw;
    encdw = (DWORD *)enc;
    *data = *encdw;
}


DWORD checkFile(nsILocalFile *file, DWORD *crc, vector<DWORD> *allowlist, nsEmbedCString *readablelist, SWCipher * cipher) {
  DWORD dwErrorCode = 0;
  nsEmbedString fullpath;
  nsEmbedString filename;
  file->GetPath(fullpath);
	file->GetLeafName(filename);
  // Read up to two codes from each text file and add them to the allowed list.
  const wchar_t * txtext = wcsstr(filename.get(), L".txt");
	if (txtext && !wcscmp(txtext, L".txt")) {
    FILE *codefile = _wfopen(fullpath.get(), L"r");
    char CRCcode[17];
    if (fgets(CRCcode, 17, codefile)) {
      string man, jar;
      DWORD mandw, jardw;
      
		  for (int i=0; i<8; i++) {
		    man.append(1, CRCcode[2*i]);
		    jar.append(1, CRCcode[(2*i)+1]);
		  }
		  
		  istringstream iss (man);
      iss >> hex >> mandw;
      allowlist->push_back(mandw);
      iss.clear();
      iss.str(jar); 
		  iss >> hex >> jardw;
      allowlist->push_back(jardw);
		}
		else {printf("Could not open:%s\n", NS_ConvertUTF16toUTF8(fullpath).get());}
		fclose(codefile);
	}
	// Calculate CRC of file and encrypt it (using key encryption as a secret hash function)
	else {
    DWORD mcr;
    dwErrorCode = CCrc32Static::FileCrc32Assembly((wchar_t *)fullpath.get(), mcr);
    DWORD dumpcrc = mcr;
    EncodeDWORD(&mcr, cipher);
    *crc = mcr;
#ifdef DUMPCODES    
    // Here we generate a text list of CRCs and file names which may be 
    // parsed by Perl to recover the CRCs that are related to locale files.
    char buff[9];
    sprintf(buff, "%08x", *crc);
    readablelist->Append(buff);
    readablelist->Append(" CRC:");
    sprintf(buff, "%08x", dumpcrc);
    readablelist->Append(buff);
    readablelist->Append("\t");
    readablelist->Append(NS_ConvertUTF16toUTF8(filename).get());
    readablelist->Append("\n");
#endif
  }
  //printf("path:%s, crc:%08x\n", mypath.c_str(), *crc);
  return dwErrorCode;
}

/* This routine combines the passed cipher key with a hidden cipher key.
   The resulting cipher key should then be the key which the text was actually
   encrypted with.
*/
void security::ModCipherKey(char * outkey, const char * inkey, const char * modVersion, const char * modName) {
  if (PassedIntegrityCheck) {
    char compKey[KEYLEN+1];
    getcodes(compKey, modVersion, modName);
//printf("TxtKey:%s, modVersion:%s, modName:%s\n", compKey, modVersion, modName);
    // Source Code
    //sprintf(outkey,"%s%s", compKey, inkey);
  	sprintf(outkey, "%s%s", inkey, compKey);
  	return;
	}
	else {sprintf(outkey,"%s","0");}
}

/* This routine checks the integrity of the program's code to prevent someone 
   from easily changing it and allowing copying of encrypted texts. CRCs are 
   caluclated for all program files and are then encryted (using key encryption as a
   secret hash function). The resulting codes are then compared to those codes that
   were calculated at compile time and to those on the allowed list. If any code
   is not accounted for, or is missing, the integrity check fails. Text files 
   in the program's chrome directory are also read, and up to two codes from each 
   such file are added to the allowed list. Codes contained within these text 
   files must be encrypted with the secret key, preventing creation of bogus files.
*/
void security::CheckIntegrity() {
  // Get the secret key
  char CRCkey[KEYLEN+1];
  getcodes(CRCkey, MINUIVERSION);
//printf("CrcKey:%s, MINUIVERSION:%s\n", CRCkey, MINUIVERSION);
	SWCipher * cipher = new SWCipher((unsigned char *)&CRCkey[0]);

	nsresult rv;
	nsCOMPtr<nsIProperties> dirSvc (do_GetService(NS_DIRECTORY_SERVICE_CONTRACTID));
	nsCOMPtr<nsISimpleEnumerator> chromeML;
	vector<DWORD> ChromeCodes;
	DWORD CRC;
	vector<DWORD> AllowList;
	nsEmbedCString ReadableList;
	bool error = false;


//Remove after UI update!! And for Source Pub ---------------------------------------------------
#ifdef DUMPCODES
  // For backward compatibility to UI add-on modules that were created before 
  // auto code generation was implemented, their CRC values must be handed to us 
  // here, encoded, and then stored in a permanant list of allowable codes.
  #include "allowCRCs.h"
  DWORD allow_crcs[] = ALLOWABLE_CRC;
  vector<DWORD> backcomp_codes;
  for (int i=0; i<ALLOWABLE_LEN; i++) {
    EncodeDWORD(&allow_crcs[i], cipher);
    backcomp_codes.push_back(allow_crcs[i]);
  }
#else
  DWORD backcomp_codes[] = ALLOWCODES;
  for (int i=0; i<ALLOWCODES_LEN; i++) {
    AllowList.push_back(backcomp_codes[i]);
  }
#endif
//-----------------------------------------------------------------------------


	// Get list of chrome directories
	rv = dirSvc->Get("ChromeML", NS_GET_IID(nsISimpleEnumerator), getter_AddRefs(chromeML));
	PRBool exists;
	nsCOMPtr<nsISupports> next;

	// Check each chrome directory
	while (NS_SUCCEEDED(chromeML->HasMoreElements(&exists)) && exists) {
		chromeML->GetNext(getter_AddRefs(next));
		nsCOMPtr<nsILocalFile> lmanifest = do_QueryInterface(next);
		if (!lmanifest) {error = true; continue;}

		PRBool isDir;
		if (NS_SUCCEEDED(lmanifest->IsDirectory(&isDir)) && isDir) {
			nsCOMPtr<nsISimpleEnumerator> entries;
			rv = lmanifest->GetDirectoryEntries(getter_AddRefs(entries));
			if (NS_FAILED(rv)) continue;
 
			// Check each file in directory
			while (NS_SUCCEEDED(entries->HasMoreElements(&exists)) && exists) {
				entries->GetNext(getter_AddRefs(next));
				lmanifest = do_QueryInterface(next);
				// Ignore sub-directories because manifests are not read from sub-directories
				if (lmanifest && NS_SUCCEEDED(lmanifest->IsDirectory(&isDir)) && !isDir) {
				  CRC=0;
					error |= (checkFile(lmanifest, &CRC, &AllowList, &ReadableList, cipher) != 0);
					if (!error && CRC) {ChromeCodes.push_back(CRC);}
				}
			}
		}
		
		// If separate file is found, include its checksum too
		else if (lmanifest) {
		  CRC=0;
      error |= (checkFile(lmanifest, &CRC, &AllowList, &ReadableList, cipher) != 0);
      if (!error & CRC) {ChromeCodes.push_back(CRC);}
		}
	}
	delete cipher;

	PassedIntegrityCheck = false;
	sort(ChromeCodes.begin(), ChromeCodes.end()); 
	vector<DWORD>::iterator aCode = ChromeCodes.begin();
	
  // Remove codes which are on the allow list.
	while (aCode != ChromeCodes.end()) {
		bool remove=false;
		for (int i=0; i<AllowList.size(); i++) {
		  if (*aCode == AllowList[i]) {remove=true; break;}
		}
		if (remove) {aCode=ChromeCodes.erase(aCode);}
		else {aCode++;}
	}

#ifndef DUMPCODES
	// Now check the codes for integrity
	DWORD OrigCodes[]=CHROMECODE;
	int OrigCodesLen=CHROMELEN;
	int i=0;
	aCode = ChromeCodes.begin();
	bool failed = false;
  while (aCode!=ChromeCodes.end() && i<CHROMELEN) {
    if (*aCode != OrigCodes[i]) {failed=true; break;}
    aCode++; i++;
  }
  PassedIntegrityCheck = (!error && !failed && aCode==ChromeCodes.end() && i==CHROMELEN);
  
  
#else
  if (!error) {
  	//Write chromeCode.h to the directory pointed to in compDump.h
  	FILE *info = fopen(CHROMECODEDIR,"w");
  	if (info != NULL) {
  	  char buff[11];
  	  string pstring;

      //Remove after UI update!! And for Source Pub ---------------------------
      aCode = backcomp_codes.begin();
      while (aCode != backcomp_codes.end()) {
        if (aCode != backcomp_codes.begin()) {pstring.append(",");}
        sprintf(buff, "0x%08x", *aCode);
        pstring.append(buff);
        aCode++;
      }
      fprintf(info, "#define ALLOWCODES {%s}\n", pstring.c_str());
      fprintf(info, "#define ALLOWCODES_LEN %i\n", backcomp_codes.size());
      DWORD allowedCRCs[] = ALLOWABLE_CRC;
      fprintf(info, "//Allowed CRCs:");
      for (int i=0; i<ALLOWABLE_LEN; i++) {fprintf(info, "%08x ", allowedCRCs[i]);}
      fprintf(info, "\n");
      // ----------------------------------------------------------------------

      pstring.assign("");
      aCode = ChromeCodes.begin();
      while (aCode != ChromeCodes.end()) {
        if (aCode != ChromeCodes.begin()) {pstring.append(",");}
        sprintf(buff, "0x%08x", *aCode++);
        pstring.append(buff);
      }
  		fprintf(info, "#define CHROMECODE {%s}\n", pstring.c_str());
  		fprintf(info, "#define CHROMELEN %i\n", ChromeCodes.size());
  		fprintf(info, "/*\n");
  		fprintf(info, "%s", ReadableList.get());
  		char kbuf[KEYLEN+1];
  		string mods(ENCXSMODS);
  		int s = 0;
  		int e = 0;
  		do {
        e = mods.find(",", s+1);
        if (e == string::npos) {
          e = mods.length();
        }
        string mod = mods.substr(s, e-s);
        s = e+1;
        getcodes(kbuf, "2.7", mod.c_str());
        fprintf(info, "%s:%s:%s\n", kbuf, "2.7", mod.c_str());
        getcodes(kbuf, "2.8", mod.c_str());
        fprintf(info, "%s:%s:%s\n", kbuf, "2.8", mod.c_str());
        getcodes(kbuf, "2.9", mod.c_str());
        fprintf(info, "%s:%s:%s\n", kbuf, "2.9", mod.c_str());
        getcodes(kbuf, "2.10", mod.c_str());
        fprintf(info, "%s:%s:%s\n", kbuf, "2.10", mod.c_str());
        getcodes(kbuf, "2.11", mod.c_str());
        fprintf(info, "%s:%s:%s\n", kbuf, "2.11", mod.c_str());
        getcodes(kbuf, "2.12", mod.c_str());
        fprintf(info, "%s:%s:%s\n", kbuf, "2.12", mod.c_str());
        getcodes(kbuf, "3.0", mod.c_str());
        fprintf(info, "%s:%s:%s\n", kbuf, "3.0", mod.c_str());
      }
      while (e < mods.length());
  		fprintf(info, "*/");
  		fclose(info);
  	}
  }
#endif

/*
  // KEEP THIS useful debug code...
  printf("error=%i\n", error);
  vector<DWORD>::iterator printCode = AllowList.begin();
  printf("\n\nAllowList:\n");
  while (printCode != AllowList.end()) {printf("%08x ", *printCode); printCode++;}
#ifndef DUMPCODES
  DWORD cch[] = CHROMECODE;
  printf("\n\nFrom chromCode.h:\n");
  for (int i=0; i<CHROMELEN; i++) {printf("%08x ", cch[i]);}
#endif
  printCode = ChromeCodes.begin();
  printf("\n\nFrom ChromeCodes:\n");
  while (printCode != ChromeCodes.end()) {printf("%08x ", *printCode); printCode++;}
  printf("\n");
  printf("PassedIntegrityCheck=%i.\n", PassedIntegrityCheck);
*/
    
}
