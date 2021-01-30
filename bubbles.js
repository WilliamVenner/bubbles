const SUNBEAMS_FRAG_SRC = `
precision mediump float;

varying vec2 fTextureCoord;
uniform vec2 dimensions;

uniform vec2 light;
uniform bool parallel;
uniform float aspect;

uniform float gain;
uniform float lacunarity;
uniform float time;

// 3D gradient Noise
// MIT License
// Copyright © 2013 Inigo Quilez
// https://www.shadertoy.com/view/Xsl3Dl

vec3 hash(vec3 p) {
	p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)),
			dot(p, vec3(113.5, 271.9, 124.6)));

	return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(in vec3 p) {
	vec3 i = floor(p);
	vec3 f = fract(p);

	vec3 u = f * f * (3.0 - 2.0 * f);

	return mix(
		mix(mix(dot(hash(i + vec3(0.0, 0.0, 0.0)), f - vec3(0.0, 0.0, 0.0)),
				dot(hash(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0)), u.x),
			mix(dot(hash(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0)),
				dot(hash(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0)), u.x),
			u.y),
		mix(mix(dot(hash(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0)),
				dot(hash(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0)), u.x),
			mix(dot(hash(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0)),
				dot(hash(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0)), u.x),
			u.y),
		u.z);
}

float turb(vec3 pos, float lacunarity, float gain ) {
	float f, totalGain;
	totalGain = gain;
	vec3 q = 2.0 * pos;
	f = totalGain * noise(q);
	q = q * 2.01 * lacunarity;
	totalGain *= gain;
	f += totalGain * noise(q);
	q = q * 3.02 * lacunarity;
	totalGain *= gain;
	f += totalGain * noise(q);
	q = q * 3.03 * lacunarity;
	totalGain *= gain;
	f += totalGain * noise(q);
	q = q * 3.01 * lacunarity;
	totalGain *= gain;
	f += totalGain * noise(q);
	q = q * 3.99 * lacunarity;
	totalGain *= gain;
	f += totalGain * noise(q);
	q = q * 3.98 * lacunarity;
	totalGain *= gain;
	f += totalGain * noise(q);
	f = 2.0 * f;
	return abs(f);
}

void main(void) {
	float d = 0.0;
	vec2 coord = gl_FragCoord.xy / dimensions.xy;
	if (parallel) {
		float _cos = light.x;
		float _sin = light.y;
		d = (_cos * coord.x) + (_sin * coord.y * aspect);
	} else {
		float dx = coord.x - light.x / dimensions.x;
		float dy = (coord.y - light.y / dimensions.y) * aspect;
		float dis = sqrt(dx * dx + dy * dy) + 0.00001;
		d = dy / dis;
	}
	vec2 dir = vec2(d, d);
	float noise = turb(vec3(dir, 0.0) + vec3(time, 0.0, 62.1 + time) * 0.1, lacunarity, gain);
	
	vec4 mist = vec4(0.0, 0.0, 0.0, noise * coord * .5);
	noise = mix(noise, 0.0, 0.6);
	//mist *= 1.0 - coord.y;
	mist = clamp(mist, 0.0, 1.0);

	gl_FragColor = vec4(1.0, 1.0, 1.0, 0.0);
	gl_FragColor += mist;
}
`;

const SUNBEAMS_VERT_SRC = `
attribute vec2 aVertexPositions;
void main() {
	gl_Position = vec4(aVertexPositions, 0.0, 1.0);
}
`;

const SUNBEAMS_UNIFORMS = {
	angle: {
		type: "1f",
		value: 15.0
	},
	time: {
		type: "1f",
		value: 0.0
	},
	lacunarity: {
		type: "1f",
		value: 1.0
	},
	gain: {
		type: "1f",
		value: .3
	},
	parallel: {
		type: "1i",
		value: true
	},
	light: {
		type: "2fv",
		value: [
			-Math.cos(-45.0 * Math.PI / 180.0),
			Math.sin(-45.0 * Math.PI / 180.0)
		]
	},
	dimensions: {
		type: "2fv",
		value: [0.0, 0.0]
	},
	aspect: {
		type: "1f",
		value: 1.0
	}
};

const pi2 = 2 * Math.PI;

const MIN_CPU_BUBBLES = 50; // Minimum number of bubbles (for the worst of computers)
const MAX_CPU_BUBBLES = 400; // Maximum number of bubbles (for the best of computers)
const CPU_CORES_BUBBLES = 8; // CPU logical cores count required for maximum bubbles
const CPU_BUBBLES_RATIO = CPU_CORES_BUBBLES / MAX_CPU_BUBBLES;

