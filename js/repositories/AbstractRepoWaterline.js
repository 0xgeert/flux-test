"use strict";

var _ = require("lodash");

var adapter = require("./adapters/sails-socket");

/**
 * AbstractRepo that could be used to model different Repositories.
 * The underlying implemention is based on PouchDB which is a pretty leaky abstraction atm.
 * @param {[type]} config [description]
 */
var AbstractRepo = function(config) {

	if(this.name === undefined){
		throw new Error("Respositories should have a 'name' defined");	
	}

	if(config === undefined){
		throw new Error("Reopsitory cannot be init without config-param");
	}
	if(config.collection === undefined){
		throw new Error("Reopsitory cannot be init without config.collection");
	}
	this.db = new adapter(_.extend(config, {
		name: this.name
	}));

	/**
	 * Create a doc.
	 * @param  {string} text The content of the doc
	 */
	this.create = function(obj) {
		return this.db.create(obj);
	};

	/**
	 * Update a doc.
	 * @param  {string} id
	 * @param {object} updates An object literal containing only the data to be
	 *     updated.
	 */
	this.update = function(id, partial) {
		return this.db.update(id, partial);
	};

	/**
	 * Update all of the docs with the same object.
	 *     the data to be updated.  Used to mark all doc as completed.
	 * @param  {object} updates An object literal containing only the data to be
	 *     updated.
	 
	 */
	this.updateAll = function(updates) {

		var that = this;

		return that.getDocs().then(function(docs) {
			return that.db.updateMulti(docs, updates);
		});
	};

	//Get the doc given id. This is needed because we need to specify a _rev of optimistic versioning.
	//Use the _rev and id to remove the document.
	//If doc not found OR anything goes wrong -> handled upstream by promise catch
	this.destroy = function(id) {
		return this.db.remove(id);
	};

	/**
	 * Delete all the completed items.
	 */
	this.destroyMulti = function(where) {

		var that = this;

		return this.getDocs(where).then(function(docs) {
			return that.db.removeMulti(docs);
		});
	};

	this.getDocs = function(where) {

		var that = this;

		// var start = Date.now();
		return that.db.find().then(function(docs) {
			// console.log("getDocs took " + (Date.now() - start) + " millis");
			if (where) {
				docs = _.where(docs, where);
			}
			return docs;
		});
	};

	this.getDocsMap = function(where) {

		return this.getDocs(where).then(function(docs) {
			return _.zipObject(_.pluck(docs, 'id'), docs);
		});
	};

};


module.exports = AbstractRepo;