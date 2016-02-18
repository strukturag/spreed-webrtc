// +build !freebsd

package main

// On Unix, rLimit values are uint64.
func rlimitType(value int) uint64 {
	return uint64(value)
}
