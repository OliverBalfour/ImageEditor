
/*
 * JavaScript HSV Colour Picker
 * by Oliver Balfour, March 2018
 *
 * Licensed under the zlib license
 *
 */

function ColourPicker (onUpdate, width, height) {

	this.element = document.createElement('div');

	this.canvas = document.createElement('canvas');
	this.ctx = this.canvas.getContext('2d');

	this.indicatorCanvas = document.createElement('canvas');
	this.ictx = this.indicatorCanvas.getContext('2d');

	this.element.appendChild(this.canvas);
	this.element.appendChild(this.indicatorCanvas);

	this.onUpdate = onUpdate;

	this.canvas.width = this.indicatorCanvas.width
		= !isNaN(width) && width > 0 ? Math.round(width) : 128;
	this.canvas.height = this.indicatorCanvas.height
		= !isNaN(height) && height > 0 ? Math.round(height) : this.canvas.width;

	this.hueCircleWidth = Math.min(this.canvas.width, this.canvas.height) / 12;
	this.backgroundColour = '#848380';

	this.mouse = { x: 0, y: 0 };
	// dragging: 'none', 'hue', or 'triangle'
	this.dragging = 'none';
	// number of pixels to give as a margin to avoid antialiased edges being selectable
	this.triangleMargin = 3;

	// hue, 0-360, on the hue circle
	this.hue = 0;
	// x,y point (0-1 scaled across width) on the saturation/lightness triangle
	// indicated by small black/white circle
	this.point = {x: 0.5, y: 0.05}
	this.selectedColour = tinycolor({h: 0, s: 0, l: 0});

	this.imageDataCache = null;
	this.updateImageDataCache = () => this.imageDataCache = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

	this.getColour = () => {
		let m = this.getMeasurements(),
			x = Math.round(m.leftX + this.point.x * m.triangleSideLength),
			y = Math.round(m.topY + this.point.y * (1.5 * m.triangleRadius));

		let i = 4 * (y * this.canvas.width + x);

		return tinycolor({
			r: this.imageDataCache.data[i],
			g: this.imageDataCache.data[i + 1],
			b: this.imageDataCache.data[i + 2],
			a: this.imageDataCache.data[i + 3]
		});
	}

	// this has a margin of error of about 8 per colour channel
	this.setColour = colour => {
		let hsv = colour.toHsv();

		// hue
		this.hue = hsv.h;

		// value
		this.point.y = hsv.v;

		// saturation
		// this is a bit trickier, as saturation is the position horizontally
		// across the triangle at the height/y of the saturation
		this.point.x = (hsv.s / 2) + 0.25;

		this.draw();
		this.update();
	}

	this.updateMouseCoords = event => {
		this.box = this.canvas.getBoundingClientRect();
		this.mouse.x = event.clientX - this.box.left;
		this.mouse.y = event.clientY - this.box.top;
	}

	this.getMeasurements = () => {
		let w = this.canvas.width,
			h = this.canvas.height,
			// smaller and larger dimension
			min = Math.min(w, h),
			max = Math.max(w, h),
			// margin on either side of colour picker
			mx = h < w ? Math.floor((max - min) / 2) : 0,
			my = w < h ? Math.floor((max - min) / 2) : 0,
			hueCircleWidth = this.hueCircleWidth,
			triangleMargin = this.triangleMargin,
			// distance from corner to center of triangle
			// not technically a radius, there's another word for it which I've forgotten
			triangleRadius = Math.floor(min / 2) - hueCircleWidth,
			// `sqrt(3) / 2 * radius` is half the side length of the triangle
			triangleSideLength = Math.sqrt(3) * triangleRadius,
			leftX = w / 2 - triangleSideLength / 2,
			rightX = w / 2 + triangleSideLength / 2,
			topY = my + hueCircleWidth,
			bottomY = (h + triangleRadius) / 2;

		return {
			w, h, min, max, mx, my,
			hueCircleWidth, triangleMargin,
			triangleRadius, triangleSideLength,
			leftX, rightX, topY, bottomY
		};
	}

	// returns true for hit, or a number representing where it missed
	// so don't naively go `if (this.mouseInsideTriangle())`
	// 0 is bounding box, 1 is right edge, 2 is left edge
	this.mouseInsideTriangle = () => {
		let m = this.getMeasurements();

		// if mouse is below bottom of triangle, or too far left or right to possibly collide
		// ie bounding box collision detection
		if (
			this.mouse.y > m.bottomY - m.triangleMargin ||
			this.mouse.x < m.leftX + m.triangleMargin ||
			this.mouse.x > m.rightX - m.triangleMargin ||
			// 2 * margin because otherwise right/left edge detection can throw the indicator outside the margin
			this.mouse.y < m.topY + 2 * m.triangleMargin
		)
			return 0;

		// if the angle from the right bottom corner to the mouse is > 60 degrees
		if (Math.atan(
			(this.mouse.y - m.bottomY)
			/ (this.mouse.x - m.rightX + m.triangleMargin)
		) / Math.PI * 180 > 60)
			return 1;

		// if the angle from the left bottom corner to the mouse is > 60 degrees
		if (Math.atan(
			(this.mouse.y - m.bottomY)
			/ (this.mouse.x - m.leftX - m.triangleMargin)
		) / Math.PI * 180 < -60)
			return 2;

		return true;
	}

	this.draw = () => {
		this.ctx.fillStyle = this.backgroundColour;
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		this.drawCircle();
		this.drawTriangle();
	}

	this.drawCircle = () => {
		let m = this.getMeasurements(),
			segments = m.max * 4;

		this.ctx.lineWidth = m.hueCircleWidth;

		// draw circle; composed of a few hundred small stroked arcs of different colours
		for (let i = 0; i <= 2 * Math.PI; i += Math.PI / segments) {
			this.ctx.strokeStyle = tinycolor({ h: i / Math.PI * 180, s: 100, l: 50 }).toHslString();
			this.ctx.beginPath();
			this.ctx.arc(
				Math.floor(m.w / 2), Math.floor(m.h / 2),
				Math.floor(m.min / 2) - m.hueCircleWidth / 2,
				i, i + Math.PI / segments + 0.01
			);
			this.ctx.stroke();
			this.ctx.closePath();
		}

		this.drawIndicators();
		this.updateImageDataCache();
	}

	this.drawTriangle = () => {
		let m = this.getMeasurements(),
			// extra margin to ensure edge colours are selectable
			margin = m.triangleMargin + 4;

		const fillTriangle = fill => {
			this.ctx.fillStyle = fill;
			this.ctx.beginPath();
			this.ctx.moveTo(m.w / 2, m.topY);
			this.ctx.lineTo(m.leftX, m.bottomY);
			this.ctx.lineTo(m.rightX, m.bottomY);
			this.ctx.fill();
			this.ctx.closePath();
		}

		// clear old triangle
		this.ctx.fillStyle = this.backgroundColour;
		this.ctx.beginPath();
		this.ctx.arc(m.w / 2, m.h / 2, m.triangleRadius, 0, Math.PI * 2);
		this.ctx.fill();
		this.ctx.closePath();
		fillTriangle('white');

		// draw a one pixel horizontal line gradient between the fully saturated hue and the transparent blended white
		// can't be a standard linear gradient, that only works with square pickers
		for (let i = 0; i < m.triangleRadius * 1.5 + 1; i++) {
			// see code in this.update() for maths explanation etc.
			let x = i / Math.sqrt(3),
				y = i + m.h / 2 - m.triangleRadius;

			// draw saturation gradient
			const saturationGradient = this.ctx.createLinearGradient(
				m.w / 2 + x - m.triangleMargin, y,
				m.w / 2 - x + m.triangleMargin, y
			);

			// at the very top, the gradient is rendered backwards without this check
			if (x < m.triangleMargin) {
				saturationGradient.addColorStop(1, tinycolor({ h: this.hue, s: 100, l: 50, a: 1 }).toHslString());
				saturationGradient.addColorStop(0, tinycolor({ h: this.hue, s: 100, l: 50, a: 0 }).toHslString());
			} else {
				saturationGradient.addColorStop(0, tinycolor({ h: this.hue, s: 100, l: 50, a: 1 }).toHslString());
				saturationGradient.addColorStop(1, tinycolor({ h: this.hue, s: 100, l: 50, a: 0 }).toHslString());
			}

			this.ctx.fillStyle = saturationGradient;
			this.ctx.beginPath();
			this.ctx.fillRect(m.w / 2 - x, Math.round(y), 2 * x, 1);
			this.ctx.closePath();
		}

		// draw lightness gradient over the top
		const lightnessGradient = this.ctx.createLinearGradient(
			0, m.topY + margin,
			0, m.bottomY - margin
		);
		lightnessGradient.addColorStop(0, 'rgba(0, 0, 0, 1');
		lightnessGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
		fillTriangle(lightnessGradient);

		this.drawIndicators();
		this.updateImageDataCache();
	}

	this.drawIndicators = () => {
		let m = this.getMeasurements();
		this.ictx.clearRect(0, 0, this.indicatorCanvas.width, this.indicatorCanvas.height);

		// hue indicator
		let theta = this.hue / 180 * Math.PI;
		this.ictx.strokeStyle = 'black';
		this.ictx.lineWidth = 1;
		this.ictx.beginPath();
		this.ictx.moveTo(
			Math.cos(theta) * m.triangleRadius + m.w / 2,
			Math.sin(theta) * m.triangleRadius + m.h / 2
		);
		this.ictx.lineTo(
			Math.cos(theta) * (m.triangleRadius + m.hueCircleWidth) + m.w / 2,
			Math.sin(theta) * (m.triangleRadius + m.hueCircleWidth) + m.h / 2
		);
		this.ictx.stroke();

		// triangle indicator
		let ix = m.leftX + this.point.x * m.triangleSideLength,
			iy = m.topY + this.point.y * (1.5 * m.triangleRadius);

		this.ictx.strokeStyle = 'white';
		this.ictx.beginPath();
		this.ictx.arc(ix, iy, 4, 0, 2 * Math.PI);
		this.ictx.stroke();
		this.ictx.strokeStyle = 'black';
		this.ictx.beginPath();
		this.ictx.arc(ix, iy, 5, 0, 2 * Math.PI);
		this.ictx.stroke();
	}

	this.update = () => {
		if (this.dragging === 'hue') {
			let x = this.mouse.x - this.canvas.width / 2,
				y = this.mouse.y - this.canvas.height / 2;

			this.hue = Math.atan2(y, x) * 180 / Math.PI;
			if (this.hue < 0)
				this.hue += 360;

			this.drawTriangle();

		} else if (this.dragging === 'triangle') {

			let m = this.getMeasurements();

			let code = this.mouseInsideTriangle();
			if (code !== true) {
				if (code === 0) {
					if (this.mouse.y > m.bottomY - m.triangleMargin)
						this.mouse.y = m.bottomY - m.triangleMargin;
					if (this.mouse.y < m.topY + 2 * m.triangleMargin)
						this.mouse.y = m.topY + 2 * m.triangleMargin;
					if (this.mouse.x > m.rightX - m.triangleMargin)
						this.mouse.x = m.rightX - m.triangleMargin - 1;
					if (this.mouse.x < m.leftX + m.triangleMargin)
						this.mouse.x = m.leftX + m.triangleMargin + 1;
					// update to make adjustments for any other collisions
					code = this.mouseInsideTriangle();
				}
				if (code === 1) {
					// the formula for the right edge line is
					// x = y / sqrt(3)
					this.mouse.x = m.w / 2 + (this.mouse.y - m.h / 2 + m.triangleRadius) / Math.sqrt(3) - m.triangleMargin;
				} else if (code === 2) {
					this.mouse.x = m.w / 2 - (this.mouse.y - m.h / 2 + m.triangleRadius) / Math.sqrt(3) + m.triangleMargin;
				}
			}

			this.point.x = (this.mouse.x - m.leftX) / m.triangleSideLength;
			this.point.y = (this.mouse.y - m.topY) / (1.5 * m.triangleRadius);

			this.drawIndicators();
		}

		this.selectedColour = this.getColour();
		if (this.onUpdate)
			this.onUpdate(this.selectedColour);
	}

	this.indicatorCanvas.addEventListener('mousedown', event => {
		this.updateMouseCoords(event);

		let x = this.mouse.x - this.canvas.width / 2,
			y = this.mouse.y - this.canvas.height / 2,
			// distance from corner to center of triangle
			triangleRadius = Math.floor(Math.min(this.canvas.width, this.canvas.height) / 2) - this.hueCircleWidth;

		if (this.mouseInsideTriangle() === true)
			this.dragging = 'triangle';
		else if (Math.hypot(x, y) > triangleRadius && Math.hypot(x, y) < triangleRadius + this.hueCircleWidth)
			this.dragging = 'hue';
		else
			this.dragging = 'none';

		if (this.dragging !== 'none')
			this.update();
	});
	this.indicatorCanvas.addEventListener('mouseup', event => {
		this.updateMouseCoords(event);

		if (this.dragging !== 'none')
			this.update();

		this.dragging = 'none';
	});
	this.indicatorCanvas.addEventListener('mousemove', event => {
		this.updateMouseCoords(event);

		if (this.dragging !== 'none')
			this.update();
	});

	// init
	this.draw();
	this.updateImageDataCache();

}
