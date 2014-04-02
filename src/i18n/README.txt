Rebuild pot file from source (only do that on template or JavaScript changes)
	``make extract``

Merge po files with pot file (always do this before translating)
	``make update``

Create JavaScript translation fiels from po files (do this when finished translating)
	``make build``

Create a new translation (obvious)
	``cp messages.pot messages-$(ISO-639-1).po``
	Add new ISO-639-1 line to helpers/languages.py including translated language name.
	``make build``
