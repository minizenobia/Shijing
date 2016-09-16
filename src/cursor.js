import events from 'events';
import Caret from './caret';

class Cursor extends events.EventEmitter {

	constructor(renderer) {
		super();

		this.ctx = renderer.shiji;
		this.renderer = renderer;
		this.startOffset = -1;
		this.startNode = null;
		this.endNode = null;
		this.endOffset = null;
		this.baseline = null;
		this.$dom = $('<div>')
			.addClass('shiji-cursor')
			.css({
				position: 'absolute',
				top: 0,
				left: 0,
				zIndex: 10000
			});

		this.caret = new Caret();
		this.caret.$dom.appendTo(this.$dom);

		renderer.shiji.$overlay.append(this.$dom);
	}

	update() {

		// Figure out position
		var caret = this.startNode.component.getCaret(this.startOffset);

		this.caret.move(caret.x, caret.y);
		this.caret.setStyle(Object.assign({
			height: caret.height,
			fontSize: $(caret.DOM).css('font-size')
		}, this.startNode.style || {}));

		this.emit('update', this);
	}

	_setPosition(node, offset) {
		this.startOffset = offset;

		// Change component
		var old = this.startNode;
		this.startNode = node;

		var changed = false;
		if (old && this.startNode) {
			if (old.id != this.startNode.id) {
				changed = true;
			}
		} else if (old != this.startNode) {
			changed = true;
		}

		if (changed) {

			// fire events
			if (old) {
				old.component.onBlur(this);
			}

			// trigger onFocus
			if (this.startNode) {
				this.startNode.component.onFocus(this);
			}
		}

		setTimeout(function() {
			this.emit('update', this);
		}.bind(this), 0);

	}

	setPosition(node, offset) {

		// Figure out position
		var caret = node.component.getCaret(offset);
console.log(caret);
		this.caret.move(caret.x, caret.y);

		this._setPosition(node, offset);

		this.caret.setStyle(Object.assign({
			height: caret.height,
			fontSize: $(caret.DOM).css('font-size')
		}, node.style || {}));
	}

	_setPositionByAxis(x, y) {
		var range = document.caretRangeFromPoint(x, y);
		var textNode = range.startContainer;
		var offset = this.startOffset = range.startOffset;

		range.detach();
		
		// We don't need text node, just getting its parent
		var parentNode = textNode;
		if (textNode.nodeType == Node.TEXT_NODE) {
			parentNode = textNode.parentNode;
		}

		// Set position
		this.setPositionByDOM(parentNode, offset);
	}

	setPositionByAxis(x, y) {
		this.baseline = null;
		this._setPositionByAxis(x, y);
	}

	setPositionByDOM(dom, offset) {

		var _offset = offset;

		var point = this.ctx.Misc.figurePosition(dom, offset, this.ctx.$overlay[0]);

		this.caret.move(point.x, point.y);

		// Find out component
		var component =  this.renderer.getOwnerByDOM(dom);
		if (!component)
			return;

		// Getting the correct offset by using DOM and offset of DOM
		_offset = component.getOffset(point.DOM, point.offset);

		// Store it
		this._setPosition(component.node, _offset);

		// Apply styles
		this.caret.setStyle(Object.assign({
			height: point.height,
			fontSize: $(dom).css('font-size')
		}, component.node.style || {}));
	}

	getCurrentPosition() {

		return {
			startNode: this.startNode,
			startOffset: this.startOffset
		};
	}

	findLineViewOwner(node) {

		if (node.component.lineViews) {
			return node;
		}

		var astHandler = this.renderer.shiji.astHandler;
		var parentNode = astHandler.getParentNode(node);
		if (parentNode)
			return this.findLineViewOwner(parentNode);
		else
			return null;
	}

	getLineView() {

		var node = this.findLineViewOwner(this.startNode);
		if (node) {
			// Getting DOM by using startNode and startOffset
			var pos = this.startNode.component.getPosition(this.startOffset);
			var range = document.createRange();

			// Figure line which contains such DOM
			for (var index in node.component.lineViews) {
				var lineView = node.component.lineViews[index];
				range.selectNode(lineView[0]);

				// Found
				if (range.isPointInRange(pos.DOM)) {
					return {
						arr: node.component.lineViews,
						lineView: lineView,
						index: parseInt(index)
					};
				}
			}
		}

		return null;
	}

	moveUp() {

		var y;
		var lineView = this.getLineView();
		if (lineView) {
			// Previous line
			if (lineView.index > 0) {
				var $lineView = lineView.arr[lineView.index - 1];
				y = $lineView.position().top;
			}
		}

		var $container = this.renderer.shiji.$overlay;

		if (this.baseline == null)
			this.baseline = this.caret.x;

		if (y == undefined) {
			y = this.caret.y - this.caret.$dom.height();
			if (y < 0) {
				y = 0;
			}
		}

		this._setPositionByAxis(this.baseline + $container.offset().left, y + $container.offset().top);
	}

	moveDown() {

		var y;
		var lineView = this.getLineView();
		if (lineView) {
			// Next line
			if (lineView.index + 1 <= lineView.arr.length) {
				var $lineView = lineView.arr[lineView.index + 1];
				y = $lineView.position().top;
			}
		}

		var $container = this.renderer.shiji.$overlay;

		if (this.baseline == null)
			this.baseline = this.caret.x;

		if (y == undefined)
			y = this.caret.y + this.caret.$dom.height();

		this._setPositionByAxis(this.baseline + $container.offset().left, y + $container.offset().top);
	}

	move(offset) {

		if (offset == 0)
			return 0;

		this.baseline = null;
console.log('Cursor1', this, this.startNode, this.startOffset, offset);

		// Call start node to move cursor
		var leftOffset = this.startNode.component.move(this, offset);
console.log('MOVED', this, this.startNode, this.startOffset);
		if (leftOffset == 0) {
			return leftOffset;
		}
console.log('Cursor2', this.startNode, leftOffset);
		// Getting target index of childrens
		var astHandler = this.renderer.shiji.astHandler;
		var index = astHandler.getIndex(this.startNode);
		if (index == -1) {
			return 0;
		}

		// Put curosr on parent
		var parentNode = astHandler.getParentNode(this.startNode);
		if (!parentNode)
			return 0;

		console.log('PARENT', parentNode, index, leftOffset);
		if (leftOffset > 0) {
			this.setPosition(parentNode, index + 1);
			leftOffset--;
		} else {
			this.setPosition(parentNode, index);
			leftOffset++;
		}

		parentNode.component.adjustCursorPosition(this, (offset > 0) ? true : false);

		return this.move(leftOffset);
	}

	setEnd(node, offset) {
		this.endNode = node;
		this.endOffset = offset;
		this.emit('update', this);
	}

	show() {
		// Range was selected
		if (this.endNode != null && this.endOffset != null) {
			console.log('RANGEEEE');
			var astHandler = this.renderer.shiji.astHandler;
			astHandler.getAncestorNode(this.startNode, this.endNode);
		}

		this.caret.show();
	}

	hide() {
		this.caret.hide();
	}

}

export default Cursor;
