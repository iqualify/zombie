var Interaction;

Interaction = (function() {
  function Interaction(browser) {
    var alertFns, confirmCanned, confirmFns, promptCanned, promptFns, prompts;
    prompts = [];
    alertFns = [];
    this.onalert = function(fn) {
      return alertFns.push(fn);
    };
    confirmFns = [];
    confirmCanned = {};
    this.onconfirm = function(question, response) {
      if (typeof question === "function") {
        return confirmFns.push(question);
      } else {
        return confirmCanned[question] = !!response;
      }
    };
    promptFns = [];
    promptCanned = {};
    this.onprompt = function(message, response) {
      if (typeof message === "function") {
        return promptFns.push(message);
      } else {
        return promptCanned[message] = response;
      }
    };
    this.prompted = function(message) {
      return prompts.indexOf(message) >= 0;
    };
    this.extend = function(window) {
      window.alert = function(message) {
        var fn, i, len;
        browser.emit("alert", message);
        prompts.push(message);
        for (i = 0, len = alertFns.length; i < len; i++) {
          fn = alertFns[i];
          fn(message);
        }
      };
      window.confirm = function(question) {
        var fn, i, len, response;
        browser.emit("confirm", question);
        prompts.push(question);
        response = confirmCanned[question];
        if (!(response || response === false)) {
          for (i = 0, len = confirmFns.length; i < len; i++) {
            fn = confirmFns[i];
            response = fn(question);
            if (response || response === false) {
              break;
            }
          }
        }
        return !!response;
      };
      return window.prompt = function(message, defaultValue) {
        var fn, i, len, response;
        browser.emit("prompt", message);
        prompts.push(message);
        response = promptCanned[message];
        if (!(response || response === false)) {
          for (i = 0, len = promptFns.length; i < len; i++) {
            fn = promptFns[i];
            response = fn(message, defaultValue);
            if (response || response === false) {
              break;
            }
          }
        }
        if (response) {
          return response.toString();
        }
        if (response === false) {
          return null;
        }
        return defaultValue || "";
      };
    };
  }

  return Interaction;

})();

exports.use = function(browser) {
  return new Interaction(browser);
};
