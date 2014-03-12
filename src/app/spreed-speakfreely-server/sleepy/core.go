/* This is a modified version of https://github.com/dougblack/sleepy
 * with support for Gorilla muxing and full http.Request in handler.
 *
 * sleepy is released under the MIT License.
 */
package sleepy

import (
	"encoding/json"
	"github.com/gorilla/mux"
	"net/http"
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
	Get(*http.Request) (int, interface{})
}

// PostSupported is the interface that provides the Post
// method a resource must support to receive HTTP POSTs.
type PostSupported interface {
	Post(*http.Request) (int, interface{})
}

// PutSupported is the interface that provides the Put
// method a resource must support to receive HTTP PUTs.
type PutSupported interface {
	Put(*http.Request) (int, interface{})
}

// DeleteSupported is the interface that provides the Delete
// method a resource must support to receive HTTP DELETEs.
type DeleteSupported interface {
	Delete(*http.Request) (int, interface{})
}

// HandleSupported is the interface that provides a general
// use method to support custom request processing.
type HandleSupported interface {
	Handle(http.ResponseWriter, *http.Request) (int, []byte)
}

// An API manages a group of resources by routing requests
// to the correct method on a matching resource and marshalling
// the returned data to JSON for the HTTP response.
type API struct {
	mux *mux.Router
}

// NewAPI allocates and returns a new API.
func NewAPI(mux *mux.Router) *API {
	return &API{mux}
}

func (api *API) requestHandler(resource interface{}) http.HandlerFunc {
	return func(rw http.ResponseWriter, request *http.Request) {

		request.ParseForm()

		var code int
		var content []byte
		var err error

		if resource, ok := resource.(HandleSupported); ok {

			var handle func(http.ResponseWriter, *http.Request) (int, []byte)
			handle = resource.Handle
			code, content = handle(rw, request)

		} else {

			var handler func(*http.Request) (int, interface{})
			var data interface{}

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

			code, data = handler(request)
			rw.Header().Set("Content-Type", "application/json; charset=utf-8")

			content, err = json.MarshalIndent(data, "", "\t")
			if err != nil {
				rw.WriteHeader(http.StatusInternalServerError)
				return
			}

		}

		rw.WriteHeader(code)
		rw.Write(content)
	}
}

// AddResource adds a new resource to an API. The API will route
// requests that match one of the given paths to the matching HTTP
// method on the resource.
func (api *API) AddResource(resource interface{}, paths ...string) {
	for _, path := range paths {
		api.mux.HandleFunc(path, api.requestHandler(resource))
	}
}

func (api *API) AddResourceWithWrapper(resource interface{}, wrapper func(handler http.HandlerFunc) http.HandlerFunc, paths ...string) {
	for _, path := range paths {
		api.mux.HandleFunc(path, wrapper(api.requestHandler(resource)))
	}
}
