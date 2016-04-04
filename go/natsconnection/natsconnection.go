package natsconnection

import (
	"errors"
	"log"
	"time"

	"github.com/nats-io/nats"
)

// DefaultNatsEstablishTimeout is the default timeout for
// calls to EstablishNatsConnection.
var DefaultEstablishTimeout = 60 * time.Second

// DefaultNatsURL is the default NATS server URL used for
// calls to NewConnection and EstablishConnection.
var DefaultURL = nats.DefaultURL

// Connection implements the wrapped nats.Conn.
type Connection struct {
	*nats.Conn
}

// EncodedConnection implements the wrapped nats.EncodedConn.
type EncodedConnection struct {
	*nats.EncodedConn
}

// NewConnection creates a connetion to the default NATS server
// and tries to establish the connection. It returns the connection
// and any connection error encountered.
func NewConnection() (*Connection, error) {
	opts := &nats.Options{
		Url:            DefaultURL,
		AllowReconnect: true,
		MaxReconnect:   -1, // Reconnect forever.
		ReconnectWait:  nats.DefaultReconnectWait,
		Timeout:        nats.DefaultTimeout,
		PingInterval:   nats.DefaultPingInterval,
		MaxPingsOut:    nats.DefaultMaxPingOut,
		SubChanLen:     nats.DefaultMaxChanLen,
		ClosedCB: func(conn *nats.Conn) {
			log.Println("NATS connection closed")
		},
		DisconnectedCB: func(conn *nats.Conn) {
			log.Println("NATS disconnected")
		},
		ReconnectedCB: func(conn *nats.Conn) {
			log.Println("NATS reconnected")
		},
		AsyncErrorCB: func(conn *nats.Conn, sub *nats.Subscription, err error) {
			log.Println("NATS async error", sub, err)
		},
	}

	nc, err := opts.Connect()
	if err != nil {
		return nil, err
	}

	return &Connection{nc}, nil
}

// NewJSONEncodedConnection creates a JSON-encoded connetion to the
// default NATS server and tries to establish the connection. It
// returns the JSON-encoded connection and any connection error
// encountered.
func NewJSONEncodedConnection() (*EncodedConnection, error) {
	nc, err := NewConnection()
	if err != nil {
		return nil, err
	}
	ec, err := nats.NewEncodedConn(nc.Conn, nats.JSON_ENCODER)
	if err != nil {
		return nil, err
	}
	return &EncodedConnection{ec}, nil
}

// EstablishConnection is a blocking way to create and establish
// connection to the default NATS server. The function will only return
// after a timeout has reached or a connection has been established. It
// returns the connection and and any timeout error encountered.
func EstablishConnection(timeout *time.Duration) (*Connection, error) {
	if timeout == nil {
		timeout = &DefaultEstablishTimeout
	}
	connch := make(chan *Connection, 1)
	errch := make(chan error, 1)
	go func() {
		notify := true
		for {
			nc, err := NewConnection()
			if err == nil {
				connch <- nc
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

// EstablishJSONEncodedConnection is a blocking way to create and establish
// JSON-encoded connection to the default NATS server. The function will
// only return after a timeout has reached or a connection has been
// established. It returns the JSON-encoded connection and and any timeout
// error encountered.
func EstablishJSONEncodedConnection(timeout *time.Duration) (*EncodedConnection, error) {
	nc, err := EstablishConnection(timeout)
	if err != nil {
		return nil, err
	}
	ec, err := nats.NewEncodedConn(nc.Conn, nats.JSON_ENCODER)
	if err != nil {
		return nil, err
	}
	return &EncodedConnection{ec}, nil
}
