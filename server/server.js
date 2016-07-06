var express = require('express');
var app     = express();
var http    = require('http').Server(app);
var io      = require('socket.io')(http);

var config  = require('./config.json');

app.use(express.static(__dirname + '/../client'));

var players = [];
var width = 1200,
	height = 700;

io.on('connection', function (socket) {
	var datetime = new Date();
	console.log(datetime + ': a user connected ' + socket.id);

	// Send data of currently connected players to the just connected one
	for(var player in players) {
		if (players.hasOwnProperty(player)) {
		  socket.emit('n', players[player]);
		}
	}
	
	var rx = Math.random() * width,
		ry = Math.random() * height;
	players[socket.id] = {
		id: socket.id,
		nick: socket.id.slice(-4),
		x: rx,
		y: ry,
		a: 0,
		length: 0,
		lineData: [{"x": rx, "y": ry}, {"x": rx, "y": ry}],
		alive: true,
		gap: 0
	}
	
	// Send player instance to the connected player as "y" (yourself)
	// and broadcast it to others under "n" (newplayer)
	socket.emit('y', players[socket.id]);
	socket.broadcast.emit('n', players[socket.id]);
	
	socket.on('a', function(a) {
		players[socket.id].a = a;
		if (players[socket.id].gap < 0) {
			io.sockets.emit('f', socket.id); // Tell everyone to Fix latest segment for this id (by appending new point to lineData)
			
			var lineData = players[socket.id].lineData;
			players[socket.id].lineData.push(lineData[lineData.length - 1]);
		}
	});

	socket.on('nick', function(nick) {
		players[socket.id].nick = nick;
		io.sockets.emit('nick', {"id": socket.id, "nick": nick});
	});	
	
});

function updateLoop() {
	for(var key in players) {
		if (players.hasOwnProperty(key)) {				
			if (players[key].alive) {				
				var x = players[key].lineData[players[key].lineData.length - 1].x,
					y = players[key].lineData[players[key].lineData.length - 1].y;
				
				players[key].length += 1;
				if (players[key].gap <= -90) {
					var lineData = players[key].lineData;
					players[key].lineData.push({"x": null, "y": null});
					// Tell players to Push this in lineData
					io.sockets.emit('p', {"id": players[key].id, "ld": {"x": null, "y": null} }); // Should probably be combined to single function...
					
					// Push this only on server side so server will keep track of movement but tell client only when gap is long enough
					players[key].lineData.push({"x": x, "y": y});
					
					players[key].gap = 8;
				} else if (players[key].gap == 0) {
					// Tell players to Push this in lineData (This is the point line jumps to)
					io.sockets.emit('p', {"id": players[key].id, "ld": {"x": x, "y": y} });
					// This is the x/y that's being constantly changed
					players[key].lineData.push({"x": x, "y": y});
					io.sockets.emit('p', {"id": players[key].id, "ld": {"x": x, "y": y} });
				}
				
				players[key].lineData[players[key].lineData.length - 1] = {"x": x + 2.5 * Math.sin(players[key].a), "y": y + 2.5 * Math.cos(players[key].a)};
				players[key].gap -= 1;
				if (players[key].gap < 0) {
					//players[key].lineData[players[key].lineData.length - 1].x += ;
					//players[key].lineData[players[key].lineData.length - 1].y += );
					
					// Send player position to everyone as Update
					io.sockets.emit('u', {"id": players[key].id, "ld": players[key].lineData[players[key].lineData.length - 1]});					
				}
				// Send head position (This is stupid)
				io.sockets.emit('h', {"id": players[key].id, "ld": players[key].lineData[players[key].lineData.length - 1]});
			}
						
		}
    }
	
	
}

function collisionLoop() {
	for(var key in players) {
		if (players.hasOwnProperty(key)) {				
			if (players[key].alive) {				
				var x = players[key].lineData[players[key].lineData.length - 1].x,
					y = players[key].lineData[players[key].lineData.length - 1].y;
				
				// Collision checking
				var i;
				for(var key2 in players) {
					if (players.hasOwnProperty(key2) && players[key2].alive) {
						for (i = 0; i < players[key2].lineData.length - 2; ++i) { 
							if (players[key2].lineData[i].y != null && players[key2].lineData[i+1].y != null) {
								p = distToSegment({"x": x, "y": y}, players[key2].lineData[i], players[key2].lineData[i+1]);
								//console.log("x: " + x + " y: " + y + " -  l1x: " + players[key].lineData[i].x + " l1y: " + players[key].lineData[i].y);
								//console.log(i + ": " + players[key].lineData[i].x);
								if (p > 0.1 && p < 1.5) {
									players[key].alive = false;
									io.sockets.emit('d', key);
									console.log("COLLISION");
								}
							}
						}
					}
				}
			}
					
		}
    }
	
	
}

function otherLoop() {
	for(var key in players) {
		if (players.hasOwnProperty(key)) {
			io.sockets.emit('s', {"id": players[key].id, "l": players[key].length});
		}
	}
}

setInterval(updateLoop, 1000 / 60);
setInterval(collisionLoop, 1000 / 60);
setInterval(otherLoop, 1000 / 10);

var serverPort = process.env.PORT || config.port;
http.listen(serverPort, function() {
	console.log("Server is listening on port " + serverPort);
});


// Utils
function sqr(x) { return x * x }
function dist2(v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y) }
function distToSegmentSquared(p, v, w) {
  var l2 = dist2(v, w);
  if (l2 == 0) return dist2(p, v);
  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist2(p, { x: v.x + t * (w.x - v.x),
					y: v.y + t * (w.y - v.y) });
}
function distToSegment(p, v, w) { return Math.sqrt(distToSegmentSquared(p, v, w)); }
