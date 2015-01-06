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

GenBookTexts = {
    
  read: function(w, d) {
    var ret = { htmlHead:Texts.getPageLinks(), htmlText:"", footnotes:null };
    
    ret.htmlText = LibSword.getGenBookChapterText(d.mod, d.Key);
    
    // add headers
    var showHeader = (d.globalOptions["Headings"]=="On");
    if (showHeader && ret.htmlText) {
      ret.htmlText = this.getChapterHeading(d) + ret.htmlText;
    }

    if (d.globalOptions["User Notes"] == "On") {
      var un = Texts.getUserNotes("na", d.Key, d.mod, ret.htmlText);
      ret.htmlText = un.html; // has user notes added to text
      ret.footnotes = un.notes;
    }
    
    return ret;
  },
  
  // This function is only for GenBook modules
  getChapterHeading: function(d) {
    var l = ModuleConfigs[d.mod].AssociatedLocale;
    if (l == NOTFOUND) {l = getLocale();} // otherwise use current program locale
  
    var html = "";
    html += "<div class=\"listenlink\" title=\"" + [0, encodeURIComponent(d.Key), 0, d.mod].join(".") + "\"></div>";
   
    return html;
  },
  
  updateAudioLinks: function(w) {
    var icons = document.getElementById("text" + w).getElementsByClassName("listenlink");
    for (var i = 0; i < icons.length; ++i) {
      var p = getElementInfo(icons[i]);
      icons[i].className = icons[i].className.replace(/\s*hasAudio/, "");
      if (AudioDirs.length && false) icons[i].className += " hasAudio"; //XS_window.getAudioForChapter(p.mod, p.bk, p.ch)
    }
  },

  // returns the first rdfChapter of general-book module, or null if not found.
  firstRdfChapter: function(mod) {

    var root = BM.RDF.GetResource("rdf:#" + "/" + mod);
    
    var db = GenBookNavigator.getDatasource(mod);
    if (!db) {
      jsdump("ERROR: firstRdfChapter- No database for \"" + mod + "\"");
      return null;			
    }
    
    var chapter1 = db.GetTarget(root, BM.RDFCU.IndexToOrdinalResource(1), true);
    if (!chapter1) {
      jsdump("ERROR: firstRdfChapter- No chapters in GenBook module \"" + mod + "\"");
      return null;
    }

    return chapter1.QueryInterface(Components.interfaces.nsIRDFResource).ValueUTF8;
  },
  
  // returns the previous rdfChapter or null if there is none.
  previousRdfChapter: function(rdfChapter) {
    var previous = null;
    
    var ch = this.getRdfChapterResource(rdfChapter);
    if (!ch.node || !ch.ds) {
      jsdump("ERROR: No previous rdfChapter for \"" + rdfChapter + "\"");
      return null;
    }
    
    var parent = ch.node.ValueUTF8;
    parent = parent.replace(/\/[^\/]*$/, "");
    var test = parent.match(GenBookNavigator.RDFCHAPTER);
    if (!test) parent = null;

    // try previous node
    if (parent) {
      BM.RDFC.Init(ch.ds, BM.RDF.GetResource(parent));
      var siblings = BM.RDFC.GetElements();
      if (siblings.hasMoreElements()) {
        var prev = siblings.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
        while (siblings.hasMoreElements()) {
          var next = siblings.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
          if (next == ch.node) {
              previous = prev.ValueUTF8;
              break;
          }
          else prev = next;
        }
      }
    }
    
    // if previous node is a container, return its last child
    if (previous && BM.RDFCU.IsContainer(ch.ds, BM.RDF.GetResource(previous))) {
      BM.RDFC.Init(ch.ds, BM.RDF.GetResource(previous));
      var chldrn = BM.RDFC.GetElements();
      var last = null;
      while(chldrn.hasMoreElements()) {last = chldrn.getNext().QueryInterface(Components.interfaces.nsIRDFResource);}
      if (last) previous = last.ValueUTF8;
    }
    
    // if there is no previous node, go to parent
    if (!previous && parent) previous = parent;
    
    // return null if result is not an rdfChapter
    if (previous && !previous.match(GenBookNavigator.RDFCHAPTER)[2]) return null;
    
    return previous;
  },
  
  // returns the next rdfChapter, or null if there is none.
  nextRdfChapter: function(rdfChapter, skipChildren) {
    var next = null;

    var ch = this.getRdfChapterResource(rdfChapter);
    if (!ch.node || !ch.ds) {
      jsdump("ERROR: No next rdfChapter for \"" + rdfChapter + "\"");
      return null;
    }
    
    var parent = ch.node.ValueUTF8;
    parent = parent.replace(/\/[^\/]*$/, "");
    var test = parent.match(GenBookNavigator.RDFCHAPTER);
    if (!test) parent = null;
 
    // try first child...
    if (!skipChildren && BM.RDFCU.IsContainer(ch.ds, ch.node)) {
      BM.RDFC.Init(ch.ds, ch.node);
      var chldrn = BM.RDFC.GetElements();
      if (chldrn.hasMoreElements()) next = chldrn.getNext().QueryInterface(Components.interfaces.nsIRDFResource).ValueUTF8;
    }

    // or else try next sibling...
    if (!next && parent) {
      BM.RDFC.Init(ch.ds, BM.RDF.GetResource(parent));
      chldrn = BM.RDFC.GetElements();
      while(chldrn.hasMoreElements()) {
        var child = chldrn.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
        if (child == ch.node && chldrn.hasMoreElements()) {
          next = chldrn.getNext().QueryInterface(Components.interfaces.nsIRDFResource).ValueUTF8;
          break;
        }
      }
    }

    // or else try parent's next sibling...
    if (!next && parent) next = this.nextRdfChapter(parent, true);
   
    // return null if result is not an rdfChapter
    if (next && !next.match(GenBookNavigator.RDFCHAPTER)[2]) return null;
    return next;
  },
  
    
  // updates all windows which are showing aMod to a new key value
  updateKeys: function(aMod, aKey) {
    for (var w=1; w<=NW; w++) {
      if (ViewPort.Module[w] != aMod) continue;
          
      ViewPort.Key[w] = aKey;

      // scroll corresponding genbook to beginning of chapter
      var t = document.getElementById("text" + w);
      var sb = t.getElementsByClassName("sb")[0];
      sb.scrollLeft = 0;
    }
  },
  
  // this function insures that each genbk module has a valid key.
  validateKeys: function() {
    for (var w=1; w<=ViewPort.NumDisplayedWindows; w++) {
      var aMod = ViewPort.Module[w];
      if (Tab[aMod].modType != GENBOOK) continue;
      
      // check the validity of every genbk module's current key
      var validKey = false;
      
      if (ViewPort.Key[w]) {
        var chValue = "rdf:#/" + aMod + ViewPort.Key[w];
        var chNode = BM.RDF.GetResource(chValue);
        var ch = GenBookNavigator.getDatasource(aMod).GetTarget(chNode, GenBookNavigator.ChapterResource, true);
        if (ch) ch = ch.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
        if (ch && ch == chValue) validKey = true;
      }
  
      if (!validKey) {
        var ch = GenBookTexts.firstRdfChapter(aMod);
        ViewPort.Key[w] = (ch && GenBookNavigator.RDFCHAPTER.test(ch) ? ch.match(GenBookNavigator.RDFCHAPTER)[2]:"");
//jsdump("validateKeys setting mod:" + aMod + " to key:" + ViewPort.Key[w]);
      }
      
    }
  },
  
  // chack for and return the database and resource for a given rdfChapter, 
  // or null values if database and/or resource are not found or are unexpected.
  getRdfChapterResource: function(rdfChapter) {
    // get our resource
    var r = {node:null, ds:null};
    
    var mod = rdfChapter.match(GenBookNavigator.RDFCHAPTER)[1];
    if (!mod) return r;
    
    r.ds = GenBookNavigator.getDatasource(mod);
    if (!r.ds) return r;
    
    var es = r.ds.GetAllResources();
    while (es.hasMoreElements()) {
      var e = es.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
      if (e.ValueUTF8 == rdfChapter) {
        r.node = e;
        // if not a container, keep looking. A container resource appears also as description resource.
        if (BM.RDFCU.IsContainer(r.ds, r.node)) break;
      }
    }
    
    // return null if this is not an rdfChapter
    if (r.node && !r.node.ValueUTF8.match(GenBookNavigator.RDFCHAPTER)[2]) r.node = null;
    
    return r;
  },

  scrollDelta: function(w, delta) {
    var t = document.getElementById("text" + w);
    var sb = t.getElementsByClassName("sb")[0];
    sb.scrollLeft += Number(delta);
  }

};


