var argv = require('optimist').argv;
var sys = require('util');
var http = require('http');
var fs = require('fs');
var tools = require('./tools');
var Backbone = require("backbone");

var port = argv.p || 8080;
var host = argv.h || 'localhost';
var wwwDir = argv.www || process.cwd()+'/frontend';

var watchFilename = 'message.txt';
var memoFilename = 'memo.log';

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

var httpServer = http.createServer(function(req, res) {
    var body = "";
    req.on('data', function (chunk) {
        body += chunk;
    });
    req.on('end', function () {
        if (req.url.indexOf('/service/') >= 0) {
            tools.service(req, res, body);
        } else {
            tools.static(req, res);
        }
    });
}).listen(port);
sys.log('Running server on port ' + port + ' with ' + wwwDir + ' as working directory');

// WebSockets
var io = require('socket.io').listen(httpServer);
io.set('log level', 1); // disables debugging
io.sockets.on('connection', function (socket) {
    getItemsFromFile(watchFilename, function(items){
        socket.emit('refresh', items);
        socket.broadcast.emit('refresh', items);
    });
//    fs.readFile(memoFilename, 'utf8', function(err, data){
//        socket.emit('memo', data);
//        socket.broadcast.emit('memo', data);
//    });
    socket.on('refresh', function (params) {
        getItemsFromFile(watchFilename, function(items){
            socket.emit('refresh', items);
            socket.broadcast.emit('refresh', items);
        });
//        fs.readFile(memoFilename, 'utf8', function(err, data){
//            socket.emit('memo', data);
//            socket.broadcast.emit('memo', data);
//        });
    });
    fs.watchFile(watchFilename, function (curr, prev) {
//        console.log('the current mtime is: ' + curr.mtime);
//        console.log('the previous mtime was: ' + prev.mtime);
        getItemsFromFile(watchFilename, function(items){
            socket.emit('refresh', items);
            socket.broadcast.emit('refresh', items);
        });
    });
//    fs.watchFile(memoFilename, function (curr, prev) {
//        fs.readFile(memoFilename, 'utf8', function(err, data){
//            socket.emit('memo', data);
//            socket.broadcast.emit('memo', data);
//        });
//    });
});
sys.log('Starting WebSockets..');

function getItemsFromFile (filename, next) {
    fs.readFile(filename, 'utf8', function(err, data){
        if (data) {
            var list = data.split("\n");
            var newItems = [];
            for (var i=0; i<list.length; i++) {
                newItems.push({
                    id: i,
                    name: list[i].replace(/\r/g,'')
                });
            }
            items = new Items(newItems);
            next(items);
        }
    });
}

// SSL
//if (argv.ssl) {
//    var fs = require('fs');
//    var https = require('https');
//    var httpProxy = require('http-proxy');
//    var options = {
//        https: {
//            key: fs.readFileSync(wwwDir + '/ssl/localhost.key', 'utf8'),
//            cert: fs.readFileSync(wwwDir + '/ssl/localhost.cert', 'utf8')
//        }
//    };
//    // a standalone HTTPS proxy server
//    httpProxy.createServer(port, host, options).listen(443);
//	sys.log('Running proxy on port 443 as listener to port ' + port);
//}


