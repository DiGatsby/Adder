function Game() { };

var width = 1200,
	height = 700;

var svg = d3.select("svg")
			.attr("width", width)
			.attr("height", height);

var lineFunction = d3.svg.line()
						.defined(function(d) { return d.y!=null; })
						.x(function(d) { return d.x; })
						.y(function(d) { return d.y; });
						

var players = [];
var me = "";
var sendUpdate = false;

// local head position
var hx = 0,
	hy = 0,
	whx = 0,
	why = 0;

Game.prototype.handleNetwork = function(socket) {  
	// Data about Yourself
	socket.on('y', function(player) {
		me = player.id;
		color = rainbow(player.alive);
		players[player.id] = {
			id: player.id,
			nick: player.nick,
			a: player.a,
			length: player.length,
			
			lineData: player.lineData,
			path: svg.append("path")
						.attr("d", lineFunction(player.lineData))
                        .attr("stroke", color)
                        .attr("stroke-width", 2)
                        .attr("fill", "none")
						.attr("id", player.id.slice(-4)),
						
			head: svg.append("circle")
						.attr("cx", player.lineData[player.lineData.length - 1].x)
						.attr("cy", player.lineData[player.lineData.length - 1].y)
						.attr("r", 2)
						.attr("fill", color)
						.attr("id", player.id.slice(-4)),					
			
			alive: player.alive
		}
	});
	
	// Data about a New player
	socket.on('n', function(player) {
		color = rainbow(player.alive);
		players[player.id] = {
			id: player.id,
			nick: player.nick,
			a: player.a,
			length: player.length,
			
			lineData: player.lineData,
			path: svg.append("path")
						.attr("d", lineFunction(player.lineData))
                        .attr("stroke", color)
                        .attr("stroke-width", 2)
                        .attr("fill", "none")
						.attr("id", player.id.slice(-4)),
						
			head: svg.append("circle")
						.attr("cx", player.lineData[player.lineData.length - 1].x)
						.attr("cy", player.lineData[player.lineData.length - 1].y)
						.attr("r", 2)
						.attr("fill", color)
						.attr("id", player.id.slice(-4)),
						
			alive: player.alive
		}
		
	});
	
	socket.on('nick', function(data) {
		players[data.id].nick = data.nick;
	});
	
	socket.on('s', function(data) {
		players[data.id].length = data.l;
		
		// Holy shit, what a lazy way to do this
		$("#scoreboard").empty();
		for(var key in players) {	
			if (players.hasOwnProperty(key)) {
				$("#scoreboard").append("<p>" + players[key].nick + "(" + players[key].length + ")</p>");
			}
		}	
	});	
	
	// Fix last segment for player of this id
	socket.on('f', function(id) {
		var lineData = players[id].lineData;
		players[id].lineData.push(lineData[lineData.length - 1]);
	});
	
	// Update last item of lineData
	socket.on('u', function(data) {
		players[data.id].lineData[players[data.id].lineData.length - 1] = data.ld;
		players[data.id].path.attr("d", lineFunction(players[data.id].lineData));
	});
	
	// Head position
	socket.on('h', function(data) {
		if (data.id == me) {
			hx = data.ld.x;
			hy = data.ld.y;
		}
		players[data.id].head.attr("cx", data.ld.x).attr("cy", data.ld.y);
	});	

	// Push data for player of this id
	socket.on('p', function(data) {
		players[data.id].lineData.push(data.ld);
	});
	
	// Player Died
	socket.on('d', function(id) {
		players[id].alive = false;
		if (id != me) {
			$("svg").find("#" + id.slice(-4)).remove();
			//$("#"+id.slice(-4)).remove();
		} else {
			socket.disconnect();
		}
	});	
	

}

Game.prototype.netLoop = function() {
	if (sendUpdate) {
		socket.emit('a', players[me].a);
		sendUpdate = false;
	}
}

Game.prototype.logicLoop = function() {
	if (Key.isDown(Key.LEFT)) {
		players[me].a += 0.1;
		sendUpdate = true;
		//lineData.push({"x": player.x, "y": player.y});
	}
	if (Key.isDown(Key.RIGHT)) {
		players[me].a -= 0.1;
		sendUpdate = true;
		//lineData.push({"x": player.x, "y": player.y});
	}
	
	if (players[me].alive) {
		hx += 2.5 * Math.sin(players[me].a);
		hy += 2.5 * Math.cos(players[me].a);
		players[me].head.attr("cx", hx).attr("cy", hy);
	}
}
