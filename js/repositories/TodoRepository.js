"use strict";

var AbstractRepo = require("./AbstractRepository");

var noCache = false;

var TodoRepo = function(){

	//init
	AbstractRepo.call(this, {
		db: "todos",
		noCache: noCache
	});

	/**
	 * Create a TODO item.
	 * @param  {string} text The content of the TODO
	 */
	this.create= function(text) {

		var todo = {
			_id: new Date().toString('T'), //time now in string
			complete: false,
			text: text
		};
	 		
	  	return this.db.put(todo); //put requires a new _id

	  	//return db.post(todo);
	};
};

TodoRepo.prototype = Object.create(AbstractRepo.prototype); // inherit


module.exports = new TodoRepo();
