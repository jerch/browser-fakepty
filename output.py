import sys, os
sys.stdout = open('output.log', 'w')

while (True):
    sys.stdout.write(repr(os.read(sys.stdin.fileno(), 1024)))
    sys.stdout.flush()
