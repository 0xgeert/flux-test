"use strict";

var Promise = require('es6-promise').Promise;

var _ = require("lodash");

var adapterFN = require("./adapters/sails-socket");

//switch to signal if documents need revisions for UD updates.
var revNeeded = false;

var DB = function(config) {

	var db = {

		//init the adapter which is going to take care of communication with the remote resource
		adapter: adapterFN(_.extend({
			collection: config.collection
		}, config.adapter || {})),


		docs: undefined,

		// when adapter signals error -> repopulate in-mem todos
		// this effectively functions as a rollback 
		rollbackAfterConflict: function(err) {
			console.log(this);
			console.log(err);
			console.log("rolling back...");
			this.docs = undefined; //clear cache so fetchall is performed from remote
			return this.fetchAll();
		},

		find: function() {
			var that = this;
			var orderById = function(result) {
				result = _.sortBy(result, function(row) {
					return row.id;
				});
				// result.reverse();
				return result;
			};

			if (!this.docs) {
				return that.adapter.find().then(function(result) {
					var docs = result;
					that.docs = _.zipObject(_.pluck(docs, 'id'), docs);

					result = orderById(result);
					return result;
				});
			} else {
				var result = _.map(_.values(that.docs));

				result = orderById(result);
				return Promise.resolve(result);
			}
		},

		//requires in-mem store to be populated!
		get: function(id) {
			//always fetch on in-mem store
			return Promise.resolve(this.docs[id]);
		},

		/**
		 * create can be used to create doc WITHOUT id.
		 * @param  {[type]} doc [description]
		 * @return {[type]}     [description]
		 */
		create: function(doc){
			var that = this;
			return that.adapter.create(doc).then(function(result) {
				that.docs[result.id] = result;
			})["catch"](this.rollbackAfterConflict);
		},

		/**
		 * update existing doc (id should be passed)
		 * @param  {[type]} partial [description]
		 * @param  {[type]} id      [description]
		 * @param  {[type]} rev     [description]
		 * @return {[type]}         [description]
		 */
		update: function(id, partial) {
			
			if (!id) {
				throw new Error("update should define 'id'");
			} 

			var that = this,
				doc = that.docs[id];

			if (!doc) {
				return Promise.reject("doc not found");
			}
			
			doc = that.docs[id] = _.extend(doc, partial);

			if(revNeeded && doc._rev === undefined){
				return Promise.reject("'rev' should exist on doc when calling repo.update");
			}

			return that.adapter.update(id, doc, doc._rev).then(function(result) {
				//update cache with changed/created rev
				doc._rev = result.rev;
			})["catch"](this.rollbackAfterConflict);
		},


		updateMulti: function(docs) {
			var that = this;

			if (!docs.length) {
				return Promise.resolve();
			}

			try{
				_.each(docs, function(doc) {
					if(revNeeded && doc._rev === undefined){
						throw new Error("'_rev' should exist on doc when passed to updateMulti");
					}
					that.docs[doc.id] = doc;
				});
			}catch(err){
				return Promise.reject(err);
			}
			

			return that.adapter.updateMulti(docs).then(function(result) {
				//update cache with changed rev
				_.each(result, function(changedDoc) {
					var doc = that.docs[changedDoc.id];
					if (doc) {
						doc._rev = changedDoc.rev;
					}
				});
			})["catch"](this.rollbackAfterConflict);
		},

		remove: function(id, rev) {

			var doc =  this.docs[id];
			delete this.docs[id];

			if (!doc) {
				throw new Error("doc not found: " + id);
			}
			if (revNeeded &&  doc._rev === undefined) {
				throw new Error("'rev' should exist on doc when calling repo.remove");
			}
			return this.adapter.remove(id, doc._rev)["catch"](this.rollbackAfterConflict);

		},


		removeMulti: function(docs) {
			var that = this;
			if (!docs.length) {
				return Promise.resolve();
			}
			try{
				_.each(docs, function(doc) {
					if(revNeeded && doc._rev === undefined){
						throw new Error("'_rev' should exist on doc when passed to removeMulti");
					}
					delete that.docs[doc.id];
				});
			}catch(err){
				return Promise.reject(err);
			}
			
			return that.adapter.removeMulti(docs)["catch"](this.rollbackAfterConflict);
		}
	};
	_.bindAll(db);
	return db;
};


/**
 * AbstractRepo that could be used to model different Repositories.
 * The underlying implemention is based on PouchDB which is a pretty leaky abstraction atm.
 * @param {[type]} config [description]
 */
var AbstractRepo = function(config) {

	if(config === undefined){
		throw new Error("Reopsitory cannot be init without config-param");
	}
	if(config.collection === undefined){
		throw new Error("Reopsitory cannot be init without config.collection");
	}
	this.db = new DB(config);

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
			docs = _.map(docs, function(doc) {
				return _.merge(doc, updates);
			});
			return that.db.updateMulti(docs);
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