var DNS, DNSMask, Net;

DNS = require("dns");

Net = require("net");

DNSMask = (function() {
  function DNSMask() {
    this._domains = {};
    this._lookup = DNS.lookup;
    DNS.lookup = this.lookup.bind(this);
    this._resolve = DNS.resolve;
    DNS.resolve = this.resolve.bind(this);
    this._resolveMx = DNS.resolve;
    DNS.resolveMx = this.resolveMx.bind(this);
  }

  DNSMask.prototype.localhost = function(domain) {
    this.map(domain, "A", "127.0.0.1");
    return this.map(domain, "AAAA", "::1");
  };

  DNSMask.prototype.map = function(domain, type, address) {
    var base;
    if (arguments.length === 2) {
      address = type;
      switch (Net.isIP(address)) {
        case 4:
          type = "A";
          break;
        case 6:
          type = "AAAA";
          break;
        default:
          type = "CNAME";
      }
    }
    if (address) {
      (base = this._domains)[domain] || (base[domain] = {});
      return this._domains[domain][type] = address;
    } else {
      return this.unmap(domain, type);
    }
  };

  DNSMask.prototype.unmap = function(domain, type) {
    var base;
    if (type) {
      (base = this._domains)[domain] || (base[domain] = {});
      return delete this._domains[domain][type];
    } else {
      return delete this._domains[domain];
    }
  };

  DNSMask.prototype.lookup = function(domain, family, callback) {
    var cname, ipv4, ipv6, ref;
    if (arguments.length === 2) {
      ref = [null, family], family = ref[0], callback = ref[1];
    }
    if (!domain) {
      setImmediate(function() {
        return callback(null, null, 4);
      });
      return;
    }
    if (Net.isIP(domain)) {
      setImmediate(function() {
        return callback(null, domain, Net.isIP(domain));
      });
      return;
    }
    cname = this._find(domain, "CNAME");
    if (cname) {
      domain = cname;
    }
    if (family === 4 || !family) {
      ipv4 = this._find(domain, "A");
      if (ipv4) {
        setImmediate(function() {
          return callback(null, ipv4, 4);
        });
        return;
      }
    }
    if (family === 6 || !family) {
      ipv6 = this._find(domain, "AAAA");
      if (ipv6) {
        setImmediate(function() {
          return callback(null, ipv6, 6);
        });
        return;
      }
    }
    return this._lookup(domain, family, callback);
  };

  DNSMask.prototype.resolve = function(domain, type, callback) {
    var ip, ref;
    if (arguments.length === 2) {
      ref = ["A", type], type = ref[0], callback = ref[1];
    }
    ip = this._find(domain, type);
    if (ip) {
      return setImmediate(function() {
        return callback(null, [ip]);
      });
    } else {
      return this._resolve(domain, type, callback);
    }
  };

  DNSMask.prototype.resolveMx = function(domain, callback) {
    var exchange;
    exchange = this._find(domain, "MX");
    if (exchange) {
      return setImmediate(function() {
        return callback(null, [exchange]);
      });
    } else {
      return this._resolveMx(domain, callback);
    }
  };

  DNSMask.prototype._find = function(domain, type) {
    var domains, i, j, parts, ref;
    parts = domain.split('.');
    domains = [domain, "*." + domain];
    for (i = j = 1, ref = parts.length; 1 <= ref ? j < ref : j > ref; i = 1 <= ref ? ++j : --j) {
      domains.push("*." + parts.slice(i, +parts.length + 1 || 9e9).join('.'));
    }
    return domains.map((function(_this) {
      return function(pattern) {
        return _this._domains[pattern];
      };
    })(this)).map((function(_this) {
      return function(domain) {
        return domain && domain[type];
      };
    })(this)).filter(function(ip) {
      return ip;
    })[0];
  };

  return DNSMask;

})();

module.exports = DNSMask;
