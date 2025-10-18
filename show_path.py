import sys, os
print(sys.executable)
print('PYTHONPATH=', os.getenv('PYTHONPATH'))
from pprint import pprint
pprint(sys.path)
try:
    import dotenv
    print('dotenv import OK')
except Exception as e:
    print('dotenv import fail:', e)
