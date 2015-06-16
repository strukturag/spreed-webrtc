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

package main

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"flag"
	"fmt"
	"github.com/gorilla/mux"
	"github.com/strukturag/goacceptlanguageparser"
	"github.com/strukturag/httputils"
	"github.com/strukturag/phoenix"
	"github.com/strukturag/sloth"
	"html/template"
	"log"
	"net/http"
	_ "net/http/pprof"
	"os"
	"path"
	goruntime "runtime"
	"strconv"
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

func mainHandler(w http.ResponseWriter, r *http.Request) {

	handleRoomView("", w, r)

}

func roomHandler(w http.ResponseWriter, r *http.Request) {

	vars := mux.Vars(r)
	handleRoomView(vars["room"], w, r)

}

func makeImageHandler(buddyImages ImageCache, expires time.Duration) http.HandlerFunc {

	return func(w http.ResponseWriter, r *http.Request) {

		vars := mux.Vars(r)
		image := buddyImages.Get(vars["imageid"])
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

	csp := false

	if config.contentSecurityPolicy != "" {
		w.Header().Set("Content-Security-Policy", config.contentSecurityPolicy)
		csp = true
	}
	if config.contentSecurityPolicyReportOnly != "" {
		w.Header().Set("Content-Security-Policy-Report-Only", config.contentSecurityPolicyReportOnly)
		csp = true
	}

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
	context := &Context{Cfg: config, App: "main", Host: r.Host, Scheme: scheme, Ssl: ssl, Csp: csp, Languages: langs, Room: room}

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

	var sessionSecret []byte
	sessionSecretString, err := runtime.GetString("app", "sessionSecret")
	if err != nil {
		return fmt.Errorf("No sessionSecret in config file.")
	}
	sessionSecret, err = hex.DecodeString(sessionSecretString)
	if err != nil {
		log.Println("Warning: sessionSecret value is not a hex encoded", err)
		sessionSecret = []byte(sessionSecretString)
	}
	if len(sessionSecret) < 32 {
		return fmt.Errorf("Length of sessionSecret must be at least 32 bytes.")
	}

	if len(sessionSecret) < 32 {
		log.Printf("Weak sessionSecret (only %d bytes). It is recommended to use a key with 32 or 64 bytes.\n", len(sessionSecret))
	}

	var encryptionSecret []byte
	encryptionSecretString, err := runtime.GetString("app", "encryptionSecret")
	if err != nil {
		return fmt.Errorf("No encryptionSecret in config file.")
	}
	encryptionSecret, err = hex.DecodeString(encryptionSecretString)
	if err != nil {
		log.Println("Warning: encryptionSecret value is not a hex encoded", err)
		encryptionSecret = []byte(encryptionSecretString)
	}
	switch l := len(encryptionSecret); {
	case l == 16:
	case l == 24:
	case l == 32:
	default:
		return fmt.Errorf("Length of encryptionSecret must be exactly 16, 24 or 32 bytes to select AES-128, AES-192 or AES-256.")
	}

	var turnSecret []byte
	turnSecretString, err := runtime.GetString("app", "turnSecret")
	if err == nil {
		turnSecret = []byte(turnSecretString)
	}

	serverRealm, err := runtime.GetString("app", "serverRealm")
	if err != nil {
		serverRealm = "local"
	}

	// Create token provider.
	tokenFile, err := runtime.GetString("app", "tokenFile")
	if err == nil {
		if !httputils.HasFilePath(path.Clean(tokenFile)) {
			return fmt.Errorf("Unable to find token file at %s", tokenFile)
		}
	}

	var tokenProvider TokenProvider
	if tokenFile != "" {
		log.Printf("Using token authorization from %s\n", tokenFile)
		tokenProvider = TokenFileProvider(tokenFile)
	}

	// Load remaining configuration items.
	config = NewConfig(runtime, tokenProvider != nil)

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

	// Define incoming channeling API limit it byte. Larger messages will be discarded.
	incomingCodecLimit := 1024 * 1024 // 1MB

	// Create realm string from config.
	computedRealm := fmt.Sprintf("%s.%s", serverRealm, config.Token)

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
	r := router.PathPrefix(config.B).Subrouter().StrictSlash(true)

	// HTTP listener support.
	if _, err = runtime.GetString("http", "listen"); err == nil {
		runtime.DefaultHTTPHandler(r)
	}

	// Native HTTPS listener support.
	if _, err = runtime.GetString("https", "listen"); err == nil {
		// Setup TLS.
		tlsConfig, err := runtime.TLSConfig()
		if err != nil {
			return fmt.Errorf("TLS configuration error: %s", err)
		}
		// Explicitly set random to use.
		tlsConfig.Rand = rand.Reader
		log.Println("Native TLS configuration intialized")
		runtime.DefaultHTTPSHandler(r)
	}

	// Add handlers.
	buddyImages := NewImageCache()
	codec := NewCodec(incomingCodecLimit)
	roomManager := NewRoomManager(config, codec)
	hub := NewHub(config, sessionSecret, encryptionSecret, turnSecret, codec)
	tickets := NewTickets(sessionSecret, encryptionSecret, computedRealm)
	sessionManager := NewSessionManager(config, tickets, hub, roomManager, roomManager, buddyImages, sessionSecret)
	statsManager := NewStatsManager(hub, roomManager, sessionManager)
	channellingAPI := NewChannellingAPI(config, roomManager, tickets, sessionManager, statsManager, hub, hub, hub)
	r.HandleFunc("/", httputils.MakeGzipHandler(mainHandler))
	r.Handle("/static/img/buddy/{flags}/{imageid}/{idx:.*}", http.StripPrefix(config.B, makeImageHandler(buddyImages, time.Duration(24)*time.Hour)))
	r.Handle("/static/{path:.*}", http.StripPrefix(config.B, httputils.FileStaticServer(http.Dir(rootFolder))))
	r.Handle("/robots.txt", http.StripPrefix(config.B, http.FileServer(http.Dir(path.Join(rootFolder, "static")))))
	r.Handle("/favicon.ico", http.StripPrefix(config.B, http.FileServer(http.Dir(path.Join(rootFolder, "static", "img")))))
	r.Handle("/ws", makeWSHandler(statsManager, sessionManager, codec, channellingAPI))

	// Simple room handler.
	r.HandleFunc("/{room}", httputils.MakeGzipHandler(roomHandler))

	// Add API end points.
	api := sloth.NewAPI()
	api.SetMux(r.PathPrefix("/api/v1/").Subrouter())
	api.AddResource(&Rooms{}, "/rooms")
	api.AddResource(config, "/config")
	api.AddResourceWithWrapper(&Tokens{tokenProvider}, httputils.MakeGzipHandler, "/tokens")
	if config.UsersEnabled {
		// Create Users handler.
		users := NewUsers(hub, tickets, sessionManager, config.UsersMode, serverRealm, runtime)
		api.AddResource(&Sessions{tickets, hub, users}, "/sessions/{id}/")
		if config.UsersAllowRegistration {
			api.AddResource(users, "/users")
		}
	}
	if statsEnabled {
		api.AddResourceWithWrapper(&Stats{statsManager}, httputils.MakeGzipHandler, "/stats")
		log.Println("Stats are enabled!")
	}

	// Add extra/static support if configured and exists.
	if extraFolder != "" {
		extraFolderStatic := path.Join(extraFolder, "static")
		if _, err = os.Stat(extraFolderStatic); err == nil {
			r.Handle("/extra/static/{path:.*}", http.StripPrefix(fmt.Sprintf("%sextra", config.B), httputils.FileStaticServer(http.Dir(extraFolder))))
			log.Printf("Added URL handler /extra/static/... for static files in %s/...\n", extraFolderStatic)
		}
	}

	// Map everything else to a room when it is a GET.
	rooms := r.PathPrefix("/").Methods("GET").Subrouter()
	rooms.HandleFunc("/{room:.*}", httputils.MakeGzipHandler(roomHandler))

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

	return phoenix.NewServer("server", version).
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
