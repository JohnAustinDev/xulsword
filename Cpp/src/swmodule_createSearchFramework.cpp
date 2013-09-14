
#ifdef USELUCENE
	SWBuf target = getConfigEntry("AbsoluteDataPath");
	if (!target.endsWith("/") && !target.endsWith("\\")) {
		target.append('/');
	}
	target.append("lucene");
	int status = FileMgr::createParent(target+"/dummy");
	if (status) return -1;

	SWKey *saveKey = 0;
	SWKey *searchKey = 0;
	SWKey textkey;
	SWBuf c;

	const int MAX_CONV_SIZE = 1024 * 1024;

	// buffer used by lucene_utf8towcs
	const int MAX_FIELD_SIZE = 1024 * 128;
	wchar_t wbuff[MAX_FIELD_SIZE];

	// turn all filters to default values
	StringList filterSettings;
	for (OptionFilterList::iterator filter = optionFilters->begin(); filter != optionFilters->end(); filter++) {
		filterSettings.push_back((*filter)->getOptionValue());
		(*filter)->setOptionValue(*((*filter)->getOptionValues().begin()));

		if ( (!strcmp("Greek Accents", (*filter)->getOptionName())) ||
			(!strcmp("Hebrew Vowel Points", (*filter)->getOptionName())) ||
			(!strcmp("Arabic Vowel Points", (*filter)->getOptionName()))
		   ) {
			(*filter)->setOptionValue("Off");
		}
	}


	// be sure we give CLucene enough file handles
	FileMgr::getSystemFileMgr()->flush();

	// save key information so as not to disrupt original
	// module position
	if (!key->isPersist()) {
		saveKey = createKey();
		*saveKey = *key;
	}
	else	saveKey = key;

	searchKey = (key->isPersist())?key->clone():0;
	if (searchKey) {
		searchKey->setPersist(1);
		setKey(*searchKey);
	}

	RAMDirectory *ramDir = 0;
	IndexWriter *coreWriter = 0;
	IndexWriter *fsWriter = 0;
	Directory *d = 0;

	const TCHAR *stopWords[] = { 0 };
	standard::StandardAnalyzer *an = new standard::StandardAnalyzer(stopWords);
	bool includeKeyInSearch = getConfig().has("SearchOption", "IncludeKeyInSearch");

	ramDir = new RAMDirectory();
	coreWriter = new IndexWriter(ramDir, an, true);
	coreWriter->setMaxFieldLength(MAX_CONV_SIZE);




	char perc = 1;
	VerseKey *vkcheck = 0;
	vkcheck = SWDYNAMIC_CAST(VerseKey, key);
	VerseKey *chapMax = 0;
	if (vkcheck) chapMax = (VerseKey *)vkcheck->clone();

	TreeKeyIdx *tkcheck = 0;
	tkcheck = SWDYNAMIC_CAST(TreeKeyIdx, key);


	*this = BOTTOM;
	long highIndex = key->getIndex();
	if (!highIndex)
		highIndex = 1;		// avoid division by zero errors.

	bool savePEA = isProcessEntryAttributes();
	setProcessEntryAttributes(true);

	// prox chapter blocks
	// position module at the beginning
	*this = TOP;

	SWBuf proxBuf;
	SWBuf proxLem;
	SWBuf proxMorph;
	SWBuf strong;
	SWBuf morph;

	char err = popError();
	while (!err) {
		long mindex = key->getIndex();

		proxBuf = "";
		proxLem = "";
		proxMorph = "";

		// computer percent complete so we can report to our progress callback
		float per = (float)mindex / highIndex;
		// between 5%-98%
		per *= 93; per += 5;
		char newperc = (char)per;
		if (newperc > perc) {
			perc = newperc;
			(*percent)(perc, percentUserData);
		}

		// get "content" field
		const char *content = stripText();

		bool good = false;

		// start out entry
		Document *doc = new Document();
		// get "key" field
		SWBuf keyText = (vkcheck) ? vkcheck->getOSISRef() : getKeyText();
		if (content && *content) {
			good = true;


			// build "strong" field
			AttributeTypeList::iterator words;
			AttributeList::iterator word;
			AttributeValue::iterator strongVal;
			AttributeValue::iterator morphVal;

			strong="";
			morph="";
			words = getEntryAttributes().find("Word");
			if (words != getEntryAttributes().end()) {
				for (word = words->second.begin();word != words->second.end(); word++) {
					int partCount = atoi(word->second["PartCount"]);
					if (!partCount) partCount = 1;
					for (int i = 0; i < partCount; i++) {
						SWBuf tmp = "Lemma";
						if (partCount > 1) tmp.appendFormatted(".%d", i+1);
						strongVal = word->second.find(tmp);
						if (strongVal != word->second.end()) {
							// cheeze.  skip empty article tags that weren't assigned to any text
							if (strongVal->second == "G3588") {
								if (word->second.find("Text") == word->second.end())
									continue;	// no text? let's skip
							}
							strong.append(strongVal->second);
							morph.append(strongVal->second);
							morph.append('@');
							SWBuf tmp = "Morph";
							if (partCount > 1) tmp.appendFormatted(".%d", i+1);
							morphVal = word->second.find(tmp);
							if (morphVal != word->second.end()) {
								morph.append(morphVal->second);
							}
							strong.append(' ');
							morph.append(' ');
						}
					}
				}
			}

			lucene_utf8towcs(wbuff, keyText.c_str(), MAX_FIELD_SIZE);
			doc->add(*_CLNEW Field(_T("key"), wbuff, Field::STORE_YES | Field::INDEX_UNTOKENIZED));

			if (includeKeyInSearch) {
				c = keyText;
				c += " ";
				c += content;
				content = c.c_str();
			}

			lucene_utf8towcs(wbuff, content, MAX_FIELD_SIZE);
			doc->add(*_CLNEW Field(_T("content"), wbuff, Field::STORE_NO | Field::INDEX_TOKENIZED));

			if (strong.length() > 0) {
				lucene_utf8towcs(wbuff, strong.c_str(), MAX_FIELD_SIZE);
				doc->add(*_CLNEW Field(_T("lemma"), wbuff, Field::STORE_NO | Field::INDEX_TOKENIZED));
				lucene_utf8towcs(wbuff, morph.c_str(), MAX_FIELD_SIZE);
				doc->add(*_CLNEW Field(_T("morph"), wbuff, Field::STORE_NO | Field::INDEX_TOKENIZED));
//printf("setting fields (%s).\ncontent: %s\nlemma: %s\n", (const char *)*key, content, strong.c_str());
			}

//printf("setting fields (%s).\n", (const char *)*key);
//fflush(stdout);
		}
		// don't write yet, cuz we have to see if we're the first of a prox block (5:1 or chapter5/verse1

		// for VerseKeys use chapter
		if (vkcheck) {
			*chapMax = *vkcheck;
			// we're the first verse in a chapter
			if (vkcheck->getVerse() == 1) {
				*chapMax = MAXVERSE;
				VerseKey saveKey = *vkcheck;
				while ((!err) && (*vkcheck <= *chapMax)) {
//printf("building proxBuf from (%s).\nproxBuf.c_str(): %s\n", (const char *)*key, proxBuf.c_str());
//printf("building proxBuf from (%s).\n", (const char *)*key);

					content = stripText();
					if (content && *content) {
						// build "strong" field
						strong = "";
						morph = "";
						AttributeTypeList::iterator words;
						AttributeList::iterator word;
						AttributeValue::iterator strongVal;
						AttributeValue::iterator morphVal;

						words = getEntryAttributes().find("Word");
						if (words != getEntryAttributes().end()) {
							for (word = words->second.begin();word != words->second.end(); word++) {
								int partCount = atoi(word->second["PartCount"]);
								if (!partCount) partCount = 1;
								for (int i = 0; i < partCount; i++) {
									SWBuf tmp = "Lemma";
									if (partCount > 1) tmp.appendFormatted(".%d", i+1);
									strongVal = word->second.find(tmp);
									if (strongVal != word->second.end()) {
										// cheeze.  skip empty article tags that weren't assigned to any text
										if (strongVal->second == "G3588") {
											if (word->second.find("Text") == word->second.end())
												continue;	// no text? let's skip
										}
										strong.append(strongVal->second);
										morph.append(strongVal->second);
										morph.append('@');
										SWBuf tmp = "Morph";
										if (partCount > 1) tmp.appendFormatted(".%d", i+1);
										morphVal = word->second.find(tmp);
										if (morphVal != word->second.end()) {
											morph.append(morphVal->second);
										}
										strong.append(' ');
										morph.append(' ');
									}
								}
							}
						}
						proxBuf += content;
						proxBuf.append(' ');
						proxLem += strong;
						proxMorph += morph;
						if (proxLem.length()) {
							proxLem.append("\n");
							proxMorph.append("\n");
						}
					}
					(*this)++;
					err = popError();
				}
				err = 0;
				*vkcheck = saveKey;
			}
		}

		// for TreeKeys use siblings if we have no children
		else if (tkcheck) {
			if (!tkcheck->hasChildren()) {
				if (!tkcheck->previousSibling()) {
					do {
//printf("building proxBuf from (%s).\n", (const char *)*key);
//fflush(stdout);

						content = stripText();
						if (content && *content) {
							// build "strong" field
							strong = "";
							morph = "";
							AttributeTypeList::iterator words;
							AttributeList::iterator word;
							AttributeValue::iterator strongVal;
							AttributeValue::iterator morphVal;

							words = getEntryAttributes().find("Word");
							if (words != getEntryAttributes().end()) {
								for (word = words->second.begin();word != words->second.end(); word++) {
									int partCount = atoi(word->second["PartCount"]);
									if (!partCount) partCount = 1;
									for (int i = 0; i < partCount; i++) {
										SWBuf tmp = "Lemma";
										if (partCount > 1) tmp.appendFormatted(".%d", i+1);
										strongVal = word->second.find(tmp);
										if (strongVal != word->second.end()) {
											// cheeze.  skip empty article tags that weren't assigned to any text
											if (strongVal->second == "G3588") {
												if (word->second.find("Text") == word->second.end())
													continue;	// no text? let's skip
											}
											strong.append(strongVal->second);
											morph.append(strongVal->second);
											morph.append('@');
											SWBuf tmp = "Morph";
											if (partCount > 1) tmp.appendFormatted(".%d", i+1);
											morphVal = word->second.find(tmp);
											if (morphVal != word->second.end()) {
												morph.append(morphVal->second);
											}
											strong.append(' ');
											morph.append(' ');
										}
									}
								}
							}

							proxBuf += content;
							proxBuf.append(' ');
							proxLem += strong;
							proxMorph += morph;
							if (proxLem.length()) {
								proxLem.append("\n");
								proxMorph.append("\n");
							}
						}
					} while (tkcheck->nextSibling());
					tkcheck->parent();
					tkcheck->firstChild();
				}
				else tkcheck->nextSibling();	// reposition from our previousSibling test
			}
		}

		if (proxBuf.length() > 0) {
			lucene_utf8towcs(wbuff, proxBuf.c_str(), MAX_FIELD_SIZE);
			doc->add(*_CLNEW Field(_T("prox"), wbuff, Field::STORE_NO | Field::INDEX_TOKENIZED));
			good = true;
		}
		if (proxLem.length() > 0) {
			lucene_utf8towcs(wbuff, proxLem.c_str(), MAX_FIELD_SIZE);
			doc->add(*_CLNEW Field(_T("proxlem"), wbuff, Field::STORE_NO | Field::INDEX_TOKENIZED) );
			lucene_utf8towcs(wbuff, proxMorph.c_str(), MAX_FIELD_SIZE);
			doc->add(*_CLNEW Field(_T("proxmorph"), wbuff, Field::STORE_NO | Field::INDEX_TOKENIZED) );
			good = true;
		}
		if (good) {
//printf("writing (%s).\n", (const char *)*key);
//fflush(stdout);
			coreWriter->addDocument(doc);
		}
		delete doc;

		(*this)++;
		err = popError();
	}

	// Optimizing automatically happens with the call to addIndexes
	//coreWriter->optimize();
	coreWriter->close();

