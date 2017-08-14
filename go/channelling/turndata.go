/*
 * Spreed WebRTC.
 * Copyright (C) 2013-2015 struktur AG
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

package channelling

type TurnDataReceiver interface {
	Index() uint64

	TurnDataAvailable(*DataTurn)
}

type TurnDataCreator interface {
	/*
		First parameter is the id of the session that requests the TURN data.
		Second parameter will be notified when TURN data become available if none
		were ready at the time the method was called (can be nil if no notification
		is required).
	*/
	CreateTurnData(string, TurnDataReceiver) *DataTurn
}
