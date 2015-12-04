/*!
 * Resolver module.
 *
 * Copyright (c) 2015 Digital Bazaar, Inc. All rights reserved.
 */
define(['angular'], function(angular) {

'use strict';

var module = angular.module('bedrock.resolver', []);

module.provider('routeResolver', function() {
  var self = this;
  self.resolve = {};
  this.$get = function() {
    return self.resolve;
  };

  /**
   * Adds a new resolve function. The function may optionally depend on
   * other resolve functions, in which case, its prerequisite resolve functions
   * will execute prior to the given resolve function. If any prerequisite
   * function returns a Promise, it will resolve prior to execution as well.
   *
   * @param name the name of the resolve function.
   * @param [deps...] optional prerequisite resolve function(s).
   * @param fn the resolve function, string, or angular-style dependency
   *          injection array.
   */
  this.add = function() {
    var args = Array.prototype.slice.apply(arguments);

    // get resolve name and function
    var name = args.shift();
    var fn = args.pop();

    if(typeof name !== 'string') {
      throw new TypeError('resolve name must be a string.');
    }
    // resolve can be a function, string, or of the
    // form: ['inject1', ..., fn]
    if(angular.isArray(fn)) {
      if(typeof (fn[fn.length] - 1) !== 'function') {
        throw new TypeError('resolve function not specified.');
      }
    } else if(typeof fn !== 'function' &&
      typeof fn !== 'string') {
      throw new TypeError('resolve must be a function or string.');
    }

    // TODO: add circular dependency check

    /* @ngInject */
    self.resolve[name] = function($injector, $route, $q) {
      return $q(function(resolve, reject) {
        // ensure all prerequisite resolves complete
        var deps = args.map(function(key) {
          return $route.current.locals[key];
        });
        $q.all(deps).then(function() {
          resolve(angular.isString(fn) ?
            $injector.get(fn) :
            $injector.invoke(fn, null, null, name));
        }, reject);
      });
    };
  };
});

/* @ngInject */
module.config(function($routeProvider, routeResolverProvider) {
  // extend $routeProvider to allow adding global custom resolver functions
  var when = $routeProvider.when;
  $routeProvider.when = function(path, route) {
    route.resolve = route.resolve || (route.resolve = {});
    route.resolve =
      angular.extend({}, route.resolve, routeResolverProvider.resolve);
    return when.apply($routeProvider, arguments);
  };
});

return module.name;

});
