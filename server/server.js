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
		gap: 0,
		lastAdd: Date.now()
	}
	
	// Send player instance to the connected player as "y" (yourself)
	// and broadcast it to others under "n" (newplayer)
	socket.emit('y', players[socket.id]);
	socket.broadcast.emit('n', players[socket.id]);
	
	socket.on('a', function(a) {
		players[socket.id].a = a;
		if (players[socket.id].gap < 0) {
			if (Date.now() - players[socket.id].lastAdd > 40) {
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
				
				players[key].lineData[players[key].lineData.length - 1] = {"x": x + 1 * Math.sin(players[key].a), "y": y + 1 * Math.cos(players[key].a)};
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
				if (players[key].alive == false) {
					break;
				}
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
			scores.push({"id": players[key].id, "score": players[key].length});
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
function intersect(x1, y1, x2, y2, x3, y3, x4, y4){

  var a1, a2, b1, b2, c1, c2;
  var r1, r2 , r3, r4;
  var denom, offset, num;

  // Compute a1, b1, c1, where line joining points 1 and 2
  // is "a1 x + b1 y + c1 = 0".
  a1 = y2 - y1;
  b1 = x1 - x2;
  c1 = (x2 * y1) - (x1 * y2);

  // Compute r3 and r4.
  r3 = ((a1 * x3) + (b1 * y3) + c1);
  r4 = ((a1 * x4) + (b1 * y4) + c1);

  // Check signs of r3 and r4. If both point 3 and point 4 lie on
  // same side of line 1, the line segments do not intersect.
  if ((r3 != 0) && (r4 != 0) && same_sign(r3, r4)){
    return false;
  }

  // Compute a2, b2, c2
  a2 = y4 - y3;
  b2 = x3 - x4;
  c2 = (x4 * y3) - (x3 * y4);

  // Compute r1 and r2
  r1 = (a2 * x1) + (b2 * y1) + c2;
  r2 = (a2 * x2) + (b2 * y2) + c2;

  // Check signs of r1 and r2. If both point 1 and point 2 lie
  // on same side of second line segment, the line segments do
  // not intersect.
  if ((r1 != 0) && (r2 != 0) && (same_sign(r1, r2))){
    return false;
  }

  //Line segments intersect: compute intersection point.
  denom = (a1 * b2) - (a2 * b1);

  if (denom == 0) {
    return false; // collinear
  }

  if (denom < 0){ 
    offset = -denom / 2; 
  } else {
    offset = denom / 2 ;
  }

  // The denom/2 is to get rounding instead of truncating. It
  // is added or subtracted to the numerator, depending upon the
  // sign of the numerator.
  num = (b1 * c2) - (b2 * c1);
  if (num < 0){
	x = (num - offset) / denom;
  } else {
    x = (num + offset) / denom;
  }

  num = (a2 * c1) - (a1 * c2);
  if (num < 0){
    y = ( num - offset) / denom;
  } else {
    y = (num + offset) / denom;
  }

  // lines_intersect
  return true;
}

function same_sign(a, b){
  return ((a * b) >= 0);
}