var File, HTML, HTTP, MATCH_CHARSET, Path, Promise, QS, Request, Resources, URL, Zlib, assert, iconv,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  slice = [].slice;

iconv = require("iconv-lite");

File = require("fs");

HTML = require("jsdom").defaultLevel;

Path = require("path");

QS = require("querystring");

Request = require("request");

URL = require("url");

HTTP = require('http');

Zlib = require("zlib");

assert = require("assert");

Promise = require("bluebird").Promise;

Resources = (function(superClass) {
  extend(Resources, superClass);

  function Resources(browser) {
    this.browser = browser;
    this.pipeline = Resources.pipeline.slice();
    this.urlMatchers = [];
  }

  Resources.prototype.request = function(method, url, options, callback) {
    var promise, ref, request, resource;
    if (options == null) {
      options = {};
    }
    if (!callback && typeof options === 'function') {
      ref = [{}, options], options = ref[0], callback = ref[1];
    }
    request = {
      method: method.toUpperCase(),
      url: url,
      headers: options.headers || {},
      params: options.params,
      body: options.body,
      time: Date.now(),
      timeout: options.timeout || 0,
      strictSSL: this.browser.strictSSL,
      localAddress: this.browser.localAddress || 0
    };
    resource = {
      request: request,
      target: options.target
    };
    this.push(resource);
    this.browser.emit("request", request);
    promise = new Promise((function(_this) {
      return function(resolve, reject) {
        return _this.runPipeline(request, function(error, response) {
          if (error) {
            resource.error = error;
            return reject(error);
          } else {
            response.url || (response.url = request.url);
            response.statusCode || (response.statusCode = 200);
            response.statusText = HTTP.STATUS_CODES[response.statusCode] || "Unknown";
            response.headers || (response.headers = {});
            response.redirects || (response.redirects = 0);
            response.time = Date.now();
            resource.response = response;
            _this.browser.emit("response", request, response);
            return resolve(resource.response);
          }
        });
      };
    })(this));
    if (callback) {
      return promise.done(function(response) {
        return callback(null, response);
      }, callback);
    } else {
      return promise;
    }
  };

  Resources.prototype.get = function(url, options, callback) {
    return this.request("get", url, options, callback);
  };

  Resources.prototype.post = function(url, options, callback) {
    return this.request("post", url, options, callback);
  };

  Resources.prototype.fail = function(url, message) {
    var failTheRequest;
    failTheRequest = function(request, next) {
      return next(new Error(message || "This request was intended to fail"));
    };
    this.urlMatchers.push([url, failTheRequest]);
  };

  Resources.prototype.delay = function(url, delay) {
    var delayTheResponse;
    if (delay == null) {
      delay = 10;
    }
    delayTheResponse = function(request, next) {
      return setTimeout(next, delay);
    };
    this.urlMatchers.push([url, delayTheResponse]);
  };

  Resources.prototype.mock = function(url, result) {
    var mockTheResponse;
    if (result == null) {
      result = {};
    }
    mockTheResponse = function(request, next) {
      return next(null, result);
    };
    this.urlMatchers.push([url, mockTheResponse]);
  };

  Resources.prototype.restore = function(url) {
    this.urlMatchers = this.urlMatchers.filter(function(arg) {
      var _, match;
      match = arg[0], _ = arg[1];
      return match !== url;
    });
  };

  Resources.prototype.dump = function(output) {
    var error, i, len, name, ref, request, resource, response, results, sample, target, value;
    if (output == null) {
      output = process.stdout;
    }
    results = [];
    for (i = 0, len = this.length; i < len; i++) {
      resource = this[i];
      request = resource.request, response = resource.response, error = resource.error, target = resource.target;
      if (response) {
        output.write(request.method + " " + response.url + " - " + response.statusCode + " " + response.statusText + " - " + (response.time - request.time) + "ms\n");
      } else {
        output.write(resource.request.method + " " + resource.request.url + "\n");
      }
      if (target instanceof HTML.Document) {
        output.write("  Loaded as HTML document\n");
      } else if (target) {
        if (target.id) {
          output.write("  Loading by element #" + target.id + "\n");
        } else {
          output.write("  Loading as " + target.tagName + " element\n");
        }
      }
      if (response) {
        if (response.redirects) {
          output.write("  Followed " + response.redirects + " redirects\n");
        }
        ref = response.headers;
        for (name in ref) {
          value = ref[name];
          output.write("  " + name + ": " + value + "\n");
        }
        output.write("\n");
        sample = response.body.slice(0, 250).toString("utf8").split("\n").map(function(line) {
          return "  " + line;
        }).join("\n");
        output.write(sample);
      } else if (error) {
        output.write("  Error: " + error.message + "\n");
      } else {
        output.write("  Pending since " + (new Date(request.time)) + "\n");
      }
      results.push(output.write("\n\n"));
    }
    return results;
  };

  Resources.prototype.addHandler = function(handler) {
    assert(handler.call, "Handler must be a function");
    assert(handler.length === 2 || handler.length === 3, "Handler function takes 2 (request handler) or 3 (reponse handler) arguments");
    return this.pipeline.push(handler);
  };

  Resources.prototype.runPipeline = function(request, callback) {
    var nextRequestHandler, nextResponseHandler, requestHandlers, response, responseHandlers;
    requestHandlers = this.pipeline.filter(function(fn) {
      return fn.length === 2;
    });
    requestHandlers.push(Resources.makeHTTPRequest);
    responseHandlers = this.pipeline.filter(function(fn) {
      return fn.length === 3;
    });
    response = null;
    nextRequestHandler = (function(_this) {
      return function(error, responseFromHandler) {
        var error1, handler;
        if (error) {
          return callback(error);
        } else if (responseFromHandler) {
          response = responseFromHandler;
          response.url || (response.url = request.url);
          return nextResponseHandler();
        } else {
          handler = requestHandlers.shift();
          try {
            return handler.call(_this.browser, request, nextRequestHandler);
          } catch (error1) {
            error = error1;
            return callback(error);
          }
        }
      };
    })(this);
    nextResponseHandler = (function(_this) {
      return function(error, responseFromHandler) {
        var error1, handler;
        if (error) {
          return callback(error);
        } else {
          if (responseFromHandler) {
            response = responseFromHandler;
          }
          handler = responseHandlers.shift();
          if (handler) {
            try {
              return handler.call(_this.browser, request, response, nextResponseHandler);
            } catch (error1) {
              error = error1;
              return callback(error);
            }
          } else {
            return callback(null, response);
          }
        }
      };
    })(this);
    nextRequestHandler();
  };

  return Resources;

})(Array);

