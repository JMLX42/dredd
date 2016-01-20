var keystone = require('keystone');

var importRoutes = keystone.importer(__dirname);

var routes = {
	api: importRoutes('./api')
};

// Setup Route Bindings
exports = module.exports = function(app) {
	app.get('/bill/list', keystone.middleware.api, routes.api.bill.list);
	app.get('/bill/search', keystone.middleware.api, routes.api.bill.search);
	app.get('/bill/:legislature/:number', keystone.middleware.api, routes.api.bill.get);
};
