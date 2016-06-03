package main

import (
	"net/http"

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