Resources.addHandler = function(handler) {
  assert(handler.call, "Handler must be a function");
  assert(handler.length === 2 || handler.length === 3, "Handler function takes 2 (request handler) or 3 (response handler) arguments");
  return this.pipeline.push(handler);
};

Resources.normalizeURL = function(request, next) {
  var method, name, ref, uri, value;
  if (/^file:/.test(request.url)) {
    request.url = request.url.replace(/^file:\/{1,3}/, "file:///");
  } else {
    if (this.document) {
      request.url = HTML.resourceLoader.resolve(this.document, request.url);
    } else {
      request.url = URL.resolve(this.site || "http://localhost", request.url);
    }
  }
  if (request.params) {
    method = request.method;
    if (method === "GET" || method === "HEAD" || method === "DELETE") {
      uri = URL.parse(request.url, true);
      ref = request.params;
      for (name in ref) {
        value = ref[name];
        uri.query[name] = value;
      }
      request.url = URL.format(uri);
    }
  }
  next();
};

Resources.mergeHeaders = function(request, next) {
  var credentials, headers, host, name, ref, ref1, value;
  headers = {
    "user-agent": this.userAgent
  };
  ref = this.headers;
  for (name in ref) {
    value = ref[name];
    headers[name.toLowerCase()] = value;
  }
  if (request.headers) {
    ref1 = request.headers;
    for (name in ref1) {
      value = ref1[name];
      headers[name.toLowerCase()] = value;
    }
  }
  host = URL.parse(request.url).host;
  headers.host = host;
  if (credentials = this.authenticate(host, false)) {
    credentials.apply(headers);
  }
  request.headers = headers;
  next();
};

