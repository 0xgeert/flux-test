"use strict";

/**
 * TodoController.js 
 *
 * Extended with `removeMulti` and `updateMulti`
 *
 * NOTE: this could prove generally useful. 
 * Suggested to add them upstream as part of CRUD-blueprints: 
 * https://github.com/balderdashy/sails/issues/1805
 * 
 * @description ::
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */

var _ = require("lodash");
module.exports = {

	testSocket: function(req,res){

        if(req.isSocket){

          Todo.watch(req.socket);
          console.log('Todo with socket id '+req.socket.id+' is now subscribed to the model class \'todo\'.');

        } else {

          res.view();

        }
    },

	/**
	 * payload: {
	 * 	where: {}, 
	 * }
	 *
	 * or
	 * 
	 * payload: {
	 * 	ids: [], 
	 * }
	 *
	 * @param  {[type]} req [description]
	 * @param  {[type]} res [description]
	 * @return {[type]}     [description]
	 */
	removeMulti: function(req, res){
		var where = req.param('where'),
			ids = req.param('ids');

		if(!_.isObject(where) && !_.isObject(ids)){
			return res.badRequest("either 'where' or 'ids' should be defined");
		}
		if(_.isObject(where) && _.isObject(ids)){
			return res.badRequest("'where' and 'ids' were both defined. It's either or");
		}
		if(_.isObject(ids)){
			where = {
				id: ids
			};
		}
		Todo.destroy(where).exec(function(err, todos) {
		   if (err) {return res.serverError();}

		   console.log("testing");
		   //let clients know what happened so they can sync up
		   Todo.message(todos,{
		   	moeha: "jaja"
		   });

		   return res.json(todos);
		});
	},

	/**
	 * payload: {
	 * 	where: {}, 
	 * 	partial: {}
	 * }
	 * or: 
	 * 
	 * payload: {
	 * 	ids: [], 
	 * 	partial: {}
	 * }
	 * 
	 * @param  {[type]} req [description]
	 * @param  {[type]} res [description]
	 * @return {[type]}     [description]
	 */
	updateMulti: function(req, res){
		var where = req.param('where'),
			partial = req.param('partial'),
			ids = req.param('ids');

		if(!_.isObject(where) && !_.isObject(ids)){
			return res.badRequest("either 'where' or 'ids' should be defined");
		}
		if(_.isObject(where) && _.isObject(ids)){
			return res.badRequest("'where' and 'ids' were both defined. It's either or");
		}
		if(_.isObject(ids)){
			where = {
				id: ids
			};
		}
		if(!_.isObject(partial)){
			return res.badRequest("'partial' should be defined");
		}
		Todo.update(where, partial).exec(function(err, todosUpdated) {
		   if (err) {return res.serverError();}
		   return res.json(todosUpdated);
		});
	}

};
