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

var utils = require("../utils");

var AppDispatcher = require('../dispatcher/AppDispatcher');

var EventEmitter = require('events').EventEmitter;

var merge = require('react/lib/merge');

var Promise = require('es6-promise').Promise;

var flux = require("../flux");


var AbstractStore = merge(EventEmitter.prototype, {

  //default success callback for stores implementing declarative 'actions'
  successCb: function(){
    this.emitChange();
  },

  //default optimistic callback for stores implementing declarative 'actions'
  optimisticCb: function(){
    console.log("optimistic change send");
    this.emitChange();
  },

  //default failure callback for stores implementing declarative 'actions'
  failCb: function(err){
    console.log(err);
    throw new err;
  },

  init: function() {

    if (this.name === undefined) {
      throw new Error("Store should have 'name'  defined");
    }

    if (this.callbackFN === undefined && this.actions === undefined) {
      throw new Error("Store should have 'callbackFN' or 'actions'  defined: " + this.name);
    }

    if (this.callbackFN !== undefined && this.actions !== undefined) {
      throw new Error("Store cannot have both 'callbackFN' and 'actions'  defined: " + this.name);
    }

    if(this.actions !== undefined ){

      if (this.constants === undefined) {
        throw new Error("Store should have 'constants' defined if 'actions' defined: " + this.name);
      }

      if (this.successCb === undefined) {
        throw new Error("Store should have 'successCb' defined if 'actions' defined: " + this.name);
      }

      if (this.failCb === undefined) {
        throw new Error("Store should have 'failCb' defined if 'actions' defined: " + this.name);
      }

      if (this.optimisticCb === undefined) {
        throw new Error("Store should have 'optimisticCb' defined if 'actions' defined: " + this.name);
      }
    }
    
    if (this.CHANGE_EVENT === undefined) {
      throw new Error("Store should have 'CHANGE_EVENT'  defined: " + this.name);
    }

    //create 'callbackFN' from this.actions which is defined declaratively
    var dag = [];
    if (this.actions !== undefined) {

      var map = createMapFromActionDeclaration(this);

      //return an array of stores this store depends on. 
      //This is used to calculate cycles in waitFor. 
      dag = _.reduce(map, function(dag, obj){
        return _.union(dag, _.pluck((obj.waitFor || []), "name"));
      }, []);

      if(dag.indexOf(this.name) > -1){
        throw new Error("Store cannot depend on itself in `waitfor`: " + this.name);
      }

      this.callbackFN = function(payload) {
        var action = payload.action;
        if (map[action.actionType] !== undefined) {
          return map[action.actionType].fn.call(this, action);
        }
      };
    }

    this.waitFor = AppDispatcher.waitFor;
    this.dispatchIndex = AppDispatcher.register(this.callbackFN);

    return dag; 
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
    var fn,
      ref;
    if (_.isString(obj)) {
      ref = obj;
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
      ref = obj.fn;
      fn = that[obj.fn];
      if (!_.isFunction(fn)) {
        throw new Error("actionHandler by reference not found in store with ref: " + obj.fn);
      }
      obj.fn = fn;
    }


    // wrap FN in promise. 
    // This unifies sync and async handlers. 
    // sync handlers are succesfull when they return. In that case resolve() is called. 
    // A sync handler needs to fail by throwing.
    // 
    // TODO: get a clear architecture picture in which case a handler needs to fail/ reject vs when an unwanted but not unexpected outcome occurs
    // (in which case you perhaps want to resolve?)
    obj.fn = _.wrap(obj.fn, function(fn, action){
      return new Promise(function(resolve, reject) {

        //wrap function with a promise
        //This allows async (method that return promise) and sync (methods that return something else)
        //to be treated the same.
        //
        //Throws etc are correctly handled by doing a reject
        Promise.resolve(fn(action)).then(resolve)["catch"](reject);

        //sync method returns directly. 
        //error is communicated by throwing (which in turn is caught by errorCb)
        if(obj.async && obj.optimistic){ //async and optimistic
          that.optimisticCb();
        }
      });
    });

    /////////////////////////////////////////////////////////////////
    //if declaratively defined to waitFor stores, config that here //
    /////////////////////////////////////////////////////////////////
    if(obj.waitFor){

      //make sure `waitFor`is array
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

      // wrap obj.fn  -that returns promise when called - 
      // with WaitFor functionality. 
      // The result, again, is a Promise.
      obj.fn = _.wrap(obj.fn, function(fn){
        return AppDispatcher.waitFor(obj.waitFor, fn);
      });
    }

    //wrap obj.fn  -that returns promise when called - with 
    //success and failure callbacks. 
    //These *need* to be defined by every store implementing 'actions'. 
    //The AbstractStore implements some sensible defaults: 
    // - successcallback: 
    //   - calls emit Change
    //   
    // - Failure callback: 
    //   - logs error
    obj.fn = _.wrap(obj.fn, function(fn, action){
      return fn(action).then(that.successCb).catch(that.failCb);
    });

    map[lookupKey] = obj;
  });
  return map;
}


module.exports = AbstractStore;