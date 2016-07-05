function rainbow(a) {
	var hue = Math.floor(Math.random() * 60) * 12;
	var sat = 0.9;
	var lit = 0.6;
	if (!a) {
		sat = 0.0;
		lit = 0.1;
	}
	return $.Color({
		hue: hue,
		saturation: sat,
		lightness: lit,
		alpha: 1
	}).toHexString();
};

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

// Arrowkey controls
window.addEventListener('keyup', function(event) { Key.onKeyup(event); }, false);
window.addEventListener('keydown', function(event) { Key.onKeydown(event); }, false);

var Key = {
  _pressed: {},

  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  
  isDown: function(keyCode) {
	return this._pressed[keyCode];
  },
  
  onKeydown: function(event) {
	this._pressed[event.keyCode] = true;
  },
  
  onKeyup: function(event) {
	delete this._pressed[event.keyCode];
  }
};