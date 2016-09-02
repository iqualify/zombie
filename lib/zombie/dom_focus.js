var FOCUS_ELEMENTS, HTML, elementType, i, j, len, len1, ref, ref1, setAttribute, setFocus;

HTML = require("jsdom").defaultLevel;

FOCUS_ELEMENTS = ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "ANCHOR"];

HTML.HTMLDocument.prototype.__defineGetter__("activeElement", function() {
  return this._inFocus || this.body;
});

setFocus = function(document, element) {
  var inFocus, onblur, onfocus;
  inFocus = document._inFocus;
  if (element !== inFocus) {
    if (inFocus) {
      onblur = document.createEvent("HTMLEvents");
      onblur.initEvent("blur", false, false);
      inFocus.dispatchEvent(onblur);
    }
    if (element) {
      onfocus = document.createEvent("HTMLEvents");
      onfocus.initEvent("focus", false, false);
      element.dispatchEvent(onfocus);
      document._inFocus = element;
      return document.window.browser.emit("focus", element);
    }
  }
};

HTML.HTMLElement.prototype.focus = function() {};

HTML.HTMLElement.prototype.blur = function() {};

ref = [HTML.HTMLInputElement, HTML.HTMLSelectElement, HTML.HTMLTextAreaElement, HTML.HTMLButtonElement, HTML.HTMLAnchorElement];
for (i = 0, len = ref.length; i < len; i++) {
  elementType = ref[i];
  elementType.prototype.focus = function() {
    return setFocus(this.ownerDocument, this);
  };
  elementType.prototype.blur = function() {
    return setFocus(this.ownerDocument, null);
  };
  setAttribute = elementType.prototype.setAttribute;
  elementType.prototype.setAttribute = function(name, value) {
    var document;
    setAttribute.call(this, name, value);
    if (name === "autofocus") {
      document = this.ownerDocument;
      if (~FOCUS_ELEMENTS.indexOf(this.tagName) && !document._inFocus) {
        return this.focus();
      }
    }
  };
}

ref1 = [HTML.HTMLInputElement, HTML.HTMLTextAreaElement, HTML.HTMLSelectElement];
for (j = 0, len1 = ref1.length; j < len1; j++) {
  elementType = ref1[j];
  elementType.prototype._eventDefaults.focus = function(event) {
    var element;
    element = event.target;
    return element._focusValue = element.value || '';
  };
  elementType.prototype._eventDefaults.blur = function(event) {
    var change, element, focusValue;
    element = event.target;
    focusValue = element._focusValue;
    if (focusValue !== element.value) {
      change = element.ownerDocument.createEvent("HTMLEvents");
      change.initEvent("change", false, false);
      return element.dispatchEvent(change);
    }
  };
}
