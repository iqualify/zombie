var createHistory, createTabs;

createHistory = require("./history");

createTabs = function(browser) {
  var current, tabs;
  tabs = [];
  current = null;
  Object.defineProperties(tabs, {
    current: {
      get: function() {
        return current;
      },
      set: function(window) {
        window = tabs.find(window) || window;
        if (!~tabs.indexOf(window)) {
          return;
        }
        if (window && window !== current) {
          if (current) {
            browser.emit("inactive", current);
          }
          current = window;
          browser.emit("active", current);
        }
      }
    },
    dump: {
      value: function(output) {
        var i, len, results, window;
        if (output == null) {
          output = process.stdout;
        }
        if (tabs.length === 0) {
          return output.write("No open tabs.\n");
        } else {
          results = [];
          for (i = 0, len = tabs.length; i < len; i++) {
            window = tabs[i];
            results.push(output.write("Window " + (window.name || "unnamed") + " open to " + window.location.href + "\n"));
          }
          return results;
        }
      }
    },
    open: {
      value: function(options) {
        var active, focus, name, open, url, window;
        if (options == null) {
          options = {};
        }
        name = options.name, url = options.url;
        if (name && (window = this.find(name.toString()))) {
          tabs.current = window;
          if (url) {
            window.location = url;
          }
          return current;
        } else {
          if (name === "_blank" || !name) {
            name = "";
          }
          active = null;
          focus = function(window) {
            var index;
            if (window && window !== active) {
              index = tabs.indexOf(active);
              if (~index) {
                tabs[index] = window;
              }
              if (tabs.current === active) {
                tabs.current = window;
              }
              active = window;
            }
            return browser.eventLoop.setActiveWindow(window);
          };
          open = createHistory(browser, focus);
          options.url = url;
          window = open(options);
          this.push(window);
          if (name && (this.propertyIsEnumerable(name) || !this[name])) {
            this[name] = window;
          }
          active = window;
          tabs.current = window;
          return window;
        }
      }
    },
    index: {
      get: function() {
        return this.indexOf(current);
      }
    },
    find: {
      value: function(name) {
        var i, len, window;
        if (tabs.propertyIsEnumerable(name)) {
          return tabs[name];
        }
        for (i = 0, len = this.length; i < len; i++) {
          window = this[i];
          if (window.name === name) {
            return window;
          }
        }
        return null;
      }
    },
    close: {
      value: function(window) {
        if (arguments.length === 0) {
          window = current;
        } else {
          window = this.find(window) || window;
        }
        if (~this.indexOf(window)) {
          window.close();
        }
      }
    },
    closeAll: {
      value: function() {
        var i, len, results, window, windows;
        windows = this.slice(0);
        results = [];
        for (i = 0, len = windows.length; i < len; i++) {
          window = windows[i];
          if (window.close) {
            results.push(window.close());
          } else {
            results.push(void 0);
          }
        }
        return results;
      }
    }
  });
  browser.on("closed", function(window) {
    var index;
    index = tabs.indexOf(window);
    if (~index) {
      browser.emit("inactive", window);
      tabs.splice(index, 1);
      if (tabs.propertyIsEnumerable(window.name)) {
        delete tabs[window.name];
      }
      if (window === current) {
        if (index > 0) {
          current = tabs[index - 1];
        } else {
          current = tabs[0];
        }
        if (current) {
          return browser.emit("active", current);
        }
      }
    }
  });
  return tabs;
};

module.exports = createTabs;
