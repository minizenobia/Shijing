import events from 'events';
import Renderer from './renderer';
import Input from './input';
import Misc from './Misc';
import Actions from './Actions';
import History from './History';
import treeOperator from './TreeOperator';
import DocumentTree from './DocumentTree';
import InputManager from './InputManager';

require('./css/main.css');
require('./css/loader.css');

class Shijing extends events.EventEmitter {

	constructor(el) {
		super();

		this.actions = new Actions(this);
		this.history = new History(this);
		this.documentTree = new DocumentTree();
		this.inputs = new InputManager();

		// APIs
		this.Misc = new Misc(this);

		// Paper
		this.paperSettings = {
			width: 0,
			height: 0
		};

		// DOMs
		this.$origin = $(el);
		this.$container = $('<div>')
			.css({
				paddingTop: '20px',
				paddingBottom: '20px',
				background: '#eeeeee',
				overflowY: 'auto',
				textAlign: 'center'
			})
			.outerHeight(this.$origin.height());
		this.$layout = $('<div>')
			.css({
				display: 'inline-block',
				position: 'relative',
				background: '#ffffff',
				boxShadow: '0 0 3px rgba(0,0,0,.1)',
				padding: '80px'
			})
			.outerHeight(this.$origin.height())
			.outerWidth(800);
		this.$overlay = $('<div>')
			.css({
				position: 'absolute',
				textAlign: 'initial',
				pointerEvents: 'none'
			})
			.outerWidth(this.$layout.width());
		this.$workarea = $('<div>')
			.addClass('shijing-workarea')
			.css({
				position: 'absolute',
				textAlign: 'initial'
			})
			.outerWidth(this.$layout.width());
		
		this.$origin.append(this.$container)
		this.$container
			.append(this.$layout);
		this.$layout
			.append(this.$workarea)
			.append(this.$overlay)

		this.renderer = new Renderer(this);

		// Input for user who stay in front of screen
		var input = new Input(this);
		this.inputs.add(input);

		this.render();
	}

	setPaperSize(width, height) {
		this.paperSettings.width = width;
		this.paperSettings.height = height;

		this.$layout
			.outerHeight(height)
			.outerWidth(width);

		this.$workarea
			.outerHeight(this.$layout.height())
			.outerWidth(this.$layout.width());

		this.$overlay
			.outerHeight(this.$layout.height())
			.outerWidth(this.$layout.width());

		this.emit('pagerSizeChanged', width, height);
	}

	setPaperMargin(margin) {

		if (!(margin instanceof Object)) {
			this.paperSettings.margins = {
				top: margin,
				bottom: margin,
				left: margin,
				right: margin
			};

			this.$layout.css({
				'padding': margin
			});

			return;
		}

		this.paperSettings.margins = margin;

		this.$layout.css({
			'padding-top': margin.top,
			'padding-bottom': margin.bottom,
			'padding-left': margin.left,
			'padding-right': margin.right,
		});
	}

	dispatch(action, internal) {

		return this.actions.dispatch(action, internal || false);
	}

	load(source) {
		this.documentTree.load(source);

		return this.render();
	}

	getSource() {
		return this.documentTree.ast;
	}

	render() {

		var root = this.documentTree.getRoot();

		// initializing default width to fit container size
		treeOperator.setStyle(root, {
			width: this.$layout.width()
		});

		return new Promise((resolve, reject) => {

			this.renderer.render(root)
				.then(async (rootComponent) => {

					// It's time to update root component
					rootComponent.on('update', () => {

						this.$workarea
							.empty()
							.append(rootComponent.dom);
					});

					// Put root DOM to workarea
					this.$workarea
						.empty()
						.append(rootComponent.dom);

					await rootComponent.componentDidMount();

					resolve();
				})
				.catch(reject);
		});
	}
}

export default Shijing;
