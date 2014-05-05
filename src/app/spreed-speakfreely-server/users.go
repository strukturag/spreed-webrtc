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
	"crypto"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/longsleep/pkac"
	"github.com/satori/go.uuid"
	"github.com/strukturag/phoenix"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"
)

var (
	serialNumberLimit *big.Int = new(big.Int).Lsh(big.NewInt(1), 128)
)

type UsersHandler interface {
	Get(request *http.Request) (string, error)
	Validate(snr *SessionNonceRequest, request *http.Request) (string, error)
	Create(snr *UserNonce, request *http.Request) (*UserNonce, error)
}

type UsersSharedsecretHandler struct {
	secret []byte
}

func (uh *UsersSharedsecretHandler) createHMAC(useridCombo string) string {

	m := hmac.New(sha256.New, uh.secret)
	m.Write([]byte(useridCombo))
	return base64.StdEncoding.EncodeToString(m.Sum(nil))

}

func (uh *UsersSharedsecretHandler) Get(request *http.Request) (userid string, err error) {
	return
}

func (uh *UsersSharedsecretHandler) Validate(snr *SessionNonceRequest, request *http.Request) (string, error) {

	// Parse UseridCombo.
	useridCombo := strings.SplitN(snr.UseridCombo, ":", 2)
	expirationString, userid := useridCombo[0], useridCombo[1]

	expiration, err := strconv.ParseInt(expirationString, 10, 64)
	if err != nil {
		return "", err
	}

	// Check expiration.
	if time.Unix(expiration, 0).Before(time.Now()) {
		return "", errors.New("expired secret")
	}

	secret := uh.createHMAC(snr.UseridCombo)
	if snr.Secret != secret {
		return "", errors.New("invalid secret")
	}

	return userid, nil

}

func (uh *UsersSharedsecretHandler) Create(un *UserNonce, request *http.Request) (*UserNonce, error) {

	// TODO(longsleep): Make this configureable - One year for now ...
	expiration := time.Now().Add(time.Duration(1) * time.Hour * 24 * 31 * 12)
	un.Timestamp = expiration.Unix()
	un.UseridCombo = fmt.Sprintf("%d:%s", un.Timestamp, un.Userid)
	un.Secret = uh.createHMAC(un.UseridCombo)

	return un, nil

}

type UsersHTTPHeaderHandler struct {
	headerName string
}

func (uh *UsersHTTPHeaderHandler) Get(request *http.Request) (userid string, err error) {
	userid = request.Header.Get(uh.headerName)
	if userid == "" {
		err = errors.New("no userid provided")
	}
	return
}

func (uh *UsersHTTPHeaderHandler) Validate(snr *SessionNonceRequest, request *http.Request) (string, error) {
	return uh.Get(request)
}

func (uh *UsersHTTPHeaderHandler) Create(un *UserNonce, request *http.Request) (*UserNonce, error) {
	return nil, errors.New("create is not possible in httpheader mode")
}

type UsersCertificateHandler struct {
	validFor    time.Duration
	privateKey  crypto.PrivateKey
	certificate *x509.Certificate
}

func (uh *UsersCertificateHandler) makeTemplate(commonName string) (*x509.Certificate, error) {

	notBefore := time.Now()
	notAfter := notBefore.Add(uh.validFor)

	serialNumber, err := rand.Int(rand.Reader, serialNumberLimit)
	if err != nil {
		return nil, err
	}

	return &x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			CommonName: commonName,
		},
		NotBefore:             notBefore,
		NotAfter:              notAfter,
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
		BasicConstraintsValid: true,
	}, nil

}

func (uh *UsersCertificateHandler) Get(request *http.Request) (userid string, err error) {

	if request.TLS == nil || len(request.TLS.VerifiedChains) == 0 {
		return
	}
	chain := request.TLS.VerifiedChains[0]
	if len(chain) == 0 {
		return
	}

	cert := chain[0]
	userid = cert.Subject.CommonName
	log.Printf("Client certificate found for user: %s\n", userid)

	return
}

func (uh *UsersCertificateHandler) Validate(snr *SessionNonceRequest, request *http.Request) (string, error) {
	return uh.Get(request)
}

