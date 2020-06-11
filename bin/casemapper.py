from json import dumps
import string
from struct import pack
from base64 import b64encode, b64decode

LOWER = []
UPPER = []
EQUAL = []

for i in range(0x10FFFF + 1):
    c = unichr(i)
    upper = c.upper()
    lower = c.lower()
    if upper != c:
        llower = upper.lower()
        if llower == c:
            if c not in EQUAL:
                EQUAL.append(c)
        else:
            UPPER.append(c)
    if lower != c:
        uupper = lower.upper()
        if uupper == c:
            if lower not in EQUAL:
                EQUAL.append(lower)
        else:
            LOWER.append(c)

print 'EQUAL', len(EQUAL)
print 'LOWER', len(LOWER)
print 'UPPER', len(UPPER)

def listing2base64(l, func):
    highs = len(filter(lambda c: ord(c) > 0xFFFF, l))
    # make sure that the other case does not change bitwidth
    assert(highs == len(filter(lambda c: ord(func(c)) > 0xFFFF, l)))
    bmps = len(l) - highs

    # create strings
    high = ''
    bmp = ''
    for c in l:
        if ord(c) > 0xFFFF:
            high += pack('II', ord(c), ord(func(c)))
        else:
            if l == LOWER:
                print ord(c), ord(func(c))
            bmp += pack('HH', ord(c), ord(func(c)))
    if l == LOWER:
      print bmp, b64encode(bmp), b64decode(b64encode(bmp))
    return b64encode(bmp), b64encode(high)

EQUAL_BMP, EQUAL_HIGH = listing2base64(EQUAL, string.upper)
LOWER_BMP, LOWER_HIGH = listing2base64(LOWER, string.lower)
UPPER_BMP, UPPER_HIGH = listing2base64(UPPER, string.upper)

with open('casemappings.json', 'w') as f:
    f.write(dumps({
        'BMP': {
            'EQUAL': EQUAL_BMP,
            'LOWER': LOWER_BMP,
            'UPPER': UPPER_BMP
        },
        'HIGH': {
            'EQUAL': EQUAL_HIGH,
            'LOWER': LOWER_HIGH,
            'UPPER': UPPER_HIGH
        }
    }, indent=4, sort_keys=True))
print 'casemappings.json created.'
