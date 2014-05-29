/**
 * Copyright 2013-2014 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * TodoStore
 */

var _ = require("lodash");

var merge = require('react/lib/merge');

var AbstractStore = require('./AbstractStore');

var Promise = require('es6-promise').Promise;

var TodoConstants = require('../constants/TodoConstants');

var PouchDB = require('pouchdb');
var db = new PouchDB('todos');
var remoteCouch = false;

/**
 * Create a TODO item.
 * @param  {string} text The content of the TODO
 */
function create(text) {
  
  var todo = {
    //_id: new Date().toString('T'), //time now in string
    complete: false,
    text: text
  };
 
  // return db.put(todo); //put requires a new _id
  
  return db.post(todo);
}

/**
 * Update a TODO item.
 * @param  {string} id 
 * @param {object} updates An object literal containing only the data to be 
 *     updated.
 */
function update(id, updates) {

  //Get the doc given id. This is needed because we need to specify a _rev of optimistic versioning.
  //Use the _rev and id to update the document.
  //If doc not found OR anything goes wrong -> handled upstream by promise catch
  return db.get(id).then(function(todo){
    if(!todo){
      throw new Error("doc not found: " + id);
    }
    return db.put(updates, id, todo._rev);
  });
}

/**
 * Update all of the TODO items with the same object. 
 *     the data to be updated.  Used to mark all TODOs as completed.
 * @param  {object} updates An object literal containing only the data to be 
 *     updated.

 */
function updateAll(updates) {

  return getDocs().then(function(docs){
    docs = _.map(docs, function(doc){
      return _.merge(doc, updates);
    });
    return db.bulkDocs(docs);
  });
}

//Get the doc given id. This is needed because we need to specify a _rev of optimistic versioning.
//Use the _rev and id to remove the document.
//If doc not found OR anything goes wrong -> handled upstream by promise catch
function destroy(id) {
  return db.get(id).then(function(todo){
    if(!todo){
      throw new Error("doc not found: " + id);
    }
    return db.remove(id, todo._rev);
  });
}

/**
 * Delete all the completed items.
 */
function destroyMulti(where) {
  var deleteObj =  {_deleted: true};
  return getDocs(where).then(function(docs){
    docs = _.map(docs, function(doc){
      return _.merge(doc,deleteObj);
    });
    return db.bulkDocs(docs);
  });
}

function getDocs(where){
  var start = Date.now();
  return db.allDocs({include_docs: true}).then(function(result){
    console.log("getDocs took " + (Date.now() - start) + " millis");
    var docs =  _.map(_.pluck(result.rows, "doc"), function(doc){
      return _.merge(doc, {id: doc._id});
    });
    if(where){
      docs = _.where(docs, where);
    }
    return docs;
  });
}

function getDocsMap(where){
  return getDocs(where).then(function(docs){
    return _.zipObject(_.pluck(docs, '_id'), docs);
  });
}


var TodoStore = merge(AbstractStore, {

  CHANGE_EVENT:'change',

  name: "todo",
  
  constants: TodoConstants,

  /**
   * Tests whether all the remaining TODO items are marked as completed.
   * @return {booleam}
   */
  areAllComplete: function() {
    return false;
    // for (id in _todos) {
    //   if (!_todos[id].complete) {
    //     return false;
    //     break;
    //   }
    // }
    // return true;
  },

  /**
   * Get the entire collection of TODOs.
   * @return {object}
   */
  getAll: function(cb) {
    getDocsMap().then(function(docsMap){
      cb(undefined,docsMap);
    }).catch(function(err){
      cb(err);
    });
  },

  //declarative actions. 
  //These are checked to exist (both the keys as the values)
  //values be also be of format function
  //or may be an object which in turn must contain a `fn` property
  //which must be a string or a function
  //
  //The object notation allows for more elaborate things to be declared
  //such as async and optimistic operation.
  actions: {
    "TODO_CREATE": {
      fn: "onTodoCreate",
      async: true
    },
    "TODO_TOGGLE_COMPLETE_ALL":{
      fn:  "onTodoToggleCompleteAll",
      async: true
    },
    "TODO_UNDO_COMPLETE": {
      fn: "onTodoUndoComplete",
      async: true,
    },
    "TODO_COMPLETE": {
      fn: "onTodoComplete",
      async: true
    },
    "TODO_UPDATE_TEXT": {
      fn: "onTodoUpdateText",
      async: true
    },
    "TODO_DESTROY": {
      fn: "onTodoDestroy",
      async: true
    },
    "TODO_DESTROY_COMPLETED": {
      fn: "onTodoDestroyCompleted",
      async: true
    }
  },

  ////////////////////
  // Action methods //
  ////////////////////
  
  onTodoCreate: function(action, resolve, reject){
    var text = action.text.trim();
    if (text !== '') {
      return create(text).then(function(asd){
        resolve();
      }).catch(reject);
    }else{
      return reject(new Error("onTodoCreate shouldn't be called with empty text!"));
    }
  },

  onTodoToggleCompleteAll: function(action, resolve, reject){
    if (TodoStore.areAllComplete()) {
      updateAll({complete: false}).then(resolve).catch(reject);
    } else {
      updateAll({complete: true}).then(resolve).catch(reject);
    }
  },

  onTodoUndoComplete: function(action, resolve, reject){
    update(action.id, {complete: false}).then(resolve).catch(reject);
  },

  onTodoComplete: function(action, resolve, reject){
    update(action.id, {complete: true}).then(resolve).catch(reject);
  },

  onTodoUpdateText: function(action, resolve, reject){
    text = action.text.trim();
    if (text !== '') {
      update(action.id, {text: text}).then(resolve).catch(reject);
    }else{
      resolve();
    }
  },

  onTodoDestroy: function(action, resolve, reject){
    destroy(action.id).then(resolve).catch(reject);
  },

  onTodoDestroyCompleted: function(action, resolve, reject){
    destroyMulti({complete: true}).then(resolve).catch(reject);
  },
});

//NOTE: don't do bindAll for action methods (onX), since this 
//fails inspection when testing for nr of params (async vs sync check)
_.bindAll(TodoStore,["successCb","optimisticCb","failCb","emitChange"]);

module.exports = TodoStore;