func (uh *UsersCertificateHandler) Create(un *UserNonce, request *http.Request) (*UserNonce, error) {

	spkac := request.Form.Get("pubkey")
	if spkac == "" {
		return nil, errors.New("no spkac provided")
	}
	spkacDerBytes, err := base64.StdEncoding.DecodeString(spkac)
	if err != nil {
		return nil, errors.New(fmt.Sprintf("spkac invalid: %s", err))
	}

	publicKey, err := pkac.ParseSPKAC(spkacDerBytes)
	if err != nil {
		return nil, errors.New(fmt.Sprintf("unable to parse spkac: %s", err))
	}

	template, err := uh.makeTemplate(un.Userid)
	if err != nil {
		return nil, err
	}

	certDerBytes, err := x509.CreateCertificate(rand.Reader, template, uh.certificate, publicKey, uh.privateKey)
	if err != nil {
		return nil, errors.New(fmt.Sprintf("failed to create certificate: %s", err))
	}

	log.Println("Generated new certificate", un.Userid)
	un.SetResponse(certDerBytes, "application/x-x509-user-cert", http.Header{
		"Content-Length": {strconv.Itoa(len(certDerBytes))},
		"Accept-Ranges":  {"bytes"},
		"Last-Modified":  {time.Now().UTC().Format(http.TimeFormat)},
	})

	return un, nil

}

type UserNonce struct {
	Nonce       string `json:"nonce"`
	Userid      string `json:"userid"`
	UseridCombo string `json:"useridcombo"`
	Secret      string `json:"secret"`
	Timestamp   int64  `json:"timestamp"`
	Success     bool   `json:"success"`
	raw         []byte
	contentType string
	header      http.Header
}

func (un *UserNonce) SetResponse(raw []byte, contentType string, header http.Header) {
	un.raw = raw
	un.contentType = contentType
	un.header = header
}

func (un *UserNonce) Response() (int, interface{}, http.Header) {
	header := un.header
	if header == nil {
		header = http.Header{}
	}
	if un.contentType != "" {
		header.Set("Content-Type", un.contentType)
		return 200, un.raw, header
	} else {
		return 200, un, header
	}
}

type Users struct {
	hub     *Hub
	realm   string
	handler UsersHandler
}

func NewUsers(hub *Hub, mode, realm string, runtime phoenix.Runtime) *Users {

	var users = &Users{
		hub:   hub,
		realm: realm,
	}

	var handler UsersHandler
	var err error

	// Create handler based on mode.
	if handler, err = users.createHandler(mode, runtime); handler != nil && err == nil {
		users.handler = handler
		// Register handler Get at the hub.
		users.hub.useridRetriever = func(request *http.Request) (userid string, err error) {
			userid, err = handler.Get(request)
			if userid != "" {
				log.Printf("Users handler get success: %s\n", userid)
			}
			return
		}
		log.Printf("Enabled users handler '%s'\n", mode)
	} else if err != nil {
		log.Printf("Failed to enable handler '%s': %s\n", mode, err)
	}

	return users
}

