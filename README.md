# subscription-transport-meteor

A meteor adaptation of the [subscriptions-transport-ws](https://github.com/apollostack/subscriptions-transport-ws) package. this transport utilizes the meteor ddp server connection.

Works exactly like transport-ws, but doesn't need httpServer in the server constructor.

The current user is available in the subscription resolver context.
