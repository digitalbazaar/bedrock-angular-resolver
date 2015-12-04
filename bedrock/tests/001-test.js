var bedrock = GLOBAL.bedrock;

bedrock.unit('bedrock-angular-resolver', function(bootstrap) {

var $injector;
var provider;
var order = [];

describe('routeResolverProvider', function() {
  beforeEach(function() {
    angular.module('test', ['bedrock.resolver'])
      .config(function(routeResolverProvider) {
        provider = routeResolverProvider;
      });
    $injector = bootstrap();
  });

  it('should not be undefined', function() {
    should.exist(provider);
  });

  it('should add a resolve function', function() {
    expect(provider.add('runSecond', 'runFirst', function() {
      order.push(2);
    })).to.not.throw;
  });

  it('should add another resolve function', function() {
    expect(provider.add('runFirst', function($q, $timeout) {
      return $q(function(resolve) {
        $timeout(function() {
          order.push(1);
          resolve();
        }, 100);
      });
    })).to.not.throw;
  });

  it('should invoke route resolve functions in the proper order', function(done) {
    var resolves = [];
    angular.forEach(provider.resolve, function(value, key) {
      resolves.push($injector.invoke(value, null, null, key));
    });
    $injector.get('$q').all(resolves).then(function() {
      order.should.have.members([1, 2]);
      done();
    });
  });
});

});
