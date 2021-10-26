/* eslint-env browser */

import WsTransport from '../../transport/ws.js';
import { startIdentify, stopIdentify } from './identify.js';
import { global } from '../../utils/index.js';
import { createWsConnectionFactory } from '../factory.js';

const STORAGE_KEY = 'rempl:id';
const sessionStorage = global.sessionStorage || {};
declare let REMPL_SERVER: string | boolean;

function fetchWsSettings() {
    function fetchEnvVariable() {
        if (typeof REMPL_SERVER !== 'undefined' && REMPL_SERVER !== global.REMPL_SERVER) {
            return REMPL_SERVER;
        }
    }

    function fetchMeta() {
        const meta = document.querySelector('meta[name="rempl:server"]');

        return (meta && meta.getAttribute('content')) || undefined;
    }

    const implicitUri = location.protocol + '//' + (location.hostname || 'localhost') + ':8177';
    let explicitUri = undefined;
    let setup = fetchEnvVariable();

    if (setup === undefined) {
        setup = fetchMeta();
    }

    switch (setup) {
        case 'none':
        case undefined:
        case false:
            // no explicit setting
            break;

        case 'implicit':
        case 'auto':
        case true:
            explicitUri = implicitUri;
            break;

        default:
            if (typeof setup === 'string') {
                explicitUri = setup;
            }
    }

    return {
        explicit: explicitUri,
        implicit: implicitUri,
    };
}

export class BrowserWsTransport extends WsTransport {
    static settings = fetchWsSettings();

    constructor(uri: string) {
        super(uri);

        this.id = sessionStorage[STORAGE_KEY];
        this.socket
            .on('rempl:identify', startIdentify)
            .on('rempl:stop identify', stopIdentify)
            .on('disconnect', stopIdentify);
    }

    get type() {
        return 'browser';
    }

    setClientId(id: string) {
        super.setClientId(id);
        sessionStorage[STORAGE_KEY] = this.id;
    }

    getInfo() {
        return {
            ...super.getInfo(),
            location: String(location),
            title: global.top.document.title,
        };
    }
}

export const establishWsConnection = createWsConnectionFactory(
    BrowserWsTransport,
    BrowserWsTransport.settings
);