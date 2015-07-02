/*
 * Spreed WebRTC.
 * Copyright (C) 2013-2014 struktur AG
 *
 * This file is part of Spreed WebRTC.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */
/*jshint -W030 */
({
    logLevel: 2,
	baseUrl: '../static/js',
	mainConfigFile: '../static/js/main.js',
	optimize: 'uglify2',
	uglify2: {
		output: {
			beautify: false
		},
		compress: {
			sequences: true,
			global_defs: {
				DEBUG: false
			}
		},
		warnings: false,
		mangle: true
	},
	wrap: false,
	useStrict: false,
	dir: './out',
	skipDirOptimize: true,
	removeCombined: true,
	modules: [
		{
			name: 'main',
			exclude: [
				'base'
			]
		},
		{
			name: 'base'
		},
		{
			name: 'app',
			exclude: [
				'main',
				'base'
			],
			inlineText: true,
		},
		{
			name: 'libs/pdf/pdf',
			dir: './out/libs/pdf',
			override: {
				skipModuleInsertion: true
			}
		},
		{
			name: 'libs/pdf/compatibility',
			dir: './out/libs/compatibility',
			override: {
				skipModuleInsertion: true
			}
		},
		{
			name: 'libs/pdf/pdf.worker',
			dir: './out/libs/pdf',
			override: {
				skipModuleInsertion: true
			}
		},
		{
			name: 'sandboxes/youtube',
			dir: './out/sandboxes',
			override: {
				skipModuleInsertion: true
			}
		},
		{
			name: 'sandboxes/pdf',
			dir: './out/sandboxes',
			override: {
				skipModuleInsertion: true
			}
		},
		{
			name: 'sandboxes/webodf',
			dir: './out/sandboxes',
			override: {
				skipModuleInsertion: true
			}
		}
	]
})
