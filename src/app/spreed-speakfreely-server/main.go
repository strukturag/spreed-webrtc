/*
 * Spreed Speak Freely.
 * Copyright (C) 2013-2014 struktur AG
 *
 * This file is part of Spreed Speak Freely.
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
package main

import (
	"flag"
	"fmt"
	"github.com/gorilla/mux"
	"github.com/strukturag/goacceptlanguageparser"
	"github.com/strukturag/httputils"
	"github.com/strukturag/phoenix"
	"html/template"
	"log"
	"net/http"
	"os"
	"path"
	"strings"
	"syscall"
	"time"
)

const (
	RLIMIT_NO_FILE = 32768
)

var version = "unreleased"
var defaultConfig = "./server.conf"

var templates *template.Template
var config *Config

// Helper to retrieve languages from request.
func getRequestLanguages(r *http.Request, supported_languages []string) []string {

	accept_language_header, ok := r.Header["Accept-Language"]
	var langs []string
	if ok {
		langs = goacceptlanguageparser.ParseAcceptLanguage(accept_language_header[0], supported_languages)
	}
	return langs

}

// Helper function to clean up string arrays.
func trimAndRemoveDuplicates(data *[]string) {
	found := make(map[string]bool)
	j := 0
	for i, x := range *data {
		x = strings.TrimSpace(x)
		if len(x) > 0 && !found[x] {
			found[x] = true
			(*data)[j] = (*data)[i]
			j++
		}
	}
	*data = (*data)[:j]
}

func mainHandler(w http.ResponseWriter, r *http.Request) {

	handleRoomView("", w, r)

}

func roomHandler(w http.ResponseWriter, r *http.Request) {

	vars := mux.Vars(r)
	handleRoomView(vars["room"], w, r)

}

func handleRoomView(room string, w http.ResponseWriter, r *http.Request) {

	w.Header().Set("Content-Type", "text/html; charset=UTF-8")
	w.Header().Set("Expires", "-1")
	w.Header().Set("Cache-Control", "private, max-age=0")

	// Detect if the request was made with SSL.
	ssl := false
	proto, ok := r.Header["X-Forwarded-Proto"]
	if ok {
		ssl = proto[0] == "https"
	}

	// Get languages from request.
	// TODO(longsleep): Added supported and default language to configuration.
	langs := getRequestLanguages(r, []string{"en", "de"})
	if len(langs) == 0 {
		langs = append(langs, "en")
	}

	// Prepare context to deliver to Javascript.
	context := &Context{Cfg: config, App: "main", Host: r.Host, Ssl: ssl, Languages: langs}

	// Render the template.
	err := templates.ExecuteTemplate(w, "mainPage", &context)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}

}

func runner(runtime phoenix.Runtime) error {
	rootFolder, err := runtime.GetString("http", "root")
	if err != nil {
		cwd, err2 := os.Getwd()
		if err2 != nil {
			return fmt.Errorf("Error while getting current directory: %s", err)
		}
		rootFolder = cwd
	}

	if !httputils.HasDirPath(rootFolder) {
		return fmt.Errorf("Configured root '%s' is not a directory.", rootFolder)
	}

	if !httputils.HasFilePath(path.Join(rootFolder, "static", "css", "main.min.css")) {
		return fmt.Errorf("Unable to find client. Path correct and compiled css?")
	}

	// Read base path from config and make sure it ends with a slash.
	basePath, err := runtime.GetString("http", "basePath")
	if err != nil {
		basePath = "/"
	} else {
		if !strings.HasSuffix(basePath, "/") {
			basePath = fmt.Sprintf("%s/", basePath)
		}
		log.Printf("Using '%s' base base path.", basePath)
	}

	sessionSecret, err := runtime.GetString("app", "sessionSecret")
	if err != nil {
		return fmt.Errorf("No sessionSecret in config file.")
	}

	tokenFile, err := runtime.GetString("app", "tokenFile")
	if err == nil {
		if !httputils.HasFilePath(path.Clean(tokenFile)) {
			return fmt.Errorf("Unable to find token file at %s", tokenFile)
		}
	}

	title, err := runtime.GetString("app", "title")
	if err != nil {
		title = "Spreed Speak Freely"
	}

	ver, err := runtime.GetString("app", "ver")
	if err != nil {
		ver = ""
	}

	runtimeVersion := version
	if version != "unreleased" {
		ver1 := ver
		if err != nil {
			ver1 = ""
		}
		ver = fmt.Sprintf("%s%s", ver1, strings.Replace(version, ".", "", -1))
	} else {
		ts := fmt.Sprintf("%d", time.Now().Unix())
		if err != nil {
			ver = ts
		}
		runtimeVersion = fmt.Sprintf("unreleased.%s", ts)
	}

	turnURIsString, err := runtime.GetString("app", "turnURIs")
	if err != nil {
		turnURIsString = ""
	}
	turnURIs := strings.Split(turnURIsString, " ")
	trimAndRemoveDuplicates(&turnURIs)

	turnSecret, err := runtime.GetString("app", "turnSecret")
	if err != nil {
		turnSecret = ""
	}

	stunURIsString, err := runtime.GetString("app", "stunURIs")
	if err != nil {
		stunURIsString = ""
	}
	stunURIs := strings.Split(stunURIsString, " ")
	trimAndRemoveDuplicates(&stunURIs)

	globalRoomid, err := runtime.GetString("app", "globalRoom")
	if err != nil {
		// Global room is disabled.
		globalRoomid = ""
	}

	plugin, err := runtime.GetString("app", "plugin")
	if err != nil {
		plugin = ""
	}

	// Create token provider.
	var tokenProvider TokenProvider
	if tokenFile != "" {
		log.Printf("Using token authorization from %s\n", tokenFile)
		tokenProvider = TokenFileProvider(tokenFile)
	}

	// Create configuration data structure.
	config = NewConfig(title, ver, runtimeVersion, basePath, stunURIs, turnURIs, tokenProvider != nil, globalRoomid, plugin)

	// Load templates.
	tt := template.New("")
	tt.Delims("<%", "%>")

	templates, err = tt.ParseGlob(path.Join(rootFolder, "html", "*.html"))
	if err != nil {
		return fmt.Errorf("Failed to load templates: %s", err)
	}

	// Load extra templates folder
	extraFolder, err := runtime.GetString("app", "extra")
	if err == nil {
		if !httputils.HasDirPath(extraFolder) {
			return fmt.Errorf("Configured extra '%s' is not a directory.", extraFolder)
		}
		templates, err = templates.ParseGlob(path.Join(extraFolder, "*.html"))
		if err != nil {
			return fmt.Errorf("Failed to load extra templates: %s", err)
		} else {
			log.Printf("Loaded extra templates from: %s", extraFolder)
		}
	}

	// Create our hub instance.
	hub := NewHub(runtimeVersion, config, sessionSecret, turnSecret)

	// Try to increase number of file open files. This only works as root.
	var rLimit syscall.Rlimit
	err = syscall.Getrlimit(syscall.RLIMIT_NOFILE, &rLimit)
	if err != nil {
		log.Println("Error getting rlimit numer of files", err)
	}
	rLimit.Max = RLIMIT_NO_FILE
	rLimit.Cur = RLIMIT_NO_FILE
	err = syscall.Setrlimit(syscall.RLIMIT_NOFILE, &rLimit)
	if err != nil {
		log.Println("Error setting rlimit", err)
	} else {
		log.Printf("Set rlimit successfully to %d\n", RLIMIT_NO_FILE)
	}

	// Create router.
	router := mux.NewRouter()
	r := router.PathPrefix(basePath).Subrouter().StrictSlash(true)
	r.HandleFunc("/", httputils.MakeGzipHandler(mainHandler))
	r.Handle("/static/{path:.*}", http.StripPrefix(basePath, httputils.FileStaticServer(http.Dir(rootFolder))))
	r.Handle("/robots.txt", http.StripPrefix(basePath, http.FileServer(http.Dir(path.Join(rootFolder, "static")))))
	r.Handle("/favicon.ico", http.StripPrefix(basePath, http.FileServer(http.Dir(path.Join(rootFolder, "static", "img")))))
	r.Handle("/ws", makeWsHubHandler(hub))
	r.HandleFunc("/{room}", httputils.MakeGzipHandler(roomHandler))
	makeApiHandler(r, tokenProvider)
	runtime.DefaultHTTPHandler(r)

	return runtime.Start()
}

func boot() error {
	configPath := flag.String("c", defaultConfig, "Configuration file.")
	logPath := flag.String("l", "", "Log file, defaults to stderr.")
	showVersion := flag.Bool("v", false, "Display version number and exit.")
	memprofile := flag.String("memprofile", "", "Write memory profile to this file.")
	cpuprofile := flag.String("cpuprofile", "", "Write cpu profile to file.")
	showHelp := flag.Bool("h", false, "Show this usage information and exit.")
	flag.Parse()

	if *showHelp {
		flag.Usage()
		return nil
	} else if *showVersion {
		fmt.Printf("Version %s\n", version)
		return nil
	}

	return phoenix.NewServer("mediastream-connector", "").
		Config(configPath).
		Log(logPath).
		CpuProfile(cpuprofile).
		MemProfile(memprofile).
		Run(runner)
}

func main() {
	if boot() != nil {
		os.Exit(-1)
	}
}
