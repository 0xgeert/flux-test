"use strict";

/**
 *
 * GeneralStore
 * Subclass needs to implement:
 * - callbackFN
 * - CHANGE_EVENT
 *
 * Sets
 */

var _ = require("lodash");

var AppDispatcher = require('../dispatcher/AppDispatcher');

var EventEmitter = require('events').EventEmitter;

var merge = require('react/lib/merge');

var Promise = require('es6-promise').Promise;

var flux = require("../flux");


var AbstractStore = merge(EventEmitter.prototype, {
  init: function() {

    if (this.name === undefined) {
      throw new Error("Store should have 'name'  defined");
    }

    if (this.callbackFN === undefined && this.actions === undefined) {
      throw new Error("Store should have 'callbackFN' or 'actions'  defined");
    }

    if (this.callbackFN !== undefined && this.actions !== undefined) {
      throw new Error("Store cannot have both 'callbackFN' and 'actions'  defined");
    }

    if (this.actions !== undefined && this.constants === undefined) {
      throw new Error("Store should have 'constants' defined if 'actions' defined");
    }

    if (this.CHANGE_EVENT === undefined) {
      throw new Error("Store should have 'CHANGE_EVENT'  defined");
    }

    //create 'callbackFN' from this.actions which is defined declaratively
    if (this.actions !== undefined) {

      var map = createMapFromActionDeclaration(this);

      this.callbackFN = function(payload) {
        var action = payload.action;
        if (map[action.actionType] !== undefined) {
          map[action.actionType].fn.call(this, action);
        }
      };
    }

    this.waitFor = AppDispatcher.waitFor;
    this.dispatchIndex = AppDispatcher.register(this.callbackFN);
  },

  // dispatchIndex set by index
  //dispatchIndex: FN

  /**
   * @param {function} callback
   */
  addChangeListener: function(callback) {
    this.on(this.CHANGE_EVENT, callback);
  },

  /**
   * @param {function} callback
   */
  removeChangeListener: function(callback) {
    this.removeListener(this.CHANGE_EVENT, callback);
  },

  emitChange: function() {
    this.emit(this.CHANGE_EVENT);
  },


});

function createMapFromActionDeclaration(store) {

  var that = store;

  //create map of actions to handlers. 
  //throw if action and/or handler is not found
  var map = {};
  _.each(store.actions, function(obj, k) {
    var lookupKey = that.constants[k];
    if (lookupKey === undefined) {
      throw new Error("action not found in store: " + k);
    }
    var fn;
    if (_.isString(obj)) {
      fn = that[obj];
      if (!_.isFunction(fn)) {
        throw new Error("actionHandler by reference not found in store with ref: " + obj);
      }
      obj = {
        fn: fn
      };
    } else if (_.isFunction(obj)) {
      obj = {
        fn: obj
      };
    }

    //Should be format: {
    //  fn: fn
    //}
    //
    if (!_.isObject(obj)) {
      throw new Error("config error for actionHandler in store: " + k)
    }

    //format: {
    //  fn: string
    //}
    //
    //transform to => 
    //{
    //  fn: function
    //}
    if (_.isString(obj.fn)) {
      fn = that[obj.fn];
      if (!_.isFunction(fn)) {
        throw new Error("actionHandler by reference not found in store with ref: " + obj.fn);
      }
      obj.fn = fn;
    }

    // wrap FN in promise
    obj.fn = _.wrap(obj.fn, function(fn, action){
      console.log("jaja");
      return new Promise(function(resolve, reject) {
        var result = fn(action, resolve, reject);

        //sync method return directly. 
        //if return assume success
        //otherwise throw
        if(!obj.async){
          resolve(result);
        }else{ //async
          //TODO: if optimistic -> send some optimistic update event
        }
      });
    });

    //if declaratively defined to waitFor stores, config that here
    if(obj.waitFor){
      //
      if(!_.isArray(obj.waitFor)){
        obj.waitFor = [obj.waitFor];

      }

      //lookup 'store' by reference and store said 'store' instead 
      obj.waitFor = _.map(obj.waitFor, function(storeRef){
        var storeToRef = flux.stores[storeRef.toLowerCase()];
        if(storeToRef === undefined){
          throw new Error("store defined to 'waitFor' is undefined (store to wait for, store) : "  + storeRef.toLowerCase() + " , "  + store.name);
        }
        return storeToRef;
      });

      //TODO: error callback
      obj.fn = _.wrap(obj.fn, function(fn){
        console.log("asdsad");
        return AppDispatcher.waitFor(obj.waitFor, fn);
      });
    }




    // if(!obj.async){

    //   // var jsonPromise = new Promise(function(resolve, reject) {
    //   //   throw new Error("he moeder");
    //   // });
    //   // console.log("after");
    //   // jsonPromise.then(function(data) {
    //   //   // This never happens:
    //   //   console.log("It worked!", data);
    //   // }).catch(function(err) {
    //   //   // Instead, this happens:
    //   //   console.log("It failed!", err);
    //   // });



    // }else{
    //   throw new Error("async not implemented yet: #11");
    // }

    map[lookupKey] = obj;
  });
  return map;
}

module.exports = AbstractStore;