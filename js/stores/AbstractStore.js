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


var AbstractStore = merge(EventEmitter.prototype, {
  init: function() {
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

      var map = this.createMapFromActionDeclaration(this.actions);

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

  createMapFromActionDeclaration: function() {

    var that = this;

    //create map of actions to handlers. 
    //throw if action and/or handler is not found
    var map = {};
    _.each(this.actions, function(obj, k) {
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
      //=> 
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

      map[lookupKey] = obj;
    });
    return map;
  },



});

module.exports = AbstractStore;