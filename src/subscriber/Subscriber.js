var hasOwnProperty = Object.prototype.hasOwnProperty;
var utils = require('../utils/index.js');

function send(subscriber, args) {
    for (var channel in subscriber.channels) {
        subscriber.channels[channel].apply(null, args);
    }
}

function invoke(method, args, callback) {
    if (typeof callback === 'function') {
        args = args.concat(callback);
    }

    this.methods[method].apply(null, args);
}

var Namespace = function(name, subscriber) {
    this.name = name;
    this.subscriber = subscriber;
    this.methods = Object.create(null);
    this.subscribers = [];
};

Namespace.prototype = {
    subscribe: function(fn) {
        this.invoke('init', fn);
        this.subscribers.push(fn);
    },

    hasMethod: function(method) {
        return method in this.methods;
    },
    provide: function(name, fn) {
        if (typeof name === 'string') {
            if (typeof fn === 'function') {
                this.methods[name] = fn;
            }
        } else {
            var methods = name;
            for (name in methods) {
                if (hasOwnProperty.call(methods, name) &&
                    typeof methods[name] === 'function') {
                    this.methods[name] = methods[name];
                }
            }
        }
    },
    invoke: function(method/*, ...args, callback*/) {
        var args = Array.prototype.slice.call(arguments, 1);
        var callback = null;

        if (args.length && typeof args[args.length - 1] === 'function') {
            callback = args.pop();
        }

        send(this.subscriber, [{
            type: 'call',
            ns: this.name,
            method: method,
            args: args
        }, callback]);
    }
};

var Subscriber = function() {
    this.namespaces = Object.create(null);
    this.channels = Object.create(null);
    this.processInput = this.processInput.bind(this);

    var defaultNS = this.ns('*');
    for (var method in defaultNS) {
        if (typeof defaultNS[method] === 'function') {
            this[method] = defaultNS[method].bind(defaultNS);
        }
    }
};

Subscriber.prototype = {
    ns: function getNamespace(name) {
        if (!this.namespaces[name]) {
            this.namespaces[name] = new Namespace(name, this);
        }

        return this.namespaces[name];
    },
    processInput: function(packet, callback) {
        var ns = packet.ns || '*';

        switch (packet.type) {
            case 'call':
                if (!this.ns(ns).hasMethod(packet.method)) {
                    return console.warn('[rempl][sync] Subscriber `' + this.id + '` has no remote command `' + packet.method + '` in namespace `' + ns + '`');
                }

                invoke.call(this.ns(ns), packet.method, packet.args, callback);
                break;

            case 'data':
                this.ns(ns).subscribers.forEach(function(subscriber) {
                    subscriber(packet.payload);
                });
                break;

            default:
                utils.warn('[rempl][sync] Unknown packet type:', packet.type);
        }
    }
};

Subscriber.factory = function createSubscriberFactory(Subscriber) {
    return function createSubscriber(id) {
        return new Subscriber(id);
    };
};

module.exports = Subscriber;
