
// Nicks Vector manipulation library.

export function Vector(a, b) {
	this.x = a || 0;
	this.y = b || 0
}
Vector.prototype.setXY = function (a, b) {
	this.x = a;
	this.y = b;
	return this
}
	;
Vector.prototype.fromVector = function (a) {
	this.x = a.x;
	this.y = a.y;
	return this
}
	;
Vector.prototype.fromVectorMinusVector = function (a, b) {
	this.x = a.x - b.x;
	this.y = a.y - b.y;
	return this
}
	;
Vector.prototype.fromVectorMidpoint = function (a, b) {
	this.x = (a.x + b.x) / 2;
	this.y = (a.y + b.y) / 2;
	return this
}
	;
Vector.prototype.fromAngLen = function (a, b) {
	this.x = Math.cos(a) * b;
	this.y = Math.sin(a) * b;
	return this
}
	;
Vector.prototype.copy = function () {
	return new Vector(this.x, this.y)
}
	;
Vector.prototype.equals = function (a) {
	return this.x == a.x && this.y == a.y
}
	;
Vector.prototype.plus = function (a) {
	this.x += a.x;
	this.y += a.y;
	return this
}
	;
Vector.prototype.add = Vector.prototype.plus;
Vector.prototype.plusScaled = function (a, b) {
	this.x += a.x * b;
	this.y += a.y * b;
	return this
}
	;
Vector.prototype.addScaled = Vector.prototype.plusScaled;
Vector.prototype.lerpTo = function (a, b) {
	this.x += (a.x - this.x) * b;
	this.y += (a.y - this.y) * b;
	return this
}
	;
Vector.prototype.minus = function (a) {
	this.x -= a.x;
	this.y -= a.y;
	return this
}
	;
Vector.prototype.subtract = Vector.prototype.minus;
Vector.prototype.minusDot = function (a, b) {
	return (this.x - a.x) * b.x + (this.y - a.y) * b.y
}
	;
Vector.prototype.scalar = function (a) {
	this.x *= a;
	this.y *= a;
	return this
};

Vector.prototype.scalar_divide = function (a) {
	this.x /= a;
	this.y /= a;
	return this;
};

Vector.prototype.dot = function (a) {
	return this.x * a.x + this.y * a.y
}
	;
Vector.prototype.left = function () {
	var a = this.y;
	this.y = this.x;
	this.x = -a;
	return this
}
	;
Vector.prototype.right = function () {
	var a = this.y;
	this.y = -this.x;
	this.x = a;
	return this
}
	;
Vector.prototype.unit = function () {
	var a = this.len;
	this.x /= a;
	this.y /= a;
	return this
}
	;
Vector.prototype.cross = function (a) {
	return this.x * a.y - this.y * a.x
}
	;
Vector.prototype.distanceTo = function (a) {
	var b = this.x - a.x;
	a = this.y - a.y;
	return Math.sqrt(b * b + a * a)
};

Vector.prototype.distanceSquaredTo = function (a) {
	return (this.x - a.x) * (this.x - a.x) + (this.y - a.y) * (this.y - a.y)
};

Object.defineProperty(Vector.prototype, "lenSquared", {
	get: function () {
		return this.x * this.x + this.y * this.y
	}
});
Object.defineProperty(Vector.prototype, "len", {
	get: function () {
		return Math.sqrt(this.lenSquared)
	}
});
Object.defineProperty(Vector.prototype, "ang", {
	get: function () {
		return Math.atan2(this.y, this.x)
	}
});
Vector.prototype.toString = function () {
	return "[" + this.x.toFixed(2) + " " + this.y.toFixed(2) + "]"
}
	;
Vector.from_array = function (a) {
	return new Vector(a[0], a[1])
}
