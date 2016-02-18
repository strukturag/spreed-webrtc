// +build freebsd

package main

// Rlimit values are int64 in FreeBSD.
// https://golang.org/src/syscall/ztypes_freebsd_amd64.go
// Intentionally signed, because of legacy code that uses -1 for
// RLIM_INFINITY.
func rlimitType(value int) int64 {
	return int64(value)
}