func (users *Users) createHandler(mode string, runtime phoenix.Runtime) (handler UsersHandler, err error) {

	switch mode {
	case "sharedsecret":
		secret, _ := runtime.GetString("users", "sharedsecret_secret")
		if secret != "" {
			handler = &UsersSharedsecretHandler{secret: []byte(secret)}
		} else {
			err = errors.New("Cannot enable sharedsecret users handler: No secret.")
		}
	case "httpheader":
		headerName, _ := runtime.GetString("users", "httpheader_header")
		if headerName == "" {
			headerName = "x-users"
		}
		handler = &UsersHTTPHeaderHandler{headerName: headerName}
	case "certificate":
		var err2 error
		uh := &UsersCertificateHandler{}
		validForDays, _ := runtime.GetInt("users", "certificate_validForDays")
		if validForDays == 0 {
			validForDays = 365
		}
		uh.validFor = time.Duration(validForDays) * 24 * time.Hour
		keyFn, _ := runtime.GetString("users", "certificate_key")
		certificateFn, _ := runtime.GetString("users", "certificate_certificate")
		if keyFn != "" && certificateFn != "" {
			// Load private key from file and use it for signing,
			if uh.privateKey, err2 = loadX509PrivateKey(keyFn); err2 == nil {
				log.Printf("Users certificate private key loaded from %s\n", keyFn)
			} else {
				log.Printf("Failed to load certificate private key: %s\n", err2)
			}
		}
		if certificateFn != "" {
			// Load Certificate from file.
			var certificate tls.Certificate
			if certificate, err = loadX509Certificate(certificateFn); err == nil {
				// Parse first certificate in file.
				var certificates []*x509.Certificate
				if certificates, err = x509.ParseCertificates(certificate.Certificate[0]); err == nil {
					// Use first parsed certificate as CA.
					uh.certificate = certificates[0]
					log.Printf("Users certificate loaded from %s\n", certificateFn)
					handler = uh
					// Get TLS config if the server has one.
					if tlsConfig, err2 := runtime.TLSConfig(); err2 == nil {
						// Enable TLS client certificate authentication.
						tlsConfig.ClientAuth = tls.VerifyClientCertIfGiven
						// Create cert pool.
						pool := x509.NewCertPool()
						// Add CA certificate to pool for TLS client authentication.
						for _, derCert := range certificate.Certificate {
							cert, err2 := x509.ParseCertificate(derCert)
							if err2 != nil {
								continue
							}
							pool.AddCert(cert)
						}
						// Add pool to config.
						tlsConfig.ClientCAs = pool
						log.Printf("Initialized TLS auth pool with %d certificates.", len(pool.Subjects()))
					}
				}
			}
		} else {
			err = errors.New("Cannot enable certificate users handler: No certificate.")
		}
	}

	return

}

// Post is used to create new userids for this server.
func (users *Users) Post(request *http.Request) (int, interface{}, http.Header) {

	if users.handler == nil {
		return 404, "No handler found", http.Header{"Content-Type": {"text/plain"}}
	}

	var snr *SessionNonceRequest

	switch request.Header.Get("Content-Type") {
	case "application/json":
		snr = &SessionNonceRequest{}
		decoder := json.NewDecoder(request.Body)
		err := decoder.Decode(snr)
		if err != nil {
			return 400, NewApiError("users_bad_request", "Failed to parse request"), http.Header{"Content-Type": {"application/json"}}
		}
	case "application/x-www-form-urlencoded":
		snr = &SessionNonceRequest{
			Id:  request.Form.Get("id"),
			Sid: request.Form.Get("sid"),
		}
	default:
		return 400, NewApiError("users_invalid_request", "Invalid request type"), http.Header{"Content-Type": {"application/json"}}
	}

	// Make sure that we have a Sid.
	if snr.Sid == "" || snr.Id == "" {
		return 400, NewApiError("users_bad_request", "Incomplete request"), http.Header{"Content-Type": {"application/json"}}
	}

	// Do this before session validation to avoid timing information.
	userid := fmt.Sprintf("%s@%s", uuid.NewV4().String(), users.realm)

	// Make sure Sid matches session and is valid.
	if !users.hub.ValidateSession(snr.Id, snr.Sid) {
		return 403, NewApiError("users_invalid_session", "Invalid session"), http.Header{"Content-Type": {"application/json"}}
	}

	nonce, err := users.hub.sessiontokenHandler(&SessionToken{Id: snr.Id, Sid: snr.Sid, Userid: userid})
	if err != nil {
		return 400, NewApiError("users_request_failed", fmt.Sprintf("Error: %q", err)), http.Header{"Content-Type": {"application/json"}}
	}

	un, err := users.handler.Create(&UserNonce{Nonce: nonce, Userid: userid, Success: true}, request)
	if err != nil {
		return 400, NewApiError("users_create_failed", fmt.Sprintf("Error: %q", err)), http.Header{"Content-Type": {"application/json"}}
	}

	log.Printf("Users create successfull %s -> %s\n", snr.Id, un.Userid)
	return un.Response()

}
