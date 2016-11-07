import { Meteor } from 'meteor/meteor';
import { DDPCommon } from 'meteor/ddp-common';

const SUBSCRIPTION_NAME = '__graphql_subscription__';
const SUBSCRIPTION_METHOD_NAME = '__graphql_subscribe__';
const UNSUBSCRIPTION_METHOD_NAME = '__graphql_unsubscribe__';

export class Client {

  constructor() {

      this.connected = false;
      this.maxId = 0;
      this.subscriptions = {};

      Meteor.connection._stream.on('message', rawMessage => {
        const message = DDPCommon.parseDDP(rawMessage);

        if (this.connected && message.msg === 'connected') {
          this.reconnect();
        }

        if (message.msg === 'changed' && message.collection === SUBSCRIPTION_NAME) {
          const id = parseInt(message.id);
          const payload = message.fields;


          if (this.subscriptions[id]) {
            if (payload.errors) {
              this.subscriptions[id].handler(payload.errors, null);
            } else {
              this.subscriptions[id].handler(null, payload.data);
            }
          }
        }
      });
  }

  /**
   * @private
   */
  connect() {
    if (!this.connected) {
      return new Promise((resolve) => {
        Meteor.subscribe(SUBSCRIPTION_NAME, () => {
          this.connected = true;
          resolve();
        });
      });
    }

    return Promise.resolve();
  }

  /**
   * @private
   */
  reconnect() {
    Object.keys(this.subscriptions).forEach(subId => {
      const { query, variables, operationName, context, handler } = this.subscriptions[subId];
      this.subscribe({ query, variables, operationName, context, subscriptionId: subId }, handler);
    });
  }

  /**
   * @param {String} query
   * @param {Object} [variables]
   * @param {String} operationName
   * @param {Object} [context]
   * @param {Number} [subscriptionId]
   * @param {Function} handler
   * @returns {Number}
   */
  async subscribe({query, variables = {}, operationName, context, subscriptionId = null }, handler) {
    await this.connect();

    if (!query) {
      throw new Error('Must provice `query` to subscribe.');
    }

    if (!handler) {
      throw new Error('Must provide `handler` to subscribe.');
    }

    const subId = subscriptionId || this.generateSubscriptionId();
    const message = Object.assign({
      query,
      variables,
      operationName,
      context
    }, { id: subId });

    this.subscriptions[subId] = { query, variables, operationName, context, handler };

    Meteor.call(SUBSCRIPTION_METHOD_NAME, message, (error) => {
      if (error) {
        handler([new Error(`Subscription failed: ${error.message}`)]);
        this.unsubscribe(subId);
      }
    });

    return subId;
  }

  /**
   * @returns {Number}
   * @private
   */
  generateSubscriptionId() {
    const id = this.maxId;
    this.maxId += 1;
    return id;
  }

  /**
   * @param {Number} id
   */
  async unsubscribe(id) {
    await this.connect();

    delete this.subscriptions[id];
    Meteor.call(UNSUBSCRIPTION_METHOD_NAME, { id });
  }

  /**
   *
   */
  unsubsribeAll() {
    Object.keys(this.subscriptions).forEach(subId => this.unsubscribe(parseInt(subId)));
  }
}