const MAX_BUBBLES = Math.min(
	(window.navigator.hardwareConcurrency / CPU_BUBBLES_RATIO) *
		(MAX_CPU_BUBBLES - MIN_CPU_BUBBLES) +
		MIN_CPU_BUBBLES,
	MAX_CPU_BUBBLES
);
const MIN_BUBBLE_SIZE = 5;
const MAX_BUBBLE_SIZE = 10;

// The minimum lifetime of a bubble divided by the canvas height (px) you are testing on
// This keeps the velocity of bubbles proportional to the canvas height, i.e. height ambiguous
const LIFETIME_HEIGHT_RATIO = 5000 / 300;

class Bubble {
	static random(min, max) {
		return Math.floor(
			Math.random() * (Math.round(max) - Math.round(min) + 1) + Math.round(min)
		);
	}

	static easeInSine(f) {
		return 1 - Math.cos((f * Math.PI) / 2);
	}

	static easeInOutSine(f) {
		return -(Math.cos(Math.PI * f) - 1) / 2;
	}

	static getLifeTime(height) {
		return Bubble.random(
			height * LIFETIME_HEIGHT_RATIO,
			height * LIFETIME_HEIGHT_RATIO * 2
		);
	}

	static getSize() {
		return Bubble.random(MIN_BUBBLE_SIZE, MAX_BUBBLE_SIZE);
	}

	static getAlpha() {
		return Bubble.random(20, 70) / 100;
	}

	static getPos(width, height, size) {
		return { x: Bubble.random(0, width), y: size * 2 };
	}

	static getWobbleCoefficient() {
		return Bubble.random(-100, 100) / 10;
	}

	constructor(lifeStart, bubbles) {
		this.bubbles = bubbles;
		this.canvas = this.bubbles.canvas;
		this.ctx = this.bubbles.ctx;

		this.alpha = Bubble.getAlpha();
		this.size = Bubble.getSize();
		this.pos = Bubble.getPos(this.bubbles.width, this.bubbles.height, this.size);
		this.wobbleCoefficient = Bubble.getWobbleCoefficient();

		this.lifeStart = lifeStart;
		this.lifeTime = Bubble.getLifeTime(this.bubbles.height);
		if (this.bubbles.firstSpawn) {
			this.lifeStart -= this.lifeTime * (Bubble.random(0, 100) / 100);
		}
	}

	getTimeFrac(timeStamp) {
		return (timeStamp - this.lifeStart) / this.lifeTime;
	}

	getWobble(timeFrac) {
		return this.size * Math.sin(timeFrac * pi2) * this.wobbleCoefficient;
	}

	draw(timeFrac) {
		let riseHeight = this.bubbles.height + this.size / 2 + this.pos.y;
		let x = this.pos.x + this.getWobble(timeFrac);
		let y = this.bubbles.height + this.pos.y - Bubble.easeInSine(timeFrac) * riseHeight;
		let floorDist = Math.min(Math.max((this.bubbles.height - y) / (this.bubbles.height * 0.1), 0), 1);

		this.ctx.beginPath();
		this.ctx.arc(x, y, this.size / 2, 0, pi2);
		this.ctx.fillStyle = "rgba(0, 127, 255, " + this.alpha * floorDist + ")";
		this.ctx.fill();
	}
}

class Bubbles {
	static forEach(canvases) {
		let bubbles = [];
		for (let i = 0; i < canvases.length; i++)
			bubbles.push(new Bubbles(canvases[i]));
		return bubbles;
	}

	static isVisible() {
		if ("visibilityState" in document)
			return document.visibilityState !== "hidden";
		if ("hidden" in document) return !document.hidden;
		return true;
	}

	constructor(container) {
		this.firstSpawn = true;
		this.bubbles = [];

		this.sunbeams = document.createElement("canvas");
		container.appendChild(this.sunbeams);
		this.webgl = this.sunbeams.getContext("webgl", { premultipliedAlpha: false });
		this.initSunbeams();

		this.canvas = document.createElement("canvas");
		container.appendChild(this.canvas);
		this.ctx = this.canvas.getContext("2d");

		this.requestAnimationFrame();

		document.addEventListener(
			typeof document.msHidden !== "undefined"
				? "msvisibilitychange"
				: typeof document.webkitHidden !== "undefined"
				? "webkitvisibilitychange"
				: "visibilitychange",
			this.documentVisibilityChange.bind(this),
			false
		);
	}

	requestAnimationFrame() {
		requestAnimationFrame(this.draw.bind(this));
	}

	documentVisibilityChange() {
		if (this.firstSpawn) return;
		this.firstSpawn = true;
		this.bubbles = [];
	}

