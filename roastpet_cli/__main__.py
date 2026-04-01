# -*- coding: utf-8 -*-
"""Allow running as: python -m roastpet_cli --token <token>"""
import sys
import os

# Add the package directory to sys.path so local imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from cli import prepare_env, main

if __name__ == "__main__":
    prepare_env()
    main()
