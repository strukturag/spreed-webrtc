/**
 * A RESTful framework for Go
 *
 * Modified version of sleepy to support Gorilla muxers.
 * https://github.com/strukturag/sleepy
 *
 * Copyright (c) 2014 struktur AG
 * Copyright (c) 2013-2014 Doug Black and the Sleepy authors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
**/

package sleepy

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gorilla/mux"
	"net/http"
	"net/url"
)

const (
	GET    = "GET"
	POST   = "POST"
	PUT    = "PUT"
	DELETE = "DELETE"
)

// GetSupported is the interface that provides the Get
// method a resource must support to receive HTTP GETs.
type GetSupported interface {
	Get(url.Values, http.Header) (int, interface{}, http.Header)
}

// PostSupported is the interface that provides the Post
// method a resource must support to receive HTTP POSTs.
type PostSupported interface {
	Post(url.Values, http.Header) (int, interface{}, http.Header)
}

// PutSupported is the interface that provides the Put
// method a resource must support to receive HTTP PUTs.
type PutSupported interface {
	Put(url.Values, http.Header) (int, interface{}, http.Header)
}

// DeleteSupported is the interface that provides the Delete
// method a resource must support to receive HTTP DELETEs.
type DeleteSupported interface {
	Delete(url.Values, http.Header) (int, interface{}, http.Header)
}

// Interface for arbitrary muxer support (like http.ServeMux).
type APIMux interface {
	HandleFunc(pattern string, handler func(http.ResponseWriter, *http.Request)) *mux.Route
	ServeHTTP(w http.ResponseWriter, r *http.Request)
}

// An API manages a group of resources by routing requests
// to the correct method on a matching resource and marshalling
// the returned data to JSON for the HTTP response.
//
// You can instantiate multiple APIs on separate ports. Each API
// will manage its own set of resources.
type API struct {
	mux            APIMux
	muxInitialized bool
}

// NewAPI allocates and returns a new API.
func NewAPI() *API {
	return &API{}
}

func (api *API) requestHandler(resource interface{}) http.HandlerFunc {
	return func(rw http.ResponseWriter, request *http.Request) {

		if request.ParseForm() != nil {
			rw.WriteHeader(http.StatusBadRequest)
			return
		}

		var handler func(url.Values, http.Header) (int, interface{}, http.Header)

		switch request.Method {
		case GET:
			if resource, ok := resource.(GetSupported); ok {
				handler = resource.Get
			}
		case POST:
			if resource, ok := resource.(PostSupported); ok {
				handler = resource.Post
			}
		case PUT:
			if resource, ok := resource.(PutSupported); ok {
				handler = resource.Put
			}
		case DELETE:
			if resource, ok := resource.(DeleteSupported); ok {
				handler = resource.Delete
			}
		}

		if handler == nil {
			rw.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		code, data, header := handler(request.Form, request.Header)

		content, err := json.MarshalIndent(data, "", "  ")
		if err != nil {
			rw.WriteHeader(http.StatusInternalServerError)
			return
		}
		for name, values := range header {
			for _, value := range values {
				rw.Header().Add(name, value)
			}
		}
		rw.WriteHeader(code)
		rw.Write(content)
	}
}

// Mux returns the muxer used by an API. If a ServeMux does not
// yet exist, a new *http.ServeMux will be created and returned.
func (api *API) Mux() APIMux {
	if api.muxInitialized {
		return api.mux
	} else {
		api.mux = mux.NewRouter()
		api.muxInitialized = true
		return api.mux
	}
}

// SetMux sets the muxer to use by an API. A muxer needs to
// implement the APIMux interface (eg. http.ServeMux).
func (api *API) SetMux(mux APIMux) error {
	if api.muxInitialized {
		return errors.New("You cannot set a muxer when already initialized.")
	} else {
		api.mux = mux
		api.muxInitialized = true
		return nil
	}
}

// AddResource adds a new resource to an API. The API will route
// requests that match one of the given paths to the matching HTTP
// method on the resource.
func (api *API) AddResource(resource interface{}, paths ...string) {
	for _, path := range paths {
		api.Mux().HandleFunc(path, api.requestHandler(resource))
	}
}

// AddResourceWithWrapper behaves exactly like AddResource but wraps
// the generated handler function with a give wrapper function to allow
// to hook in Gzip support and similar.
func (api *API) AddResourceWithWrapper(resource interface{}, wrapper func(handler http.HandlerFunc) http.HandlerFunc, paths ...string) {
	for _, path := range paths {
		api.Mux().HandleFunc(path, wrapper(api.requestHandler(resource)))
	}
}

// Start causes the API to begin serving requests on the given port.
func (api *API) Start(port int) error {
	if !api.muxInitialized {
		return errors.New("You must add at least one resource to this API.")
	}
	portString := fmt.Sprintf(":%d", port)
	return http.ListenAndServe(portString, api.Mux())
}
