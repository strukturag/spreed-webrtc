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

package main

import (
	"app/spreed-webrtc-server/sleepy"
	"bytes"
	"flag"
	"fmt"
	"github.com/gorilla/mux"
	"github.com/strukturag/goacceptlanguageparser"
	"github.com/strukturag/httputils"
	"github.com/strukturag/phoenix"
	"html/template"
	"log"
	"net/http"
	_ "net/http/pprof"
	"os"
	"path"
	goruntime "runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

var version = "unreleased"
var defaultConfig = "./server.conf"

var templates *template.Template
var config *Config

// Helper to retrieve languages from request.
func getRequestLanguages(r *http.Request, supportedLanguages []string) []string {

	acceptLanguageHeader, ok := r.Header["Accept-Language"]
	var langs []string
	if ok {
		langs = goacceptlanguageparser.ParseAcceptLanguage(acceptLanguageHeader[0], supportedLanguages)
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

func makeImageHandler(hub *Hub, expires time.Duration) http.HandlerFunc {

	return func(w http.ResponseWriter, r *http.Request) {

		vars := mux.Vars(r)
		image := hub.buddyImages.Get(vars["imageid"])
		if image == nil {
			http.Error(w, "Unknown image", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", image.mimetype)
		w.Header().Set("ETag", image.lastChangeId)
		age := time.Now().Sub(image.lastChange)
		if age >= time.Second {
			w.Header().Set("Age", strconv.Itoa(int(age.Seconds())))
		}
		if expires >= time.Second {
			w.Header().Set("Expires", time.Now().Add(expires).Format(time.RFC1123))
			w.Header().Set("Cache-Control", "public, no-transform, max-age="+strconv.Itoa(int(expires.Seconds())))
		}
		http.ServeContent(w, r, "", image.lastChange, bytes.NewReader(image.data))
	}

}

func handleRoomView(room string, w http.ResponseWriter, r *http.Request) {

	var err error

	w.Header().Set("Content-Type", "text/html; charset=UTF-8")
	w.Header().Set("Expires", "-1")
	w.Header().Set("Cache-Control", "private, max-age=0")

	scheme := "http"

	// Detect if the request was made with SSL.
	ssl := r.TLS != nil
	proto, ok := r.Header["X-Forwarded-Proto"]
	if ok {
		ssl = proto[0] == "https"
		scheme = "https"
	}

	// Get languages from request.
	langs := getRequestLanguages(r, []string{})
	if len(langs) == 0 {
		langs = append(langs, "en")
	}

	// Prepare context to deliver to HTML..
	context := &Context{Cfg: config, App: "main", Host: r.Host, Scheme: scheme, Ssl: ssl, Languages: langs, Room: room}

	// Get URL parameters.
	r.ParseForm()

	// Check if incoming request is a crawler which supports AJAX crawling.
	// See https://developers.google.com/webmasters/ajax-crawling/docs/getting-started for details.
	if _, ok := r.Form["_escaped_fragment_"]; ok {
		// Render crawlerPage template..
		err = templates.ExecuteTemplate(w, "crawlerPage", &context)
	} else {
		// Render mainPage template.
		err = templates.ExecuteTemplate(w, "mainPage", &context)
	}

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}

}

func runner(runtime phoenix.Runtime) error {

	log.SetFlags(log.LstdFlags | log.Lmicroseconds)

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

	statsEnabled, err := runtime.GetBool("http", "stats")
	if err != nil {
		statsEnabled = false
	}

	pprofListen, err := runtime.GetString("http", "pprofListen")
	if err == nil && pprofListen != "" {
		log.Printf("Starting pprof HTTP server on %s", pprofListen)
		go func() {
			log.Println(http.ListenAndServe(pprofListen, nil))
		}()
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
		title = "Spreed WebRTC"
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

	defaultRoomEnabled := true
	defaultRoomEnabledString, err := runtime.GetString("app", "defaultRoomEnabled")
	if err == nil {
		defaultRoomEnabled = defaultRoomEnabledString == "true"
	}

	usersEnabled := false
	usersEnabledString, err := runtime.GetString("users", "enabled")
	if err == nil {
		usersEnabled = usersEnabledString == "true"
	}

	usersAllowRegistration := false
	usersAllowRegistrationString, err := runtime.GetString("users", "allowRegistration")
	if err == nil {
		usersAllowRegistration = usersAllowRegistrationString == "true"
	}

	serverToken, err := runtime.GetString("app", "serverToken")
	if err != nil {
		//TODO(longsleep): When we have a database, generate this once from random source and store it.
		serverToken = "i-did-not-change-the-public-token-boo"
	}

	serverRealm, err := runtime.GetString("app", "serverRealm")
	if err != nil {
		serverRealm = "local"
	}

	usersMode, _ := runtime.GetString("users", "mode")

	// Create token provider.
	var tokenProvider TokenProvider
	if tokenFile != "" {
		log.Printf("Using token authorization from %s\n", tokenFile)
		tokenProvider = TokenFileProvider(tokenFile)
	}

	// Create configuration data structure.
	config = NewConfig(title, ver, runtimeVersion, basePath, serverToken, stunURIs, turnURIs, tokenProvider != nil, globalRoomid, defaultRoomEnabled, usersEnabled, usersAllowRegistration, usersMode, plugin)

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
		}
		log.Printf("Loaded extra templates from: %s", extraFolder)
	}

	// Create realm string from config.
	computedRealm := fmt.Sprintf("%s.%s", serverRealm, serverToken)

	// Create our hub instance.
	hub := NewHub(runtimeVersion, config, sessionSecret, turnSecret, computedRealm)

	// Set number of go routines if it is 1
	if goruntime.GOMAXPROCS(0) == 1 {
		nCPU := goruntime.NumCPU()
		goruntime.GOMAXPROCS(nCPU)
		log.Printf("Using the number of CPU's (%d) as GOMAXPROCS\n", nCPU)
	}

	// Get current number of max open files.
	var rLimit syscall.Rlimit
	err = syscall.Getrlimit(syscall.RLIMIT_NOFILE, &rLimit)
	if err != nil {
		log.Println("Error getting max numer of open files", err)
	} else {
		log.Printf("Max open files are %d\n", rLimit.Max)
	}

	// Try to increase number of file open files. This only works as root.
	maxfd, err := runtime.GetInt("http", "maxfd")
	if err == nil {
		rLimit.Max = uint64(maxfd)
		rLimit.Cur = uint64(maxfd)
		err = syscall.Setrlimit(syscall.RLIMIT_NOFILE, &rLimit)
		if err != nil {
			log.Println("Error setting max open files", err)
		} else {
			log.Printf("Set max open files successfully to %d\n", uint64(maxfd))
		}
	}

	// Create router.
	router := mux.NewRouter()
	r := router.PathPrefix(basePath).Subrouter().StrictSlash(true)

	// Prepare listeners.
	runtime.DefaultHTTPHandler(r)
	runtime.DefaultHTTPSHandler(r)

	// Add handlers.
	r.HandleFunc("/", httputils.MakeGzipHandler(mainHandler))
	r.Handle("/static/img/buddy/{flags}/{imageid}/{idx:.*}", http.StripPrefix(basePath, makeImageHandler(hub, time.Duration(24)*time.Hour)))
	r.Handle("/static/{path:.*}", http.StripPrefix(basePath, httputils.FileStaticServer(http.Dir(rootFolder))))
	r.Handle("/robots.txt", http.StripPrefix(basePath, http.FileServer(http.Dir(path.Join(rootFolder, "static")))))
	r.Handle("/favicon.ico", http.StripPrefix(basePath, http.FileServer(http.Dir(path.Join(rootFolder, "static", "img")))))
	r.Handle("/ws", makeWsHubHandler(hub))
	r.HandleFunc("/{room}", httputils.MakeGzipHandler(roomHandler))

	// Add API end points.
	api := sleepy.NewAPI()
	api.SetMux(r.PathPrefix("/api/v1/").Subrouter())
	api.AddResource(&Rooms{}, "/rooms")
	api.AddResource(config, "/config")
	api.AddResourceWithWrapper(&Tokens{tokenProvider}, httputils.MakeGzipHandler, "/tokens")
	if usersEnabled {
		// Create Users handler.
		users := NewUsers(hub, usersMode, serverRealm, runtime)
		api.AddResource(&Sessions{hub: hub, users: users}, "/sessions/{id}/")
		if usersAllowRegistration {
			api.AddResource(users, "/users")
		}
	}
	if statsEnabled {
		api.AddResourceWithWrapper(&Stats{hub: hub}, httputils.MakeGzipHandler, "/stats")
		log.Println("Stats are enabled!")
	}

	// Add extra/static support if configured and exists.
	if extraFolder != "" {
		extraFolderStatic := path.Join(extraFolder, "static")
		if _, err = os.Stat(extraFolderStatic); err == nil {
			r.Handle("/extra/static/{path:.*}", http.StripPrefix(fmt.Sprintf("%sextra", basePath), httputils.FileStaticServer(http.Dir(extraFolder))))
			log.Printf("Added URL handler /extra/static/... for static files in %s/...\n", extraFolderStatic)
		}
	}

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

	return phoenix.NewServer("server", "").
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
