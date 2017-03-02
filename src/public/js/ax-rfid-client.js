(function (exports) {
    'use strict';

    var AxRfidTagStore;
    if (typeof require === "undefined") {
        AxRfidTagStore = AxRfid.TagStore;
    }
    else {
        require('rx-lite');
        require('rx-dom');
        AxRfidTagStore = require('./ax-rfid-store').TagStore;
    }

    function RfidError(message, cmd) {
        this.name = 'RfidError';
        this.message = message || 'Rfid error';
        if (cmd) {
            this.cmd = cmd;
        }
        this.stack = (new Error()).stack;
    }

    RfidError.prototype = Object.create(Error.prototype);
    RfidError.prototype.constructor = RfidError;

    var CONFIG={host: "localhost", port: 7000, readerProbeInterval: 10000, isDebug: false};

    function Client(overrideConfig) {
        var config = Object.assign({}, CONFIG, overrideConfig);
        var debugSubject = new Rx.Subject();
        var tagStore = new AxRfidTagStore();
        var queue = [];
        var ws;
        var wsSubscription;
        var onError;

        function setErrorHandler(errorHandler) {
            onError=errorHandler;
        }

        function noop() {
        }

        function handleError(e) {
            console.error('error: '+e);
            if (onError) {
                onError(e);
            }
        }

        function disconnect() {
            if (ws) {
                wsSubscription.dispose();
            }
            else {
                handleError(new RfidError("Not connected"));
            }
        }

        function handleMessage(message) {
            if (queue.length > 0) {
                var item = queue.shift();
                var result = item.result;
                if (message.cmd === "error") {
                    result.onError(new RfidError(message.result, message.incmd));
                }
                else {
                    result.onNext(message);
                    result.onCompleted();
                }
            }
            else {
                result.onError(new RfidError("Unexpected message: " + messageAsString, message.cmd));
            }
        }

        function debugMessage(action, message) {
            if (config.isDebug) {
                debugSubject.onNext({"action": action, "message": message});
                console.log('action: '+action+' message: '+JSON.stringify(message));
            }
        }

        function sendMessage(message) {
            var result = new Rx.ReplaySubject(1);
            if (ws) {
                var messageAsString = JSON.stringify(message);
                debugMessage("request", message);
                ws.onNext(messageAsString);
                queue.push({"result": result, "message": message});
                return result;
            }
            else {
                result.onError(new RfidError("Not connected", message.cmd));
            }
        }

        function sendMessageWithCallback(message, callback) {
            var result = sendMessage(message);
            var subscription = result.subscribe(
                function (result) {
                    callback(result);
                },
                function (e) {
                    handleError(e);
                },
                function () {
                    subscription.dispose();
                }
            );
        }

        function setClientName(name) {
            sendMessageWithCallback({"cmd": "remoteName", "name": name}, noop);
        }

        function readerStatus() {
            var isError=false;
            queue.forEach(function(item) {
               var message=item.message;
               var cmd=message.cmd;
               if (cmd==="readerStatus") {
                  isError=true;
                  var result=item.result;
                  result.onError(new RfidError("WebSocket timeout", message.cmd));
               }
            });
            if (isError) {
                disconnect();
            }
            else {
                sendMessageWithCallback({"cmd": "readerStatus"}, noop);
            }
        }

        function probeReaderStatus() {
            var readerProbe = Rx.Observable.interval(config.readerProbeInterval).skip(1);
            return readerProbe.subscribe(
                function (result) {
                    readerStatus();
                }
            );
        }

        function reload() {
            sendMessageWithCallback({"cmd": "resend"}, noop);
        }

        function setCheckoutState(id, isCheckoutState) {
            var security = isCheckoutState ? "Deactivated" : "Activated";
            return sendMessage({"cmd": "setCheckoutState", "id": id, "security": security})
        }


        function connect(name) {
            if (ws) {
                handleError(new RfidError("Already connected"));
            }
            else {
                var probeReaderSubscription;
                var openObserver = Rx.Observer.create(function (e) {
                    console.log('Connected');
                    tagStore.setConnected(true);
                    queue = [];
                }.bind(this));

                var closingObserver = Rx.Observer.create(function () {
                    console.log('Disconnected');
                    tagStore.setConnected(false);
                    ws = null;
                    if (probeReaderSubscription) {
                       probeReaderSubscription.dispose();
                    }
                }.bind(this));

                ws = Rx.DOM.fromWebSocket("ws://" + config.host + ":" + config.port, null, openObserver, closingObserver);
                setClientName(name);
                probeReaderSubscription=probeReaderStatus();
                wsSubscription = ws.subscribe(
                    function (e) {
                        var messageAsString = e.data;
                        var message = JSON.parse(messageAsString);
                        debugMessage("response", message);
                        switch (message.cmd) {
                            case "tag":
                                var reason = message.reason;
                                var id = message.id;
                                var reader = message.reader;
                                switch (reason) {
                                    case 'Reader empty':
                                        tagStore.removeAllTags();
                                        break;
                                    case 'Removed':
                                        tagStore.removeTag(id);
                                        break;
                                    case 'Partial':
                                    case 'Firsttime new partial':
                                        tagStore.addOrReplaceTag(id, reader, false);
                                        break;
                                    default:
                                        tagStore.addOrReplaceTag(id, reader, true);
                                }
                                break;
                            case "disabled":
                                tagStore.setEnabled(false);
                                break;
                            case "enable":
                                tagStore.setEnabled(true);
                                handleMessage(message);
                                break;
                            case "readerStatus":
                                if (message.status==="online") {
                                    tagStore.setReady(true);
                                }
                                else {
                                    tagStore.setReady(false);
                                    tagStore.setEnabled(false);
                                }
                                handleMessage(message);
                                break;
                            case "resend":
                            case "Resend":
                                tagStore.setEnabled(true);
                                handleMessage(message);
                                break;
                            case "setCheckoutState":
                                tagStore.setCheckoutState(message.id, message.security === "Deactivated");
                                handleMessage(message);
                                break;
                            default:
                                handleMessage(message);
                        }
                    }.bind(this),
                    function (e) {
                        handleError(e);
                    }.bind(this),
                    noop
                );
            }
        }

        return {
            setErrorHandler: function (errorHandler) {
              setErrorHandler(errorHandler);
            },
            connect: function (name) {
                connect(name)
            },
            disconnect: function () {
                disconnect()
            },
            reload: function () {
                reload()
            },
            setCheckoutState: function (id, isCheckoutState) {
                return setCheckoutState(id, isCheckoutState);
            },

            getDebugSubject: function () {
                return debugSubject;
            },

            getTagStore: function () {
                return tagStore;
            },

            sendMessage: function (message) {
                return sendMessage(message);
            }
        }
    }

    exports.Client = Client;

}((window.AxRfid = window.AxRfid || {})));

if (typeof module !== "undefined") {
    module.exports = AxRfid.Client;
}