/*
 * jquery.injectCSS.js - jquery css injection plugin
 * Copyright (C) 2013, Robert Kajic (robert@kajic.com)
 * http://kajic.com
 *
 * https://github.com/kajic/jquery-injectCSS
 * Allows for injection of CSS defined as javascript JSS objects.
 *
 * Based on JSS (http://jss-lang.org/).
 *
 * Licensed under the MIT License.
 *
 * Date: 2013-01-08
 * Version: 0.1
 */

(function (jQuery) {
    'use strict';

    function toCSS(jss) {
        function jsonToCSS(scope, css) {
            if (scope && !result[scope]) {
                result[scope] = {};
            }
            for (var property in css) {
                var value = css[property];
                if (value instanceof Array) {
                    var values = value;
                    for (var i = 0; i < values.length; i++) {
                        addProperty(scope, property, values[i]);
                    }
                }
                else {
                    switch (typeof(value)) {
                        case "number":
                        case "string":
                            addProperty(scope, property, value);
                            break;
                        case "object":
                            var endChar = property.charAt(property.length - 1);
                            if (scope && (endChar === "_" || endChar === "-")) {
                                var variants = value;
                                for (var key in variants) {
                                    // key may be a comma separted list
                                    var list = key.split(/\s*,\s*/);
                                    for (var j = 0; j < list.length; j++) {
                                        var valueVariant = variants[key];
                                        if (valueVariant instanceof Array) {
                                            var valuesVariant = valueVariant;
                                            for (var k = 0; k < valuesVariant.length; k++) {
                                                addProperty(scope, property + list[j], valuesVariant[k]);
                                            }
                                        }
                                        else {
                                            addProperty(scope, property + list[j], variants[key]);
                                        }
                                    }
                                }
                            }
                            else {
                                jsonToCSS(makeSelectorName(scope, property), value);
                            }
                            break;
                    }
                }
            }
        }

        function makePropertyName(n) {
            return n.replace(/_/g, "-");
        }

        function makeSelectorName(scope, name) {
            var snames = [];
            var names = name.split(/\s*,\s*/);
            var scopes = scope.split(/\s*,\s*/);
            for (var s = 0; s < scopes.length; s++) {
                var currentScope = scopes[s];
                for (var i = 0; i < names.length; i++) {
                    var currentName = names[i];
                    if (currentName.charAt(0) === "&") {
                        snames.push(currentScope + currentName.substr(1));
                    } else {
                        snames.push(currentScope ? currentScope + " " + currentName : currentName);
                    }
                }
            }
            return snames.join(", ");
        }

        function addProperty(scope, property, value) {

            if (typeof(value) === "number") {
                value = value + "px";
            }

            var properties = property.split(/\s*,\s*/);
            for (var i = 0; i < properties.length; i++) {
                var currentProperty = makePropertyName(properties[i]);

                if (result[scope][currentProperty]) {
                    result[scope][currentProperty].push(value);
                } else {
                    result[scope][currentProperty] = [value];
                }
            }
        }

        // --------------


        var result = {};

        if (typeof(jss) === "string") {
            // evaluate the JSS object:
            try {
                eval("var jss = {" + jss + "}");
            }
            catch (e) {
                return "/*\nUnable to parse JSS: " + e + "\n*/";
            }
        }

        jsonToCSS("", jss);

        // output result:
        var ret = "";
        for (var a in result) {
            var css = result[a];
            ret += a + " {\n";
            for (var i in css) {
                var values = css[i];    // this is an array !
                for (var j = 0; j < values.length; j++) {
                    ret += "\t" + i + ": " + values[j] + ";\n";
                }
            }
            ret += "}\n";
        }
        return ret;
    }

    var defaults = {
        truncateFirst: false,
        containerName: "injectCSSContainer"
    };

    jQuery.injectCSS = function (jss, options) {
        options = jQuery.extend({}, defaults, options);

        options.media = options.media || 'all';

        var container = jQuery("#" + options.containerName);
        if (!container.length) {
            container = jQuery("<style></style>").appendTo('head').attr({
                media: options.media,
                id: options.containerName,
                type: 'text/css'
            });
        }

        var css = "";
        if (!options.truncateFirst) {
            css += container.text();
        }
        css += toCSS(jss);

        var containerDomElem = container[0];
        if (containerDomElem.styleSheet !== undefined && containerDomElem.styleSheet.cssText !== undefined) { // IE
            containerDomElem.styleSheet.cssText = css;
        } else {
            container.text(css); //Others
        }

        return container;
    };
}(jQuery));
