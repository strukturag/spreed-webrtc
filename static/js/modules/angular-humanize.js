/*
 * @license angular-humanize
 * Copyright 2013-2015 struktur AG, http://www.struktur.de
 * License: MIT
 */
(function(window, angular, humanize, undefined) {
	'use strict';

	/**
	 * # ngHumanize
	 *
	 * `ngHumanize` is the name of the optional Angular module that provides
	 * filters for humanization of data.
	 *
	 * The implementation uses [humanize.js](https://github.com/taijinlee/humanize)
	 * for humanization implementation functions.
	 *
	 */

	// define ngHumanize module
	var ngHumanize = angular.module('ngHumanize', []);

	/**
	 * This is a port of php.js date and behaves exactly like PHP's date.
	 * http://php.net/manual/en/function.date.php
	 */
	ngHumanize.filter("humanizeDate", function() {
		return function(input, format) {
			return humanize.date(format, input);
		}
	});

	/**
	 * Format a number to have decimal significant decimal places, using
	 * decPoint as the decimal separator, and thousandsSep as thousands separater.
	 */
	ngHumanize.filter("humanizeNumber", function() {
		return function(input, decimals, decPoint, thousandsSep) {
			return humanize.numberFormat(input, decimals, decPoint, thousandsSep);
		}
	});

	/**
	 * Returns 'today', 'tomorrow' or 'yesterday', as appropriate,
	 * otherwise format the date using the passed format with
	 * humanize.date().
	 */
	ngHumanize.filter("humanizeNaturalDay", function() {
		return function(input, format) {
			return humanize.naturalDay(input, format);
		}
	});

	/**
	 * Returns a relative time to the current time, seconds as the most
	 * granular up to years to the least granular.
	 */
	ngHumanize.filter("humanizeRelativeTime", function() {
		return function(input) {
			return humanize.relativeTime(input);
		}
	});

	/**
	 * Converts a number into its ordinal representation.
	 * http://en.wikipedia.org/wiki/Ordinal_number_(linguistics)
	 */
	ngHumanize.filter("humanizeOrdinal", function() {
		return function(format) {
			return humanize.ordinal(format);
		}
	});

	/**
	 * Converts a byte count to a human readable value using kilo as the basis,
	 * and numberFormat formatting.
	 */
	ngHumanize.filter("humanizeFilesize", function() {
		return function(input, kilo, decimals, decPoint, thousandsSep) {
			return humanize.filesize(input, kilo, decimals, decPoint, thousandsSep);
		}
	});

	/**
	 * Converts a string's newlines into properly formatted html ie. one
	 * new line -> br, two new lines -> p, entire thing wrapped in p.
	 */
	ngHumanize.filter("humanizeLinebreaks", function() {
		return function(input) {
			return humanize.linebreaks(input);
		}
	});

	/**
	 * Converts a string's newlines into br's.
	 */
	ngHumanize.filter("humanizeNl2br", function() {
		return function(input) {
			return humanize.nl2br(input);
		}
	});

	/**
	 * Truncates a string to length-1 and appends '…'. If string is shorter
	 * than length, then no-op.
	 */
	ngHumanize.filter("humanizeTruncatechars", function() {
		return function(input, length) {
			return humanize.truncatechars(input, length);
		}
	});

	/**
	 * Truncates a string to only include the first numWords words and
	 * appends '…'. If string has fewer words than numWords, then no-op.
	 */
	ngHumanize.filter("humanizeTruncatewords", function() {
		return function(input, numWords) {
			return humanize.truncatewords(input, numWords);
		}
	});

}(window, window.angular, window.humanize));
