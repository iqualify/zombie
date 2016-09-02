var Console, format, inspect, ref,
  slice = [].slice;

ref = require("util"), format = ref.format, inspect = ref.inspect;

Console = (function() {
  function Console(browser) {
    this.browser = browser;
  }

  Console.prototype.assert = function(expression) {
    var message;
    if (expression) {
      return;
    }
    message = "Assertion failed:" + (format.apply(null, [""].concat(slice.call(Array.prototype.slice.call(arguments, 1)))));
    this.browser.emit("console", "error", message);
    throw new Error(message);
  };

  Console.prototype.count = function(name) {
    var base, message;
    this.counters || (this.counters = {});
    (base = this.counters)[name] || (base[name] = 0);
    this.counters[name]++;
    message = name + ": " + this.counters[name];
    this.browser.emit("console", "log", message);
  };

  Console.prototype.debug = function() {
    this.browser.emit("console", "debug", format.apply(null, arguments));
  };

  Console.prototype.error = function() {
    this.browser.emit("console", "error", format.apply(null, arguments));
  };

  Console.prototype.group = function() {};

  Console.prototype.groupCollapsed = function() {};

  Console.prototype.groupEnd = function() {};

  Console.prototype.dir = function(object) {
    this.browser.emit("console", "log", inspect(object));
  };

  Console.prototype.info = function() {
    this.browser.emit("console", "info", format.apply(null, arguments));
  };

  Console.prototype.log = function() {
    this.browser.emit("console", "log", format.apply(null, arguments));
  };

  Console.prototype.time = function(name) {
    this.timers || (this.timers = {});
    return this.timers[name] = Date.now();
  };

  Console.prototype.timeEnd = function(name) {
    var message, start;
    if (this.timers) {
      if (start = this.timers[name]) {
        delete this.timers[name];
        message = name + ": " + (Date.now() - start) + "ms";
        this.browser.emit("console", "log", message);
      }
    }
  };

  Console.prototype.trace = function() {
    var message, stack;
    stack = (new Error).stack.split("\n");
    stack[0] = "console.trace()";
    message = stack.join("\n");
    this.browser.emit("console", "trace", message);
  };

  Console.prototype.warn = function() {
    this.browser.emit("console", "warn", format.apply(null, arguments));
  };

  return Console;

})();

module.exports = Console;
