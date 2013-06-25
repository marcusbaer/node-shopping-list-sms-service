var Backbone = require("backbone");
var argv = require('optimist').argv;

var Item = Backbone.Model.extend({
    defaults: {
        id: null,
        name: null
    }
});

var Items = Backbone.Collection.extend({
    model: Item
});

var items = new Items();
var sock = null;

var socketsCallback = function (socket) {
    sock = socket;
    socket.on('refresh', function (params) {
        socket.emit('refresh', items);
        socket.broadcast.emit('refresh', items);
    });
};


exports.sockets = socketsCallback;