
"use strict";

var Promise = require('es6-promise').Promise;

var _ = require("lodash");

var PouchDB = require('pouchdb');

var remoteCouch = false;


var DB = function(config){
	var db =  {
		docs: [],
		dbPouch: new PouchDB(config.db),

		// when pouch signals error -> repopulate in-mem todos
		// this effectively functions as a rollback 
		rollbackAfterConflict: function(err){
			console.log(this);
			console.log(err);
			console.log("rolling back...");
			this.docs = undefined; //clear cache
			return this.allDocs({include_docs: true});
		},

		allDocs: function(opts){
			var that = this;
			var orderById = function(result){
				result.rows = _.sortBy(result.rows, function(row){
					return row.doc._id;
				});
				// result.rows.reverse();
				return result;
			};

			if(!this.docs){
				// console.log("remote lookup");
				return that.dbPouch.allDocs(opts).then(function(result){
					var docs = _.pluck(result.rows, "doc");
					that.docs = _.zipObject(_.pluck(docs, '_id'), docs);

					result = orderById(result);
					return result;
				});
			}else{
				// console.log("local lookup");
				var result = {
		      rows : _.map(_.values(that.docs), function(doc){
		        return {doc: doc};
		      })
		    };

		    result.total_rows = result.rows.length;
		    result.offset= 0; //TODO: this *may* become dynamic iff we decide to implement https://github.com/gebrits/flux-test/issues/17

		    result = orderById(result);
		    return Promise.resolve(result);
			}
		},

		put: function(partial, id, rev){
			var that = this;
			var doc;
			if(!id){
			  //new
			  that.docs[partial._id] = partial;
			  doc = partial; 
			}else{
			  //change existing
			  doc = that.docs[id];
			  if(!doc){
			    return Promise.reject("doc not found");
			  }
			  doc = that.docs[id] = _.merge(doc, partial);
			}

			console.log("local create/put done");
			//in all cases update pouch
			return that.dbPouch.put(doc, id, rev).then(function(result){
				console.log("remote create/put done");
				//update cache with changed/created rev and id which may not yet exist
				doc._rev = result.rev;
				doc.id = result.id;
			})["catch"](this.rollbackAfterConflict);
		},

		//requires in-mem store to be populated!
		get: function(id){
			//always fetch on in-mem store
			return Promise.resolve(this.docs[id]);
		},

		remove: function(id, rev){
			if(rev === undefined){
				throw new Error("rev needs to be defined when calling store.remove");
			}
			delete this.docs[id];
			console.log("local remove done");
			return this.dbPouch.remove(id, rev)["catch"](this.rollbackAfterConflict);
		},

		bulkDocs: function(docs){
			var that = this;
			if(!docs.length){
			  return Promise.resolve();
			}
			_.each(docs, function(doc){
			  if(doc._deleted){
			  	//delete
			    delete that.docs[doc.id];
			  }else{
			  	//update
			    that.docs[doc.id] = doc;
			  }
			}); 

			console.log("local bulk done");
			return that.dbPouch.bulkDocs(docs).then(function(result){
				//update cache with changed rev
				_.each(result, function(changedDoc){
					var doc = that.docs[changedDoc.id];
					if(doc){
						doc._rev = changedDoc.rev;
					}
				});
			})["catch"](this.rollbackAfterConflict);
		}
	};
	_.bindAll(db);
	return db;
};


var AbstractRepo = {
	
	init: function(config){
		this.db = new DB(config);
		return this;
	},

	/**
	 * Create a doc.
	 * @param  {string} text The content of the doc
	 */
	create: function(obj) {
	  return this.db.put(obj); //put requires a new _id
	  //return db.post(obj);
	},

	/**
	 * Update a doc.
	 * @param  {string} id 
	 * @param {object} updates An object literal containing only the data to be 
	 *     updated.
	 */
	update: function(id, updates) {

		var that = this;

		//Get the doc given id. This is needed because we need to specify a _rev of optimistic versioning.
		//Use the _rev and id to update the document.
		//If doc not found OR anything goes wrong -> handled upstream by promise catch
		return that.db.get(id).then(function(doc){
			if(!doc){
			  throw new Error("doc not found: " + id);
			}
			doc = _.merge(doc, updates);
			return that.db.put(doc, id, doc._rev);
		});
	},

	/**
	 * Update all of the docs with the same object. 
	 *     the data to be updated.  Used to mark all doc as completed.
	 * @param  {object} updates An object literal containing only the data to be 
	 *     updated.

	 */
	updateAll: function(updates) {

		var that = this;

		return that.getDocs().then(function(docs){
			docs = _.map(docs, function(doc){
			  return _.merge(doc, updates);
			});
			return that.db.bulkDocs(docs);
		});
	},

	//Get the doc given id. This is needed because we need to specify a _rev of optimistic versioning.
	//Use the _rev and id to remove the document.
	//If doc not found OR anything goes wrong -> handled upstream by promise catch
	destroy: function(id) {

		var that = this;

		return that.db.get(id).then(function(doc){
			if(!doc){
			  throw new Error("doc not found: " + id);
			}
			return that.db.remove(id, doc._rev);
		});
	},

	/**
	 * Delete all the completed items.
	 */
	destroyMulti: function(where) {

		var that = this;

		var deleteObj =  {_deleted: true};
			return this.getDocs(where).then(function(docs){
			docs = _.map(docs, function(doc){
			  return _.merge(doc,deleteObj);
			});
			return that.db.bulkDocs(docs);
		});
	},

	getDocs: function(where){

		var that = this;

	  // var start = Date.now();
		return that.db.allDocs({include_docs: true}).then(function(result){
			// console.log("getDocs took " + (Date.now() - start) + " millis");
			var docs =  _.map(_.pluck(result.rows, "doc"), function(doc){
				return _.merge(doc, {id: doc._id});
			});
			if(where){
				docs = _.where(docs, where);
			}
			return docs;
		});
	},

	getDocsMap: function(where){

		return this.getDocs(where).then(function(docs){
			return _.zipObject(_.pluck(docs, '_id'), docs);
		});
	}

};

module.exports = AbstractRepo;
