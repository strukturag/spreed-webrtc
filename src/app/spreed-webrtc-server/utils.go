package main

import (
	"fmt"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/strukturag/goacceptlanguageparser"
)

// Helper to retrieve languages from request.
func getRequestLanguages(r *http.Request, supportedLanguages []string) []string {
	acceptLanguageHeader, ok := r.Header["Accept-Language"]
	var langs []string
	if ok {
		langs = goacceptlanguageparser.ParseAcceptLanguage(acceptLanguageHeader[0], supportedLanguages)
	}
	return langs
}

func rewriteExtraDUrl(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)

		extra, ok := vars["extra"]
		if !ok {
			http.NotFound(w, r)
			return
		}
		path, ok := vars["path"]
		if !ok {
			http.NotFound(w, r)
			return
		}

		r.URL.Path = fmt.Sprintf("%s/static/%s", extra, path)
		h.ServeHTTP(w, r)
	})
}
