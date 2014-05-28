

var merge = require('react/lib/merge');

var Promise = require('es6-promise').Promise;

var AbstractStore = require('./AbstractStore');

var TestStore = merge(AbstractStore, {

  CHANGE_EVENT:'change',

  name: "test",
  
  successCb: function(){
    //skip
  },

  callbackFN: function(payload) {
    var action = payload.action;

    return new Promise(function(resolve, reject) {

      //testing store dependency: TodoStore waiting on this store to finish
      switch(action.actionType) {
        default:
          setTimeout(function(){
            resolve();
          },1000);
      }
    });

  }
});


module.exports = TestStore;
