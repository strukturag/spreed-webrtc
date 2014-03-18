package main

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"log"
	"strconv"
	"strings"
	"sync"
)

var imageFilenames map[string]string

type Image struct {
	updateIdx int
	userid    string
	mimetype  string
	data      []byte
}

type ImageCache interface {
	Update(userId string, image string) string

	Get(imageId string) *Image

	DeleteUserImage(userId string)
}

type imageCache struct {
	images     map[string]*Image
	userImages map[string]string
	mutex      sync.RWMutex
}

func NewImageCache() ImageCache {
	result := &imageCache{}
	result.images = make(map[string]*Image)
	result.userImages = make(map[string]string)
	if imageFilenames == nil {
		imageFilenames = map[string]string{
			"image/png":  "picture.png",
			"image/jpeg": "picture.jpg",
			"image/gif":  "picture.gif",
		}
	}
	return result
}

func (self *imageCache) Update(userId string, image string) string {
	var mimetype string = "image/x-unknown"
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
	result, ok := self.userImages[userId]
	if !ok {
		self.mutex.RUnlock()
		imageId := make([]byte, 16, 16)
		if _, err = rand.Read(imageId); err != nil {
			return ""
		}
		result = base64.URLEncoding.EncodeToString(imageId)
		img = &Image{userid: userId}
		self.mutex.Lock()
		resultTmp, ok := self.userImages[userId]
		if !ok {
			self.userImages[userId] = result
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
		img.mimetype = mimetype
		img.data = decoded
	}
	result += "/" + strconv.Itoa(img.updateIdx)
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

func (self *imageCache) DeleteUserImage(userId string) {
	self.mutex.Lock()
	imageId, ok := self.userImages[userId]
	if ok {
		delete(self.userImages, userId)
		delete(self.images, imageId)
	}
	self.mutex.Unlock()
}
