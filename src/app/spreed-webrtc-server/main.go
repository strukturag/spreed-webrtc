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
	"html/template"
	"log"
	"net/http"
	_ "net/http/pprof"
	"os"
	"path"
	"path/filepath"
	goruntime "runtime"
	"sort"
	"strings"
	"syscall"
	"time"

	"github.com/strukturag/spreed-webrtc/go/channelling"
	"github.com/strukturag/spreed-webrtc/go/channelling/api"
	"github.com/strukturag/spreed-webrtc/go/channelling/server"
	"github.com/strukturag/spreed-webrtc/go/natsconnection"

	"github.com/gorilla/mux"
	"github.com/strukturag/httputils"
	"github.com/strukturag/phoenix"
	"github.com/strukturag/sloth"
)

var version = "unreleased"
var defaultConfig = "./server.conf"

var templates *template.Template
var templatesExtraDHead template.HTML
var templatesExtraDBody template.HTML
var config *channelling.Config

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

	pipelinesEnabled, err := runtime.GetBool("app", "pipelinesEnabled")
	if err != nil {
		pipelinesEnabled = false
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

	var tokenProvider channelling.TokenProvider
	if tokenFile != "" {
		log.Printf("Using token authorization from %s\n", tokenFile)
		tokenProvider = channelling.TokenFileProvider(tokenFile)
	}

	// Nats pub/sub supports.
	natsChannellingTrigger, _ := runtime.GetBool("nats", "channelling_trigger")
	natsChannellingTriggerSubject, _ := runtime.GetString("nats", "channelling_trigger_subject")
	if natsURL, err := runtime.GetString("nats", "url"); err == nil {
		if natsURL != "" {
			natsconnection.DefaultURL = natsURL
		}
	}
	if natsEstablishTimeout, err := runtime.GetInt("nats", "establishTimeout"); err == nil {
		if natsEstablishTimeout != 0 {
			natsconnection.DefaultEstablishTimeout = time.Duration(natsEstablishTimeout) * time.Second
		}
	}
	natsClientId, _ := runtime.GetString("nats", "client_id")

	// Load remaining configuration items.
	config, err = server.NewConfig(runtime, tokenProvider != nil)
	if err != nil {
		return err
	}

	// Load templates.
	templates = template.New("")
	templates.Delims("<%", "%>")

	// Load html templates folder
	err = filepath.Walk(path.Join(rootFolder, "html"), func(path string, info os.FileInfo, err error) error {
		if err == nil {
			if strings.HasSuffix(path, ".html") {
				_, err = templates.ParseFiles(path)
				if err != nil {
					return err
				}
			}
		}
		return nil
	})
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

	// Load extra.d folder
	extraDFolder, err := runtime.GetString("app", "extra.d")
	if err == nil {
		if !httputils.HasDirPath(extraDFolder) {
			return fmt.Errorf("Configured extra.d '%s' is not a directory.", extraDFolder)
		}
		err = loadExtraD(extraDFolder)
		if err != nil {
			return fmt.Errorf("Failed to process extra.d folder: %s", err)
		}
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
		rLimit.Max = rlimitType(maxfd)
		rLimit.Cur = rlimitType(maxfd)
		err = syscall.Setrlimit(syscall.RLIMIT_NOFILE, &rLimit)
		if err != nil {
			log.Println("Error setting max open files", err)
		} else {
			log.Printf("Set max open files successfully to %d\n", rlimitType(maxfd))
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

	// Prepare services.
	apiConsumer := channelling.NewChannellingAPIConsumer()
	buddyImages := channelling.NewImageCache()
	codec := channelling.NewCodec(incomingCodecLimit)
	roomManager := channelling.NewRoomManager(config, codec)
	hub := channelling.NewHub(config, sessionSecret, encryptionSecret, turnSecret, codec)
	tickets := channelling.NewTickets(sessionSecret, encryptionSecret, computedRealm)
	sessionManager := channelling.NewSessionManager(config, tickets, hub, roomManager, roomManager, buddyImages, sessionSecret)
	statsManager := channelling.NewStatsManager(hub, roomManager, sessionManager)
	busManager := channelling.NewBusManager(apiConsumer, natsClientId, natsChannellingTrigger, natsChannellingTriggerSubject)
	pipelineManager := channelling.NewPipelineManager(busManager, sessionManager, sessionManager, sessionManager)
	if err := roomManager.SetBusManager(busManager); err != nil {
		return err
	}

	// Create API.
	channellingAPI := api.New(config, roomManager, tickets, sessionManager, statsManager, hub, hub, hub, busManager, pipelineManager)
	apiConsumer.SetChannellingAPI(channellingAPI)

	// Start bus.
	busManager.Start()

	// Add handlers.
	r.HandleFunc("/", httputils.MakeGzipHandler(mainHandler))
	r.Handle("/static/img/buddy/{flags}/{imageid}/{idx:.*}", http.StripPrefix(config.B, makeImageHandler(buddyImages, time.Duration(24)*time.Hour)))
	r.Handle("/static/{path:.*}", http.StripPrefix(config.B, httputils.FileStaticServer(http.Dir(rootFolder))))
	r.Handle("/robots.txt", http.StripPrefix(config.B, http.FileServer(http.Dir(path.Join(rootFolder, "static")))))
	r.Handle("/favicon.ico", http.StripPrefix(config.B, http.FileServer(http.Dir(path.Join(rootFolder, "static", "img")))))
	r.HandleFunc("/.well-known/spreed-configuration", wellKnownHandler)

	// Sandbox handler.
	r.HandleFunc("/sandbox/{origin_scheme}/{origin_host}/{sandbox}.html", httputils.MakeGzipHandler(sandboxHandler))

	// Add RESTful API end points.
	rest := sloth.NewAPI()
	rest.SetMux(r.PathPrefix("/api/v1/").Subrouter())
	rest.AddResource(&server.Rooms{}, "/rooms")
	rest.AddResource(config, "/config")
	rest.AddResourceWithWrapper(&server.Tokens{tokenProvider}, httputils.MakeGzipHandler, "/tokens")

	var users *server.Users
	if config.UsersEnabled {
		// Create Users handler.
		users = server.NewUsers(hub, tickets, sessionManager, config.UsersMode, serverRealm, runtime)
		rest.AddResource(&server.Sessions{tickets, hub, users}, "/sessions/{id}/")
		if config.UsersAllowRegistration {
			rest.AddResource(users, "/users")
		}
	}
	if statsEnabled {
		rest.AddResourceWithWrapper(&server.Stats{statsManager}, httputils.MakeGzipHandler, "/stats")
		log.Println("Stats are enabled!")
	}
	if pipelinesEnabled {
		pipelineManager.Start()
		rest.AddResource(&server.Pipelines{pipelineManager, channellingAPI}, "/pipelines/{id}")
		log.Println("Pipelines API is enabled!")
	}

	// Add extra/static support if configured and exists.
	if extraFolder != "" {
		extraFolderStatic, _ := filepath.Abs(path.Join(extraFolder, "static"))
		if _, err = os.Stat(extraFolderStatic); err == nil {
			r.Handle("/extra/static/{path:.*}", http.StripPrefix(fmt.Sprintf("%sextra", config.B), httputils.FileStaticServer(http.Dir(extraFolder))))
			log.Printf("Added URL handler /extra/static/... for static files in %s/...\n", extraFolderStatic)
		}
	}

	// Add extra.d/static support if configured.
	if extraDFolder != "" {
		extraDFolderStatic, _ := filepath.Abs(extraDFolder)
		r.Handle("/extra.d/static/{ver}/{extra}/{path:.*}", http.StripPrefix(fmt.Sprintf("%sextra.d/static", config.B), rewriteExtraDUrl(httputils.FileStaticServer(http.Dir(extraDFolderStatic)))))
		log.Printf("Added URL handler /extra.d/static/... for static files in %s/.../static/... \n", extraDFolderStatic)
	}

	// Finally add websocket handler.
	r.Handle("/ws", makeWSHandler(statsManager, sessionManager, codec, channellingAPI, users))

	// Simple room handler.
	r.HandleFunc("/{room}", httputils.MakeGzipHandler(roomHandler))

	// Map everything else to a room when it is a GET.
	rooms := r.PathPrefix("/").Methods("GET").Subrouter()
	rooms.HandleFunc("/{room:.*}", httputils.MakeGzipHandler(roomHandler))

	return runtime.Start()
}

func loadExtraD(extraDFolder string) error {
	f, err := os.Open(extraDFolder)
	if err != nil {
		return err
	}

	extras, err := f.Readdirnames(-1)
	if err != nil {
		return err
	}
	f.Close()

	// Sort by name.
	sort.Strings(extras)

	var headBuf bytes.Buffer
	var bodyBuf bytes.Buffer
	context := &channelling.Context{
		Cfg: config,
	}

	for _, extra := range extras {
		info, err := os.Stat(filepath.Join(extraDFolder, extra))
		if err != nil {
			log.Println("Failed to add extra.d folder", extra, err)
			continue
		}
		if !info.IsDir() {
			continue
		}

		context.S = fmt.Sprintf("extra.d/%s/%s", config.S, extra)
		extraDTemplates := template.New("")
		extraDTemplates.Delims("<%", "%>")
		extraBase := path.Join(extraDFolder, extra)
		extraDTemplates.ParseFiles(path.Join(extraBase, "head.html"), path.Join(extraBase, "body.html"))
		if headTemplate := extraDTemplates.Lookup("head.html"); headTemplate != nil {
			if err := headTemplate.Execute(&headBuf, context); err != nil {
				log.Println("Failed to parse extra.d template", extraBase, "head.html", err)
			}

		}
		if bodyTemplate := extraDTemplates.Lookup("body.html"); bodyTemplate != nil {
			if err := bodyTemplate.Execute(&bodyBuf, context); err != nil {
				log.Println("Failed to parse extra.d template", extraBase, "body.html", err)
			}
		}
	}

	templatesExtraDHead = template.HTML(headBuf.String())
	templatesExtraDBody = template.HTML(bodyBuf.String())

	return nil
}

func boot() error {
	defaultConfigPath := flag.String("dc", "", "Default configuration file.")
	configPath := flag.String("c", defaultConfig, "Configuration file.")
	overrideConfigPath := flag.String("oc", "", "Override configuration file.")
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
		DefaultConfig(defaultConfigPath).
		Config(configPath).
		OverrideConfig(overrideConfigPath).
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
