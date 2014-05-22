"use strict";

/**
 *
 * GeneralStore
 *
 */

var AppDispatcher = require('../dispatcher/AppDispatcher');

var EventEmitter = require('events').EventEmitter; 

var merge = require('react/lib/merge');

var GeneralStore = merge(EventEmitter.prototype, {
  init: function() {
    if(this.callbackFN === undefined){
      throw new Error("Store should have 'callbackFN'  defined");
    }
    AppDispatcher.register(this.callbackFN);
  }

});

module.exports = GeneralStore;
