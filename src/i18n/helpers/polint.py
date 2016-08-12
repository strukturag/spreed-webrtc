#!/usr/bin/python -u
#
# Helper script to check syntax of translation files.
#
# (c)2016 struktur AG
try:
    from collections import OrderedDict
except ImportError:
    OrderedDict = dict
import glob
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

def parsepo(fn):
    """
    Open po file and return a dict containing msgid as keys and msgstr as value.
    Return None on syntax errors, raise an exception on other errors.
    """
    data = OrderedDict()
    if isinstance(fn, basestring):
        with file(fn, 'rb') as fp:
            lines = fp.readlines()
    else:
        lines = fn.readlines()

    msgid = None
    msgstr = None
    default = None
    first = True
    lastline = None
    untranslated = []
    errors = 0

    # find end of header
    for line_number, line in enumerate(lines):
        try:
            line = unicode(line, 'utf-8')
        except UnicodeError:
            try:
                line = unicode(line, 'latin-1')
            except UnicodeError:
                errors += 1
                print >> sys.stderr, 'ERROR: Could not decode data in line %d: %r' % (line_number+1, line)
                continue

        if line[-2:] == '\r\n':
            errors += 1
            print >> sys.stderr, 'ERROR: line %d has Windoze line endings' % (line_number+1)
            line = line[:-2]

        if line[-1:] == '\n':
            line = line[:-1]

        if line != line.strip():
            errors += 1
            print >> sys.stderr, 'ERROR: line %d contains leading and/or trailing whitespaces' % (line_number+1)

        if line.startswith("msgid"):
            msgid = line.strip()[7:-1]
            msgstr = None
        elif line.startswith("msgstr"):
            msgstr = line.strip()[8:-1]
        elif line.startswith('"'):
            if msgstr is None:
                msgid += line.strip()[1:-1]
            elif msgstr is not None:
                msgstr += line.strip()[1:-1]
        elif line.startswith("#. Default: "):
            default = line.strip()[13:-1]
        elif line.startswith("#"):
            lastline = line
            continue
        elif not line:
            # blank line -> must be finished
            if msgid is None and msgstr is None:
                if lastline.startswith('#~'):
                    lastline = line
                    continue
                else:
                    errors += 1
                    print >> sys.stderr, 'ERROR: Got blank line in %d without msgstr or msgid.' % (line_number+1)
                    continue

            if first:
                # skip first occurance as this is the header
                first = False
                lastline = line
                continue

            if not msgstr:
                untranslated.append(msgid)

            # set data
            data[msgid] = (msgstr, default)
            msgid = msgstr = default = None

            lastline = line

    if msgid is not None and msgstr is not None:
        # add last line if not followed by empty line
        if not msgstr:
            untranslated.append(msgid)

        data[msgid] = (msgstr, default)
        msgid = msgstr = None

    if errors:
        return errors, data, untranslated

    return 0, data, untranslated

def check_translation(msgid, msgstr, default, value, language):
    if not default:
        default = msgid

    errors = 0
    if '  ' in value:
        errors += 1
        print >> sys.stderr, 'ERROR: Translation for %r contains too many whitespaces (%s)' % (msgid, value)

    start_quote = default and (default.startswith('\\"') or default.startswith('"') \
                          or default.startswith("'"))
    if value.startswith('\\"') and not start_quote:
        print >> sys.stderr, 'ERROR: Translation for %r starts with an " (%s)' % (msgid, value)
        value = value[2:]
        errors += 1
    elif value.startswith('"') and not start_quote:
        print >> sys.stderr, 'ERROR: Translation for %r starts with an " (%s)' % (msgid, value)
        value = value[1:]
        errors += 1

    end_quote = default and (default.endswith('\\"') or default.endswith('"') \
                        or default.endswith("'"))
    if value.endswith('\\"') and not end_quote:
        print >> sys.stderr, 'ERROR: Translation for %r ends with an " (%s)' % (msgid, value)
        value = value[:-2]
        errors += 1
    elif value.endswith('"') and not end_quote:
        print >> sys.stderr, 'ERROR: Translation for %r ends with an " (%s)' % (msgid, value)
        value = value[:-1]
        errors += 1

    leading_space = default and default.startswith(' ')
    if leading_space and not value.startswith(' '):
        print >> sys.stderr, 'ERROR: Translation for %r does not start with a leading whitespace (%s)' % (msgid, value)
        value = ' ' + value
        errors += 1
    elif not leading_space and value.startswith(' '):
        print >> sys.stderr, 'ERROR: Translation for %r starts with a leading whitespace (%s)' % (msgid, value)
        value = ' ' + value
        errors += 1

    if not language.startswith('zh') and not language.startswith('ko') and not language.startswith('ja'):
        # TODO(fancycode): Is it correct to skip for these languages?
        trailing_dot = default and default.endswith('.')
        if trailing_dot and not value.endswith('.'):
            print >> sys.stderr, 'ERROR: Translation for %r does not end with a tailing dot (%s)' % (msgid, value)
            value += '.'
            errors += 1

    punct = False
    for ch in ('.', ',', ';', ':', '?', '!', ')', ']'):
        if ' '+ch in value and not punct:
            if ch != '.' or not ' ..' in value:
                print >> sys.stderr, 'ERROR: Translation for %r contains invalid punctuation (%s)' % (msgid, value)
                punct = True
                errors += 1

            while ' '+ch+' ' in value:
                value = value.replace(' '+ch+' ', ch+' ')
            if value.endswith(' '+ch):
                value = value[:-1-len(ch)]+ch
    for ch in ('(', '['):
        if ch+' ' in value and not punct:
            print >> sys.stderr, 'ERROR: Translation for %r contains invalid punctuation (%s)' % (msgid, value)
            punct = True
            errors += 1

        while ' '+ch+' ' in value:
            value = value.replace(' '+ch+' ', ' '+ch)

    return errors

def main():
    _, POT_DATA, _ = parsepo(os.path.join(ROOT, 'messages.pot'))

    errors = 0
    try:
        sys.argv.remove('--hook')
    except ValueError:
        is_hook = False
    else:
        is_hook = True

    if is_hook:
        filename, orig_filename = sys.argv[1:]
        filenames = [filename]
    else:
        orig_filename = None
        filenames = sys.argv[1:]
    show_filenames = False
    if not filenames:
        filenames = glob.glob(os.path.join(ROOT, 'messages-*.po'))
        show_filenames = True
    for filename in filenames:
        if orig_filename:
            language = os.path.basename(orig_filename)[9:-3]
        else:
            language = os.path.basename(filename)[9:-3]
        if show_filenames:
            print 'Checking %s (%s)' % (filename, language)
        try:
            parse_errors, data, untranslated = parsepo(filename)
            if parse_errors:
                errors += parse_errors
        except Exception, e:
            print >> sys.stderr, 'ERROR: Could not parse (%s)' % (e)
            import traceback
            traceback.print_exc(file=sys.stderr)
            data = None

        if data is None:
            errors += 1
            continue

        file_errors = 0
        for msgid, (msgstr, default) in POT_DATA.iteritems():
            v = data.pop(msgid, None)
            if v is None or not v[0]:
                print >> sys.stderr, 'WARNING: Missing translation for %r' % (msgid)
                continue

            file_errors += check_translation(msgid, msgstr, default, v[0], language) or 0

        if show_filenames:
            print 'Found %d errors in %s' % (file_errors, filename)

        print
        errors += file_errors

    if errors:
        print >> sys.stderr, 'Found %d total errors' % (errors)
        return 1

    return 0

if __name__ == '__main__':
    import locale
    locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')
    sys.exit(main())
