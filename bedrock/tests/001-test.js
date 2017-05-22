/*
 * Copyright (c) 2015-2017 Digital Bazaar, Inc. All rights reserved.
 */
/* globals angular, expect, should */
var bedrock = global.bedrock;

bedrock.unit('bedrock-angular-resolver', function(bootstrap) {

  var $injector;
  var _$routeProvider;
  var _routeResolverProvider;
  var order = [];

  describe('routeResolverProvider', function() {
    before(function() {
      angular.module('test', ['bedrock.resolver'])
        .config(function($routeProvider, routeResolverProvider) {
          _$routeProvider = $routeProvider;
          _routeResolverProvider = routeResolverProvider;
        });
      $injector = bootstrap();
    });

    beforeEach(function(done) {
      order.splice(0, order.length);
      // must reset current route brResolve cache because the code runs against
      // the `current` route and we don't actually change routes during the test
      // TODO: preferred alternative would be to actually change routes to test
      // resolution ... or mock changing the route or cancel it before it
      // finishes or something similar (probably an angular testing pattern
      // that we can copy)
      var $route = $injector.get('$route');
      delete $route.current._brResolving;
      if('locals' in $route.current) {
        delete $route.current.brResolve;
      }
      done();
    });

    it('should not be undefined', function() {
      should.exist(_routeResolverProvider);
    });

    it('should add a resolve function', function() {
      expect(_routeResolverProvider.add('runSecond', 'runFirst', function() {
        order.push(2);
      })).to.not.throw;
    });

    it('should add another resolve function', function() {
      expect(_routeResolverProvider.add('runFirst', function($q, $timeout) {
        return $q(function(resolve) {
          $timeout(function() {
            order.push(1);
            resolve();
          }, 100);
        });
      })).to.not.throw;
    });

    it('invokes global route resolvers in the proper order', done => {
      // create fake route
      var routeOptions = {};
      _$routeProvider.when('/test-route', routeOptions);

      var resolves = [];
      angular.forEach(routeOptions.resolve, function(fn, name) {
        resolves.push($injector.invoke(fn, null, null, name));
      });
      $injector.get('$q').all(resolves).then(function() {
        order.should.have.members([1, 2]);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('invokes global and local route resolvers in the proper order', done => {
      // create fake route
      var routeOptions = {
        resolve: {
          _test: function() {
            order.push(3);
          }
        }
      };
      _$routeProvider.when('/test-route', routeOptions);

      var resolves = [];
      angular.forEach(routeOptions.resolve, function(fn, name) {
        resolves.push($injector.invoke(fn, null, null, name));
      });
      $injector.get('$q').all(resolves).then(function() {
        order.should.have.members([1, 2, 3]);
        done();
      }).catch(function(err) {
        done(err);
      });
    });
  });

});
