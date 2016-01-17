var keystone = require('keystone');

var importRoutes = keystone.importer(__dirname);

var routes = {
	api: importRoutes('./api')
};

// Setup Route Bindings
exports = module.exports = function(app) {
	app.get('/bill/list', keystone.middleware.api, routes.api.bill.list);
	app.get('/bill/get/:legislature/:number', keystone.middleware.api, routes.api.bill.get);
};
