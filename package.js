Package.describe({
  name: 'subscription-transport-meteor',
  version: '0.0.1',
  summary: 'A meteor transport for GraphQL subscriptions'
});

Package.onUse(function(api) {
  api.versionsFrom('1.4.2');
  api.use(['ecmascript']);
  api.use('ddp-common', 'client');
  api.mainModule('client.js', 'client');
  api.mainModule('server.js', 'server');
});
