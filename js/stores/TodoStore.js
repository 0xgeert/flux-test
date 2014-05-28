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

var TodoConstants = require('../constants/TodoConstants');

//var _todos = {};

var PouchDB = require('pouchdb');
var db = new PouchDB('todos');

/**
 * Create a TODO item.
 * @param  {string} text The content of the TODO
 */
function create(text) {
  // Hand waving here -- not showing how this interacts with XHR or persistent
  // server-side storage.
  // Using the current timestamp in place of a real id.
  
  var todo = {
    _id: Date.now(),
    complete: false,
    text: text
  };

  db.put(todo, function callback(err, result) {
    if (!err) {
      console.log('Successfully posted a todo!');
    }
  });
}

/**
 * Update a TODO item.
 * @param  {string} id 
 * @param {object} updates An object literal containing only the data to be 
 *     updated.
 */
function update(id, updates) {

  db.put(todo);

  _todos[id] = merge(_todos[id], updates);
}

/**
 * Update all of the TODO items with the same object. 
 *     the data to be updated.  Used to mark all TODOs as completed.
 * @param  {object} updates An object literal containing only the data to be 
 *     updated.

 */
function updateAll(updates) {
  for (var id in _todos) {
    update(id, updates);
  }
}

/**
 * Delete a TODO item.
 * @param  {string} id
 */
function destroy(id) {
  delete _todos[id];
}

/**
 * Delete all the completed TODO items.
 */
function destroyCompleted() {
  for (var id in _todos) {
    if (_todos[id].complete) {
      destroy(id);
    }
  }
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
    for (id in _todos) {
      if (!_todos[id].complete) {
        return false;
        break;
      }
    }
    return true;
  },

  /**
   * Get the entire collection of TODOs.
   * @return {object}
   */
  getAll: function() {
    return _todos;
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
      create(text);
    }
    resolve();
  },

  onTodoToggleCompleteAll: function(action, resolve, reject){
    if (TodoStore.areAllComplete()) {
      updateAll({complete: false});
    } else {
      updateAll({complete: true});
    }
    resolve();
  },

  onTodoUndoComplete: function(action, resolve, reject){
    update(action.id, {complete: false});
    resolve();
  },

  onTodoComplete: function(action, resolve, reject){
    update(action.id, {complete: true});
    resolve();
  },

  onTodoUpdateText: function(action, resolve, reject){
    text = action.text.trim();
    if (text !== '') {
      update(action.id, {text: text});
    }
    resolve();
  },

  onTodoDestroy: function(action, resolve, reject){
    destroy(action.id);
    resolve();
  },

  onTodoDestroyCompleted: function(action, resolve, reject){
    destroyCompleted();
    resolve();
  },
});

_.bindAll(TodoStore,["successCb","optimisticCb","failCb","emitChange"]);

module.exports = TodoStore;
