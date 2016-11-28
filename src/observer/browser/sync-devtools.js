var DEBUG = false;
var PREFIX = 'basisjsDevpanel';
var document = global.document;
var connected = new Value(false);
var features = new Value([]);
var inputChannelId = PREFIX + ':' + basis.genUID();
var outputChannelId;
var initCallbacks = [];
var callbacks = {};
var subscribers = [];
var inited = false;
var send;

var subscribe = function(fn) {
    subscribers.push(fn);
};
var send = function() {
    if (!inited) {
        basis.dev.warn('[rempl][sync-devtools] Cross-process messaging is not inited');
    }
};

function init(callback) {
    if (inited) {
        callback({
            setFeatures: features.set.bind(features),
            connected: connected,
            subscribe: subscribe,
            send: send
        });
    } else {
        initCallbacks.push(callback);
    }
}

function emitEvent(channelId, data) {
    if (DEBUG) {
        console.log('[rempl][sync-devtools] emit event', channelId, data);
    }

    // IE does not support CustomEvent constructor
    if (typeof document.createEvent === 'function') {
        var event = document.createEvent('CustomEvent');
        event.initCustomEvent(channelId, false, false, data);
        document.dispatchEvent(event);
    } else {
        document.dispatchEvent(new CustomEvent(channelId, {
            detail: data
        }));
    }
}

function wrapCallback(callback) {
    return function() {
        emitEvent(outputChannelId, {
            event: 'callback',
            callback: callback,
            data: basis.array(arguments)
        });
    };
}

function handshake() {
    emitEvent('basisjs-devpanel:init', {
        input: inputChannelId,
        output: outputChannelId,
        features: features.value
    });
}

if (document.createEvent) {
    document.addEventListener('basisjs-devpanel:connect', function(e) {
        if (outputChannelId) {
            return;
        }

        var data = e.detail;
        outputChannelId = data.input;

        if (!data.output) {
            handshake();
        }

        send = function() {
            // console.log('[devpanel] send to devtools', arguments);
            var args = basis.array(arguments);
            var callback = false;

            if (args.length && typeof args[args.length - 1] === 'function') {
                // TODO: deprecate (srop) callback after some time to avoid memory leaks
                callback = basis.genUID();
                callbacks[callback] = args.pop();
            }

            emitEvent(outputChannelId, {
                event: 'data',
                callback: callback,
                data: args
            });
        };

        // send features to devtools
        features.attach(function(features) {
            emitEvent(outputChannelId, {
                event: 'features',
                data: [features]
            });
        });

        // invoke onInit callbacks
        inited = true;
        initCallbacks.splice(0).forEach(init);
    });

    // devtools -> devpanel
    document.addEventListener(inputChannelId, function(e) {
        var data = e.detail;

        if (DEBUG) {
            console.log('[rempl][sync-devtools] recieve from devtools', data.event, data);
        }

        switch (data.event) {
            case 'connect':
                connected.set(true);
                break;

            case 'disconnect':
                connected.set(false);
                break;

            case 'callback':
                if (callbacks.hasOwnProperty(data.callback)) {
                    callbacks[data.callback].apply(null, data.data);
                    delete callbacks[data.callback];
                }
                break;


            case 'data':
                var args = basis.array(data.data);
                var callback = data.callback;

                if (callback) {
                    args = args.concat(wrapCallback(callback));
                }

                subscribers.forEach(function(item) {
                    item.apply(null, args);
                });
                break;

            case 'getInspectorUI': // legacy of basis.js plugin // TODO: remove
            case 'getRemoteUI':
                getRemoteUI(
                    basis.array(data.data)[0] || false,
                    data.callback ? wrapCallback(data.callback) : Function
                );
                break;

            default:
                basis.dev.warn('[rempl][sync-devtools] Unknown message type `' + data.event + '`', data);
        }
    });

    handshake();
} else {
    send = function() {
        basis.dev.warn('[rempl][sync-devtools] Cross-process messaging is not supported');
    };
}

module.exports = {
    onInit: init,
    connected: connected,
    subscribe: subscribe,
    send: send
};
