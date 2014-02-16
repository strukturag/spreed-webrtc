// Example plugin shows the basic API.
define([], function() {
	return {
		initialize: function(app) {
			console.log("Example plugin 1 loaded.", app);
		}
	}
});
