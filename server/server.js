var express = require('express');
var app     = express();
var http    = require('http').Server(app);
var io      = require('socket.io')(http);

var config  = require('./config.json');

app.use(express.static(__dirname + '/../client'));

var players = [];
var width = 1400,
	height = 1400;

io.on('connection', function (socket) {
	var datetime = new Date();
	console.log(datetime + ': a user connected ' + socket.id);

	// Send data of currently connected players to the just connected one
	for(var player in players) {
		if (players.hasOwnProperty(player)) {
		  socket.emit('n', players[player]);
		}
	}
	/*
	width += 320;
	height += 320;
	
	if (width > 1400) {
		width = 1400;
		height = 1400;
	}*/
	
	
	var rx = (200) + Math.random() * 1400,
		ry = (200) + Math.random() * 1400;
	players[socket.id] = {
		id: socket.id,
		nick: socket.id.slice(-4),
		x: rx,
		y: ry,
		a: 180,
		length: 0,
		lineData: [{"x": rx, "y": ry}, {"x": rx, "y": ry}],
		alive: true,
		gap: 0,
		lastAdd: Date.now()
	}
	
	// Send player instance to the connected player as "y" (yourself)
	// and broadcast it to others under "n" (newplayer)
	io.sockets.emit('r', {"w": width, "h": height});
	socket.emit('y', players[socket.id]);
	socket.broadcast.emit('n', players[socket.id]);
	
	socket.on('a', function(a) {
		players[socket.id].a = a;
		if (players[socket.id].gap < 0) {
			if (Date.now() - players[socket.id].lastAdd > 50) {
				io.sockets.emit('f', socket.id); // Tell everyone to Fix latest segment for this id (by appending new point to lineData)
				var lineData = players[socket.id].lineData;
				players[socket.id].lineData.push(lineData[lineData.length - 1]);
				players[socket.id].lastAdd = Date.now();
			}
		}
	});

	socket.on('nick', function(nick) {
		players[socket.id].nick = nick;
		io.sockets.emit('nick', {"id": socket.id, "nick": nick});
	});	
	
	socket.on('disconnect', function() {
		delete players[socket.id];
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
				
				players[key].lineData[players[key].lineData.length - 1] = {"x": x + 5 * Math.sin(players[key].a), "y": y + 5 * Math.cos(players[key].a)};
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
		for(var key2 in players) {
			if (players.hasOwnProperty(key) && players[key].gap < 0 && players[key].alive && players.hasOwnProperty(key2) && players[key2].alive) {							
				var x = players[key].lineData[players[key].lineData.length - 1].x,
					y = players[key].lineData[players[key].lineData.length - 1].y
					lastx = players[key].lineData[players[key].lineData.length - 2].x,
					lasty = players[key].lineData[players[key].lineData.length - 2].y;
				
				if (x < 0 || x > width || y < 0 || y > height) {
					players[key].alive = false;
					io.sockets.emit('d', key);
					break;
				}
				
				// Collision checking
				var i;
				for (i = 1; i < players[key2].lineData.length - 2; ++i) { 
					if (players[key2].lineData[i-1].y != null && players[key2].lineData[i].y != null) {
						//p = distToSegment({"x": x, "y": y}, players[key2].lineData[i], players[key2].lineData[i+1]);
						//console.log("x: " + x + " y: " + y + " -  l1x: " + players[key].lineData[i].x + " l1y: " + players[key].lineData[i].y);
						//console.log(i + ": " + players[key].lineData[i].x);
						var p = intersect(lastx, lasty, x, y, players[key2].lineData[i-1].x, players[key2].lineData[i-1].y, players[key2].lineData[i].x, players[key2].lineData[i].y);
						if (p) {
							players[key].alive = false;
							io.sockets.emit('d', key);
							break;
						}
					}
				}
			}
			if (players[key].alive == false) {
				break;
			}
		}
		if (players[key].alive == false) {
			delete players[key];
		}
	}
				
}

function otherLoop() {
	var scores = [];
	for(var key in players) {
		if (players.hasOwnProperty(key)) {
			scores.push({"id": players[key].id, "score": players[key].length})
		}
	}
	io.sockets.emit('s', scores);
}

setInterval(updateLoop, 1000 / 60);
setInterval(collisionLoop, 1000 / 60);
setInterval(otherLoop, 1000 / 8);

var serverPort = process.env.PORT || config.port;
http.listen(serverPort, function() {
	console.log("Server is listening on port " + serverPort);
});


// Utils
function intersect(line1StartX, line1StartY, line1EndX, line1EndY, line2StartX, line2StartY, line2EndX, line2EndY) {
    // if the lines intersect, the result contains the x and y of the intersection (treating the lines as infinite) and booleans for whether line segment 1 or line segment 2 contain the point
    var denominator, a, b, numerator1, numerator2, result = {
        x: null,
        y: null,
    };
    denominator = ((line2EndY - line2StartY) * (line1EndX - line1StartX)) - ((line2EndX - line2StartX) * (line1EndY - line1StartY));
    if (denominator == 0) { return false; }
    a = line1StartY - line2StartY;
    b = line1StartX - line2StartX;
    numerator1 = ((line2EndX - line2StartX) * a) - ((line2EndY - line2StartY) * b);
    numerator2 = ((line1EndX - line1StartX) * a) - ((line1EndY - line1StartY) * b);
    a = numerator1 / denominator;
    b = numerator2 / denominator;
    result.x = line1StartX + (a * (line1EndX - line1StartX));
    result.y = line1StartY + (a * (line1EndY - line1StartY));
    if (a > 0 && a < 1 && b > 0 && b < 1 && result.x != null && result.y != null) {
        return true;
    }
    return false;
};