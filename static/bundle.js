
(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
var app = (function () {
	'use strict';

	function noop() {}

	function assign(tar, src) {
		for (const k in src) tar[k] = src[k];
		return tar;
	}

	function add_location(element, file, line, column, char) {
		element.__svelte_meta = {
			loc: { file, line, column, char }
		};
	}

	function run(fn) {
		return fn();
	}

	function blank_object() {
		return Object.create(null);
	}

	function run_all(fns) {
		fns.forEach(run);
	}

	function is_function(thing) {
		return typeof thing === 'function';
	}

	function safe_not_equal(a, b) {
		return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}

	function validate_store(store, name) {
		if (!store || typeof store.subscribe !== 'function') {
			throw new Error(`'${name}' is not a store with a 'subscribe' method`);
		}
	}

	function subscribe(component, store, callback) {
		const unsub = store.subscribe(callback);

		component.$$.on_destroy.push(unsub.unsubscribe
			? () => unsub.unsubscribe()
			: unsub);
	}

	function create_slot(definition, ctx, fn) {
		if (definition) {
			const slot_ctx = get_slot_context(definition, ctx, fn);
			return definition[0](slot_ctx);
		}
	}

	function get_slot_context(definition, ctx, fn) {
		return definition[1]
			? assign({}, assign(ctx.$$scope.ctx, definition[1](fn ? fn(ctx) : {})))
			: ctx.$$scope.ctx;
	}

	function get_slot_changes(definition, ctx, changed, fn) {
		return definition[1]
			? assign({}, assign(ctx.$$scope.changed || {}, definition[1](fn ? fn(changed) : {})))
			: ctx.$$scope.changed || {};
	}

	function append(target, node) {
		target.appendChild(node);
	}

	function insert(target, node, anchor) {
		target.insertBefore(node, anchor || null);
	}

	function detach(node) {
		node.parentNode.removeChild(node);
	}

	function destroy_each(iterations, detaching) {
		for (let i = 0; i < iterations.length; i += 1) {
			if (iterations[i]) iterations[i].d(detaching);
		}
	}

	function element(name) {
		return document.createElement(name);
	}

	function text(data) {
		return document.createTextNode(data);
	}

	function space() {
		return text(' ');
	}

	function empty() {
		return text('');
	}

	function listen(node, event, handler, options) {
		node.addEventListener(event, handler, options);
		return () => node.removeEventListener(event, handler, options);
	}

	function attr(node, attribute, value) {
		if (value == null) node.removeAttribute(attribute);
		else node.setAttribute(attribute, value);
	}

	function set_attributes(node, attributes) {
		for (const key in attributes) {
			if (key === 'style') {
				node.style.cssText = attributes[key];
			} else if (key in node) {
				node[key] = attributes[key];
			} else {
				attr(node, key, attributes[key]);
			}
		}
	}

	function children(element) {
		return Array.from(element.childNodes);
	}

	function set_data(text, data) {
		data = '' + data;
		if (text.data !== data) text.data = data;
	}

	function custom_event(type, detail) {
		const e = document.createEvent('CustomEvent');
		e.initCustomEvent(type, false, false, detail);
		return e;
	}

	let current_component;

	function set_current_component(component) {
		current_component = component;
	}

	function get_current_component() {
		if (!current_component) throw new Error(`Function called outside component initialization`);
		return current_component;
	}

	function onMount(fn) {
		get_current_component().$$.on_mount.push(fn);
	}

	function onDestroy(fn) {
		get_current_component().$$.on_destroy.push(fn);
	}

	function createEventDispatcher() {
		const component = current_component;

		return (type, detail) => {
			const callbacks = component.$$.callbacks[type];

			if (callbacks) {
				// TODO are there situations where events could be dispatched
				// in a server (non-DOM) environment?
				const event = custom_event(type, detail);
				callbacks.slice().forEach(fn => {
					fn.call(component, event);
				});
			}
		};
	}

	function setContext(key, context) {
		get_current_component().$$.context.set(key, context);
	}

	function getContext(key) {
		return get_current_component().$$.context.get(key);
	}

	const dirty_components = [];

	const resolved_promise = Promise.resolve();
	let update_scheduled = false;
	const binding_callbacks = [];
	const render_callbacks = [];
	const flush_callbacks = [];

	function schedule_update() {
		if (!update_scheduled) {
			update_scheduled = true;
			resolved_promise.then(flush);
		}
	}

	function add_render_callback(fn) {
		render_callbacks.push(fn);
	}

	function flush() {
		const seen_callbacks = new Set();

		do {
			// first, call beforeUpdate functions
			// and update components
			while (dirty_components.length) {
				const component = dirty_components.shift();
				set_current_component(component);
				update(component.$$);
			}

			while (binding_callbacks.length) binding_callbacks.shift()();

			// then, once components are updated, call
			// afterUpdate functions. This may cause
			// subsequent updates...
			while (render_callbacks.length) {
				const callback = render_callbacks.pop();
				if (!seen_callbacks.has(callback)) {
					callback();

					// ...so guard against infinite loops
					seen_callbacks.add(callback);
				}
			}
		} while (dirty_components.length);

		while (flush_callbacks.length) {
			flush_callbacks.pop()();
		}

		update_scheduled = false;
	}

	function update($$) {
		if ($$.fragment) {
			$$.update($$.dirty);
			run_all($$.before_render);
			$$.fragment.p($$.dirty, $$.ctx);
			$$.dirty = null;

			$$.after_render.forEach(add_render_callback);
		}
	}

	let outros;

	function group_outros() {
		outros = {
			remaining: 0,
			callbacks: []
		};
	}

	function check_outros() {
		if (!outros.remaining) {
			run_all(outros.callbacks);
		}
	}

	function on_outro(callback) {
		outros.callbacks.push(callback);
	}

	function get_spread_update(levels, updates) {
		const update = {};

		const to_null_out = {};
		const accounted_for = { $$scope: 1 };

		let i = levels.length;
		while (i--) {
			const o = levels[i];
			const n = updates[i];

			if (n) {
				for (const key in o) {
					if (!(key in n)) to_null_out[key] = 1;
				}

				for (const key in n) {
					if (!accounted_for[key]) {
						update[key] = n[key];
						accounted_for[key] = 1;
					}
				}

				levels[i] = n;
			} else {
				for (const key in o) {
					accounted_for[key] = 1;
				}
			}
		}

		for (const key in to_null_out) {
			if (!(key in update)) update[key] = undefined;
		}

		return update;
	}

	function mount_component(component, target, anchor) {
		const { fragment, on_mount, on_destroy, after_render } = component.$$;

		fragment.m(target, anchor);

		// onMount happens after the initial afterUpdate. Because
		// afterUpdate callbacks happen in reverse order (inner first)
		// we schedule onMount callbacks before afterUpdate callbacks
		add_render_callback(() => {
			const new_on_destroy = on_mount.map(run).filter(is_function);
			if (on_destroy) {
				on_destroy.push(...new_on_destroy);
			} else {
				// Edge case - component was destroyed immediately,
				// most likely as a result of a binding initialising
				run_all(new_on_destroy);
			}
			component.$$.on_mount = [];
		});

		after_render.forEach(add_render_callback);
	}

	function destroy(component, detaching) {
		if (component.$$) {
			run_all(component.$$.on_destroy);
			component.$$.fragment.d(detaching);

			// TODO null out other refs, including component.$$ (but need to
			// preserve final state?)
			component.$$.on_destroy = component.$$.fragment = null;
			component.$$.ctx = {};
		}
	}

	function make_dirty(component, key) {
		if (!component.$$.dirty) {
			dirty_components.push(component);
			schedule_update();
			component.$$.dirty = blank_object();
		}
		component.$$.dirty[key] = true;
	}

	function init(component, options, instance, create_fragment, not_equal$$1, prop_names) {
		const parent_component = current_component;
		set_current_component(component);

		const props = options.props || {};

		const $$ = component.$$ = {
			fragment: null,
			ctx: null,

			// state
			props: prop_names,
			update: noop,
			not_equal: not_equal$$1,
			bound: blank_object(),

			// lifecycle
			on_mount: [],
			on_destroy: [],
			before_render: [],
			after_render: [],
			context: new Map(parent_component ? parent_component.$$.context : []),

			// everything else
			callbacks: blank_object(),
			dirty: null
		};

		let ready = false;

		$$.ctx = instance
			? instance(component, props, (key, value) => {
				if ($$.ctx && not_equal$$1($$.ctx[key], $$.ctx[key] = value)) {
					if ($$.bound[key]) $$.bound[key](value);
					if (ready) make_dirty(component, key);
				}
			})
			: props;

		$$.update();
		ready = true;
		run_all($$.before_render);
		$$.fragment = create_fragment($$.ctx);

		if (options.target) {
			if (options.hydrate) {
				$$.fragment.l(children(options.target));
			} else {
				$$.fragment.c();
			}

			if (options.intro && component.$$.fragment.i) component.$$.fragment.i();
			mount_component(component, options.target, options.anchor);
			flush();
		}

		set_current_component(parent_component);
	}

	class SvelteComponent {
		$destroy() {
			destroy(this, true);
			this.$destroy = noop;
		}

		$on(type, callback) {
			const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
			callbacks.push(callback);

			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		$set() {
			// overridden by instance, if it has props
		}
	}

	class SvelteComponentDev extends SvelteComponent {
		constructor(options) {
			if (!options || (!options.target && !options.$$inline)) {
				throw new Error(`'target' is a required option`);
			}

			super();
		}

		$destroy() {
			super.$destroy();
			this.$destroy = () => {
				console.warn(`Component was already destroyed`); // eslint-disable-line no-console
			};
		}
	}

	function noop$1() {}

	function run$1(fn) {
		return fn();
	}

	function run_all$1(fns) {
		fns.forEach(run$1);
	}

	function is_function$1(thing) {
		return typeof thing === 'function';
	}

	function safe_not_equal$1(a, b) {
		return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}

	/**
	 * Creates a `Readable` store that allows reading by subscription.
	 * @param value initial value
	 * @param start start and stop notifications for subscriptions
	 */
	function readable(value, start) {
	    return {
	        subscribe: writable(value, start).subscribe,
	    };
	}
	/**
	 * Create a `Writable` store that allows both updating and reading by subscription.
	 * @param value initial value
	 * @param start start and stop notifications for subscriptions
	 */
	function writable(value, start = noop$1) {
	    let stop;
	    const subscribers = [];
	    function set(new_value) {
	        if (safe_not_equal$1(value, new_value)) {
	            value = new_value;
	            if (!stop) {
	                return; // not ready
	            }
	            subscribers.forEach((s) => s[1]());
	            subscribers.forEach((s) => s[0](value));
	        }
	    }
	    function update(fn) {
	        set(fn(value));
	    }
	    function subscribe$$1(run$$1, invalidate = noop$1) {
	        const subscriber = [run$$1, invalidate];
	        subscribers.push(subscriber);
	        if (subscribers.length === 1) {
	            stop = start(set) || noop$1;
	        }
	        run$$1(value);
	        return () => {
	            const index = subscribers.indexOf(subscriber);
	            if (index !== -1) {
	                subscribers.splice(index, 1);
	            }
	            if (subscribers.length === 0) {
	                stop();
	            }
	        };
	    }
	    return { set, update, subscribe: subscribe$$1 };
	}
	/**
	 * Derived value store by synchronizing one or more readable stores and
	 * applying an aggregation function over its input values.
	 * @param stores input stores
	 * @param fn function callback that aggregates the values
	 * @param initial_value when used asynchronously
	 */
	function derived(stores, fn, initial_value) {
	    const single = !Array.isArray(stores);
	    const stores_array = single
	        ? [stores]
	        : stores;
	    const auto = fn.length < 2;
	    return readable(initial_value, (set) => {
	        let inited = false;
	        const values = [];
	        let pending = 0;
	        let cleanup = noop$1;
	        const sync = () => {
	            if (pending) {
	                return;
	            }
	            cleanup();
	            const result = fn(single ? values[0] : values, set);
	            if (auto) {
	                set(result);
	            }
	            else {
	                cleanup = is_function$1(result) ? result : noop$1;
	            }
	        };
	        const unsubscribers = stores_array.map((store, i) => store.subscribe((value) => {
	            values[i] = value;
	            pending &= ~(1 << i);
	            if (inited) {
	                sync();
	            }
	        }, () => {
	            pending |= (1 << i);
	        }));
	        inited = true;
	        sync();
	        return function stop() {
	            run_all$1(unsubscribers);
	            cleanup();
	        };
	    });
	}

	const LOCATION = {};
	const ROUTER = {};

	/**
	 * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/history.js
	 *
	 * https://github.com/reach/router/blob/master/LICENSE
	 * */

	function getLocation(source) {
	  return {
	    ...source.location,
	    state: source.history.state,
	    key: (source.history.state && source.history.state.key) || "initial"
	  };
	}

	function createHistory(source, options) {
	  const listeners = [];
	  let location = getLocation(source);

	  return {
	    get location() {
	      return location;
	    },

	    listen(listener) {
	      listeners.push(listener);

	      const popstateListener = () => {
	        location = getLocation(source);
	        listener({ location, action: "POP" });
	      };

	      source.addEventListener("popstate", popstateListener);

	      return () => {
	        source.removeEventListener("popstate", popstateListener);

	        const index = listeners.indexOf(listener);
	        listeners.splice(index, 1);
	      };
	    },

	    navigate(to, { state, replace = false } = {}) {
	      state = { ...state, key: Date.now() + "" };
	      // try...catch iOS Safari limits to 100 pushState calls
	      try {
	        if (replace) {
	          source.history.replaceState(state, null, to);
	        } else {
	          source.history.pushState(state, null, to);
	        }
	      } catch (e) {
	        source.location[replace ? "replace" : "assign"](to);
	      }

	      location = getLocation(source);
	      listeners.forEach(listener => listener({ location, action: "PUSH" }));
	    }
	  };
	}

	// Stores history entries in memory for testing or other platforms like Native
	function createMemorySource(initialPathname = "/") {
	  let index = 0;
	  const stack = [{ pathname: initialPathname, search: "" }];
	  const states = [];

	  return {
	    get location() {
	      return stack[index];
	    },
	    addEventListener(name, fn) {},
	    removeEventListener(name, fn) {},
	    history: {
	      get entries() {
	        return stack;
	      },
	      get index() {
	        return index;
	      },
	      get state() {
	        return states[index];
	      },
	      pushState(state, _, uri) {
	        const [pathname, search = ""] = uri.split("?");
	        index++;
	        stack.push({ pathname, search });
	        states.push(state);
	      },
	      replaceState(state, _, uri) {
	        const [pathname, search = ""] = uri.split("?");
	        stack[index] = { pathname, search };
	        states[index] = state;
	      }
	    }
	  };
	}

	// Global history uses window.history as the source if available,
	// otherwise a memory history
	const canUseDOM = Boolean(
	  typeof window !== "undefined" &&
	    window.document &&
	    window.document.createElement
	);
	const globalHistory = createHistory(canUseDOM ? window : createMemorySource());
	const { navigate } = globalHistory;

	/**
	 * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/utils.js
	 *
	 * https://github.com/reach/router/blob/master/LICENSE
	 * */

	const paramRe = /^:(.+)/;

	const SEGMENT_POINTS = 4;
	const STATIC_POINTS = 3;
	const DYNAMIC_POINTS = 2;
	const SPLAT_PENALTY = 1;
	const ROOT_POINTS = 1;

	/**
	 * Check if `string` starts with `search`
	 * @param {string} string
	 * @param {string} search
	 * @return {boolean}
	 */
	function startsWith(string, search) {
	  return string.substr(0, search.length) === search;
	}

	/**
	 * Check if `segment` is a root segment
	 * @param {string} segment
	 * @return {boolean}
	 */
	function isRootSegment(segment) {
	  return segment === "";
	}

	/**
	 * Check if `segment` is a dynamic segment
	 * @param {string} segment
	 * @return {boolean}
	 */
	function isDynamic(segment) {
	  return paramRe.test(segment);
	}

	/**
	 * Check if `segment` is a splat
	 * @param {string} segment
	 * @return {boolean}
	 */
	function isSplat(segment) {
	  return segment[0] === "*";
	}

	/**
	 * Split up the URI into segments delimited by `/`
	 * @param {string} uri
	 * @return {string[]}
	 */
	function segmentize(uri) {
	  return (
	    uri
	      // Strip starting/ending `/`
	      .replace(/(^\/+|\/+$)/g, "")
	      .split("/")
	  );
	}

	/**
	 * Strip `str` of potential start and end `/`
	 * @param {string} str
	 * @return {string}
	 */
	function stripSlashes(str) {
	  return str.replace(/(^\/+|\/+$)/g, "");
	}

	/**
	 * Score a route depending on how its individual segments look
	 * @param {object} route
	 * @param {number} index
	 * @return {object}
	 */
	function rankRoute(route, index) {
	  const score = route.default
	    ? 0
	    : segmentize(route.path).reduce((score, segment) => {
	        score += SEGMENT_POINTS;

	        if (isRootSegment(segment)) {
	          score += ROOT_POINTS;
	        } else if (isDynamic(segment)) {
	          score += DYNAMIC_POINTS;
	        } else if (isSplat(segment)) {
	          score -= SEGMENT_POINTS + SPLAT_PENALTY;
	        } else {
	          score += STATIC_POINTS;
	        }

	        return score;
	      }, 0);

	  return { route, score, index };
	}

	/**
	 * Give a score to all routes and sort them on that
	 * @param {object[]} routes
	 * @return {object[]}
	 */
	function rankRoutes(routes) {
	  return (
	    routes
	      .map(rankRoute)
	      // If two routes have the exact same score, we go by index instead
	      .sort((a, b) =>
	        a.score < b.score ? 1 : a.score > b.score ? -1 : a.index - b.index
	      )
	  );
	}

	/**
	 * Ranks and picks the best route to match. Each segment gets the highest
	 * amount of points, then the type of segment gets an additional amount of
	 * points where
	 *
	 *  static > dynamic > splat > root
	 *
	 * This way we don't have to worry about the order of our routes, let the
	 * computers do it.
	 *
	 * A route looks like this
	 *
	 *  { path, default, value }
	 *
	 * And a returned match looks like:
	 *
	 *  { route, params, uri }
	 *
	 * @param {object[]} routes
	 * @param {string} uri
	 * @return {?object}
	 */
	function pick(routes, uri) {
	  let match;
	  let default_;

	  const [uriPathname] = uri.split("?");
	  const uriSegments = segmentize(uriPathname);
	  const isRootUri = uriSegments[0] === "";
	  const ranked = rankRoutes(routes);

	  for (let i = 0, l = ranked.length; i < l; i++) {
	    const route = ranked[i].route;
	    let missed = false;

	    if (route.default) {
	      default_ = {
	        route,
	        params: {},
	        uri
	      };
	      continue;
	    }

	    const routeSegments = segmentize(route.path);
	    const params = {};
	    const max = Math.max(uriSegments.length, routeSegments.length);
	    let index = 0;

	    for (; index < max; index++) {
	      const routeSegment = routeSegments[index];
	      const uriSegment = uriSegments[index];

	      if (isSplat(routeSegment)) {
	        // Hit a splat, just grab the rest, and return a match
	        // uri:   /files/documents/work
	        // route: /files/* or /files/*splatname
	        const splatName = routeSegment === '*' ? '*' : routeSegment.slice(1);

	        params[splatName] = uriSegments
	          .slice(index)
	          .map(decodeURIComponent)
	          .join("/");
	        break;
	      }

	      if (uriSegment === undefined) {
	        // URI is shorter than the route, no match
	        // uri:   /users
	        // route: /users/:userId
	        missed = true;
	        break;
	      }

	      let dynamicMatch = paramRe.exec(routeSegment);

	      if (dynamicMatch && !isRootUri) {
	        const value = decodeURIComponent(uriSegment);
	        params[dynamicMatch[1]] = value;
	      } else if (routeSegment !== uriSegment) {
	        // Current segments don't match, not dynamic, not splat, so no match
	        // uri:   /users/123/settings
	        // route: /users/:id/profile
	        missed = true;
	        break;
	      }
	    }

	    if (!missed) {
	      match = {
	        route,
	        params,
	        uri: "/" + uriSegments.slice(0, index).join("/")
	      };
	      break;
	    }
	  }

	  return match || default_ || null;
	}

	/**
	 * Check if the `path` matches the `uri`.
	 * @param {string} path
	 * @param {string} uri
	 * @return {?object}
	 */
	function match(route, uri) {
	  return pick([route], uri);
	}

	/**
	 * Add the query to the pathname if a query is given
	 * @param {string} pathname
	 * @param {string} [query]
	 * @return {string}
	 */
	function addQuery(pathname, query) {
	  return pathname + (query ? `?${query}` : "");
	}

	/**
	 * Resolve URIs as though every path is a directory, no files. Relative URIs
	 * in the browser can feel awkward because not only can you be "in a directory",
	 * you can be "at a file", too. For example:
	 *
	 *  browserSpecResolve('foo', '/bar/') => /bar/foo
	 *  browserSpecResolve('foo', '/bar') => /foo
	 *
	 * But on the command line of a file system, it's not as complicated. You can't
	 * `cd` from a file, only directories. This way, links have to know less about
	 * their current path. To go deeper you can do this:
	 *
	 *  <Link to="deeper"/>
	 *  // instead of
	 *  <Link to=`{${props.uri}/deeper}`/>
	 *
	 * Just like `cd`, if you want to go deeper from the command line, you do this:
	 *
	 *  cd deeper
	 *  # not
	 *  cd $(pwd)/deeper
	 *
	 * By treating every path as a directory, linking to relative paths should
	 * require less contextual information and (fingers crossed) be more intuitive.
	 * @param {string} to
	 * @param {string} base
	 * @return {string}
	 */
	function resolve(to, base) {
	  // /foo/bar, /baz/qux => /foo/bar
	  if (startsWith(to, "/")) {
	    return to;
	  }

	  const [toPathname, toQuery] = to.split("?");
	  const [basePathname] = base.split("?");
	  const toSegments = segmentize(toPathname);
	  const baseSegments = segmentize(basePathname);

	  // ?a=b, /users?b=c => /users?a=b
	  if (toSegments[0] === "") {
	    return addQuery(basePathname, toQuery);
	  }

	  // profile, /users/789 => /users/789/profile
	  if (!startsWith(toSegments[0], ".")) {
	    const pathname = baseSegments.concat(toSegments).join("/");

	    return addQuery((basePathname === "/" ? "" : "/") + pathname, toQuery);
	  }

	  // ./       , /users/123 => /users/123
	  // ../      , /users/123 => /users
	  // ../..    , /users/123 => /
	  // ../../one, /a/b/c/d   => /a/b/one
	  // .././one , /a/b/c/d   => /a/b/c/one
	  const allSegments = baseSegments.concat(toSegments);
	  const segments = [];

	  allSegments.forEach(segment => {
	    if (segment === "..") {
	      segments.pop();
	    } else if (segment !== ".") {
	      segments.push(segment);
	    }
	  });

	  return addQuery("/" + segments.join("/"), toQuery);
	}

	/**
	 * Combines the `basepath` and the `path` into one path.
	 * @param {string} basepath
	 * @param {string} path
	 */
	function combinePaths(basepath, path) {
	  return `${stripSlashes(
    path === "/" ? basepath : `${stripSlashes(basepath)}/${stripSlashes(path)}`
  )}/*`;
	}

	/**
	 * Decides whether a given `event` should result in a navigation or not.
	 * @param {object} event
	 */
	function shouldNavigate(event) {
	  return (
	    !event.defaultPrevented &&
	    event.button === 0 &&
	    !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
	  );
	}

	/* node_modules/svelte-routing/src/Router.svelte generated by Svelte v3.4.2 */

	function create_fragment(ctx) {
		var current;

		const default_slot_1 = ctx.$$slots.default;
		const default_slot = create_slot(default_slot_1, ctx, null);

		return {
			c: function create() {
				if (default_slot) default_slot.c();
			},

			l: function claim(nodes) {
				if (default_slot) default_slot.l(nodes);
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				if (default_slot) {
					default_slot.m(target, anchor);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (default_slot && default_slot.p && changed.$$scope) {
					default_slot.p(get_slot_changes(default_slot_1, ctx, changed, null), get_slot_context(default_slot_1, ctx, null));
				}
			},

			i: function intro(local) {
				if (current) return;
				if (default_slot && default_slot.i) default_slot.i(local);
				current = true;
			},

			o: function outro(local) {
				if (default_slot && default_slot.o) default_slot.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (default_slot) default_slot.d(detaching);
			}
		};
	}

	function instance($$self, $$props, $$invalidate) {
		let $base, $location, $routes;

		

	  let { basepath = "/", url = null } = $$props;

	  const locationContext = getContext(LOCATION);
	  const routerContext = getContext(ROUTER);

	  const routes = writable([]); validate_store(routes, 'routes'); subscribe($$self, routes, $$value => { $routes = $$value; $$invalidate('$routes', $routes); });
	  const activeRoute = writable(null);
	  let hasActiveRoute = false; // Used in SSR to synchronously set that a Route is active.

	  // If locationContext is not set, this is the topmost Router in the tree.
	  // If the `url` prop is given we force the location to it.
	  const location =
	    locationContext ||
	    writable(url ? { pathname: url } : globalHistory.location); validate_store(location, 'location'); subscribe($$self, location, $$value => { $location = $$value; $$invalidate('$location', $location); });

	  // If routerContext is set, the routerBase of the parent Router
	  // will be the base for this Router's descendants.
	  // If routerContext is not set, the path and resolved uri will both
	  // have the value of the basepath prop.
	  const base = routerContext
	    ? routerContext.routerBase
	    : writable({
	        path: basepath,
	        uri: basepath
	      }); validate_store(base, 'base'); subscribe($$self, base, $$value => { $base = $$value; $$invalidate('$base', $base); });

	  const routerBase = derived([base, activeRoute], ([base, activeRoute]) => {
	    // If there is no activeRoute, the routerBase will be identical to the base.
	    if (activeRoute === null) {
	      return base;
	    }

	    const { path: basepath } = base;
	    const { route, uri } = activeRoute;
	    // Remove the potential /* or /*splatname from
	    // the end of the child Routes relative paths.
	    const path = route.default ? basepath : route.path.replace(/\*.*$/, "");

	    return { path, uri };
	  });

	  function registerRoute(route) {
	    const { path: basepath } = $base;
	    let { path } = route;

	    // We store the original path in the _path property so we can reuse
	    // it when the basepath changes. The only thing that matters is that
	    // the route reference is intact, so mutation is fine.
	    route._path = path;
	    route.path = combinePaths(basepath, path);

	    if (typeof window === "undefined") {
	      // In SSR we should set the activeRoute immediately if it is a match.
	      // If there are more Routes being registered after a match is found,
	      // we just skip them.
	      if (hasActiveRoute) {
	        return;
	      }

	      const matchingRoute = match(route, $location.pathname);
	      if (matchingRoute) {
	        activeRoute.set(matchingRoute);
	        $$invalidate('hasActiveRoute', hasActiveRoute = true);
	      }
	    } else {
	      routes.update(rs => {
	        rs.push(route);
	        return rs;
	      });
	    }
	  }

	  function unregisterRoute(route) {
	    routes.update(rs => {
	      const index = rs.indexOf(route);
	      rs.splice(index, 1);
	      return rs;
	    });
	  }

	  if (!locationContext) {
	    // The topmost Router in the tree is responsible for updating
	    // the location store and supplying it through context.
	    onMount(() => {
	      const unlisten = globalHistory.listen(history => {
	        location.set(history.location);
	      });

	      return unlisten;
	    });

	    setContext(LOCATION, location);
	  }

	  setContext(ROUTER, {
	    activeRoute,
	    base,
	    routerBase,
	    registerRoute,
	    unregisterRoute
	  });

		let { $$slots = {}, $$scope } = $$props;

		$$self.$set = $$props => {
			if ('basepath' in $$props) $$invalidate('basepath', basepath = $$props.basepath);
			if ('url' in $$props) $$invalidate('url', url = $$props.url);
			if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
		};

		$$self.$$.update = ($$dirty = { $base: 1, $routes: 1, $location: 1 }) => {
			if ($$dirty.$base) { {
	        const { path: basepath } = $base;
	        routes.update(rs => {
	          rs.forEach(r => (r.path = combinePaths(basepath, r._path)));
	          return rs;
	        });
	      } }
			if ($$dirty.$routes || $$dirty.$location) { {
	        const bestMatch = pick($routes, $location.pathname);
	        activeRoute.set(bestMatch);
	      } }
		};

		return {
			basepath,
			url,
			routes,
			location,
			base,
			$$slots,
			$$scope
		};
	}

	class Router extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance, create_fragment, safe_not_equal, ["basepath", "url"]);
		}

		get basepath() {
			throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set basepath(value) {
			throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get url() {
			throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set url(value) {
			throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* node_modules/svelte-routing/src/Route.svelte generated by Svelte v3.4.2 */

	// (35:0) {#if $activeRoute !== null && $activeRoute.route === route}
	function create_if_block(ctx) {
		var current_block_type_index, if_block, if_block_anchor, current;

		var if_block_creators = [
			create_if_block_1,
			create_else_block
		];

		var if_blocks = [];

		function select_block_type(ctx) {
			if (ctx.component !== null) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c: function create() {
				if_block.c();
				if_block_anchor = empty();
			},

			m: function mount(target, anchor) {
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);
				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(changed, ctx);
				} else {
					group_outros();
					on_outro(() => {
						if_blocks[previous_block_index].d(1);
						if_blocks[previous_block_index] = null;
					});
					if_block.o(1);
					check_outros();

					if_block = if_blocks[current_block_type_index];
					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					}
					if_block.i(1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},

			i: function intro(local) {
				if (current) return;
				if (if_block) if_block.i();
				current = true;
			},

			o: function outro(local) {
				if (if_block) if_block.o();
				current = false;
			},

			d: function destroy(detaching) {
				if_blocks[current_block_type_index].d(detaching);

				if (detaching) {
					detach(if_block_anchor);
				}
			}
		};
	}

	// (38:2) {:else}
	function create_else_block(ctx) {
		var current;

		const default_slot_1 = ctx.$$slots.default;
		const default_slot = create_slot(default_slot_1, ctx, null);

		return {
			c: function create() {
				if (default_slot) default_slot.c();
			},

			l: function claim(nodes) {
				if (default_slot) default_slot.l(nodes);
			},

			m: function mount(target, anchor) {
				if (default_slot) {
					default_slot.m(target, anchor);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (default_slot && default_slot.p && changed.$$scope) {
					default_slot.p(get_slot_changes(default_slot_1, ctx, changed, null), get_slot_context(default_slot_1, ctx, null));
				}
			},

			i: function intro(local) {
				if (current) return;
				if (default_slot && default_slot.i) default_slot.i(local);
				current = true;
			},

			o: function outro(local) {
				if (default_slot && default_slot.o) default_slot.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (default_slot) default_slot.d(detaching);
			}
		};
	}

	// (36:2) {#if component !== null}
	function create_if_block_1(ctx) {
		var switch_instance_anchor, current;

		var switch_instance_spread_levels = [
			ctx.routeParams
		];

		var switch_value = ctx.component;

		function switch_props(ctx) {
			let switch_instance_props = {};
			for (var i = 0; i < switch_instance_spread_levels.length; i += 1) {
				switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
			}
			return {
				props: switch_instance_props,
				$$inline: true
			};
		}

		if (switch_value) {
			var switch_instance = new switch_value(switch_props(ctx));
		}

		return {
			c: function create() {
				if (switch_instance) switch_instance.$$.fragment.c();
				switch_instance_anchor = empty();
			},

			m: function mount(target, anchor) {
				if (switch_instance) {
					mount_component(switch_instance, target, anchor);
				}

				insert(target, switch_instance_anchor, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var switch_instance_changes = changed.routeParams ? get_spread_update(switch_instance_spread_levels, [
					ctx.routeParams
				]) : {};

				if (switch_value !== (switch_value = ctx.component)) {
					if (switch_instance) {
						group_outros();
						const old_component = switch_instance;
						on_outro(() => {
							old_component.$destroy();
						});
						old_component.$$.fragment.o(1);
						check_outros();
					}

					if (switch_value) {
						switch_instance = new switch_value(switch_props(ctx));

						switch_instance.$$.fragment.c();
						switch_instance.$$.fragment.i(1);
						mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
					} else {
						switch_instance = null;
					}
				}

				else if (switch_value) {
					switch_instance.$set(switch_instance_changes);
				}
			},

			i: function intro(local) {
				if (current) return;
				if (switch_instance) switch_instance.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				if (switch_instance) switch_instance.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(switch_instance_anchor);
				}

				if (switch_instance) switch_instance.$destroy(detaching);
			}
		};
	}

	function create_fragment$1(ctx) {
		var if_block_anchor, current;

		var if_block = (ctx.$activeRoute !== null && ctx.$activeRoute.route === ctx.route) && create_if_block(ctx);

		return {
			c: function create() {
				if (if_block) if_block.c();
				if_block_anchor = empty();
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				if (ctx.$activeRoute !== null && ctx.$activeRoute.route === ctx.route) {
					if (if_block) {
						if_block.p(changed, ctx);
						if_block.i(1);
					} else {
						if_block = create_if_block(ctx);
						if_block.c();
						if_block.i(1);
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				} else if (if_block) {
					group_outros();
					on_outro(() => {
						if_block.d(1);
						if_block = null;
					});

					if_block.o(1);
					check_outros();
				}
			},

			i: function intro(local) {
				if (current) return;
				if (if_block) if_block.i();
				current = true;
			},

			o: function outro(local) {
				if (if_block) if_block.o();
				current = false;
			},

			d: function destroy(detaching) {
				if (if_block) if_block.d(detaching);

				if (detaching) {
					detach(if_block_anchor);
				}
			}
		};
	}

	function instance$1($$self, $$props, $$invalidate) {
		let $activeRoute;

		

	  let { path = "", component = null } = $$props;

	  const { registerRoute, unregisterRoute, activeRoute } = getContext(ROUTER); validate_store(activeRoute, 'activeRoute'); subscribe($$self, activeRoute, $$value => { $activeRoute = $$value; $$invalidate('$activeRoute', $activeRoute); });

	  const route = {
	    path,
	    // If no path prop is given, this Route will act as the default Route
	    // that is rendered if no other Route in the Router is a match.
	    default: path === ""
	  };
	  let routeParams = {};

	  registerRoute(route);

	  // There is no need to unregister Routes in SSR since it will all be
	  // thrown away anyway.
	  if (typeof window !== "undefined") {
	    onDestroy(() => {
	      unregisterRoute(route);
	    });
	  }

		let { $$slots = {}, $$scope } = $$props;

		$$self.$set = $$props => {
			if ('path' in $$props) $$invalidate('path', path = $$props.path);
			if ('component' in $$props) $$invalidate('component', component = $$props.component);
			if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
		};

		$$self.$$.update = ($$dirty = { $activeRoute: 1 }) => {
			if ($$dirty.$activeRoute) { if ($activeRoute && $activeRoute.route === route) {
	        $$invalidate('routeParams', routeParams = $activeRoute.params);
	      } }
		};

		return {
			path,
			component,
			activeRoute,
			route,
			routeParams,
			$activeRoute,
			$$slots,
			$$scope
		};
	}

	class Route extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$1, create_fragment$1, safe_not_equal, ["path", "component"]);
		}

		get path() {
			throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set path(value) {
			throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get component() {
			throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set component(value) {
			throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* node_modules/svelte-routing/src/Link.svelte generated by Svelte v3.4.2 */

	const file = "node_modules/svelte-routing/src/Link.svelte";

	function create_fragment$2(ctx) {
		var a, current, dispose;

		const default_slot_1 = ctx.$$slots.default;
		const default_slot = create_slot(default_slot_1, ctx, null);

		var a_levels = [
			{ href: ctx.href },
			{ "aria-current": ctx.ariaCurrent },
			ctx.props
		];

		var a_data = {};
		for (var i = 0; i < a_levels.length; i += 1) {
			a_data = assign(a_data, a_levels[i]);
		}

		return {
			c: function create() {
				a = element("a");

				if (default_slot) default_slot.c();

				set_attributes(a, a_data);
				add_location(a, file, 40, 0, 1249);
				dispose = listen(a, "click", ctx.onClick);
			},

			l: function claim(nodes) {
				if (default_slot) default_slot.l(a_nodes);
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, a, anchor);

				if (default_slot) {
					default_slot.m(a, null);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (default_slot && default_slot.p && changed.$$scope) {
					default_slot.p(get_slot_changes(default_slot_1, ctx, changed, null), get_slot_context(default_slot_1, ctx, null));
				}

				set_attributes(a, get_spread_update(a_levels, [
					(changed.href) && { href: ctx.href },
					(changed.ariaCurrent) && { "aria-current": ctx.ariaCurrent },
					(changed.props) && ctx.props
				]));
			},

			i: function intro(local) {
				if (current) return;
				if (default_slot && default_slot.i) default_slot.i(local);
				current = true;
			},

			o: function outro(local) {
				if (default_slot && default_slot.o) default_slot.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(a);
				}

				if (default_slot) default_slot.d(detaching);
				dispose();
			}
		};
	}

	function instance$2($$self, $$props, $$invalidate) {
		let $base, $location;

		

	  let { to = "#", replace = false, state = {}, getProps = () => ({}) } = $$props;

	  const { base } = getContext(ROUTER); validate_store(base, 'base'); subscribe($$self, base, $$value => { $base = $$value; $$invalidate('$base', $base); });
	  const location = getContext(LOCATION); validate_store(location, 'location'); subscribe($$self, location, $$value => { $location = $$value; $$invalidate('$location', $location); });
	  const dispatch = createEventDispatcher();

	  let href, isPartiallyCurrent, isCurrent, props;

	  function onClick(event) {
	    dispatch("click", event);

	    if (shouldNavigate(event)) {
	      event.preventDefault();
	      // Don't push another entry to the history stack when the user
	      // clicks on a Link to the page they are currently on.
	      const shouldReplace = $location.pathname === href || replace;
	      navigate(href, { state, replace: shouldReplace });
	    }
	  }

		let { $$slots = {}, $$scope } = $$props;

		$$self.$set = $$props => {
			if ('to' in $$props) $$invalidate('to', to = $$props.to);
			if ('replace' in $$props) $$invalidate('replace', replace = $$props.replace);
			if ('state' in $$props) $$invalidate('state', state = $$props.state);
			if ('getProps' in $$props) $$invalidate('getProps', getProps = $$props.getProps);
			if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
		};

		let ariaCurrent;

		$$self.$$.update = ($$dirty = { to: 1, $base: 1, $location: 1, href: 1, isCurrent: 1, getProps: 1, isPartiallyCurrent: 1 }) => {
			if ($$dirty.to || $$dirty.$base) { $$invalidate('href', href = to === "/" ? $base.uri : resolve(to, $base.uri)); }
			if ($$dirty.$location || $$dirty.href) { $$invalidate('isPartiallyCurrent', isPartiallyCurrent = startsWith($location.pathname, href)); }
			if ($$dirty.href || $$dirty.$location) { $$invalidate('isCurrent', isCurrent = href === $location.pathname); }
			if ($$dirty.isCurrent) { $$invalidate('ariaCurrent', ariaCurrent = isCurrent ? "page" : undefined); }
			if ($$dirty.getProps || $$dirty.$location || $$dirty.href || $$dirty.isPartiallyCurrent || $$dirty.isCurrent) { $$invalidate('props', props = getProps({
	        location: $location,
	        href,
	        isPartiallyCurrent,
	        isCurrent
	      })); }
		};

		return {
			to,
			replace,
			state,
			getProps,
			base,
			location,
			href,
			props,
			onClick,
			ariaCurrent,
			$$slots,
			$$scope
		};
	}

	class Link extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$2, create_fragment$2, safe_not_equal, ["to", "replace", "state", "getProps"]);
		}

		get to() {
			throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set to(value) {
			throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get replace() {
			throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set replace(value) {
			throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get state() {
			throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set state(value) {
			throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get getProps() {
			throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set getProps(value) {
			throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	const courses = writable(null);


	async function getCourses() {
	        const data = await fetch(`/courses/index.json`).then(r => r.json());
	        courses.set(data);
	}

	/* static-src/assets-src/js-src/components/FeaturedCourses.svelte generated by Svelte v3.4.2 */

	const file$1 = "static-src/assets-src/js-src/components/FeaturedCourses.svelte";

	function get_each_context_1(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.category = list[i];
		return child_ctx;
	}

	function get_each_context(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.item = list[i];
		return child_ctx;
	}

	// (18:4) {#if $courses}
	function create_if_block$1(ctx) {
		var div;

		var each_value = ctx.$courses.data.items;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
		}

		return {
			c: function create() {
				div = element("div");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}
				div.className = "tile is-ancestor";
				add_location(div, file$1, 18, 6, 338);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(div, null);
				}
			},

			p: function update(changed, ctx) {
				if (changed.$courses) {
					each_value = ctx.$courses.data.items;

					for (var i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(div, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value.length;
				}
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	// (32:18) {#each item.categories.split(',') as category}
	function create_each_block_1(ctx) {
		var span, t0, t1_value = ctx.category, t1;

		return {
			c: function create() {
				span = element("span");
				t0 = text("#");
				t1 = text(t1_value);
				span.className = "tag";
				add_location(span, file$1, 32, 20, 945);
			},

			m: function mount(target, anchor) {
				insert(target, span, anchor);
				append(span, t0);
				append(span, t1);
			},

			p: function update(changed, ctx) {
				if ((changed.$courses) && t1_value !== (t1_value = ctx.category)) {
					set_data(t1, t1_value);
				}
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(span);
				}
			}
		};
	}

	// (20:8) {#each $courses.data.items as item}
	function create_each_block(ctx) {
		var div3, div2, article, p, span, i, t0, t1_value = ctx.item.title, t1, t2, div0, t3_value = ctx.item.description, t3, t4, div1, t5, a, t6, a_href_value, t7;

		var each_value_1 = ctx.item.categories.split(',');

		var each_blocks = [];

		for (var i_1 = 0; i_1 < each_value_1.length; i_1 += 1) {
			each_blocks[i_1] = create_each_block_1(get_each_context_1(ctx, each_value_1, i_1));
		}

		return {
			c: function create() {
				div3 = element("div");
				div2 = element("div");
				article = element("article");
				p = element("p");
				span = element("span");
				i = element("i");
				t0 = space();
				t1 = text(t1_value);
				t2 = space();
				div0 = element("div");
				t3 = text(t3_value);
				t4 = space();
				div1 = element("div");

				for (var i_1 = 0; i_1 < each_blocks.length; i_1 += 1) {
					each_blocks[i_1].c();
				}

				t5 = space();
				a = element("a");
				t6 = text("View");
				t7 = space();
				i.className = "fas fa-university";
				add_location(i, file$1, 25, 18, 652);
				span.className = "icon";
				add_location(span, file$1, 24, 16, 614);
				p.className = "title";
				add_location(p, file$1, 23, 16, 580);
				div0.className = "content";
				add_location(div0, file$1, 29, 16, 777);
				div1.className = "tags";
				add_location(div1, file$1, 30, 16, 841);
				a.className = "button is-link is-fullwidth";
				a.href = a_href_value = ctx.item.permalink;
				add_location(a, file$1, 35, 16, 1047);
				article.className = "tile is-child notification is-info";
				add_location(article, file$1, 22, 14, 511);
				div2.className = "tile is-child";
				add_location(div2, file$1, 21, 12, 469);
				div3.className = "tile is-4 is-parent svelte-1akjseh";
				add_location(div3, file$1, 20, 10, 423);
			},

			m: function mount(target, anchor) {
				insert(target, div3, anchor);
				append(div3, div2);
				append(div2, article);
				append(article, p);
				append(p, span);
				append(span, i);
				append(p, t0);
				append(p, t1);
				append(article, t2);
				append(article, div0);
				append(div0, t3);
				append(article, t4);
				append(article, div1);

				for (var i_1 = 0; i_1 < each_blocks.length; i_1 += 1) {
					each_blocks[i_1].m(div1, null);
				}

				append(article, t5);
				append(article, a);
				append(a, t6);
				append(div3, t7);
			},

			p: function update(changed, ctx) {
				if ((changed.$courses) && t1_value !== (t1_value = ctx.item.title)) {
					set_data(t1, t1_value);
				}

				if ((changed.$courses) && t3_value !== (t3_value = ctx.item.description)) {
					set_data(t3, t3_value);
				}

				if (changed.$courses) {
					each_value_1 = ctx.item.categories.split(',');

					for (var i_1 = 0; i_1 < each_value_1.length; i_1 += 1) {
						const child_ctx = get_each_context_1(ctx, each_value_1, i_1);

						if (each_blocks[i_1]) {
							each_blocks[i_1].p(changed, child_ctx);
						} else {
							each_blocks[i_1] = create_each_block_1(child_ctx);
							each_blocks[i_1].c();
							each_blocks[i_1].m(div1, null);
						}
					}

					for (; i_1 < each_blocks.length; i_1 += 1) {
						each_blocks[i_1].d(1);
					}
					each_blocks.length = each_value_1.length;
				}

				if ((changed.$courses) && a_href_value !== (a_href_value = ctx.item.permalink)) {
					a.href = a_href_value;
				}
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div3);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	function create_fragment$3(ctx) {
		var section, div;

		var if_block = (ctx.$courses) && create_if_block$1(ctx);

		return {
			c: function create() {
				section = element("section");
				div = element("div");
				if (if_block) if_block.c();
				div.className = "container";
				add_location(div, file$1, 16, 2, 289);
				section.className = "section";
				add_location(section, file$1, 15, 0, 261);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, section, anchor);
				append(section, div);
				if (if_block) if_block.m(div, null);
			},

			p: function update(changed, ctx) {
				if (ctx.$courses) {
					if (if_block) {
						if_block.p(changed, ctx);
					} else {
						if_block = create_if_block$1(ctx);
						if_block.c();
						if_block.m(div, null);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(section);
				}

				if (if_block) if_block.d();
			}
		};
	}

	function instance$3($$self, $$props, $$invalidate) {
		let $courses;

		validate_store(courses, 'courses');
		subscribe($$self, courses, $$value => { $courses = $$value; $$invalidate('$courses', $courses); });

		let { title } = $$props;

		$$self.$set = $$props => {
			if ('title' in $$props) $$invalidate('title', title = $$props.title);
		};

		return { title, $courses };
	}

	class FeaturedCourses extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$3, create_fragment$3, safe_not_equal, ["title"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.title === undefined && !('title' in props)) {
				console.warn("<FeaturedCourses> was created without expected prop 'title'");
			}
		}

		get title() {
			throw new Error("<FeaturedCourses>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set title(value) {
			throw new Error("<FeaturedCourses>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* static-src/assets-src/js-src/views/Courses.svelte generated by Svelte v3.4.2 */

	function create_fragment$4(ctx) {
		var current;

		var featuredcourses = new FeaturedCourses({
			props: { title: "Featured Courses" },
			$$inline: true
		});

		return {
			c: function create() {
				featuredcourses.$$.fragment.c();
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				mount_component(featuredcourses, target, anchor);
				current = true;
			},

			p: noop,

			i: function intro(local) {
				if (current) return;
				featuredcourses.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				featuredcourses.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				featuredcourses.$destroy(detaching);
			}
		};
	}

	class Courses extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$4, safe_not_equal, []);
		}
	}

	const tutorials = writable(null);


	async function getTutorials() {
	        const data = await fetch(`/tutorials/index.json`).then(r => r.json());
	        tutorials.set(data);
	}

	/* static-src/assets-src/js-src/components/FeaturedTutorials.svelte generated by Svelte v3.4.2 */

	const file$2 = "static-src/assets-src/js-src/components/FeaturedTutorials.svelte";

	function get_each_context_1$1(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.category = list[i];
		return child_ctx;
	}

	function get_each_context$1(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.item = list[i];
		return child_ctx;
	}

	// (19:2) {#if $tutorials}
	function create_if_block$2(ctx) {
		var div;

		var each_value = ctx.$tutorials.data.items;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
		}

		return {
			c: function create() {
				div = element("div");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}
				div.className = "tile is-ancestor";
				add_location(div, file$2, 19, 4, 372);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(div, null);
				}
			},

			p: function update(changed, ctx) {
				if (changed.$tutorials) {
					each_value = ctx.$tutorials.data.items;

					for (var i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$1(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block$1(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(div, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value.length;
				}
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	// (33:18) {#each item.categories.split(',') as category}
	function create_each_block_1$1(ctx) {
		var span, t0, t1_value = ctx.category, t1;

		return {
			c: function create() {
				span = element("span");
				t0 = text("#");
				t1 = text(t1_value);
				span.className = "tag";
				add_location(span, file$2, 33, 20, 969);
			},

			m: function mount(target, anchor) {
				insert(target, span, anchor);
				append(span, t0);
				append(span, t1);
			},

			p: function update(changed, ctx) {
				if ((changed.$tutorials) && t1_value !== (t1_value = ctx.category)) {
					set_data(t1, t1_value);
				}
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(span);
				}
			}
		};
	}

	// (21:6) {#each $tutorials.data.items as item}
	function create_each_block$1(ctx) {
		var div3, div2, article, p, span, i, t0, t1_value = ctx.item.title, t1, t2, div0, t3_value = ctx.item.description, t3, t4, div1, t5, a, t6, a_href_value, t7;

		var each_value_1 = ctx.item.categories.split(',');

		var each_blocks = [];

		for (var i_1 = 0; i_1 < each_value_1.length; i_1 += 1) {
			each_blocks[i_1] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i_1));
		}

		return {
			c: function create() {
				div3 = element("div");
				div2 = element("div");
				article = element("article");
				p = element("p");
				span = element("span");
				i = element("i");
				t0 = space();
				t1 = text(t1_value);
				t2 = space();
				div0 = element("div");
				t3 = text(t3_value);
				t4 = space();
				div1 = element("div");

				for (var i_1 = 0; i_1 < each_blocks.length; i_1 += 1) {
					each_blocks[i_1].c();
				}

				t5 = space();
				a = element("a");
				t6 = text("View");
				t7 = space();
				i.className = "fas fa-check";
				add_location(i, file$2, 26, 18, 683);
				span.className = "icon";
				add_location(span, file$2, 25, 16, 645);
				p.className = "title";
				add_location(p, file$2, 24, 16, 611);
				div0.className = "content";
				add_location(div0, file$2, 30, 14, 801);
				div1.className = "tags";
				add_location(div1, file$2, 31, 16, 865);
				a.className = "button is-link is-fullwidth";
				a.href = a_href_value = ctx.item.permalink;
				add_location(a, file$2, 36, 16, 1071);
				article.className = "tile is-child notification is-warning";
				add_location(article, file$2, 23, 12, 539);
				div2.className = "tile is-child";
				add_location(div2, file$2, 22, 10, 499);
				div3.className = "tile is-4 is-parent svelte-1akjseh";
				add_location(div3, file$2, 21, 8, 455);
			},

			m: function mount(target, anchor) {
				insert(target, div3, anchor);
				append(div3, div2);
				append(div2, article);
				append(article, p);
				append(p, span);
				append(span, i);
				append(p, t0);
				append(p, t1);
				append(article, t2);
				append(article, div0);
				append(div0, t3);
				append(article, t4);
				append(article, div1);

				for (var i_1 = 0; i_1 < each_blocks.length; i_1 += 1) {
					each_blocks[i_1].m(div1, null);
				}

				append(article, t5);
				append(article, a);
				append(a, t6);
				append(div3, t7);
			},

			p: function update(changed, ctx) {
				if ((changed.$tutorials) && t1_value !== (t1_value = ctx.item.title)) {
					set_data(t1, t1_value);
				}

				if ((changed.$tutorials) && t3_value !== (t3_value = ctx.item.description)) {
					set_data(t3, t3_value);
				}

				if (changed.$tutorials) {
					each_value_1 = ctx.item.categories.split(',');

					for (var i_1 = 0; i_1 < each_value_1.length; i_1 += 1) {
						const child_ctx = get_each_context_1$1(ctx, each_value_1, i_1);

						if (each_blocks[i_1]) {
							each_blocks[i_1].p(changed, child_ctx);
						} else {
							each_blocks[i_1] = create_each_block_1$1(child_ctx);
							each_blocks[i_1].c();
							each_blocks[i_1].m(div1, null);
						}
					}

					for (; i_1 < each_blocks.length; i_1 += 1) {
						each_blocks[i_1].d(1);
					}
					each_blocks.length = each_value_1.length;
				}

				if ((changed.$tutorials) && a_href_value !== (a_href_value = ctx.item.permalink)) {
					a.href = a_href_value;
				}
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div3);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	function create_fragment$5(ctx) {
		var section, div;

		var if_block = (ctx.$tutorials) && create_if_block$2(ctx);

		return {
			c: function create() {
				section = element("section");
				div = element("div");
				if (if_block) if_block.c();
				div.className = "container";
				add_location(div, file$2, 17, 0, 325);
				section.className = "section";
				add_location(section, file$2, 16, 0, 299);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, section, anchor);
				append(section, div);
				if (if_block) if_block.m(div, null);
			},

			p: function update(changed, ctx) {
				if (ctx.$tutorials) {
					if (if_block) {
						if_block.p(changed, ctx);
					} else {
						if_block = create_if_block$2(ctx);
						if_block.c();
						if_block.m(div, null);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(section);
				}

				if (if_block) if_block.d();
			}
		};
	}

	function instance$4($$self, $$props, $$invalidate) {
		let $tutorials;

		validate_store(tutorials, 'tutorials');
		subscribe($$self, tutorials, $$value => { $tutorials = $$value; $$invalidate('$tutorials', $tutorials); });

		
	  let { title } = $$props;

		$$self.$set = $$props => {
			if ('title' in $$props) $$invalidate('title', title = $$props.title);
		};

		return { title, $tutorials };
	}

	class FeaturedTutorials extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$4, create_fragment$5, safe_not_equal, ["title"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.title === undefined && !('title' in props)) {
				console.warn("<FeaturedTutorials> was created without expected prop 'title'");
			}
		}

		get title() {
			throw new Error("<FeaturedTutorials>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set title(value) {
			throw new Error("<FeaturedTutorials>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* static-src/assets-src/js-src/views/Tutorials.svelte generated by Svelte v3.4.2 */

	function create_fragment$6(ctx) {
		var current;

		var featuredtutorials = new FeaturedTutorials({
			props: { title: "Featured Tutorials" },
			$$inline: true
		});

		return {
			c: function create() {
				featuredtutorials.$$.fragment.c();
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				mount_component(featuredtutorials, target, anchor);
				current = true;
			},

			p: noop,

			i: function intro(local) {
				if (current) return;
				featuredtutorials.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				featuredtutorials.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				featuredtutorials.$destroy(detaching);
			}
		};
	}

	class Tutorials extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$6, safe_not_equal, []);
		}
	}

	const snacks = writable(null);


	async function getSnacks() {
	        const data = await fetch(`/snacks/index.json`).then(r => r.json());
	        snacks.set(data);
	}

	/* static-src/assets-src/js-src/components/FeaturedSnacks.svelte generated by Svelte v3.4.2 */

	const file$3 = "static-src/assets-src/js-src/components/FeaturedSnacks.svelte";

	function get_each_context_1$2(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.category = list[i];
		return child_ctx;
	}

	function get_each_context$2(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.item = list[i];
		return child_ctx;
	}

	// (19:4) {#if $snacks}
	function create_if_block$3(ctx) {
		var div;

		var each_value = ctx.$snacks.data.items;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
		}

		return {
			c: function create() {
				div = element("div");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}
				div.className = "tile is-ancestor";
				add_location(div, file$3, 19, 6, 370);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(div, null);
				}
			},

			p: function update(changed, ctx) {
				if (changed.$snacks) {
					each_value = ctx.$snacks.data.items;

					for (var i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$2(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block$2(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(div, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value.length;
				}
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	// (33:18) {#each item.categories.split(',') as category}
	function create_each_block_1$2(ctx) {
		var span, t0, t1_value = ctx.category, t1;

		return {
			c: function create() {
				span = element("span");
				t0 = text("#");
				t1 = text(t1_value);
				span.className = "tag";
				add_location(span, file$3, 33, 20, 980);
			},

			m: function mount(target, anchor) {
				insert(target, span, anchor);
				append(span, t0);
				append(span, t1);
			},

			p: function update(changed, ctx) {
				if ((changed.$snacks) && t1_value !== (t1_value = ctx.category)) {
					set_data(t1, t1_value);
				}
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(span);
				}
			}
		};
	}

	// (21:8) {#each $snacks.data.items as item}
	function create_each_block$2(ctx) {
		var div3, div2, article, p, span, i, t0, t1_value = ctx.item.title, t1, t2, div0, t3_value = ctx.item.description, t3, t4, div1, t5, a, t6, a_href_value, t7;

		var each_value_1 = ctx.item.categories.split(',');

		var each_blocks = [];

		for (var i_1 = 0; i_1 < each_value_1.length; i_1 += 1) {
			each_blocks[i_1] = create_each_block_1$2(get_each_context_1$2(ctx, each_value_1, i_1));
		}

		return {
			c: function create() {
				div3 = element("div");
				div2 = element("div");
				article = element("article");
				p = element("p");
				span = element("span");
				i = element("i");
				t0 = space();
				t1 = text(t1_value);
				t2 = space();
				div0 = element("div");
				t3 = text(t3_value);
				t4 = space();
				div1 = element("div");

				for (var i_1 = 0; i_1 < each_blocks.length; i_1 += 1) {
					each_blocks[i_1].c();
				}

				t5 = space();
				a = element("a");
				t6 = text("View");
				t7 = space();
				i.className = "fas fa-cookie-bite";
				add_location(i, file$3, 26, 18, 686);
				span.className = "icon";
				add_location(span, file$3, 25, 16, 648);
				p.className = "title";
				add_location(p, file$3, 24, 16, 614);
				div0.className = "content";
				add_location(div0, file$3, 30, 16, 812);
				div1.className = "tags";
				add_location(div1, file$3, 31, 16, 876);
				a.className = "button is-link is-fullwidth";
				a.href = a_href_value = ctx.item.permalink;
				add_location(a, file$3, 36, 16, 1082);
				article.className = "tile is-child notification is-success";
				add_location(article, file$3, 23, 14, 542);
				div2.className = "tile is-child";
				add_location(div2, file$3, 22, 12, 500);
				div3.className = "tile is-4 is-parent svelte-1akjseh";
				add_location(div3, file$3, 21, 10, 454);
			},

			m: function mount(target, anchor) {
				insert(target, div3, anchor);
				append(div3, div2);
				append(div2, article);
				append(article, p);
				append(p, span);
				append(span, i);
				append(p, t0);
				append(p, t1);
				append(article, t2);
				append(article, div0);
				append(div0, t3);
				append(article, t4);
				append(article, div1);

				for (var i_1 = 0; i_1 < each_blocks.length; i_1 += 1) {
					each_blocks[i_1].m(div1, null);
				}

				append(article, t5);
				append(article, a);
				append(a, t6);
				append(div3, t7);
			},

			p: function update(changed, ctx) {
				if ((changed.$snacks) && t1_value !== (t1_value = ctx.item.title)) {
					set_data(t1, t1_value);
				}

				if ((changed.$snacks) && t3_value !== (t3_value = ctx.item.description)) {
					set_data(t3, t3_value);
				}

				if (changed.$snacks) {
					each_value_1 = ctx.item.categories.split(',');

					for (var i_1 = 0; i_1 < each_value_1.length; i_1 += 1) {
						const child_ctx = get_each_context_1$2(ctx, each_value_1, i_1);

						if (each_blocks[i_1]) {
							each_blocks[i_1].p(changed, child_ctx);
						} else {
							each_blocks[i_1] = create_each_block_1$2(child_ctx);
							each_blocks[i_1].c();
							each_blocks[i_1].m(div1, null);
						}
					}

					for (; i_1 < each_blocks.length; i_1 += 1) {
						each_blocks[i_1].d(1);
					}
					each_blocks.length = each_value_1.length;
				}

				if ((changed.$snacks) && a_href_value !== (a_href_value = ctx.item.permalink)) {
					a.href = a_href_value;
				}
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div3);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	function create_fragment$7(ctx) {
		var section, div;

		var if_block = (ctx.$snacks) && create_if_block$3(ctx);

		return {
			c: function create() {
				section = element("section");
				div = element("div");
				if (if_block) if_block.c();
				div.className = "container";
				add_location(div, file$3, 17, 2, 322);
				section.className = "section";
				add_location(section, file$3, 16, 0, 294);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, section, anchor);
				append(section, div);
				if (if_block) if_block.m(div, null);
			},

			p: function update(changed, ctx) {
				if (ctx.$snacks) {
					if (if_block) {
						if_block.p(changed, ctx);
					} else {
						if_block = create_if_block$3(ctx);
						if_block.c();
						if_block.m(div, null);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(section);
				}

				if (if_block) if_block.d();
			}
		};
	}

	function instance$5($$self, $$props, $$invalidate) {
		let $snacks;

		validate_store(snacks, 'snacks');
		subscribe($$self, snacks, $$value => { $snacks = $$value; $$invalidate('$snacks', $snacks); });

		
	  let { title } = $$props;

		$$self.$set = $$props => {
			if ('title' in $$props) $$invalidate('title', title = $$props.title);
		};

		return { title, $snacks };
	}

	class FeaturedSnacks extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$5, create_fragment$7, safe_not_equal, ["title"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.title === undefined && !('title' in props)) {
				console.warn("<FeaturedSnacks> was created without expected prop 'title'");
			}
		}

		get title() {
			throw new Error("<FeaturedSnacks>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set title(value) {
			throw new Error("<FeaturedSnacks>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* static-src/assets-src/js-src/views/Snacks.svelte generated by Svelte v3.4.2 */

	function create_fragment$8(ctx) {
		var current;

		var featuredsnacks = new FeaturedSnacks({
			props: { title: "Featured Snacks" },
			$$inline: true
		});

		return {
			c: function create() {
				featuredsnacks.$$.fragment.c();
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				mount_component(featuredsnacks, target, anchor);
				current = true;
			},

			p: noop,

			i: function intro(local) {
				if (current) return;
				featuredsnacks.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				featuredsnacks.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				featuredsnacks.$destroy(detaching);
			}
		};
	}

	class Snacks extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$8, safe_not_equal, []);
		}
	}

	/* static-src/assets-src/js-src/views/About.svelte generated by Svelte v3.4.2 */

	const file$4 = "static-src/assets-src/js-src/views/About.svelte";

	function create_fragment$9(ctx) {
		var div, h2;

		return {
			c: function create() {
				div = element("div");
				h2 = element("h2");
				h2.textContent = "About";
				add_location(h2, file$4, 0, 5, 5);
				add_location(div, file$4, 0, 0, 0);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, h2);
			},

			p: noop,
			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	class About extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$9, safe_not_equal, []);
		}
	}

	/* static-src/assets-src/js-src/views/Home.svelte generated by Svelte v3.4.2 */

	function create_fragment$a(ctx) {
		var t0, t1, current;

		var featuredsnacks = new FeaturedSnacks({
			props: { title: "Featured Snacks" },
			$$inline: true
		});

		var featuredtutorials = new FeaturedTutorials({
			props: { title: "Featured Tutorials" },
			$$inline: true
		});

		var featuredcourses = new FeaturedCourses({
			props: { title: "Featured Courses" },
			$$inline: true
		});

		return {
			c: function create() {
				featuredsnacks.$$.fragment.c();
				t0 = space();
				featuredtutorials.$$.fragment.c();
				t1 = space();
				featuredcourses.$$.fragment.c();
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				mount_component(featuredsnacks, target, anchor);
				insert(target, t0, anchor);
				mount_component(featuredtutorials, target, anchor);
				insert(target, t1, anchor);
				mount_component(featuredcourses, target, anchor);
				current = true;
			},

			p: noop,

			i: function intro(local) {
				if (current) return;
				featuredsnacks.$$.fragment.i(local);

				featuredtutorials.$$.fragment.i(local);

				featuredcourses.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				featuredsnacks.$$.fragment.o(local);
				featuredtutorials.$$.fragment.o(local);
				featuredcourses.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				featuredsnacks.$destroy(detaching);

				if (detaching) {
					detach(t0);
				}

				featuredtutorials.$destroy(detaching);

				if (detaching) {
					detach(t1);
				}

				featuredcourses.$destroy(detaching);
			}
		};
	}

	class Home extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$a, safe_not_equal, []);
		}
	}

	/* static-src/assets-src/js-src/components/Banner.svelte generated by Svelte v3.4.2 */

	const file$5 = "static-src/assets-src/js-src/components/Banner.svelte";

	// (9:8) <Link class="navbar-item" to="/">
	function create_default_slot_4(ctx) {
		var h1, t;

		return {
			c: function create() {
				h1 = element("h1");
				t = text(ctx.title);
				add_location(h1, file$5, 8, 41, 252);
			},

			m: function mount(target, anchor) {
				insert(target, h1, anchor);
				append(h1, t);
			},

			p: function update(changed, ctx) {
				if (changed.title) {
					set_data(t, ctx.title);
				}
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(h1);
				}
			}
		};
	}

	// (28:8) <Link class="navbar-item" to="/snacks">
	function create_default_slot_3(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Snacks");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (31:8) <Link class="navbar-item" to="/tutorials">
	function create_default_slot_2(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Tutorials");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (34:8) <Link class="navbar-item" to="/courses">
	function create_default_slot_1(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Courses");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (41:12) <Link class="navbar-item" to="/about">
	function create_default_slot(ctx) {
		var t;

		return {
			c: function create() {
				t = text("About");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	function create_fragment$b(ctx) {
		var nav, div0, span0, t0, a0, span1, t1, span2, t2, span3, t3, div7, div3, span4, t4, span5, t5, span6, t6, div2, a1, t8, div1, span7, t9, a2, t11, hr, t12, a3, t14, div6, div5, div4, a4, strong, t16, a5, current;

		var link0 = new Link({
			props: {
			class: "navbar-item",
			to: "/",
			$$slots: { default: [create_default_slot_4] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		var link1 = new Link({
			props: {
			class: "navbar-item",
			to: "/snacks",
			$$slots: { default: [create_default_slot_3] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		var link2 = new Link({
			props: {
			class: "navbar-item",
			to: "/tutorials",
			$$slots: { default: [create_default_slot_2] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		var link3 = new Link({
			props: {
			class: "navbar-item",
			to: "/courses",
			$$slots: { default: [create_default_slot_1] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		var link4 = new Link({
			props: {
			class: "navbar-item",
			to: "/about",
			$$slots: { default: [create_default_slot] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		return {
			c: function create() {
				nav = element("nav");
				div0 = element("div");
				span0 = element("span");
				link0.$$.fragment.c();
				t0 = space();
				a0 = element("a");
				span1 = element("span");
				t1 = space();
				span2 = element("span");
				t2 = space();
				span3 = element("span");
				t3 = space();
				div7 = element("div");
				div3 = element("div");
				span4 = element("span");
				link1.$$.fragment.c();
				t4 = space();
				span5 = element("span");
				link2.$$.fragment.c();
				t5 = space();
				span6 = element("span");
				link3.$$.fragment.c();
				t6 = space();
				div2 = element("div");
				a1 = element("a");
				a1.textContent = "More";
				t8 = space();
				div1 = element("div");
				span7 = element("span");
				link4.$$.fragment.c();
				t9 = space();
				a2 = element("a");
				a2.textContent = "Contact";
				t11 = space();
				hr = element("hr");
				t12 = space();
				a3 = element("a");
				a3.textContent = "Report an issue";
				t14 = space();
				div6 = element("div");
				div5 = element("div");
				div4 = element("div");
				a4 = element("a");
				strong = element("strong");
				strong.textContent = "Sign up";
				t16 = space();
				a5 = element("a");
				a5.textContent = "Log in";
				span0.className = "navbar-item";
				add_location(span0, file$5, 7, 6, 184);
				attr(span1, "aria-hidden", "true");
				add_location(span1, file$5, 17, 6, 451);
				attr(span2, "aria-hidden", "true");
				add_location(span2, file$5, 18, 6, 485);
				attr(span3, "aria-hidden", "true");
				add_location(span3, file$5, 19, 6, 519);
				attr(a0, "role", "button");
				a0.className = "navbar-burger burger";
				attr(a0, "aria-label", "menu");
				attr(a0, "aria-expanded", "false");
				a0.dataset.target = "navbarBasicExample";
				add_location(a0, file$5, 11, 4, 295);
				div0.className = "navbar-brand";
				add_location(div0, file$5, 6, 2, 151);
				span4.className = "navbar-item";
				add_location(span4, file$5, 26, 6, 656);
				span5.className = "navbar-item";
				add_location(span5, file$5, 29, 6, 764);
				span6.className = "navbar-item";
				add_location(span6, file$5, 32, 6, 878);
				a1.className = "navbar-link";
				add_location(a1, file$5, 36, 8, 1048);
				span7.className = "navbar-item";
				add_location(span7, file$5, 39, 10, 1129);
				a2.className = "navbar-item";
				add_location(a2, file$5, 42, 10, 1247);
				hr.className = "navbar-divider";
				add_location(hr, file$5, 43, 10, 1292);
				a3.className = "navbar-item";
				add_location(a3, file$5, 44, 10, 1332);
				div1.className = "navbar-dropdown";
				add_location(div1, file$5, 38, 8, 1089);
				div2.className = "navbar-item has-dropdown is-hoverable";
				add_location(div2, file$5, 35, 6, 988);
				div3.className = "navbar-start";
				add_location(div3, file$5, 24, 4, 622);
				add_location(strong, file$5, 53, 12, 1558);
				a4.className = "button is-primary";
				add_location(a4, file$5, 52, 10, 1516);
				a5.className = "button is-light";
				add_location(a5, file$5, 55, 10, 1608);
				div4.className = "buttons";
				add_location(div4, file$5, 51, 8, 1484);
				div5.className = "navbar-item";
				add_location(div5, file$5, 50, 6, 1450);
				div6.className = "navbar-end";
				add_location(div6, file$5, 49, 4, 1419);
				div7.id = "navbarBasicExample";
				div7.className = "navbar-menu";
				add_location(div7, file$5, 23, 2, 568);
				nav.className = "navbar";
				attr(nav, "role", "navigation");
				attr(nav, "aria-label", "main navigation");
				add_location(nav, file$5, 5, 0, 81);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, nav, anchor);
				append(nav, div0);
				append(div0, span0);
				mount_component(link0, span0, null);
				append(div0, t0);
				append(div0, a0);
				append(a0, span1);
				append(a0, t1);
				append(a0, span2);
				append(a0, t2);
				append(a0, span3);
				append(nav, t3);
				append(nav, div7);
				append(div7, div3);
				append(div3, span4);
				mount_component(link1, span4, null);
				append(div3, t4);
				append(div3, span5);
				mount_component(link2, span5, null);
				append(div3, t5);
				append(div3, span6);
				mount_component(link3, span6, null);
				append(div3, t6);
				append(div3, div2);
				append(div2, a1);
				append(div2, t8);
				append(div2, div1);
				append(div1, span7);
				mount_component(link4, span7, null);
				append(div1, t9);
				append(div1, a2);
				append(div1, t11);
				append(div1, hr);
				append(div1, t12);
				append(div1, a3);
				append(div7, t14);
				append(div7, div6);
				append(div6, div5);
				append(div5, div4);
				append(div4, a4);
				append(a4, strong);
				append(div4, t16);
				append(div4, a5);
				current = true;
			},

			p: function update(changed, ctx) {
				var link0_changes = {};
				if (changed.$$scope || changed.title) link0_changes.$$scope = { changed, ctx };
				link0.$set(link0_changes);

				var link1_changes = {};
				if (changed.$$scope) link1_changes.$$scope = { changed, ctx };
				link1.$set(link1_changes);

				var link2_changes = {};
				if (changed.$$scope) link2_changes.$$scope = { changed, ctx };
				link2.$set(link2_changes);

				var link3_changes = {};
				if (changed.$$scope) link3_changes.$$scope = { changed, ctx };
				link3.$set(link3_changes);

				var link4_changes = {};
				if (changed.$$scope) link4_changes.$$scope = { changed, ctx };
				link4.$set(link4_changes);
			},

			i: function intro(local) {
				if (current) return;
				link0.$$.fragment.i(local);

				link1.$$.fragment.i(local);

				link2.$$.fragment.i(local);

				link3.$$.fragment.i(local);

				link4.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				link0.$$.fragment.o(local);
				link1.$$.fragment.o(local);
				link2.$$.fragment.o(local);
				link3.$$.fragment.o(local);
				link4.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(nav);
				}

				link0.$destroy();

				link1.$destroy();

				link2.$destroy();

				link3.$destroy();

				link4.$destroy();
			}
		};
	}

	function instance$6($$self, $$props, $$invalidate) {
		let { title } = $$props;

		$$self.$set = $$props => {
			if ('title' in $$props) $$invalidate('title', title = $$props.title);
		};

		return { title };
	}

	class Banner extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$6, create_fragment$b, safe_not_equal, ["title"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.title === undefined && !('title' in props)) {
				console.warn("<Banner> was created without expected prop 'title'");
			}
		}

		get title() {
			throw new Error("<Banner>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set title(value) {
			throw new Error("<Banner>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* static-src/assets-src/js-src/App.svelte generated by Svelte v3.4.2 */

	const file$6 = "static-src/assets-src/js-src/App.svelte";

	// (36:4) <Route path="/">
	function create_default_slot_1$1(ctx) {
		var current;

		var home = new Home({ $$inline: true });

		return {
			c: function create() {
				home.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(home, target, anchor);
				current = true;
			},

			i: function intro(local) {
				if (current) return;
				home.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				home.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				home.$destroy(detaching);
			}
		};
	}

	// (28:0) <Router url="{url}">
	function create_default_slot$1(ctx) {
		var t0, main, t1, t2, t3, t4, current;

		var banner = new Banner({
			props: { title: ctx.title },
			$$inline: true
		});

		var route0 = new Route({
			props: {
			path: "tutorials",
			component: Tutorials
		},
			$$inline: true
		});

		var route1 = new Route({
			props: { path: "courses", component: Courses },
			$$inline: true
		});

		var route2 = new Route({
			props: { path: "snacks", component: Snacks },
			$$inline: true
		});

		var route3 = new Route({
			props: { path: "about", component: About },
			$$inline: true
		});

		var route4 = new Route({
			props: {
			path: "/",
			$$slots: { default: [create_default_slot_1$1] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		return {
			c: function create() {
				banner.$$.fragment.c();
				t0 = space();
				main = element("main");
				route0.$$.fragment.c();
				t1 = space();
				route1.$$.fragment.c();
				t2 = space();
				route2.$$.fragment.c();
				t3 = space();
				route3.$$.fragment.c();
				t4 = space();
				route4.$$.fragment.c();
				add_location(main, file$6, 29, 2, 748);
			},

			m: function mount(target, anchor) {
				mount_component(banner, target, anchor);
				insert(target, t0, anchor);
				insert(target, main, anchor);
				mount_component(route0, main, null);
				append(main, t1);
				mount_component(route1, main, null);
				append(main, t2);
				mount_component(route2, main, null);
				append(main, t3);
				mount_component(route3, main, null);
				append(main, t4);
				mount_component(route4, main, null);
				current = true;
			},

			p: function update(changed, ctx) {
				var banner_changes = {};
				if (changed.title) banner_changes.title = ctx.title;
				banner.$set(banner_changes);

				var route0_changes = {};
				if (changed.Tutorials) route0_changes.component = Tutorials;
				route0.$set(route0_changes);

				var route1_changes = {};
				if (changed.Courses) route1_changes.component = Courses;
				route1.$set(route1_changes);

				var route2_changes = {};
				if (changed.Snacks) route2_changes.component = Snacks;
				route2.$set(route2_changes);

				var route3_changes = {};
				if (changed.About) route3_changes.component = About;
				route3.$set(route3_changes);

				var route4_changes = {};
				if (changed.$$scope) route4_changes.$$scope = { changed, ctx };
				route4.$set(route4_changes);
			},

			i: function intro(local) {
				if (current) return;
				banner.$$.fragment.i(local);

				route0.$$.fragment.i(local);

				route1.$$.fragment.i(local);

				route2.$$.fragment.i(local);

				route3.$$.fragment.i(local);

				route4.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				banner.$$.fragment.o(local);
				route0.$$.fragment.o(local);
				route1.$$.fragment.o(local);
				route2.$$.fragment.o(local);
				route3.$$.fragment.o(local);
				route4.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				banner.$destroy(detaching);

				if (detaching) {
					detach(t0);
					detach(main);
				}

				route0.$destroy();

				route1.$destroy();

				route2.$destroy();

				route3.$destroy();

				route4.$destroy();
			}
		};
	}

	function create_fragment$c(ctx) {
		var current;

		var router = new Router({
			props: {
			url: ctx.url,
			$$slots: { default: [create_default_slot$1] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		return {
			c: function create() {
				router.$$.fragment.c();
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				mount_component(router, target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var router_changes = {};
				if (changed.url) router_changes.url = ctx.url;
				if (changed.$$scope || changed.title) router_changes.$$scope = { changed, ctx };
				router.$set(router_changes);
			},

			i: function intro(local) {
				if (current) return;
				router.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				router.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				router.$destroy(detaching);
			}
		};
	}

	function instance$7($$self, $$props, $$invalidate) {
		
	  let { url = "", title = "" } = $$props;


	  onMount(() => {
	    getCourses();
	    getTutorials();
	    getSnacks();
	  });

		$$self.$set = $$props => {
			if ('url' in $$props) $$invalidate('url', url = $$props.url);
			if ('title' in $$props) $$invalidate('title', title = $$props.title);
		};

		return { url, title };
	}

	class App extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$7, create_fragment$c, safe_not_equal, ["url", "title"]);
		}

		get url() {
			throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set url(value) {
			throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get title() {
			throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set title(value) {
			throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	const app = new App({
	  target: document.body,
	  props: {
	    title: document.title
	  }
	});

	return app;

}());
//# sourceMappingURL=bundle.js.map
