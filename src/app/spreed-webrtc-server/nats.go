package main

import (
	"errors"
	"log"
	"time"

	"github.com/nats-io/nats"
)

// DefaultNatsEstablishTimeout is the default timeout for
// calls to EstablishNatsConnection.
var DefaultNatsEstablishTimeout = 60 * time.Second

// DefaultNatsURL is the default NATS server URL used for
// calls to NewNatsConnection and EstablishNatsConnection.
var DefaultNatsURL = nats.DefaultURL

// NewNatsConnection creates a connetion to the default NATS server
// and tries to establish the connection. It returns the connection
// and any connection error encountered.
func NewNatsConnection() (*nats.EncodedConn, error) {
	nc, err := nats.Connect(DefaultNatsURL)
	if err != nil {
		return nil, err
	}
	ec, err := nats.NewEncodedConn(nc, nats.JSON_ENCODER)
	if err != nil {
		return nil, err
	}
	return ec, nil
}

// EstablishNatsConnection is a blocking way to create and establish
// connection to the default NATS server. The function will only return
// after a timeout has reached or a connection has been established. It
// returns the connection and and any timeout error encountered.
func EstablishNatsConnection(timeout *time.Duration) (*nats.EncodedConn, error) {
	if timeout == nil {
		timeout = &DefaultNatsEstablishTimeout
	}
	connch := make(chan *nats.EncodedConn, 1)
	errch := make(chan error, 1)
	go func() {
		notify := true
		for {
			ec, err := NewNatsConnection()
			if err == nil {
				connch <- ec
				break
			}
			switch err {
			case nats.ErrTimeout:
				fallthrough
			case nats.ErrNoServers:
				if notify {
					notify = false
					log.Println("Waiting for NATS server to become available")
				}
				time.Sleep(1 * time.Second)
				continue
			default:
				errch <- err
				break
			}
		}
	}()

	select {
	case conn := <-connch:
		return conn, nil
	case err := <-errch:
		return nil, err
	case <-time.After(*timeout):
		return nil, errors.New("NATS connection: timeout")
	}
}
