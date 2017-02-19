
(function (exports) {
    'use strict';

    var assign = require('object-assign');
    var createRxStore = require('rx-store').createRxStore;

    var initialState = {isConnected: false, isReady: false, isEnabled: false, tags: []};

    function Tag(id, reader, isComplete) {
        this.id = id;
        this.reader = reader;
        this.isComplete = isComplete;
    }

    function tagStoreReducer(state, action) {

        function removeTag(tags, id) {
            return tags.filter(function (tag) {
                return tag.id !== id;
            })
        }

        var payload = action.payload;

        switch (action.type) {
            case 'SET_CONNECTED':
                return assign({}, initialState, {isConnected: payload.isConnected, isReady: payload.isConnected});
            case 'ADD_OR_REPLACE_TAG':
                return assign({}, state, {tags: removeTag(state.tags, payload.id).concat(new Tag(payload.id, payload.reader, payload.isComplete))});
            case 'REMOVE_TAG':
                return assign({}, state, {tags: removeTag(state.tags, payload.id)});
            case 'REMOVE_ALL_TAGS':
                return assign({}, state, {tags: []});
            case 'SET_ENABLED':
                return assign({}, state, {isEnabled: payload.isEnabled});
            case 'SET_READY':
                return assign({}, state, {isReady: payload.isReady});
            case 'SET_CHECKOUT_STATE':
                return assign({}, state, {
                    tags: state.tags.map(function (tag) {
                        var newTag=new Tag(tag.id, tag.reader, tag.isComplete);
                        if (tag.id === payload.id) {
                            newTag.isCheckoutState=payload.isCheckoutState;
                        }
                        else {
                            newTag.isCheckoutState=tag.isCheckoutState;
                        }
                        return newTag;
                    })
                });
            default:
                return state;
        }
    }

    function TagStore() {

        function addOrReplaceTag(id, reader, isComplete) {
            return {
                type: 'ADD_OR_REPLACE_TAG',
                payload: {id: id, reader: reader, isComplete: isComplete}
            };
        }

        function removeTag(id) {
            return {
                type: 'REMOVE_TAG',
                payload: {id: id}
            };
        }

        function removeAllTags() {
            return {
                type: 'REMOVE_ALL_TAGS'
            };
        }

        function setEnabled(isEnabled) {
            return {
                type: 'SET_ENABLED',
                payload: {isEnabled: isEnabled}
            };
        }

        function setReady(isReady) {
            return {
                type: 'SET_READY',
                payload: {isReady: isReady}
            };
        }

        function setCheckoutState(id, isCheckoutState) {
            return {
                type: 'SET_CHECKOUT_STATE',
                payload: {id: id, isCheckoutState: isCheckoutState}
            };
        }

        function setConnected(isConnected) {
            return {
                type: 'SET_CONNECTED',
                payload: {isConnected: isConnected}
            };
        }

        var store = createRxStore(tagStoreReducer, initialState);

        return {
            addOrReplaceTag: function (id, reader, isComplete) {
                var action = addOrReplaceTag(id, reader, isComplete);
                store.dispatch(action);
            },
            removeTag: function (id) {
                var action = removeTag(id);
                store.dispatch(action);
            },
            removeAllTags: function () {
                var action = removeAllTags();
                store.dispatch(action);
            },
            setEnabled: function (isEnabled) {
                var action = setEnabled(isEnabled);
                store.dispatch(action);
            },
            setReady: function (isReady) {
                var action = setReady(isReady);
                store.dispatch(action);
            },
            setCheckoutState: function (id, isCheckoutState) {
                var action = setCheckoutState(id, isCheckoutState);
                store.dispatch(action);
            },
            setConnected: function (isConnected) {
                var action = setConnected(isConnected);
                store.dispatch(action);
            },
            subscribe: function (callback) {
                return store.subscribe(callback);
            }
        }
    }

    exports.TagStore = TagStore;

}((window.AxRfid = window.AxRfid || {})));


module.exports = AxRfid.TagStore;