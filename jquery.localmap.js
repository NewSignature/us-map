(function($, document, window, Raphael, undefined) {
    // jQuery Plugin Factory
    function jQueryPluginFactory( $, name, methods, getters ){
        getters = getters instanceof Array ? getters : [];
        var getters_obj = {};
        for(var i=0; i<getters.length; i++){
            getters_obj[getters[i]] = true;
        }

        // Create the object
        var Plugin = function(element){
            this.element = element;
        };
        Plugin.prototype = methods;

        // Assign the plugin
        $.fn[name] = function(){
            var args = arguments;
            var returnValue = this;

            this.each(function() {
                var $this = $(this);
                var plugin = $this.data('plugin-'+name);
                // Init the plugin if first time
                if( !plugin ){
                    plugin = new Plugin($this);
                    $this.data('plugin-'+name, plugin);
                    if(plugin._init){
                        plugin._init.apply(plugin, args);
                    }

                // call a method
                } else if(typeof args[0] == 'string' && args[0].charAt(0) != '_' && typeof plugin[args[0]] == 'function'){
                    var methodArgs = Array.prototype.slice.call(args, 1);
                    var r = plugin[args[0]].apply(plugin, methodArgs);
                    // set the return value if method is a getter
                    if( args[0] in getters_obj ){
                        returnValue = r;
                    }
                }
            });

            return returnValue; // returning the jQuery object
        };
    };

    // Some constants
    var WIDTH = 930,
        HEIGHT = 320,
        LABELS_WIDTH = 70;

    // Default options
    var defaults = {
        // The styles for the state
        'stateStyles': {
            fill: "#333",
            stroke: "#666",
            "stroke-width": 1,
            "stroke-linejoin": "round",
            scale: [1, 1]
        },

        // The styles for the hover
        'stateHoverStyles': {
            fill: "#33c",
            stroke: "#000",
            scale: [1.1, 1.1]
        },

        // The time for the animation, set to false to remove the animation
        'stateHoverAnimation': 500,

        // State specific styles. 'ST': {}
        'stateSpecificStyles': {},

        // State specific hover styles
        'stateSpecificHoverStyles': {},

        // Events
        'click': null,

        'mouseover': null,

        'mouseout': null,

        'clickState': {},

        'mouseoverState': {},

        'mouseoutState': {},

        // Labels
        'showLabels' : true,

        'labelWidth': 20,

        'labelHeight': 15,

        'labelGap' : 6,

        'labelRadius' : 3,

        'labelBackingStyles': {
            fill: "#333",
            stroke: "#666",
            "stroke-width": 1,
            "stroke-linejoin": "round",
            scale: [1, 1]
        },

        // The styles for the hover
        'labelBackingHoverStyles': {
            fill: "#33c",
            stroke: "#000"
        },

        'stateSpecificLabelBackingStyles': {},

        'stateSpecificLabelBackingHoverStyles': {},

        'labelTextStyles': {
            fill: "#fff",
            'stroke': 'none',
            'font-weight': 300,
            'stroke-width': 0,
            'font-size': '10px'
        },

        // The styles for the hover
        'labelTextHoverStyles': {},

        'stateSpecificLabelTextStyles': {},

        'stateSpecificLabelTextHoverStyles': {},

        'paths': {}
    };

    // Methods
    var methods = {
        /**
         * The init function
         */
        _init: function(options) {
            // Save the options
            this.options = {};
            $.extend(this.options, defaults, options);

            // Save the width and height;
            var width = this.element.width();
            var height = this.element.height();

            // Calculate the width and height to match the container while keeping the labels at a fixed size
            var xscale = this.element.width()/WIDTH;
            var yscale = this.element.height()/HEIGHT;
            this.scale = Math.min(xscale, yscale);
            this.labelAreaWidth = Math.ceil(LABELS_WIDTH/this.scale); // The actual width with the labels reversed scaled

            var paperWidthWithLabels = WIDTH + Math.max(0, this.labelAreaWidth - LABELS_WIDTH);
            // Create the Raphael instances
            this.paper = Raphael(this.element.get(0), paperWidthWithLabels, HEIGHT);//this.element.width(), this.element.height());

            // Scale to fit
            this.paper.setSize(width, height);
            this.paper.setViewBox(0, 0, paperWidthWithLabels, HEIGHT, false);

            // Keep track of all the states
            this.stateHitAreas = {}; // transparent for the hit area
            this.stateShapes = {}; // for the visual shape
            this.topShape = null;

            // create all the states
            this._initCreateStates();

            // create the labels for the smaller states
            this.labelShapes = {};
            this.labelTexts = {};
            this.labelHitAreas = {};
            if(this.options.showLabels) {
                this._initCreateLabels();
            }

            // Add the
        },

        /**
         * Create the state objects
         */
        _initCreateStates: function() {
            // TODO: Dynamic attrs
            var attr = this.options.stateStyles;
            var R = this.paper; // shorter name for usage here
            var paths = this.options.paths;

            // Create the actual objects
            var stateAttr = {};
            for(var state in paths) {
                stateAttr = {};
                if(this.options.stateSpecificStyles[state]) {
                    $.extend(stateAttr, attr, this.options.stateSpecificStyles[state]);
                } else {
                    stateAttr = attr;
                }
                this.stateShapes[state] = R.path(paths[state]).attr(stateAttr);
                this.topShape = this.stateShapes[state];

                this.stateHitAreas[state] = R.path(paths[state]).attr({fill: "#000", "stroke-width": 0, "opacity" : 0.0, 'cursor': 'pointer'});
                this.stateHitAreas[state].node.dataState = state;
            }

            // Bind events
            this._onClickProxy = $.proxy(this, '_onClick');
            this._onMouseOverProxy = $.proxy(this, '_onMouseOver'),
            this._onMouseOutProxy = $.proxy(this, '_onMouseOut');

            for(var state in this.stateHitAreas) {
                this.stateHitAreas[state].toFront();
                $(this.stateHitAreas[state].node).bind('mouseout', this._onMouseOutProxy);
                $(this.stateHitAreas[state].node).bind('click', this._onClickProxy);
                $(this.stateHitAreas[state].node).bind('mouseover', this._onMouseOverProxy);
            }
        },

        /**
         * Create the labels
         */
        _initCreateLabels: function() {
            var R = this.paper; // shorter name for usage here
            var neStates = ['VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD', 'DC'];

            // calculate the values for placing items
            var neBoxX = 860;
            var neBoxY = 220;
            var oWidth = this.options.labelWidth;
            var oHeight = this.options.labelHeight;
            var oGap = this.options.labelGap;
            var oRadius = this.options.labelRadius;

            var shapeWidth = oWidth/this.scale;
            var shapeHeight = oHeight/this.scale;

            var colWidth = (oWidth+oGap)/this.scale;
            var downBy = (oHeight+oGap)/this.scale*0.5;

            var shapeRadius = oRadius/this.scale;

            // Styling information
            var backingAttr = this.options.labelBackingStyles;
            var textAttr = this.options.labelTextStyles;
            var stateAttr = {};

            // NE States
            for(var i=0, x, y, state; i<neStates.length; ++i) {
                state = neStates[i];

                // position
                x = ((i+1)%2) * colWidth + neBoxX;
                y = i*downBy + neBoxY;

                // attributes for styling the backing
                stateAttr = {};
                if(this.options.stateSpecificLabelBackingStyles[state]) {
                    $.extend(stateAttr, backingAttr, this.options.stateSpecificLabelBackingStyles[state]);
                } else {
                    stateAttr = backingAttr;
                }

                // add the backing
                this.labelShapes[state] = R.rect(x, y, shapeWidth, shapeHeight, shapeRadius).attr(stateAttr);

                // attributes for styling the text
                stateAttr = {};
                if(this.options.stateSpecificLabelTextStyles[state]) {
                    $.extend(stateAttr, textAttr, this.options.stateSpecificLabelTextStyles[state]);
                } else {
                    $.extend(stateAttr, textAttr);
                }

                // adjust font-size
                if(stateAttr['font-size']) {
                    stateAttr['font-size'] = (parseInt(stateAttr['font-size'])/this.scale) + 'px';
                }

                // add the text
                this.labelTexts[state] = R.text(x+(shapeWidth/2), y+(shapeHeight/2), state).attr(stateAttr);

                // Create the hit areas
                this.labelHitAreas[state] = R.rect(x, y, shapeWidth, shapeHeight, shapeRadius).attr({
                    fill: "#000",
                    "stroke-width": 0,
                    "opacity" : 0.0,
                    'cursor': 'pointer'
                });
                this.labelHitAreas[state].node.dataState = state;
            }

            // Bind events
            for(var state in this.labelHitAreas) {
                this.labelHitAreas[state].toFront();
                $(this.labelHitAreas[state].node).bind('mouseout', this._onMouseOutProxy);
                $(this.labelHitAreas[state].node).bind('click', this._onClickProxy);
                $(this.labelHitAreas[state].node).bind('mouseover', this._onMouseOverProxy);
            }
        },

        /**
         * Get the state Raphael object
         */
        _getStateFromEvent: function(event) {
            // first get the state name
            var stateName = (event.target && event.target.dataState) || (event.dataState);
            return this._getState(stateName);
        },

        /**
         *
         */
        _getState: function(stateName) {
            var stateShape = this.stateShapes[stateName];
            var stateHitArea = this.stateHitAreas[stateName];
            var labelBacking = this.labelShapes[stateName];
            var labelText = this.labelTexts[stateName];
            var labelHitArea = this.labelHitAreas[stateName]

            return {
                shape: stateShape,
                hitArea: stateHitArea,
                name: stateName,
                labelBacking: labelBacking,
                labelText: labelText,
                labelHitArea: labelHitArea
            };
        },

        /**
         * The mouseout handler
         */
        _onMouseOut: function(event) {
            var stateData = this._getStateFromEvent(event);

            // Stop if no state was found
            if(!stateData.hitArea) {
                return;
            }

            return !this._triggerEvent('mouseout', event, stateData);
        },

        /**
         *
         */
        _defaultMouseOutAction: function(stateData) {
            // hover effect
            // ... state shape
            var attrs = {};
            if(this.options.stateSpecificStyles[stateData.name]) {
                $.extend(attrs, this.options.stateStyles, this.options.stateSpecificStyles[stateData.name]);
            } else {
                attrs = this.options.stateStyles;
            }

            stateData.shape.animate(attrs, this.options.stateHoverAnimation);

            // ... for the label backing
            if(stateData.labelBacking) {
                var attrs = {};

                if(this.options.stateSpecificLabelBackingStyles[stateData.name]) {
                    $.extend(attrs, this.options.labelBackingStyles, this.options.stateSpecificLabelBackingStyles[stateData.name]);
                } else {
                    attrs = this.options.labelBackingStyles;
                }

                stateData.labelBacking.animate(attrs, this.options.stateHoverAnimation);
            }
        },

        /**
         * The click handler
         */
        _onClick: function(event) {
            var stateData = this._getStateFromEvent(event);

            // Stop if no state was found
            if(!stateData.hitArea) {
                return;
            }

            return !this._triggerEvent('click', event, stateData);
        },

        /**
         * The mouseover handler
         */
        _onMouseOver: function(event) {
            var stateData = this._getStateFromEvent(event);

            // Stop if no state was found
            if(!stateData.hitArea) {
                return;
            }

            return !this._triggerEvent('mouseover', event, stateData);
        },

        /**
         * The default on hover action for a state
         */
        _defaultMouseOverAction: function(stateData) {
            // hover effect
            this.bringShapeToFront(stateData.shape);
            this.paper.safari();

            // ... for the state
            var attrs = {};
            if(this.options.stateSpecificHoverStyles[stateData.name]) {
                $.extend(attrs, this.options.stateHoverStyles, this.options.stateSpecificHoverStyles[stateData.name]);
            } else {
                attrs = this.options.stateHoverStyles;
            }

            stateData.shape.animate(attrs, this.options.stateHoverAnimation);

            // ... for the label backing
            if(stateData.labelBacking) {
                var attrs = {};

                if(this.options.stateSpecificLabelBackingHoverStyles[stateData.name]) {
                    $.extend(attrs, this.options.labelBackingHoverStyles, this.options.stateSpecificLabelBackingHoverStyles[stateData.name]);
                } else {
                    attrs = this.options.labelBackingHoverStyles;
                }

                stateData.labelBacking.animate(attrs, this.options.stateHoverAnimation);
            }
        },

        /**
         * Trigger events
         *
         * @param type string - the type of event
         * @param event Event object - the original event object
         * @param stateData object - information about the state
         *
         * return boolean - true to continue to default action, false to prevent the default action
         */
        _triggerEvent: function(type, event, stateData) {
            var name = stateData.name;
            var defaultPrevented = false;

            // State specific
            var sEvent = $.Event('usmap'+type+name);
            sEvent.originalEvent = event;

            // Do the one in options first
            if(this.options[type+'State'][name]) {
                defaultPrevented = this.options[type+'State'][name](sEvent, stateData) === false;
            }

            // Then do the bounded ones
            if(sEvent.isPropagationStopped()) {
                this.element.trigger(sEvent, [stateData]);
                defaultPrevented = defaultPrevented || sEvent.isDefaultPrevented();
            }

            // General
            if(!sEvent.isPropagationStopped()) {
                var gEvent = $.Event('usmap'+type);
                gEvent.originalEvent = event;

                // Options handler first
                if(this.options[type]) {
                    defaultPrevented = this.options[type](gEvent, stateData) === false || defaultPrevented;
                }

                // Bounded options next
                if(!gEvent.isPropagationStopped()) {
                    this.element.trigger(gEvent, [stateData]);
                    defaultPrevented = defaultPrevented || gEvent.isDefaultPrevented();
                }
            }

            // Do the default action
            if(!defaultPrevented) {
                switch(type) {
                    case 'mouseover':
                        this._defaultMouseOverAction(stateData);
                        break;
                    case 'mouseout':
                        this._defaultMouseOutAction(stateData);
                        break;
                }
            }

            return !defaultPrevented;
        },

        /**
         *
          @param string state - The two letter state abbr
         */
        trigger: function(state, type, event) {
            type = type.replace('usmap', ''); // remove the usmap if they added it
            state = state.toUpperCase(); // ensure state is uppercase to match

            var stateData = this._getState(state);

            this._triggerEvent(type, event, stateData);
        },

        /**
         * Bring a state shape to the top of the state shapes, but not above the hit areas
         */
        bringShapeToFront: function(shape) {
            if(this.topShape) {
                shape.insertAfter(this.topShape);
            }

            this.topShape = shape;
        }
    };

    // Getters
    var getters = [];

    // Create the plugin
    jQueryPluginFactory($, 'usmap', methods, getters);

})(jQuery, document, window, Raphael);