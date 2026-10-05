import os
import sys
import tempfile

# Isolate the test suite from the development database before app import
_TEST_DB = os.path.join(tempfile.gettempdir(), "vendorguard_test.db")
if os.path.exists(_TEST_DB):
    os.remove(_TEST_DB)
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
