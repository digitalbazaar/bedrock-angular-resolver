/*!
 * Resolver module.
 *
 * Copyright (c) 2015-2017 Digital Bazaar, Inc. All rights reserved.
 */
import angular from 'angular';

var module = angular.module('bedrock.resolver', ['ngRoute']);

module.provider('routeResolver', function() {
  var self = this;

  // generated resolve functions that angular router processes
  self.resolve = {};

  // global resolvers
  self._global = {};

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

    self._global[name] = {
      deps: args,
      fn: fn,
      global: true
    };

    return self;
  };

  /**
   * Called internally to add the global `brResolve` resolve function to
   * route options.
   *
   * @param routeOptions the route options.
   */
  this._addGlobals = function(routeOptions) {
    // resolvers for this route
    var resolvers = {
      local: routeOptions.resolve || {},
      global: {}
    };

    // rewrite resolve option to control dependency ordering; add `brResolve`
    // which will ensure global resolvers are first
    routeOptions.resolve = {
      /* @ngInject */
      brResolve: function($injector, $q, $route) {
        // start resolving `brResolve`
        var locals = $route.current.locals || ($route.current.locals = {});
        var resolving = $route.current._brResolving || (
          $route.current._brResolving = {local: {}, global: {}});
        var brResolve = locals.brResolve || (locals.brResolve = {});
        if('brResolve' in resolving.local) {
          return resolving.local.brResolve;
        }
        return resolving.local.brResolve = $q(function(resolve, reject) {
          // resolve all global resolvers
          resolveSet($injector, $q, resolvers.global, resolving.global)
            .then(function() {
              resolve(brResolve);
            }, reject);
        });
      }
    };

    // create each global resolver
    angular.forEach(self._global, function(options, name) {
      routeOptions.resolve[name] = resolvers.global[name] =
        createOrderedResolver(resolvers.global, name, options);
    });

    // create local resolvers and make them all depend on `brResolve`
    angular.forEach(resolvers.local, function(fn, name) {
      routeOptions.resolve[name] = resolvers.local[name] =
        createOrderedResolver(
          resolvers.local, name, {deps: ['brResolve'], fn: fn});
    });

    // finally add `brResolve` as a local resolver that all other locals
    // depend on; this ensures backwards compatibility w/some older global
    // resolvers that read from $route.current.locals directly instead of from
    // $route.current.locals.brResolve ... without this a local resolver
    // with the same name as a global one could cause a conflict, here we
    // delay those so that the values from the global resolvers are set
    // first and then they can be later overwritten once all the global
    // resolvers are done
    resolvers.local.brResolve = routeOptions.resolve.brOptions;
  };

  function createOrderedResolver(resolvers, name, options) {
    var deps = options.deps || [];
    var fn = options.fn;
    var useBrResolve = !!options.global;

    /* @ngInject */
    var resolver = function($injector, $route, $q) {
      // TODO: add circular dependency check
      // start resolving
      var locals = $route.current.locals || ($route.current.locals = {});
      var resolving = $route.current._brResolving || (
        $route.current._brResolving = {local: {}, global: {}});
      var brResolve;
      if(useBrResolve) {
        brResolve = locals.brResolve || (locals.brResolve = {});
        resolving = resolving.global;
      } else {
        resolving = resolving.local;
      }
      if(name in resolving) {
        return resolving[name];
      }
      return resolving[name] = $q(function(resolve, reject) {
        // ensure all prerequisite resolves complete
        resolveSet($injector, $q, resolvers, resolving, deps, name)
          .then(function() {
            $q.when(angular.isString(fn) ?
              $injector.get(fn) :
              $injector.invoke(fn, null, null, name)).then(function(result) {
                if(brResolve) {
                  brResolve[name] = result;
                }
                resolve(locals[name] = result);
              });
          }).catch(reject);
      });
    };
    return resolver;
  }

  function resolveSet($injector, $q, resolvers, resolving, subset, parent) {
    if(!subset) {
      subset = Object.keys(resolvers);
    }
    var deps = subset.map(function(name) {
      if(!(name in resolving)) {
        var fn = resolvers[name];
        if(fn === undefined) {
          if(parent) {
            throw Error('Resolver "' + parent +
              '" has undefined dependency: "' + name + '"');
          }
          throw Error('Undefined resolve dependency: "' + name + '".');
        }
        resolving[name] = angular.isString(fn) ?
          $injector.get(fn) : $injector.invoke(fn, null, null, name);
      }
      return resolving[name];
    });
    return $q.all(deps);
  }
});

/* @ngInject */
module.config(function($routeProvider, routeResolverProvider) {
  // extend $routeProvider to allow adding global custom resolver functions
  var when = $routeProvider.when;
  $routeProvider.when = function(path, route) {
    routeResolverProvider._addGlobals(route);
    return when.apply($routeProvider, arguments);
  };
});
