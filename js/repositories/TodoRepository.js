"use strict";

var AbstractRepo = require("./AbstractRepoWaterline");

var noCache = false;


var TodoRepo = function(){

	//init
	AbstractRepo.call(this, {
		collection: "todo",
		noCache: noCache,
		adapter: {
			//config for the remote adapter
			//this is extended with 'collection'  as defined above
		} 
	});

	/**
	 * Create a TODO item.
	 * @param  {string} text The content of the TODO
	 */
	this.create= function(text) {

		var todo = {
			// id: new Date().toString('T'), //TODO: create with custom id not supported in waterline? 
			complete: false,
			text: text
		};
	 		
	  	return this.db.create(todo);
	};
};

TodoRepo.prototype = Object.create(AbstractRepo.prototype); // inherit


module.exports = new TodoRepo();
