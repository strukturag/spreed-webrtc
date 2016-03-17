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

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/binary"
	"log"
	"strings"
	"sync"
	"time"
)

var imageFilenames map[string]string

type Image struct {
	updateIdx    int
	lastChange   time.Time
	lastChangeId string
	sessionid    string
	mimetype     string
	data         []byte
}

func (img *Image) LastChangeID() string {
	return img.lastChangeId
}

func (img *Image) LastChange() time.Time {
	return img.lastChange
}

func (img *Image) MimeType() string {
	return img.mimetype
}

func (img *Image) Reader() *bytes.Reader {
	return bytes.NewReader(img.data)
}

type ImageCache interface {
	Update(sessionId string, image string) string
	Get(imageId string) *Image
	Delete(sessionId string)
}

type imageCache struct {
	images        map[string]*Image
	sessionImages map[string]string
	mutex         sync.RWMutex
}

func NewImageCache() ImageCache {
	result := &imageCache{}
	result.images = make(map[string]*Image)
	result.sessionImages = make(map[string]string)
	if imageFilenames == nil {
		imageFilenames = map[string]string{
			"image/png":  "picture.png",
			"image/jpeg": "picture.jpg",
			"image/gif":  "picture.gif",
			"image/webp": "picture.webp",
		}
	}
	return result
}

func (self *imageCache) Update(sessionId string, image string) string {
	mimetype := "image/x-unknown"
	pos := strings.Index(image, ";")
	if pos != -1 {
		mimetype = image[:pos]
		image = image[pos+1:]
	}
	pos = strings.Index(image, ",")
	var decoded []byte
	var err error
	if pos != -1 {
		encoding := image[:pos]
		switch encoding {
		case "base64":
			decoded, err = base64.StdEncoding.DecodeString(image[pos+1:])
			if err != nil {
				return ""
			}
		default:
			log.Println("Unknown encoding", encoding)
			return ""
		}
	} else {
		decoded = []byte(image[pos+1:])
	}
	var img *Image
	self.mutex.RLock()
	result, ok := self.sessionImages[sessionId]
	if !ok {
		self.mutex.RUnlock()
		imageId := make([]byte, 15, 15)
		if _, err = rand.Read(imageId); err != nil {
			return ""
		}
		result = base64.URLEncoding.EncodeToString(imageId)
		img = &Image{sessionid: sessionId}
		self.mutex.Lock()
		resultTmp, ok := self.sessionImages[sessionId]
		if !ok {
			self.sessionImages[sessionId] = result
			self.images[result] = img
		} else {
			result = resultTmp
			img = self.images[result]
		}
		self.mutex.Unlock()
	} else {
		img = self.images[result]
		self.mutex.RUnlock()
	}
	if mimetype != img.mimetype || !bytes.Equal(img.data, decoded) {
		img.updateIdx++
		img.lastChange = time.Now()
		tmp := make([]byte, binary.MaxVarintLen64)
		count := binary.PutUvarint(tmp, uint64(img.lastChange.UnixNano()))
		img.lastChangeId = base64.URLEncoding.EncodeToString(tmp[:count])
		img.mimetype = mimetype
		img.data = decoded
	}
	result += "/" + img.lastChangeId
	filename, ok := imageFilenames[mimetype]
	if ok {
		result += "/" + filename
	}

	return result
}

func (self *imageCache) Get(imageId string) *Image {
	self.mutex.RLock()
	image := self.images[imageId]
	self.mutex.RUnlock()

	return image
}

func (self *imageCache) Delete(sessionId string) {
	self.mutex.Lock()
	imageId, ok := self.sessionImages[sessionId]
	if ok {
		delete(self.sessionImages, sessionId)
		delete(self.images, imageId)
	}
	self.mutex.Unlock()
}
