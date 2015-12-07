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

  // generated resolve functions that angular router processes
  self.resolve = {};

  // return a routeResolver instance (this provider is generally only used
  // as a provider, its instance isn't directly used)
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

    /* @ngInject */
    self.resolve[name] = function($injector, $route, $q) {
      // TODO: add circular dependency check
      // start resolving
      var $$resolving = ($route.current.$$resolving ||
        ($route.current.$$resolving = {}));
      var locals = $route.current.locals || ($route.current.locals = {});
      if(name in $$resolving) {
        return $$resolving[name];
      }
      return $$resolving[name] = $q(function(resolve, reject) {
        // ensure all prerequisite resolves complete
        var deps = args.map(function(key) {
          if(!(key in $$resolving)) {
            var fn = self.resolve[key];
            $$resolving[key] = angular.isString(fn) ?
              $injector.get(fn) : $injector.invoke(fn, null, null, key);
          }
          return $$resolving[key];
        });
        $q.all(deps).then(function() {
          $q.when(angular.isString(fn) ?
            $injector.get(fn) :
            $injector.invoke(fn, null, null, name)).then(function(result) {
            resolve(locals[name] = result);
          });
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
    route.resolve = angular.extend(
      {}, route.resolve, routeResolverProvider.resolve);
    return when.apply($routeProvider, arguments);
  };
});

return module.name;

});
