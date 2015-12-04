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
