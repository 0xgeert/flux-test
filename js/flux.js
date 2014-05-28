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
		var dag = {};
		_.each(this.stores, function(store){
			dag[store.name] = store.init();
		});

		detectCycleInStores(dag);

		return this;
	}
});

// Cycle detection in Direct Acyclic Graph
function detectCycleInStores(dag){
	while(true){

		//1. find nodes with 0 dependencies
		//2. remove the keys with 0 deps
		var zeroDep = [],
			dagTmp = {};
		_.each(dag, function(refs, name){
			if(!refs.length){
				zeroDep.push(name);
			}else{
				//construct new dag by filtering out all stores with 0 deps
				dagTmp[name] = refs;
			}
		});
		dag = dagTmp;

		//if dag is empty -> no cycles
		if(!_.size(dag)){
			return;
		}

		//If no progress -> a cycle was found 
		if(!zeroDep.length){
			throw new Error("stores have cycle in their waitfor deps: " + JSON.stringify(_.keys(dag)));
		}

		//3. remove the references from stores which still have dependencies
		_.each(dag, function(refs, name){
			dag[name] = _.difference(refs, zeroDep);
		});
	}
}

_.bindAll(Flux, ["init"]);


module.exports = Flux;
