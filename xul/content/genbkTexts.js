/*  This file is part of xulSword.

    Copyright 2012 John Austin (gpl.programs.info@gmail.com)

    xulSword is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    xulSword is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with xulSword.  If not, see <http://www.gnu.org/licenses/>.
*/

////////////////////////////////////////////////////////////////////////
// GenBookTexts
////////////////////////////////////////////////////////////////////////

// IMPORTANT: GenBookKey_ has the form: /modName/etc/etc/etc.

var GenBookTexts = {
  
  read: function(w, d) {
    var ret = { htmlHead:Texts.getPageLinks(), htmlText:"", footnotes:null };
    
    // the GenBookKey value always begins with /mod/ so that values can be directly
    // compared to the genbook-tree's resource values.
    ret.htmlText = Bible.getGenBookChapterText(d.mod, d.GenBookKey.replace(/^\/[^\/]+/, ""));
    ret.htmlText = Texts.addParagraphIDs(ret.htmlText, d.mod);
      
    var un = Texts.getUserNotes("na", d.GenBookKey, d.mod, ret.htmlText);
    ret.htmlText = un.html; // has user notes added to text
    ret.footnotes = un.notes;
    
    return ret;
  },
  
  // return information about displayed genBooks
  getGenBookInfo: function() {
    var numUniqueGenBooks = 0;
    var firstGenBook = null;
    var genBookList = "";
    var modsAtRoot = [];
    for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
      if (Tab[prefs.getCharPref("Version" + w)].modType == GENBOOK) {
        var mymodRE = new RegExp("(^|;)(" + escapeRE(prefs.getCharPref("Version" + w)) + ");");
        if (!genBookList.match(mymodRE)) numUniqueGenBooks++;
        else continue;
        // Insure genbook has a showingkey pref!
        var key = getPrefOrCreate("GenBookKey_" + prefs.getCharPref("Version" + w) + "_" + w, "Unicode", "/" + prefs.getCharPref("Version" + w));
        if (key == "/" + prefs.getCharPref("Version" + w)) modsAtRoot.push(prefs.getCharPref("Version" + w));
        if (!firstGenBook) firstGenBook=prefs.getCharPref("Version" + w);
        genBookList += prefs.getCharPref("Version" + w) + ";";
      }
    }
    var ret = {};
    ret.numUniqueGenBooks = numUniqueGenBooks;
    ret.genBookList = genBookList;
    ret.modsAtRoot = modsAtRoot;
    ret.firstGenBook = firstGenBook;
    return ret;
  },

  RDFChecked: {},
  
  // update genBookChooser based on genBook info
  updateGenBookNavigator: function(gbks) {  

    var elem = MainWindow.document.getElementById("genbook-tree");
    var GBs = gbks.genBookList.split(";");
    GBs.pop();
    
    // remove data sources which are being displayed but are no longer needed
    var DSs = elem.database.GetDataSources();
    var needToRebuild=false;
    while (DSs.hasMoreElements()) {
      var myDS = DSs.getNext();
      var mymod = myDS.QueryInterface(Components.interfaces.nsIRDFDataSource).URI.match(/\/([^\/]+)\.rdf/);
      if (!mymod) continue;
      mymod = mymod[1];
      var keepDS=false;
      for (var i=0; i<GBs.length; i++) {
        if (GBs[i] == mymod) {
          GBs.splice(i, 1);
          keepDS=true;
        }
      }
      if (!keepDS) {
        //jsdump("Removing: " + window.unescape(myDS.QueryInterface(Components.interfaces.nsIRDFDataSource).URI.match(/\/([^\/]+\.rdf)/)[1]) + "\n");
        elem.database.RemoveDataSource(myDS);
        needToRebuild=true;
      }
    }
    
    // add data sources which are not already being displayed but need to be
    for (i=0; i<GBs.length; i++) {
      needToRebuild=true; 
      var moduleRDF = getSpecialDirectory("xsResD");
      moduleRDF.append(GBs[i] + ".rdf");
      if (!moduleRDF.exists() || !this.RDFChecked[GBs[i]]) writeFile(moduleRDF, Bible.getGenBookTableOfContents(GBs[i]));
      this.RDFChecked[GBs[i]] = true;
    
      var myURI = encodeURI("File://" + moduleRDF.path.replace("\\","/","g"));
      //jsdump("Adding: " + myURI.match(/\/([^\/]+\.rdf)/)[1] + "\n");
      elem.database.AddDataSource(BM.RDF.GetDataSourceBlocking(myURI));
    }
    
    // rebuild the tree if necessary
    if (needToRebuild) {
      if (gbks.numUniqueGenBooks>1)  elem.ref = "rdf:#http://www.xulsword.com/tableofcontents/ContentsRoot";
      if (gbks.numUniqueGenBooks==1) elem.ref = "rdf:#/" + gbks.firstGenBook;
      elem.builder.rebuild();
    }

    if (gbks.numUniqueGenBooks>0 && elem.currentIndex==-1) {
      for (var w=1; w<=NW; w++) {
        if (prefs.getCharPref("Version" + w) != gbks.firstGenBook) continue;
        this.navigatorSelect(getPrefOrCreate("GenBookKey_" + gbks.firstGenBook + "_" + w, "Unicode", "/" + gbks.firstGenBook));
        break;
      }
    }

    //Now that databases are loaded, set any root key prefs
    for (i=0; i<gbks.modsAtRoot.length; i++) {this.setPrefToRoot(gbks.modsAtRoot[i]);}
    
    return gbks.numUniqueGenBooks>0;
  },

  // sets the pref of unpinned GenBooks showing the module to the first chapter
  setPrefToRoot: function(module) {
    var elem = MainWindow.document.getElementById("genbook-tree");
    
    var root = BM.RDF.GetResource("rdf:#" + "/" + module);
    var notFound=false;
    try {var child1 = elem.database.GetTarget(root, BM.RDFCU.IndexToOrdinalResource(1), true);}
    catch (er) {notFound=true;}
    if (!child1 || notFound) {jsdump("Resource " + root.Value + " not found.\n"); return;}
    var chapter = elem.database.GetTarget(child1, BM.RDF.GetResource("http://www.xulsword.com/tableofcontents/rdf#Chapter"), true)
                  .QueryInterface(Components.interfaces.nsIRDFLiteral);
    for (var w=1; w<=NW; w++) {
      if (module != prefs.getCharPref("Version" + w) ||
          prefs.getBoolPref("IsPinned" + w)) continue;
      setUnicodePref("GenBookKey_" + module + "_" + w, chapter.Value.replace("rdf:#",""));
    }
  },
  
  previousChapter: function(key) {
    var previous = null;
    
    var res = this.getResource(key);
    if (!res.node || !res.ds) return null;
    
    var parent = this.getParentOfNode(res.node);
    if (!parent.node || !parent.ds) return null;
 
    // try previous node
    BM.RDFC.Init(parent.ds, parent.node);
    var siblings = BM.RDFC.GetElements();
    if (siblings.hasMoreElements()) {
      var prev = siblings.getNext();
      while (siblings.hasMoreElements()) {
        var next = siblings.getNext();
        if (next == res.node) {
            previous = prev;
            break;
        }
        else prev = next;
      }
    }
    
    // if previous node is a folder, open it and get last child
    if (previous && BM.RDFCU.IsContainer(parent.ds, previous)) {
      BM.RDFC.Init(parent.ds, previous);
      var chldrn = BM.RDFC.GetElements();
      var last = null;
      while(chldrn.hasMoreElements()) {last = chldrn.getNext();}
      if (last) previous = last;
    }
    
    // if there is no previous node, go to parent
    if (!previous) previous = parent.node;
    
    return previous.QueryInterface(BM.kRDFRSCIID).Value.replace(/^rdf\:\#/, "");
  },
  
  nextChapter: function(key, skipChildren) {
    var next = null;
    
    var res = this.getResource(key);
    if (!res.node || !res.ds) return null;
    
    var parent = this.getParentOfNode(res.node);
 
    // try first child...
    if (!skipChildren && BM.RDFCU.IsContainer(res.ds, res.node)) {
      BM.RDFC.Init(res.ds, res.node);
      var chldrn = BM.RDFC.GetElements();
      if (chldrn.hasMoreElements()) next = chldrn.getNext();
    }

    // or else try next sibling...
    if (!next && parent.node) {
      BM.RDFC.Init(parent.ds, parent.node);
      chldrn = BM.RDFC.GetElements();
      while(chldrn.hasMoreElements()) {
        var child = chldrn.getNext();
        if (child == res.node && chldrn.hasMoreElements()) {
          next = chldrn.getNext();
          break;
        }
      }
    }

    // or else try parent's next sibling...
    if (!next && parent.node) {
      next = this.nextChapter(parent.node.QueryInterface(BM.kRDFRSCIID).Value.replace(/^rdf\:\#/, ""), true);
    }
    else if (next) next = next.QueryInterface(BM.kRDFRSCIID).Value.replace(/^rdf\:\#/, "");

    return next;
  },
  
  getResource: function(key) {
    // get our resource
    var r = {node:null, ds:null};
    var dss = MainWindow.document.getElementById("genbook-tree").database.GetDataSources();
    GETNODE:
    while (dss.hasMoreElements()) {
      r.ds = dss.getNext().QueryInterface(Components.interfaces.nsIRDFDataSource);
      var es = r.ds.GetAllResources();
      while (es.hasMoreElements()) {
        var e = es.getNext();
        if (e.QueryInterface(BM.kRDFRSCIID).Value == "rdf:#" + key) {
          r.node = e;
          // if not a container, keep looking. A container resource appears also as description resource.
          if (BM.RDFCU.IsContainer(r.ds, r.node)) break GETNODE;
        }
      }
    }
    
    return r;
  },
  
  getParentOfNode: function(res) {
    var r = {node:null, ds:null};
    
    // get our resource's parent (if there is one)
    var dss = MainWindow.document.getElementById("genbook-tree").database.GetDataSources();
    
    GETPARENT:
    while (dss.hasMoreElements()) {
      r.ds = dss.getNext().QueryInterface(Components.interfaces.nsIRDFDataSource);
      var es = r.ds.GetAllResources();
      while (es.hasMoreElements()) {
        var e = es.getNext();
        if (!BM.RDFCU.IsContainer(r.ds, e)) continue;
        BM.RDFC.Init(r.ds, e);
        var chds = BM.RDFC.GetElements();
        while(chds.hasMoreElements()) {
          var chd = chds.getNext();
          if (chd == res) {
            r.node = e;
            break GETPARENT;
          }
        }
      }
    }
    
    return r;
  },

  isSelectedGenBook: function(key) {
    var elem = MainWindow.document.getElementById("genbook-tree");
    
    var elemTB = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
    var elemTV = elem.view.QueryInterface(Components.interfaces.nsITreeView);
    try {var selRes = elemTB.getResourceAtIndex(elem.currentIndex);}
    catch (er) {return false;}
    var chapter = elem.database.GetTarget(selRes, BM.RDF.GetResource("http://www.xulsword.com/tableofcontents/rdf#Chapter"), true);
    chapter = chapter.QueryInterface(Components.interfaces.nsIRDFLiteral).Value.replace("rdf:#","");
    
    return key==chapter;
  },
  
  // opens and selects key in GenBook navigator. The selection triggers an update event.
  navigatorSelect: function(key) {
    
    this.openGenBookKey(key);
    
    var elem = MainWindow.document.getElementById("genbook-tree");

    var elemTB = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
    var selRes = BM.RDF.GetResource("rdf:#" + key);
    try {
      var i = elemTB.getIndexOfResource(selRes);
      elem.view.selection.select(i);
    }
    catch (er) {elem.view.selection.select(0);}    
  },

  //Recursively opens key and scrolls there, but does not select...
  openGenBookKey: function(key) {
    var elem = MainWindow.document.getElementById("genbook-tree");
    
    var t = (key + "/").indexOf("/", 1);
    var checkedFirstLevel = false;
    var elemTB = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
    var elemTV = elem.view.QueryInterface(Components.interfaces.nsITreeView);
    
    while (t != -1) {
      var resvalue = "rdf:#" + key.substring(0,t);
      var res = BM.RDF.GetResource(resvalue);
      try {var index = elemTB.getIndexOfResource(res);}
      catch (er) {return;}
      if (index == -1) {
        if (checkedFirstLevel) return;
        checkedFirstLevel=true;
      }
      else {
        if (elemTV.isContainer(index) && !elemTV.isContainerOpen(index)) elemTV.toggleOpenState(index);
      }
      
      t = (key + "/").indexOf("/", t+1); 
    }
    
    this.scrollGenBookTo(key);
  },

  // update corresponding unpinned GenBook prefs according to navigator selection, and update texts.
  onSelectGenBook: function() {
    var elem = MainWindow.document.getElementById("genbook-tree");
    
    try {var selRes = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder).getResourceAtIndex(elem.currentIndex);}
    catch (er) {}
    if (!selRes) return;
   
    var key = elem.database.GetTarget(selRes, BM.RDF.GetResource("http://www.xulsword.com/tableofcontents/rdf#Chapter"), true);
    key = key.QueryInterface(Components.interfaces.nsIRDFLiteral).Value.replace("rdf:#","");

    var mod = key.match(/^\/([^\/]+)/);
    if (!mod)  return;
    mod = mod[1];
    
    for (var w=1; w<=NW; w++) {
      if (prefs.getBoolPref("IsPinned" + w)) continue;
      setUnicodePref("GenBookKey_" + mod + "_" + w, key);
      // scroll corresponding genbook to beginning of chapter
      if (prefs.getCharPref("Version" + w) == mod) {
        var t = document.getElementById("text" + w);
        var sb = t.getElementsByClassName("sb")[0];
        sb.scrollLeft = 0;
      }
    }

    Texts.update();

  },

  //NOTE: Does not open row first!
  scrollGenBookTo: function(key) {
    var elem = MainWindow.document.getElementById("genbook-tree");
    
    var elemTB = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
    
    var res = BM.RDF.GetResource("rdf:#" + key);
    try {var index = elemTB.getIndexOfResource(res);}
    catch (er) {return;}
    
    var parentres = BM.RDF.GetResource("rdf:#" + key.replace(/\/[^\/]+$/,""));
    try {var parentindex = elemTB.getIndexOfResource(parentres);}
    catch (er) {return;}
    
    if (parentindex == -1 || index == -1) return;
    window.setTimeout("GenBookTexts.scrollTreeNow(" + parentindex + ", " + index + ")", 0);
  },

  scrollTreeNow: function(pi, i) {
    var elem = MainWindow.document.getElementById("genbook-tree");
    //elem.boxObject.QueryInterface(Components.interfaces.nsITreeBoxObject).scrollToRow(pi);
    elem.boxObject.QueryInterface(Components.interfaces.nsITreeBoxObject).ensureRowIsVisible(i);
  },
  
  scrollDelta: function(w, delta) {
    var t = document.getElementById("text" + w);
    var sb = t.getElementsByClassName("sb")[0];
    sb.scrollLeft += Number(delta);
  }

};

// Make sure MainWindow has access to our objects
if (MainWindow) {
  if (typeof(MainWindow.DictTexts) == "undefined") MainWindow.DictTexts = DictTexts;
}
