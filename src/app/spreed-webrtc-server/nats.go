package main

import (
	"errors"
	"log"
	"time"

	"github.com/nats-io/nats"
)

var DefaultNatsEstablishTimeout = 60 * time.Second
var DefaultNatsURL = nats.DefaultURL

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
