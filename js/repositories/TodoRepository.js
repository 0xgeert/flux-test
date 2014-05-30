"use strict";


var merge = require('react/lib/merge');

var AbstractRepo = require("./AbstractRepository");

var TodoRepo = merge(AbstractRepo, {
	/**
	 * Create a TODO item.
	 * @param  {string} text The content of the TODO
	 */
	create: function(text) {

		var todo = {
			_id: new Date().toString('T'), //time now in string
			complete: false,
			text: text
		};
	 		
	  	return this.db.put(todo); //put requires a new _id

	  	//return db.post(todo);
	}
});

module.exports = TodoRepo.init({
	db: "todos"
});
