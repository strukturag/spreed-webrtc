#!/bin/sh
#
# This script blocks all outbound and inbound DNS except DNS. If all UDP is
# blocked, the only way to do a peer to peer connection is with a TURN server
# which supports tcp.
#
# NOTE: this script requires Linux and must be run as root/sudo.
#
# (c)2016 struktur AG
# http://www.struktur.de

set -e
RETVAL=0

run() {
	set -x
	local mode=$1
	iptables $mode INPUT -p udp --sport 53 -j ACCEPT
	iptables $mode INPUT -p udp --dport 53 -j ACCEPT
	iptables $mode OUTPUT -p udp --sport 53 -j ACCEPT
	iptables $mode OUTPUT -p udp --dport 53 -j ACCEPT

	iptables $mode INPUT -p udp -j DROP
	iptables $mode OUTPUT -p udp -j DROP
	set +x
}

start() {
	run -A
}

stop() {
	set +e
	run -D
	set -e
}

case "$1" in
	start)
		start
		;;
	stop)
		stop
		;;
	*)
		echo "Usage: $0 [start|stop]"
		RETVAL=1
		;;
esac

exit $RETVAL
