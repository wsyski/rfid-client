'use strict';

require('../style/app.css');
var AxRfid = require('./ax-rfid');

function $(id) {
    return document.getElementById(id);
}
function removeChildNodes(id) {
    var node = $(id);
    while (node.firstChild) {
        node.removeChild(node.firstChild);
    }
}

function getObjectHtml(object) {
    var divNode = document.createElement("DIV");
    var textNode = document.createTextNode(JSON.stringify(object));
    divNode.appendChild(textNode);
    return divNode;
}

function showDebugMessage(message) {
    var debugNode = $("debug");
    var liNode = document.createElement("LI");
    if (debugNode.firstElementChild) {
        debugNode.insertBefore(liNode, debugNode.firstElementChild);
    }
    else {
        debugNode.appendChild(liNode);
    }
    liNode.appendChild(getObjectHtml(message));
}

window.addEventListener("load", function (event) {
    //var host = window.document.location.host.replace(/:.*/, '');
    var host = 'lulpreserv3';
    var port = 7000;
    var btnCommand = $("btnCommand");
    var btnConnect = $("btnConnect");
    var btnDisconnect = $("btnDisconnect");
    var btnClear = $("btnClear");
    var btnReload = $("btnReload");
    var btnCheckout = $("btnCheckout");
    var btnCheckin = $("btnCheckin");
    var inputMessage = $("inputMessage");
    var tagStoreData;
    var debugSubscription;
    var tagStoreSubscription;
    var axRfidClient = new AxRfid.Client({host: host, port: port, isDebug: true});
    debugSubscription = axRfidClient.getDebugSubject().subscribe(
        function (message) {
            showDebugMessage(message);
        },
        function (e) {
            console.error(e);
        },
        function () {
            debugSubscription.dispose();
        }
    );
    tagStoreSubscription = axRfidClient.getTagStore().subscribe(function (data) {
        tagStoreData = data;
        showTagStoreData();
        updateToolbar();
    });

    function onError(e) {
        console.error(e);
        if (e.name === "RfidError") {
            alert('Rfid error cmd:' + e.cmd + ' message: ' + e.message);
        }
        else {
            alert(e.message);
        }
    }

    function showTagStoreData() {
        removeChildNodes("tagStoreData");
        var divNode = $("tagStoreData");
        divNode.appendChild(getObjectHtml(tagStoreData));
    }

    function setCheckoutState(isActivated) {
        var tags = tagStoreData.tags;
        tags.forEach(function (tag, index) {
            if (tag.isComplete) {
                var result = axRfidClient.setCheckoutState(tag.id, isActivated);
                var subscription = result.subscribe(
                    function (message) {
                    },
                    function (e) {
                        subscription.dispose();
                        onError(e);
                    },
                    function () {
                        subscription.dispose();
                    }
                );
            }
        });
    }

    function updateToolbar() {
        var isConnected = tagStoreData.isConnected;
        btnCommand.disabled = !isConnected;
        btnConnect.disabled = isConnected;
        btnDisconnect.disabled = !isConnected;
        btnReload.disabled = !isConnected;
        btnCheckout.disabled = !isConnected;
        btnCheckin.disabled = !isConnected;
    }

    btnCommand.addEventListener("click", function (event) {
        var messageAsString = inputMessage.value;
        var result = axRfidClient.sendMessage(JSON.parse(messageAsString));
        var subscription = result.subscribe(
            function (message) {
            },
            function (e) {
                subscription.dispose();
                onError(e);
            },
            function () {
                subscription.dispose();
            }
        );

    });
    btnConnect.addEventListener("click", function (event) {
        axRfidClient.connect("workplace");
    });

    btnDisconnect.addEventListener("click", function (event) {
        tagStoreSubscription.unsubscribe();
        axRfidClient.disconnect();
    });
    btnClear.addEventListener("click", function (event) {
        removeChildNodes("debug");
    });
    btnReload.addEventListener("click", function (event) {
        axRfidClient.reload();
    });
    btnCheckout.addEventListener("click", function (event) {
        setCheckoutState(false);
    });
    btnCheckin.addEventListener("click", function (event) {
        setCheckoutState(true);
    });
});

