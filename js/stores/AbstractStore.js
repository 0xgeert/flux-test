"use strict";

/**
 *
 * GeneralStore
 *
 */

var AppDispatcher = require('../dispatcher/AppDispatcher');

var EventEmitter = require('events').EventEmitter; 

var merge = require('react/lib/merge');

var AbstractStore = merge(EventEmitter.prototype, {
  init: function() {
    if(this.callbackFN === undefined){
      throw new Error("Store should have 'callbackFN'  defined");
    }
    if(this.CHANGE_EVENT === undefined){
      throw new Error("Store should have 'CHANGE_EVENT'  defined");
    }
    AppDispatcher.register(this.callbackFN);
  },

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

module.exports = AbstractStore;
