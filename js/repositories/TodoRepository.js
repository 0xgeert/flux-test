"use strict";

var AbstractRepo = require("./AbstractRepoWaterline");

var _ = require("lodash");

var TodoRepoFN = function(opts){

	this.name =  "todoRepo";

	//init
	AbstractRepo.call(this, _.extend(opts,{
		collection: "todo",
	}));

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

TodoRepoFN.prototype = Object.create(AbstractRepo.prototype); // inherit

module.exports = TodoRepoFN;
