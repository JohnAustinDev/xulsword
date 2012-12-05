/*  This file is part of xulSword.

    Copyright 2009 John Austin (gpl.programs.info@gmail.com)

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

var PrintPassage = {

  ProgressMeter:null,
  FromChooser:null, 
  ToChooser:null, 
  
  init: function() {
    initCSS();

    this.ProgressMeter = document.getElementById("progress");
    this.FromChooser = document.getElementById("from-dropdown");
    this.ToChooser = document.getElementById("to-dropdown");
  
    var startBible = firstDisplayBible();
    var startLocation = MainWindow.Location.getLocation(startBible);
    
    this.FromChooser.location = startLocation;
    this.FromChooser.version = startBible;
    this.ToChooser.location = startLocation;
    this.ToChooser.version = startBible;
      
    var fromBk = document.getAnonymousElementByAttribute(this.FromChooser, "anonid", "book")
    fromBk.focus();
    fromBk.select();
  },

  textHTML:"",
  creatingTextHTML:false,
  
  handlePrintCommand: function(command) {
  
    // Wait until our HTML data is ready before printing
    if (!this.textHTML) {
    
      // Start the creation process if it's not already started
      if (!this.creatingTextHTML) {
        this.creatingTextHTML = true;
        this.createTextHTML();
      }
      
      window.setTimeout("PrintPassage.handlePrintCommand('" + command + "');", 100);
      return;
    }
    this.creatingTextHTML = false;
    
    // prepare our target to send to main print routine
    var target = { 
          uri:"chrome://xulsword/content/printPassage.html", 
          bodyHTML:this.textHTML
        }
      
    MainWindow.handlePrintCommand(command, target);
    
    this.textHTML = "";
  },
  
  From:null,
  To:null,
  Next:null,
  Count:null,
  TotalChaps:null,
  tmpHTML:null,
  
  createTextHTML: function() {
    
    // set up our start and end counters
    var loc = this.FromChooser.location.split(".");
    this.From = { 
        bk:loc[0], 
        bn:findBookNum(loc[0]), 
        ch:Number(loc[1]), 
        vs:Number(loc[2]), 
        lv:Number(loc[2]), 
        mod:this.FromChooser.version };
    
    loc = this.ToChooser.location.split(".");
    this.To = { 
        bk:loc[0], 
        bn:findBookNum(loc[0]), 
        ch:Number(loc[1]), 
        vs:Number(loc[2]), 
        lv:Number(loc[2]), 
        mod:this.FromChooser.version };
    
    this.Count = 0;
    this.TotalChaps = 0;
    if (this.From.bn == this.To.bn) this.TotalChaps = this.To.ch - this.From.ch;
    else {
      this.TotalChaps = Bible.getMaxChapter(this.From.mod, this.From.bk) - this.From.ch
      for (var n=this.From.bn+1; n<=this.To.bn; n++) {
        var add=0;
        if (n == this.To.bn) add = this.To.ch;
        else add = Bible.getMaxChapter(this.From.mod, Book[n].sName);
        this.TotalChaps += add;
      }
    }
    if (this.TotalChaps > 0) this.ProgressMeter.setAttribute("hidden", false);

    // initialize loop variables
    this.tmpHTML  = "<div "; // begin single outer container
    this.tmpHTML += "showIntros=\"" + (document.getElementById("introduction").checked ? "true":"false") + "\" ";
    this.tmpHTML += "showNoteText=\"" + (document.getElementById("crossreftext").checked  ? "true":"false") + "\">"; 
    this.display = this.getDisplay(this.From.mod, this.From.bk + "." + this.From.ch + ".1.1");
    this.Next = { bn:this.From.bn, ch:this.From.ch };
    
    // start the creation loop which will create a chapter's HTML, update
    // the progress bar, and then either quit (if counters are complete) or
    // else schedule a timeout to get the next chapter.
    window.setTimeout("PrintPassage.getChapterHTML();",1);
    
  },

  // Add a single chapter to tmpHTML and then decide what to do next
  getChapterHTML: function() {
  
    this.display.bk = Book[this.Next.bn].sName;
    this.display.ch = this.Next.ch;
    
    var ti = BibleTexts.read(1, this.display);
    
    this.tmpHTML += "<div class='sb'>" + ti.htmlText + "</div>";
    this.tmpHTML += "<div class='nb'>" + ti.htmlNotes + "</div>";
    this.tmpHTML += "<div class=\"pagebreak\"></div>";
    
    // update the progress meter
    this.Count++;
    this.ProgressMeter.value = 100*(this.Count/this.TotalChaps);
    
    // decide what to do next
    if (this.Next.bn == this.To.bn && this.Next.ch == this.To.ch) {
      this.textHTML = this.tmpHTML + "</div>"; // end single outer container
      return;
    }
    if (this.Next.ch == Bible.getMaxChapter(this.From.mod, Book[this.Next.bn].sName)) {
      this.Next.bn++;
      this.Next.ch = 1;
    }
    else this.Next.ch++;
    
    window.setTimeout("PrintPassage.getChapterHTML();", 1);
  },
  
  getDisplay: function(mod, loc) {
    
    // Get default display from current Global settings
    var d = Texts.getDisplay(mod, loc, 1);
    
    // Overwrite our display with values from checkboxes
    for (var tcmd in GlobalToggleCommands) {
      var elem = document.getElementById(tcmd);
      if (!elem) continue;
      d.globalOptions[GlobalToggleCommands[elem.id]] = (elem.checked ? "On":"Off");
    }
    
    return d;
  }

};


// This function is called by reference-dropdowns when they're updated
function onRefUserUpdate(e, location, version) {
  var elem = e.target;
  while (!elem.id) {elem = elem.parentNode;}
  if (!elem) return;
  
//jsdump("A:" + FromChooser.location + " B:" + ToChooser.location + " " + isLocationAbeforeB(FromChooser.location, ToChooser.location) + "\n");
  switch (elem.id) {
  
  case PrintPassage.FromChooser.id:
    PrintPassage.ToChooser.version = version;
    if (!isLocationAbeforeB(location, PrintPassage.ToChooser.location)) 
        PrintPassage.ToChooser.location = location;
    break;
    
  case PrintPassage.ToChooser.id:
    if (!isLocationAbeforeB(PrintPassage.FromChooser.location, location)) 
        PrintPassage.ToChooser.location = PrintPassage.FromChooser.location;
    break;
    
  }

}