Resources.createBody = function(request, next) {
  var binary, boundary, disp, headers, i, len, method, mimeType, multipart, name, params, value, values;
  method = request.method;
  if (method === "POST" || method === "PUT") {
    headers = request.headers;
    headers["content-type"] || (headers["content-type"] = "application/x-www-form-urlencoded");
    mimeType = headers["content-type"].split(";")[0];
    if (!request.body) {
      switch (mimeType) {
        case "application/x-www-form-urlencoded":
          request.body = QS.stringify(request.params || {});
          headers["content-length"] = request.body.length;
          break;
        case "multipart/form-data":
          params = request.params || {};
          if (Object.keys(params).length === 0) {
            headers["content-type"] = "text/plain";
            request.body = "";
          } else {
            boundary = (new Date().getTime()) + "." + (Math.random());
            headers["content-type"] += "; boundary=" + boundary;
            multipart = [];
            for (name in params) {
              values = params[name];
              for (i = 0, len = values.length; i < len; i++) {
                value = values[i];
                disp = "form-data; name=\"" + name + "\"";
                if (value.read) {
                  binary = value.read();
                  multipart.push({
                    "Content-Disposition": disp + "; filename=\"" + value + "\"",
                    "Content-Type": value.mime || "application/octet-stream",
                    "Content-Length": binary.length,
                    body: binary
                  });
                } else {
                  multipart.push({
                    "Content-Disposition": disp,
                    "Content-Type": "text/plain; charset=utf8",
                    "Content-Length": value.length,
                    body: value
                  });
                }
              }
            }
            request.multipart = multipart;
          }
          break;
        case "text/plain":
          break;
        default:
          next(new Error("Unsupported content type " + mimeType));
          return;
      }
    }
  }
  next();
};

Resources.specialURLHandlers = function(request, next) {
  var handler, i, len, ref, ref1, url;
  ref = this.resources.urlMatchers;
  for (i = 0, len = ref.length; i < len; i++) {
    ref1 = ref[i], url = ref1[0], handler = ref1[1];
    if (url instanceof RegExp) {
      if (url.test(request.url)) {
        handler(request, next);
        return;
      }
    } else if (URL.resolve(request.url, url) === request.url) {
      handler(request, next);
      return;
    }
  }
  return next();
};

Resources.handleHTTPResponse = function(request, response, callback) {
  var hostname, name, pathname, protocol, redirectHeaders, redirectRequest, redirectUrl, redirects, ref, ref1, setCookie, value;
  ref = URL.parse(request.url), protocol = ref.protocol, hostname = ref.hostname, pathname = ref.pathname;
  if (!(protocol === "http:" || protocol === "https:")) {
    callback();
    return;
  }
  setCookie = response.headers && response.headers["set-cookie"];
  if (setCookie) {
    this.cookies.update(setCookie, hostname, pathname);
  }
  redirects = request.redirects || 0;
  redirectUrl = null;
  switch (response.statusCode) {
    case 301:
    case 307:
      if (request.method === "GET" || request.method === "HEAD") {
        redirectUrl = URL.resolve(request.url, response.headers.location);
      }
      break;
    case 302:
    case 303:
      redirectUrl = URL.resolve(request.url, response.headers.location);
  }
  if (redirectUrl) {
    response.url = redirectUrl;
    ++redirects;
    if (redirects > this.maxRedirects) {
      callback(new Error("More than " + this.maxRedirects + " redirects, giving up"));
      return;
    }
    redirectHeaders = {};
    ref1 = request.headers;
    for (name in ref1) {
      value = ref1[name];
      redirectHeaders[name] = value;
    }
    redirectHeaders.referer = request.url;
    delete redirectHeaders["content-type"];
    delete redirectHeaders["content-length"];
    delete redirectHeaders["content-transfer-encoding"];
    redirectRequest = {
      method: "GET",
      url: response.url,
      headers: redirectHeaders,
      redirects: redirects,
      strictSSL: request.strictSSL,
      time: request.time,
      timeout: request.timeout
    };
    this.emit("redirect", request, response, redirectRequest);
    this.resources.runPipeline(redirectRequest, callback);
  } else {
    response.redirects = redirects;
    callback();
  }
};

