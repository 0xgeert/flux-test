"use strict";

/**
 *
 * Flux
 *
 */

var EventEmitter = require('events').EventEmitter; 

var merge = require('react/lib/merge');

var _ = require("lodash");

var Flux = merge(EventEmitter.prototype, {
  
	init: function(config){
		if(config === undefined){
			throw new Error("Flux should be passed a config object");
		}
		if(config.stores === undefined){
			throw new Error("Flux should be passed a config object that contains 'stores'");
		}
		this.stores = config.stores;

		//init stores
		_.each(this.stores, function(store){
			store.init();
		});

		return this;
	}
});

_.bindAll(Flux, ["init"]);


module.exports = Flux;