	calcCanvasSize() {
		const { width, height } = this.canvas.getBoundingClientRect();
		if (this.width !== width || this.height !== height) {
			const scale = window.devicePixelRatio;
			const scaledWidth = Math.floor(width * scale);
			const scaledHeight = Math.floor(height * scale);

			this.sunbeams.width = scaledWidth;
			this.sunbeams.height = scaledHeight;

			this.canvas.width = scaledWidth;
			this.canvas.height = scaledHeight;
			this.ctx.scale(scale, scale);
		}
		this.width = width;
		this.height = height;
	}

	spawnBubble(timeStamp) {
		this.bubbles.push(new Bubble(timeStamp, this));
	}

	spawnBubbles(timeStamp) {
		while (this.bubbles.length < Math.ceil(MAX_BUBBLES / 2)) {
			this.spawnBubble(timeStamp);
		}
	}

	drawBubbles(timeStamp) {
		let i = 0;
		while (i < this.bubbles.length) {
			let bubble = this.bubbles[i];
			let timeFrac = bubble.getTimeFrac(timeStamp);
			if (timeFrac >= 1) {
				this.bubbles.splice(i, 1);
				continue;
			} else if (timeFrac >= 0.5 && !bubble.nextSpawned) {
				bubble.nextSpawned = true;
				this.spawnBubble(timeStamp);
			}

			bubble.draw(timeFrac);
			i++;
		}
	}

	setUniform(name, value) {
		this.webgl["uniform" + SUNBEAMS_UNIFORMS[name].type](this.uniforms[name], value);
	}

	initSunbeams() {
		const vertexShader = this.webgl.createShader(this.webgl.VERTEX_SHADER);
		this.webgl.shaderSource(vertexShader, SUNBEAMS_VERT_SRC);
		this.webgl.compileShader(vertexShader);
		if (!this.webgl.getShaderParameter(vertexShader, this.webgl.COMPILE_STATUS)) {
			console.error("Could not compile WebGL vertex shader. \n\n" + this.webgl.getShaderInfoLog(vertexShader) );
			this.webgl.deleteShader(vertexShader);
			delete this.webgl;
			return;
		}

		const fragShader = this.webgl.createShader(this.webgl.FRAGMENT_SHADER);
		this.webgl.shaderSource(fragShader, SUNBEAMS_FRAG_SRC);
		this.webgl.compileShader(fragShader);
		if (!this.webgl.getShaderParameter(fragShader, this.webgl.COMPILE_STATUS)) {
			console.error("Could not compile WebGL fragment shader. \n\n" + this.webgl.getShaderInfoLog(fragShader));
			this.webgl.deleteShader(fragShader);
			delete this.webgl;
			return;
		}

		const program = this.webgl.createProgram();
		this.webgl.attachShader(program, vertexShader);
		this.webgl.attachShader(program, fragShader);
		this.webgl.linkProgram(program);

		const aVertexPositions = this.webgl.getAttribLocation(program, "aVertexPositions");
		const vertexPositionBuffer = this.webgl.createBuffer();
		this.webgl.bindBuffer(this.webgl.ARRAY_BUFFER, vertexPositionBuffer);
		this.webgl.bufferData(this.webgl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), this.webgl.STATIC_DRAW);
		this.webgl.enableVertexAttribArray(aVertexPositions);
		this.webgl.vertexAttribPointer(aVertexPositions, 2, this.webgl.FLOAT, false, 0, 0);

		if (!this.webgl.getProgramParameter(program, this.webgl.LINK_STATUS)) {
			console.error("Could not compile WebGL program. \n\n" + this.webgl.getProgramInfoLog(program));
			delete this.webgl;
			return;
		}

		this.webgl.useProgram(program);

		this.uniforms = {};
		for (let name in SUNBEAMS_UNIFORMS) {
			let uniformData = SUNBEAMS_UNIFORMS[name];
			this.uniforms[name] = this.webgl.getUniformLocation(program, name);
			this.setUniform(name, uniformData.value);
		}
	}

	drawSunbeams(timeStamp) {
		if (!this.webgl) return;
		
		this.webgl.clearColor(0, 0, 0, 0);
		this.webgl.clear(this.webgl.COLOR_BUFFER_BIT);
		this.webgl.viewport(0, 0, this.width, this.height);

		if (!this.sunbeamsStart) this.sunbeamsStart = timeStamp;
		this.setUniform("time", 0.0002 * timeStamp - this.sunbeamsStart);
		this.setUniform("dimensions", [this.width, this.height]);
		this.setUniform("aspect", this.height / this.width);

		this.webgl.drawArrays(this.webgl.TRIANGLES, 0, 6);
	}

	draw(timeStamp) {
		this.calcCanvasSize();
		this.ctx.clearRect(0, 0, this.width, this.height);

		this.spawnBubbles(timeStamp);
		this.drawBubbles(timeStamp);
		this.firstSpawn = false;

		this.drawSunbeams(timeStamp);

		this.requestAnimationFrame();
	}
}