#ifdef CLUCENE2
	d = FSDirectory::getDirectory(target.c_str());
#endif
	if (IndexReader::indexExists(target.c_str())) {
#ifndef CLUCENE2
		d = FSDirectory::getDirectory(target.c_str(), false);
#endif
		if (IndexReader::isLocked(d)) {
			IndexReader::unlock(d);
		}
		fsWriter = new IndexWriter( d, an, false);
	}
	else {
#ifndef CLUCENE2
		d = FSDirectory::getDirectory(target.c_str(), true);
#endif
		fsWriter = new IndexWriter(d, an, true);
	}

	Directory *dirs[] = { ramDir, 0 };
#ifdef CLUCENE2
	lucene::util::ConstValueArray< lucene::store::Directory *>dirsa(dirs, 1);
	fsWriter->addIndexes(dirsa);
#else
	fsWriter->addIndexes(dirs);
#endif
	fsWriter->close();

	delete ramDir;
	delete coreWriter;
	delete fsWriter;
	delete an;

	// reposition module back to where it was before we were called
	setKey(*saveKey);

	if (!saveKey->isPersist())
		delete saveKey;

	if (searchKey)
		delete searchKey;

	delete chapMax;

	setProcessEntryAttributes(savePEA);

	// reset option filters back to original values
	StringList::iterator origVal = filterSettings.begin();
	for (OptionFilterList::iterator filter = optionFilters->begin(); filter != optionFilters->end(); filter++) {
		(*filter)->setOptionValue(*origVal++);
	}

	return 0;
#else
	return SWSearchable::createSearchFramework(percent, percentUserData);
#endif
