import { Meteor } from 'meteor/meteor';

const SUBSCRIPTION_NAME = '__graphql_subscription__';
const SUBSCRIPTION_METHOD_NAME = '__graphql_subscribe__';
const UNSUBSCRIPTION_METHOD_NAME = '__graphql_unsubscribe__';

export class SubscriptionServer {

  /**
   * @param {SubscriptionManager} subscriptionManager
   * @param {Function} [onSubscribe]
   */
  constructor({ subscriptionManager, onSubscribe }) {
    if (!subscriptionManager) {
      throw new Error('Must provide `subscriptionManager` to meteor subscription server constructor.');
    }


    this.subscriptionManager = subscriptionManager;
    this.onSubscribe = onSubscribe;

    const connections = this.connections = [];
    const self = this;

    Meteor.publish(SUBSCRIPTION_NAME, function () {
      const subscription = this;
      const connectionId = subscription.connection.id;
      connections[connectionId] = { subscription, subscriptionIds : {} };

      subscription.onStop(() => {
        Object.keys(connections[connectionId].subscriptionIds).forEach(subscriptionId => {
          self.unsubscribe({subscriptionId, connectionId});
        });

        delete connections[connectionId];
      });

      subscription.ready();
    });

    Meteor.methods({
      [SUBSCRIPTION_METHOD_NAME]({query, variables, operationName, context, id}) {
        self.subscribe(
          {
            query,
            variables,
            operationName,
            context
          }, {
            subscriptionId: id,
            connectionId: this.connection.id,
            userId: this.userId
          }
        );
      },

      [UNSUBSCRIPTION_METHOD_NAME]({id}) {
        self.unsubscribe({
            subscriptionId: id,
            connectionId: this.connection.id
        });
      }
    });
  }

  /**
   * @param {String} query
   * @param {Object} [variables]
   * @param {String} operationName
   * @param {Object} [context]
   * @param {Number} subscriptionId
   * @param {String} connectionId
   * @param {String} [userId]
   */
  async subscribe({ query, variables, operationName, context = {}}, {subscriptionId, connectionId, userId}) {
    let params = { query, variables, operationName, context };

    if (userId) {
      context.userId = userId;
      context.user = await Meteor.users.findOne({ _id: userId });
    }

    if (this.onSubscribe) {
      params = this.onSubscribe(Object.assign({}, params, { subscriptionId, connectionId }), params, this);
    }

    if (this.connections[connectionId].subscriptionIds[subscriptionId]) {
      this.subscriptionManager.unsubscribe(this.connections[connectionId].subscriptionIds[subscriptionId]);
      delete this.connections[connectionId].subscriptionIds[subscriptionId];
    }

    const subscription = this.connections[connectionId].subscription;

    params.callback = (error, result) => {
      if (!error) {
        this.sendData({subscription, subscriptionId, data: result.data});
      } else if (error.errors) {
        this.sendData({subscription, subscriptionId, errors: error.errors });
      } else {
        this.sendData({subscription, subscriptionId, errors: [{message: error.message }]});
      }
    };

    const graphqlSubId = await this.subscriptionManager.subscribe(params);
    this.connections[connectionId].subscriptionIds[subscriptionId] = graphqlSubId;
  }

  /**
   * @param {Number} subscriptionId
   * @param {String} connectionId
   */
  unsubscribe({ subscriptionId, connectionId }) {

    if (typeof this.connections[connectionId].subscriptionIds[subscriptionId] !== 'undefined') {
      this.subscriptionManager.unsubscribe(this.connections[connectionId].subscriptionIds[subscriptionId]);
      delete this.connections[connectionId].subscriptionIds[subscriptionId];
    }
  }

  /**
   * @param {Object} subscription
   * @param {Number} subscriptionId
   * @param {Object} [data]
   * @param {Array} [errors]
   * @private
   */
  sendData({subscription, subscriptionId, data = null, errors = null}) {
    subscription._session.sendChanged(SUBSCRIPTION_NAME, subscriptionId.toString(), { data, errors });
  }
}
