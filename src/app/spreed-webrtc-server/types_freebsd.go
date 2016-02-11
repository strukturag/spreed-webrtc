// Copyright 2013 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

// rlim_t converts an int to the OS specific type for rlim_t.  UNIX defines
// this to be uint64:
//   http://pubs.opengroup.org/onlinepubs/007904975/basedefs/sys/resource.h.html
// For legacy reasons FreeBSD defines this as int64:
//   https://github.com/freebsd/freebsd/blob/d1a65cb7ef2fa0cefbf00f16367a7ba99edc0457/sys/sys/_types.h#L55
func rlim_t(i int) int64 {
	return int64(i)
}
