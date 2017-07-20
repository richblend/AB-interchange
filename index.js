'use strict';

var AB = require('another-brick');
var abMediaQuery = require('ab-mediaquery');

var pluginName = 'interchange',
    attr       = 'data-ab-interchange',
    attrSrc    = 'data-ab-interchange-src';

var Plugin = function(el, options) {
  this.el = el;

  var dataOptions  = window.AB.isJson(this.el.getAttribute(attr)) ? JSON.parse(this.el.getAttribute(attr)) : {};
  this.settings    = window.AB.extend(true, Plugin.defaults, options, dataOptions);

  this.rules       = [];
  this.currentPath = '';
  this.mode        = this._defineMode();
  this.animated    = false;

  this.init();
};

Plugin.defaults = {
  mode      : 'background',
  lazy      : true,
  offscreen : 1.5
};

Plugin.prototype = {
  init: function() {
    // no need for a plugin in case of 'picture' with good support
    if (this.el.parentNode.matches('picture') && window.HTMLPictureElement)
      return this;

    this._events()
        ._generateRules()
        ._updatePath();

    return this;
  },

  _defineMode: function() {
    // in case of <img /> there is no doubt
    if (this.el.nodeName === 'IMG')
      return 'img';

    return this.settings.mode;
  },

  _generateRules: function() {
    var rulesList = [],
        rules     = this.el.getAttribute(attrSrc).match(/\[[^\]]+\]/g);

    for (var i = 0, len = rules.length; i < len; i++) {
      var rule  = rules[i].slice(1, -1).split(', '),
          path  = rule.slice(0, -1).join(''),
          query = rule[rule.length - 1];

      rulesList.push({
        path: path,
        query: query
      });
    }

    this.rules = rulesList;

    return this;
  },

  _updatePath: function() {
    var path  = '',
        rules = this.rules;

    // Iterate through each rule
    for (var i = 0, len = rules.length; i < len; i++) {
      if (window.AB.mediaQuery.is(rules[i].query))
        path = rules[i].path;
    }

    // if path hasn't changed, return
    if (this.currentPath === path)
      return this;

    this.currentPath = path;
    this._replace();

    return this;
  },

  _onScroll: function() {
    this.animated = false;

    if (this._inView())
      this._replace();

    return this;
  },

  _events: function() {
    var that = this;

    // update path, then replace
    window.addEventListener('changed.ab-mediaquery', that._updatePath.bind(that));

    if (that.settings.lazy) {
      window.addEventListener('scroll', function() {
        if (!that.animated) {
          window.requestAnimationFrame(that._onScroll.bind(that));
          that.animated = true;
        }
      });
    }

    // on img change
    that.el.addEventListener('load', that._triggerEvent.bind(that));

    return that;
  },

  _inView: function() {
    var windowHeight = window.innerHeight,
        rect         = this.el.getBoundingClientRect();

    return (
      rect.top >= - windowHeight * this.settings.offscreen &&
      rect.bottom <= windowHeight + windowHeight * this.settings.offscreen
    );
  },

  _triggerEvent: function() {
    var event = new CustomEvent('replaced.ab-interchange', {
      detail: {
        element: this.el
      }
    });
    window.dispatchEvent(event);

    return this;
  },

  _replace: function() {
    var that = this,
        path = that.currentPath;

    if ( !that.settings.lazy || (that.settings.lazy && that._inView()) ) {
      // image case
      if (that.mode === 'img') {
        if (that.el.src === path)
          return that;

        that.el.src = path; // event triggered when img is loaded
        return that;
      }

      // background-image case
      if (that.mode === 'background') {
        if (that.el.style.backgroundImage === 'url("'+path+'")')
          return that;

        if (path)
          path = 'url('+path+')';
        else
          path = 'none';

        that.el.style.backgroundImage = path;
        that._triggerEvent();

        return that;
      }

      // HTML case
      if (that.mode === 'ajax') {
        if (!path) {
          that.el.innerHTML = '';
          return that;
        }

        var request = new XMLHttpRequest();
        request.open('GET', path, true);
        request.onload = function() {
          if (this.status >= 200 && this.status < 400) {
            that.el.innerHTML = this.response;
            that._triggerEvent();
          } else {
            that.el.innerHTML = '';
          }
        };

        request.onerror = function() {
          that.el.innerHTML = '';
        };
        request.send();

        return that;
      }

      return that;
    }
  }
};

window.abInterchange = function(options) {
  var elements = document.querySelectorAll('['+ attr +']');
  for (var i = 0, len = elements.length; i < len; i++) {
    if (elements[i][pluginName]) continue;
    elements[i][pluginName] = new Plugin(elements[i], options);
  }
};