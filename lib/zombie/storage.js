var Event, HTML, Storage, StorageArea, StorageEvent, Storages;

HTML = require("jsdom").defaultLevel;

Event = require("jsdom").level(3, 'events').Event;

StorageArea = (function() {
  function StorageArea() {
    this._items = [];
    this._storages = [];
  }

  StorageArea.prototype._fire = function(source, key, oldValue, newValue) {
    var event, j, len, ref, ref1, results, storage, window;
    ref = this._storages;
    results = [];
    for (j = 0, len = ref.length; j < len; j++) {
      ref1 = ref[j], storage = ref1[0], window = ref1[1];
      if (storage === source) {
        continue;
      }
      event = new StorageEvent(storage, window.location.href, key, oldValue, newValue);
      results.push(window.dispatchEvent(event));
    }
    return results;
  };

  StorageArea.prototype.__defineGetter__("length", function() {
    var i, k;
    i = 0;
    for (k in this._items) {
      ++i;
    }
    return i;
  });

  StorageArea.prototype.key = function(index) {
    var i, k;
    i = 0;
    for (k in this._items) {
      if (i === index) {
        return k;
      }
      ++i;
    }
  };

  StorageArea.prototype.get = function(key) {
    return this._items[key] || null;
  };

  StorageArea.prototype.set = function(source, key, value) {
    var oldValue;
    oldValue = this._items[key];
    this._items[key] = value;
    return this._fire(source, key, oldValue, value);
  };

  StorageArea.prototype.remove = function(source, key) {
    var oldValue;
    oldValue = this._items[key];
    delete this._items[key];
    return this._fire(source, key, oldValue);
  };

  StorageArea.prototype.clear = function(source) {
    this._items = [];
    return this._fire(source);
  };

  StorageArea.prototype.associate = function(storage, window) {
    return this._storages.push([storage, window]);
  };

  StorageArea.prototype.__defineGetter__("pairs", function() {
    var k, v;
    return (function() {
      var ref, results;
      ref = this._items;
      results = [];
      for (k in ref) {
        v = ref[k];
        results.push([k, v]);
      }
      return results;
    }).call(this);
  });

  StorageArea.prototype.toString = function() {
    var k, v;
    return ((function() {
      var ref, results;
      ref = this._items;
      results = [];
      for (k in ref) {
        v = ref[k];
        results.push(k + " = " + v);
      }
      return results;
    }).call(this)).join("\n");
  };

  return StorageArea;

})();

Storage = (function() {
  function Storage(_area) {
    this._area = _area;
  }

  Storage.prototype.__defineGetter__("length", function() {
    return this._area.length;
  });

  Storage.prototype.key = function(index) {
    return this._area.key(index);
  };

  Storage.prototype.getItem = function(key) {
    return this._area.get(key.toString());
  };

  Storage.prototype.setItem = function(key, value) {
    return this._area.set(this, key.toString(), value);
  };

  Storage.prototype.removeItem = function(key) {
    return this._area.remove(this, key.toString());
  };

  Storage.prototype.clear = function() {
    return this._area.clear(this);
  };

  Storage.prototype.dump = function() {
    return this._area.dump();
  };

  return Storage;

})();

StorageEvent = function(storage, url, key, oldValue, newValue) {
  Event.call(this, "storage");
  this.__defineGetter__("url", function() {
    return url;
  });
  this.__defineGetter__("storageArea", function() {
    return storage;
  });
  this.__defineGetter__("key", function() {
    return key;
  });
  this.__defineGetter__("oldValue", function() {
    return oldValue;
  });
  return this.__defineGetter__("newValue", function() {
    return newValue;
  });
};

StorageEvent.prototype.__proto__ = Event.prototype;

HTML.SECURITY_ERR = 18;

Storages = (function() {
  function Storages() {
    this._locals = {};
    this._sessions = {};
  }

  Storages.prototype.local = function(host) {
    var area, base;
    area = (base = this._locals)[host] != null ? base[host] : base[host] = new StorageArea();
    return new Storage(area);
  };

  Storages.prototype.session = function(host) {
    var area, base;
    area = (base = this._sessions)[host] != null ? base[host] : base[host] = new StorageArea();
    return new Storage(area);
  };

  Storages.prototype.extend = function(window) {
    var storages;
    storages = this;
    window.StorageEvent = StorageEvent;
    Object.defineProperty(window, "localStorage", {
      get: function() {
        var ref;
        return (ref = this.document) != null ? ref._localStorage || (ref._localStorage = storages.local(this.location.host)) : void 0;
      }
    });
    return Object.defineProperty(window, "sessionStorage", {
      get: function() {
        var ref;
        return (ref = this.document) != null ? ref._sessionStorage || (ref._sessionStorage = storages.session(this.location.host)) : void 0;
      }
    });
  };

  Storages.prototype.dump = function() {
    var area, domain, j, l, len, len1, pair, pairs, ref, ref1, serialized;
    serialized = [];
    ref = this._locals;
    for (domain in ref) {
      area = ref[domain];
      pairs = area.pairs;
      serialized.push(domain + " local:");
      for (j = 0, len = pairs.length; j < len; j++) {
        pair = pairs[j];
        serialized.push("  " + pair[0] + " = " + pair[1]);
      }
    }
    ref1 = this._sessions;
    for (domain in ref1) {
      area = ref1[domain];
      pairs = area.pairs;
      serialized.push(domain + " session:");
      for (l = 0, len1 = pairs.length; l < len1; l++) {
        pair = pairs[l];
        serialized.push("  " + pair[0] + " = " + pair[1]);
      }
    }
    return serialized;
  };

  Storages.prototype.save = function() {
    var area, domain, j, l, len, len1, pair, pairs, ref, ref1, serialized;
    serialized = ["# Saved on " + (new Date().toISOString())];
    ref = this._locals;
    for (domain in ref) {
      area = ref[domain];
      pairs = area.pairs;
      if (pairs.length > 0) {
        serialized.push(domain + " local:");
        for (j = 0, len = pairs.length; j < len; j++) {
          pair = pairs[j];
          serialized.push("  " + (escape(pair[0])) + " = " + (escape(pair[1])));
        }
      }
    }
    ref1 = this._sessions;
    for (domain in ref1) {
      area = ref1[domain];
      pairs = area.pairs;
      if (pairs.length > 0) {
        serialized.push(domain + " session:");
        for (l = 0, len1 = pairs.length; l < len1; l++) {
          pair = pairs[l];
          serialized.push("  " + (escape(pair[0])) + " = " + (escape(pair[1])));
        }
      }
    }
    return serialized.join("\n") + "\n";
  };

  Storages.prototype.load = function(serialized) {
    var domain, item, j, key, len, ref, ref1, ref2, results, storage, type, value;
    storage = null;
    ref = serialized.split(/\n+/);
    results = [];
    for (j = 0, len = ref.length; j < len; j++) {
      item = ref[j];
      if (item[0] === "#" || item === "") {
        continue;
      }
      if (item[0] === " ") {
        ref1 = item.split("="), key = ref1[0], value = ref1[1];
        if (storage) {
          results.push(storage.setItem(unescape(key.trim()), unescape(value.trim())));
        } else {
          throw "Must specify storage type using local: or session:";
        }
      } else {
        ref2 = item.split(" "), domain = ref2[0], type = ref2[1];
        if (type === "local:") {
          results.push(storage = this.local(domain));
        } else if (type === "session:") {
          results.push(storage = this.session(domain));
        } else {
          throw "Unkown storage type " + type;
        }
      }
    }
    return results;
  };

  return Storages;

})();

module.exports = Storages;
