//<span id="sv" class="hl">
var w;
function loadViewPort() {
el1 = document.getElementById("vs.Ps.119.1");
el2 = document.getElementById("vs.Ps.118.1");
el3 = document.getElementById("vs.Matt.1.1");
  w = document.getElementById("text2");
  var v = document.getElementsByClassName("hl");
  //for (var i=0; i<v.length; i++) {v[i].scrollIntoView(false);}
  //window.setTimeout("window.alert(w.scrollLeft)", 2000);
  //window.setInterval("int();", 100);
  //window.alert(v.id);
  //v.scrollIntoView(true);
}

var el1;
var el2;
var el3;
    
var v=1;
function int() {
  for (var x=0; x<1; x++) {
    if (el1) {
      el1.style.display = "none";
      el1 = el1.nextSibling;
     // jsdump("vs.Ps.119." + v);
    }
    if (el2) {
      el2.style.display = "none";
      el2 = el2.nextSibling;
      //jsdump("vs.Ps.118." + v);
    }
    if (el3) {
      el3.style.display = "none";
      el3 = el3.nextSibling;
      //jsdump("vs.Ps.118." + v);
    }
    v++;
  }
}
