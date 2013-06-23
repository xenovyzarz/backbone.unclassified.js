// This is the code that makes the `ui` attribute work. It patches
// a few Backbone View functions so it can perform pattern matching
// for events and grab your ui elements when the main element is changed.

(function() {
	if (typeof Backbone === "undefined") {
		console.error("backbone.unclassified must be included after backbone");
		return;
	}

	function patch(obj, fn, creator) {
		var old = obj[fn];
		obj[fn] = creator(old) || old;
	}

	/**
	 * Converts a hierarchical collection of name -> selector into a
	 * collection of name -> element.
	 */
	function processUiSpec(el, uiMap, spec, path) {
		if (!spec) {
			return undefined;
		} else if (typeof spec === "string") {
			var child = el.find(spec);
			uiMap[path] = child;
			return child;
		}

		var ui = {};

		for (var key in spec) {
			ui[key] = processUiSpec(el, uiMap, spec[key], path ? (path + "." + key) : key);
		}

		return ui;
	}

	// This does the work of using your `ui` object to grab all of the child
	// elements out of the DOM, using whatever DOM library Backbone is using.
	patch(Backbone.View.prototype, "setElement", function(old) {
		return function() {
			var ret = old.apply(this, arguments);
			this._uiMap = {};
			this.ui = processUiSpec(this.$el, this._uiMap, this.constructor.prototype.ui);
			return ret;
		};
	});

	// This does a little work to allow you to use your child element names
	// in your view's `events` object.
	patch(Backbone.View.prototype, "delegateEvents", function(old) {
  		var delegateEventSplitter = /^(\S+)\s*(.*)$/;

		return function(events) {
			if (!(events || (events = _.result(this, 'events')))) return this;

			this.undelegateEvents();

			_.each(events, function(method, key) {
				if (!_.isFunction(method)) method = this[events[key]];
				if (!method) return;

				var match = key.match(delegateEventSplitter);
				var eventName = match[1], selector = match[2];
				method = _.bind(method, this);
				eventName += '.delegateEvents' + this.cid;

				if (selector === '') {
					this.$el.on(eventName, method);
				} else if (this.ui && selector in this._uiMap) {
					// This is the only part that has changed. It checks to see if
					// your selector
					this._uiMap[selector].on(eventName, method);
				} else {
					this.$el.on(eventName, selector, method);
				}
			}, this);

			return this;
		};
	});
}());