Resources.decompressBody = function(request, response, next) {
  var contentEncoding, transferEncoding;
  if (response.body && response.headers) {
    transferEncoding = response.headers["transfer-encoding"];
    contentEncoding = response.headers["content-encoding"];
  }
  if ((contentEncoding === "deflate") || (transferEncoding === "deflate")) {
    Zlib.inflate(response.body, function(error, buffer) {
      if (!error) {
        response.body = buffer;
      }
      return next(error);
    });
  } else if ((contentEncoding === "gzip") || (transferEncoding === "gzip")) {
    Zlib.gunzip(response.body, function(error, buffer) {
      if (!error) {
        response.body = buffer;
      }
      return next(error);
    });
  } else {
    next();
  }
};

MATCH_CHARSET = /<meta(?!\s*(?:name|value)\s*=)[^>]*?charset\s*=[\s"']*([^\s"'\/>]*)/i;

Resources.decodeBody = function(request, response, next) {
  var charset, contentType, i, isHTML, len, match, mimeType, ref, ref1, subtype, type, typeOption, typeOptions;
  contentType = response.headers && response.headers["content-type"];
  if (contentType && Buffer.isBuffer(response.body)) {
    ref = contentType.split(/;\s*/), mimeType = ref[0], typeOptions = 2 <= ref.length ? slice.call(ref, 1) : [];
    ref1 = contentType.split(/\//, 2), type = ref1[0], subtype = ref1[1];
  }
  if (type && type !== "text") {
    next();
    return;
  }
  if (Buffer.isBuffer(response.body)) {
    if (mimeType) {
      for (i = 0, len = typeOptions.length; i < len; i++) {
        typeOption = typeOptions[i];
        if (/^charset=/i.test(typeOption)) {
          charset = typeOption.split("=")[1];
          break;
        }
      }
    }
    isHTML = /html/.test(subtype) || /\bhtml\b/.test(request.headers.accept);
    if (!charset && isHTML) {
      match = response.body.toString().match(MATCH_CHARSET);
      charset = match && match[1];
    }
    if (!charset && isHTML) {
      charset = charset || "windows-1252";
    }
    if (charset) {
      response.body = iconv.decode(response.body, charset);
    }
  }
  return next();
};

Resources.pipeline = [Resources.normalizeURL, Resources.mergeHeaders, Resources.createBody, Resources.specialURLHandlers, Resources.handleHTTPResponse, Resources.decompressBody, Resources.decodeBody];

Resources.makeHTTPRequest = function(request, callback) {
  var cookies, filename, hostname, httpRequest, pathname, protocol, ref;
  ref = URL.parse(request.url), protocol = ref.protocol, hostname = ref.hostname, pathname = ref.pathname;
  if (protocol === "file:") {
    if (request.method === "GET") {
      filename = Path.normalize(decodeURI(pathname));
      File.exists(filename, (function(_this) {
        return function(exists) {
          if (exists) {
            return File.readFile(filename, function(error, buffer) {
              if (error) {
                request.error = error;
                return callback(error);
              } else {
                return callback(null, {
                  body: buffer
                });
              }
            });
          } else {
            return callback(null, {
              statusCode: 404
            });
          }
        };
      })(this));
    } else {
      callback(resource.error);
    }
  } else {
    cookies = this.cookies;
    request.headers.cookie = cookies.serialize(hostname, pathname);
    httpRequest = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
      multipart: request.multipart,
      proxy: this.proxy,
      jar: false,
      followRedirect: false,
      encoding: null,
      strictSSL: request.strictSSL,
      localAddress: request.localAddress || 0,
      timeout: request.timeout || 0
    };
    Request(httpRequest, (function(_this) {
      return function(error, response) {
        if (error) {
          callback(error);
          return;
        }
        response = {
          url: request.url,
          statusCode: response.statusCode,
          headers: response.headers,
          body: response.body,
          redirects: request.redirects || 0
        };
        return callback(null, response);
      };
    })(this));
  }
};

module.exports = Resources;
