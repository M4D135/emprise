#!/usr/bin/env python3
"""Run the current sandbox browser acceptance suite."""
import pathlib,runpy
runpy.run_path(str(pathlib.Path(__file__).with_name("sandbox-browser.py")),run_name="__main__")
